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

#### Phase 1: Detection and Placeholder Creation
```javascript
// Each link gets unique placeholder (no grouping by text to avoid conflicts):
// [Download Config](/files/config.json) → [[[LINK_0]]]
// [`config.json`](/files/config.json) → [[[LINK_1]]]
// [themeConfig](/files/config.json) → [[[LINK_2]]]

// Unique placeholder logic:
for (const linkRequest of sortedRequests) {
  const placeholder = `[[[LINK_${placeholderCounter}]]]`;
  linkRequestMap.set(placeholder, {
    text: link.text,
    url: finalUrl,
    placeholder: placeholder,
    // ... other properties
  });
  placeholderCounter++;
}
```

#### Phase 2: File Upload (for attachments)
```javascript
const uploadResult = await this.attachmentProcessor.uploadAttachment(link.absolutePath);
```

#### Phase 3: Combined Google Docs Integration (Single-Phase)

**Enhanced Approach: Exact Placeholder Positioning**
```javascript
// Find exact position of each placeholder before processing
const positions = this.findAllTextOccurrences(placeholder, textElements);
const position = positions[0]; // Exact placeholder position

// Combined operation: delete placeholder + insert text + apply formatting
const requests = [
  // 1. Delete the placeholder
  {
    deleteContentRange: {
      range: {
        startIndex: position.startIndex,
        endIndex: position.endIndex
      }
    }
  },
  // 2. Insert replacement text
  {
    insertText: {
      location: { index: position.startIndex },
      text: replacementText
    }
  },
  // 3. Apply link formatting to inserted text
  {
    updateTextStyle: {
      textStyle: {
        link: { url: linkRequest.url },
        foregroundColor: { color: { rgbColor: { blue: 1.0, green: 0.0, red: 0.0 } } },
        underline: true
      },
      range: {
        startIndex: position.startIndex,
        endIndex: position.startIndex + replacementText.length
      },
      fields: "link,foregroundColor,underline"
    }
  }
];
```

#### Key Improvements: Duplicate Text Handling
```javascript
// OLD PROBLEM: Multiple "themeConfig" text in document
// - themeConfig at position X (correct link)
// - themeConfig at position Y (wrong position gets formatting)

// NEW SOLUTION: Exact placeholder positioning
// 1. Find exact position of [[[LINK_N]]] placeholder
// 2. Replace only that specific placeholder
// 3. Apply formatting to exact replacement position
// 4. No text search conflicts with existing content
```

#### Advanced Safety Features
```javascript
// Reverse order processing prevents index shifting
const sortedRequests = [...linkRequests].sort((a, b) => {
  const posA = placeholderPositions.get(a.placeholder);
  const posB = placeholderPositions.get(b.placeholder);
  return posB.startIndex - posA.startIndex; // Reverse order
});

// Position verification before processing
if (positions.length > 0) {
  const position = positions[0];
  console.log(`Found placeholder "${placeholder}" at position ${position.startIndex}-${position.endIndex}`);
} else {
  console.warn(`Could not find placeholder: ${placeholder}`);
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
- **Single-Phase Approach**: Combines placeholder deletion, text insertion, and formatting in one batch
- **Exact Positioning**: Eliminates text search conflicts by using precise placeholder positions
- **Reverse Processing**: Processes placeholders in reverse order to prevent index shifting
- **Reduced API Calls**: Single batch update for all link operations (3 requests per link)

### Caching
- File hash-based deduplication
- Session cache for immediate reuse
- Persistent cache across sync sessions

### Error Recovery
- **Position Verification**: Verifies placeholder existence before processing
- **Graceful Skipping**: Skips missing placeholders instead of failing entire batch
- **Index Safety**: Reverse order processing prevents index corruption
- Comprehensive error logging with detailed context

## Statistics and Monitoring

### Processing Stats
```javascript
{
  externalLinks: 5,
  attachmentsFound: 3,
  attachmentsUploaded: 2,
  attachmentsCached: 1,
  uniqueLinkRequests: 8,   // Each link gets unique placeholder
  errors: []
}
```

### Debug Output
```
🔗 Processing links and attachments...
📎 Uploading attachment: ./docs/manual.pdf
🔄 Found 8 links, creating 8 unique placeholders
📝 Phase 1: Found 8/8 placeholders, created 24 combined requests
✅ Link processing complete: 2 external links, 6 attachments (2 uploaded, 4 cached)
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

3. **Link Formatting Applied to Wrong Position** ✅ **FIXED**
   - **Old Issue**: When document contains multiple instances of same text (e.g., "themeConfig"), link formatting could be applied to wrong occurrence
   - **Root Cause**: System searched for text after replacement instead of using exact placeholder positions
   - **Solution**: Enhanced to use exact placeholder positioning with combined operations
   - **Result**: Each link now formatted at its exact placeholder position, eliminating text conflicts

4. **Link Formatting Issues**
   - Enable debug mode for detailed logs
   - Check placeholder generation and positioning
   - Verify Google Docs API permissions
   - Review combined operation logs (delete + insert + format)

5. **Missing Placeholders**
   - **Symptom**: Warning "Could not find placeholder: [[[LINK_N]]]"
   - **Cause**: Placeholder was not properly inserted or was corrupted
   - **Debug**: Check Phase 1 placeholder insertion logs
   - **Solution**: Verify markdown link syntax and file paths

### Debug Commands
```bash
# Enable debug mode
DEBUG_GDOCS_CONVERTER=true node ./bin/docflu.js sync --file docs/example.md --gdocs

# Check processed content
cat .docusaurus/debug/gdocs-link-processor/link-processing-*.json
```

### Debug Output Analysis
```
🐛 Found placeholder "[[[LINK_0]]]" at position 123-135
🐛 Will replace with "config.json" and format as link to https://drive.google.com/...
🔗 Link formatting: "config.json" → https://drive.google.com/... (123-134)
```

## Future Enhancements

### Planned Features
- [x] **Single-Phase Link Processing** - Completed: Combines deletion, insertion, and formatting in one batch
- [x] **Exact Placeholder Positioning** - Completed: Eliminates duplicate text conflicts
- [x] **Unique Placeholders** - Completed: Each link gets unique placeholder to prevent conflicts
- [x] **Duplicate Text Handling** - Completed: Fixed issues with multiple instances of same text
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