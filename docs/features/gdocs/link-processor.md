# Google Docs Link & Attachment Processor Implementation

## Overview

The Link & Attachment Processor is a comprehensive system that handles external links and local file attachments during Google Docs synchronization. It processes markdown links, uploads local attachments to Google Drive, and applies proper link formatting in Google Docs.

## Architecture

### Core Components

1. **LinkProcessor** (`lib/core/gdocs/link-processor.js`)
   - Main orchestrator for link and attachment processing
   - Handles external links and local file detection
   - Coordinates with AttachmentProcessor for file uploads

2. **AttachmentProcessor** (`lib/core/gdocs/attachment-processor.js`)
   - Specialized handler for uploading local files to Google Drive
   - Supports unlimited file types with comprehensive MIME type detection
   - Implements caching and deduplication

3. **GoogleDriveClient** (Enhanced)
   - Unified folder management (`docflu-files-xxx` instead of `docflu-images-xxx`)
   - Shared storage for both images and attachments

4. **GoogleDocsSync** (Enhanced)
   - Integrated link processing pipeline
   - Combined formatting requests for efficiency

## Features

### Link Types Supported

- **External Links**: `[text](https://example.com)`
- **Local Files**: `[text](/files/document.pdf)`
- **Relative Files**: `[text](./assets/file.zip)`

### Advanced Processing Features

- **Multiple File References**: Supports different text references to the same file (e.g., "Download Config" and "`config.json`" both linking to same file)
- **2-Phase Link Processing**: Separates text replacement and link formatting for better reliability
- **Deduplication Logic**: Groups same files with different text references to avoid conflicts
- **Text Corruption Prevention**: Advanced index management prevents overlapping replacements

### File Type Support

The system supports unlimited file types including:

#### Documents
- PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
- TXT, MD, JSON, XML, CSV, RTF

#### Archives
- ZIP, RAR, 7Z, TAR, GZ, BZ2

#### Media Files
- Audio: MP3, WAV, FLAC, AAC
- Video: MP4, AVI, MOV, WMV, FLV, WEBM

#### Development Files
- JS, TS, CSS, HTML, PY, JAVA, CPP, C, PHP, RB, GO, RS
- SQL, SH, BAT, PS1

#### Data Files
- YAML, YML, TOML, INI, CONF, LOG

#### Other Formats
- EPUB, MOBI, ISO, DMG, EXE, MSI, DEB, RPM, APK

## Implementation Details

### Processing Pipeline

1. **Content Analysis**
   ```javascript
   if (this.containsLinks(processedContent)) {
     const linkResult = await this.linkProcessor.processLinks(processedContent, filePath);
     processedContent = linkResult.processedMarkdown;
     linkRequests = linkResult.linkRequests;
   }
   ```

2. **Link Detection & Deduplication**
   - External links: `https?://` patterns
   - Local files: `/files/` or `./` patterns
   - **Deduplication**: Groups links by `text|normalizedURL` to handle multiple references
   - **URL Normalization**: Converts `/files/config.json` and `/config.json` to same `config.json`
   - Placeholder generation with unique identifiers

3. **Attachment Upload**
   - File hash generation for deduplication
   - Session and persistent caching
   - Google Drive upload with public permissions
   - Download URL generation

4. **2-Phase Link Processing**
   - **Phase 1**: Text replacement using `replaceAllText` API
   - **Phase 2**: Link formatting using `updateTextStyle` API
   - **Index Safety**: Text verification prevents corruption from overlapping replacements

### Folder Management

#### Unified Storage
- **Folder Name**: `docflu-files-{timestamp}`
- **Shared Usage**: Both images and attachments
- **Location**: Google Drive root
- **Permissions**: Public read access

#### Caching Strategy

**Session Cache**
```javascript
this.uploadedImages.set(fileHash, uploadResult);
```

**Persistent Cache**
```javascript
uploadedAttachments: {
  [fileHash]: {
    url: downloadUrl,
    fileId: file.data.id,
    fileName: uploadFileName,
    originalName: path.basename(filePath),
    mimeType: mimeType,
    size: file.data.size,
    hash: fileHash,
    uploadedAt: new Date().toISOString()
  }
}
```

### Link Processing Workflow

#### Phase 1: Detection, Deduplication and Placeholder Creation
```javascript
// Multiple references to same file:
// [Download Config](/files/config.json) → [[[LINK_0]]]
// [`config.json`](/files/config.json) → [[[LINK_0]]] (same placeholder)

// Deduplication logic:
const linkKey = `${link.text}|${normalizedUrl}`;
if (!textToLinkGroup.has(linkKey)) {
  const placeholder = `[[[LINK_${placeholderCounter}]]]`;
  // Group all occurrences under same placeholder
}
```

#### Phase 2: File Upload (for attachments)
```javascript
const uploadResult = await this.attachmentProcessor.uploadAttachment(link.absolutePath);
```

#### Phase 3: 2-Phase Google Docs Integration

**Phase 3.1: Text Replacement**
```javascript
// Replace all placeholders with text using replaceAllText API
{
  replaceAllText: {
    containsText: {
      text: "[[[LINK_0]]]",
      matchCase: true
    },
    replaceText: "Download Config"
  }
}
```

**Phase 3.2: Link Formatting**
```javascript
// Apply link formatting after text is replaced
{
  updateTextStyle: {
    textStyle: {
      link: { url: linkRequest.url },
      foregroundColor: { color: { rgbColor: { blue: 1.0, green: 0.0, red: 0.0 } } },
      underline: true
    },
    range: { startIndex: position.startIndex, endIndex: position.endIndex },
    fields: "link,foregroundColor,underline"
  }
}
```

#### Advanced Safety Features
```javascript
// Text verification prevents corruption
const actualText = processedMarkdown.substring(startIndex, endIndex);
if (actualText !== originalText) {
  console.warn(`Text mismatch: expected "${originalText}", found "${actualText}"`);
  continue; // Skip this replacement to avoid corruption
}
```

## Configuration

### Environment Variables
- `DEBUG_GDOCS_CONVERTER=true`: Enable detailed debug logging

### File Path Resolution
```javascript
// Absolute path resolution
const absolutePath = path.isAbsolute(link.url) 
  ? link.url 
  : path.resolve(path.dirname(filePath), link.url);
```

## Error Handling

### Graceful Degradation
- Missing files: Warning logged, link kept as text
- Upload failures: Retry mechanism with fallback
- Network issues: Cached results when available

### Debug Information
```javascript
if (process.env.DEBUG_GDOCS_CONVERTER === 'true') {
  console.log(`🔗 Processing link: ${link.text} → ${link.url}`);
  console.log(`📎 Upload result: ${uploadResult.cached ? 'cached' : 'new'}`);
}
```

## Integration Points

### GoogleDocsSync Integration
```javascript
// Initialize link processor
this.linkProcessor = new LinkProcessor(this.driveClient, this.projectRoot);

// Process links in both append and replace modes
const linkResult = await this.linkProcessor.processLinks(processedContent, filePath);

// Combined formatting (text + links)
const allFormattingRequests = [...textRequests, ...linkRequests];
```

### State Management
```javascript
// Update state with attachment info
await this.stateManager.updateState({
  googleDrive: {
    ...currentState.googleDrive,
    filesFolderId: this.imageFolderId,
    uploadedAttachments: {
      ...currentState.googleDrive?.uploadedAttachments,
      [fileHash]: uploadResult
    }
  }
});
```

## Performance Optimizations

### Batch Processing
- **2-Phase Approach**: Separates text replacement and formatting for reliability
- **replaceAllText API**: Avoids complex index calculations and prevents content loss
- **Deduplication**: Reduces duplicate processing for same files with multiple references
- Single batch update for all formatting operations

### Caching
- File hash-based deduplication
- Session cache for immediate reuse
- Persistent cache across sync sessions

### Error Recovery
- **Text Verification**: Prevents corruption by verifying text before replacement
- **Graceful Skipping**: Skips problematic replacements instead of failing entire batch
- Fallback to text format on formatting failures
- Comprehensive error logging with detailed context

## Statistics and Monitoring

### Processing Stats
```javascript
{
  externalLinks: 5,
  attachmentsFound: 3,
  attachmentsUploaded: 2,
  attachmentsCached: 1,
  duplicateReferences: 4,  // Multiple references to same files
  uniqueLinkRequests: 6,   // After deduplication
  errors: []
}
```

### Debug Output
```
🔗 Processing links and attachments...
📎 Uploading attachment: ./docs/manual.pdf
🔄 Found 10 total links, deduplicated to 6 unique requests
📝 Phase 1: 6/6 text replacements successful
🔗 Phase 2: 6/6 link formatting successful
✅ Link processing complete: 2 external links, 4 attachments (2 uploaded, 2 cached)
```

## Usage Examples

### Basic Markdown with Links
```markdown
# Documentation

Visit our [GitHub repository](https://github.com/company/project) for source code.

Download the [User Manual](./files/manual.pdf) for detailed instructions.

You can also reference the manual as [`manual.pdf`](./files/manual.pdf).

See the [API Reference](https://api.example.com/docs) for integration details.
```

### Result in Google Docs
- External links: Properly formatted with blue color and underline
- Local attachments: Uploaded to Google Drive and linked once, referenced multiple times
- Multiple references: Same file linked with different text (e.g., "User Manual" and "`manual.pdf`")
- All links: Clickable and functional without text corruption

## Troubleshooting

### Common Issues

1. **File Not Found**
   - Check file path relative to markdown file
   - Ensure file exists and is readable

2. **Upload Failures**
   - Verify Google Drive permissions
   - Check network connectivity
   - Review file size limits

3. **Text Corruption or Missing Content**
   - **Cause**: Multiple references to same file creating overlapping replacements
   - **Solution**: System now uses 2-phase processing with deduplication
   - **Debug**: Check for "Text mismatch" warnings in logs

4. **Link Formatting Issues**
   - Enable debug mode for detailed logs
   - Check placeholder generation and replacement
   - Verify Google Docs API permissions
   - Review Phase 1 (text replacement) and Phase 2 (formatting) logs separately

### Debug Commands
```bash
# Enable debug mode
DEBUG_GDOCS_CONVERTER=true node ./bin/docflu.js sync --file docs/example.md --gdocs

# Check processed content
cat .docusaurus/debug/gdocs-link-processor/link-processing-*.json
```

## Future Enhancements

### Planned Features
- [x] **2-Phase Link Processing** - Completed: Separates text replacement and formatting
- [x] **Multiple File References** - Completed: Supports different text references to same file
- [x] **Advanced Deduplication** - Completed: Groups links by text+URL to prevent conflicts
- [ ] Link validation and health checking
- [ ] Automatic link text extraction from target pages
- [ ] Support for internal document cross-references
- [ ] Link analytics and usage tracking
- [ ] Bulk attachment management interface

### Integration Opportunities
- [ ] Confluence-style page linking
- [ ] Automatic table of contents generation
- [ ] Cross-document reference resolution
- [ ] Link preview generation

## Related Documentation

- [Image Processing Implementation](./image-processing.md)
- [Google Docs Sync Overview](../../../README.md)
- [Configuration Guide](../../../GOOGLE_OAUTH_SETUP.md)
- [Implementation Plan](../../../PLAN2.md) 