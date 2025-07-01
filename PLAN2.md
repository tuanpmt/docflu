# PLAN 2: docflu CLI - Docusaurus to Google Docs Sync

> **🎯 CURRENT STATUS**: ✅ **Phase 2 COMPLETED** - OAuth2 + Text + Table + Image Sync  
> **📅 Updated**: 2025-07-01  
> **🚀 NEXT**: Phase 3 - Links & Attachments Processing

## 📊 Project Overview

### Goals
- **CLI Tool**: `docflu sync --gdocs` - Sync Docusaurus to Google Docs
- **Direction**: 1-way sync (Markdown → Google Docs)
- **Authentication**: OAuth2 Desktop App with browser approval
- **Output**: Single Google Docs document with rich formatting

### Current Project Structure ✅ PHASE 2 COMPLETE
```
docflu/                        # CLI package (120KB+ total for gdocs/)
├── bin/
│   └── docflu.js             # ✅ CLI entry point with --gdocs support
├── lib/
│   ├── commands/
│   │   ├── sync.js           # Confluence sync command (18KB)
│   │   ├── sync_gdocs.js     # ✅ Google Docs sync command (4.3KB)
│   │   └── init.js           # ✅ OAuth setup command (4.6KB)
│   ├── core/
│   │   ├── gdocs/            # ✅ Google Docs implementation (120KB+)
│   │   │   ├── google-docs-sync.js        # ✅ Main orchestrator (53KB, 1512 lines)
│   │   │   ├── google-docs-converter.js   # ✅ Markdown converter (18KB, 610 lines)
│   │   │   ├── google-docs-client.js      # ✅ API client (13KB, 410 lines)
│   │   │   ├── google-docs-state.js       # ✅ State management (7KB, 307 lines)
│   │   │   ├── table-converter.js         # ✅ Table logic (6.3KB, 222 lines)
│   │   │   ├── backup.js                  # ✅ Backup system (20KB, 712 lines)
│   │   │   ├── gdocs-image-processor.js   # ✅ Image orchestrator (15KB, 461 lines)
│   │   │   ├── diagram-processor.js       # ✅ Google Docs diagrams (12KB, 350 lines)
│   │   │   ├── image-processor.js         # ✅ Google Docs images (10KB, 300 lines)
│   │   │   ├── google-drive-client.js     # ✅ Google Drive API (18KB, 520 lines)
│   │   │   ├── README.md                  # ✅ Documentation (9.2KB, 303 lines)
│   │   │   └── DEBUG.md                   # ✅ Debug guide (9.1KB, 339 lines)
│   │   ├── config.js                      # ✅ OAuth config (2.9KB)
│   │   ├── docusaurus-scanner.js          # ✅ Reused (7.2KB)
│   │   ├── state-manager.js               # ✅ Reused (5.8KB)
│   │   ├── image-processor.js             # ✅ Confluence version (7.9KB, 259 lines)
│   │   ├── diagram-processor.js           # ✅ Confluence version (36KB, 1030 lines)
│   │   └── mermaid-processor.js           # ✅ Confluence version (12KB, 368 lines)
│   ├── docs/
│   │   └── features/
│   │       └── gdocs/
│   │           └── image-processing.md    # ✅ Complete documentation (25KB, 758 lines)
│   └── test/
│       └── gdocs/            # ✅ Complete test suite (35KB+)
│           ├── test-converter.js          # ✅ Converter tests (9.9KB, 272 lines)
│           ├── test-sync.js               # ✅ Sync tests (8.4KB, 269 lines)
│           ├── test-image-processing.js   # ✅ Image tests (8KB, 250 lines)
│           ├── test-image-debug.js        # ✅ Debug tests (6KB, 180 lines)
│           └── test-all-gdocs.js          # ✅ Integration tests (3KB, 80 lines)
```

### Available Commands ✅
```bash
# OAuth2 Setup
docflu init --gdocs

# Single File Sync (Replace Mode)
docflu sync --gdocs --file path/to/file.md

# Batch Sync (Append Mode)  
docflu sync --gdocs --docs

# Dry Run
docflu sync --gdocs --dry-run
```

## ✅ PHASE 1 COMPLETED (12/20 Features)

### 🔐 Authentication System
- ✅ **OAuth2 Flow**: Authorization Code with PKCE
- ✅ **Browser Integration**: Auto-open consent page
- ✅ **Token Management**: Storage, refresh, validation
- ✅ **Error Handling**: Comprehensive auth error recovery

### 📝 Content Conversion Engine
- ✅ **Text Processing**: Headings, paragraphs, lists, code blocks
- ✅ **Inline Formatting**: Bold, italic, inline code with proper colors
- ✅ **Table Conversion**: Native Google Docs tables with 2-step architecture
- ✅ **Complex Tables**: Support for 11x11, 6x12+ structures
- ✅ **100% Automation**: No manual intervention required

### 🔄 Sync Architecture
- ✅ **Single File Mode (`--file`)**: Replace entire document content
- ✅ **Batch Mode (`--docs`)**: Sequential append with clear option
- ✅ **Multi-Document**: Index tracking for proper positioning
- ✅ **Scoped Formatting**: Preserve existing content formatting
- ✅ **Incremental Sync**: Only process changed files

### 📊 Performance & Reliability
- ✅ **Batch Operations**: Efficient Google Docs API usage
- ✅ **Error Recovery**: Retry with exponential backoff
- ✅ **State Tracking**: Document IDs, timestamps, sync status
- ✅ **Performance**: 463 cell requests in 15-20 seconds
- ✅ **Success Rate**: 100% on production tests

## ✅ PHASE 2 COMPLETED (8/8 Features)

### 🖼️ Image Processing (COMPLETED)
- ✅ **Local Images**: PNG, JPG, GIF, SVG upload to Google Drive with SHA256 caching
- ✅ **Remote Images**: Download and re-upload external images with caching
- ✅ **Mermaid Diagrams**: Render syntax to PNG and insert as native images
- ✅ **HTML Images**: Process `<img>` tags with full attribute extraction
- ✅ **SVG Conversion**: Automatic SVG to PNG conversion using Sharp
- ✅ **Native Image Insertion**: Direct Google Docs API image insertion with unique placeholders
- ✅ **Debug System**: Comprehensive debug files with phase tracking
- ✅ **Google Drive Integration**: Complete API integration with folder management

### 🔗 Content Organization
- ❌ **Internal Links**: Not feasible (Google Docs API limitation)
- ❌ **Content Separation**: Alternative to tab hierarchy needed
- ❌ **Document Structure**: Better organization strategy required

## ❌ PHASE 3 PENDING (4/4 Features)

### 🔗 Links & Attachments Processing (HIGH PRIORITY)
- ❌ **External Links**: Convert `[text](url)` to Google Docs Link API format
- ❌ **Local Attachments**: Upload files to Google Drive and convert to links
- ❌ **Link Formatting**: Preserve link text with proper URL association
- ❌ **File Type Support**: PDF, JSON, ZIP, MP3, MP4, and other common formats

## 🚀 PHASE 2 IMPLEMENTATION PLAN

### Dependencies Implemented ✅
```json
{
  "implemented_dependencies": {
    "@mermaid-js/mermaid-cli": "^10.6.1",    // ✅ Mermaid rendering (CLI-based)
    "sharp": "^0.33.5",                      // ✅ Image processing & SVG conversion
    "mime-types": "^2.1.35",                 // ✅ File type detection
    "crypto": "built-in",                    // ✅ SHA256 hashing for caching
    "axios": "^1.6.0"                        // ✅ Remote image downloads
  },
  "google_api_scopes": [
    "https://www.googleapis.com/auth/documents",      // ✅ Google Docs access
    "https://www.googleapis.com/auth/drive.file"      // ✅ Google Drive image upload
  ]
}
```

### Implementation Completed ✅
1. **✅ Google Drive Integration**: Complete API client with folder management and caching
2. **✅ Image Detection**: Scan markdown for images, HTML img tags, and Mermaid blocks
3. **✅ Mermaid Renderer**: Convert syntax to PNG using @mermaid-js/mermaid-cli
4. **✅ Image Processor**: Handle local/remote image processing with Google Drive upload
5. **✅ Document Integration**: Insert native images into Google Docs with unique placeholders
6. **✅ Testing Suite**: Comprehensive image processing and debug test suites

### Files Created ✅
```
lib/core/gdocs/
├── google-drive-client.js     # ✅ Google Drive API for image storage (18KB, 520 lines)
├── gdocs-image-processor.js   # ✅ Image processing orchestrator (15KB, 461 lines)
├── diagram-processor.js       # ✅ Google Docs diagram processor (12KB, 350 lines)
├── image-processor.js         # ✅ Google Docs image processor (10KB, 300 lines)
└── docs/features/gdocs/
    └── image-processing.md    # ✅ Complete documentation (25KB, 758 lines)
```

### Integration Completed ✅
- **✅ `google-docs-sync.js`**: Added complete image processing pipeline with native insertion
- **✅ `google-docs-converter.js`**: Enhanced to detect and handle image placeholders
- **✅ `google-docs-client.js`**: Added Google Drive API scope and permission handling

## 🚀 PHASE 3 IMPLEMENTATION PLAN

### Link & Attachment Processing Strategy

#### 1. Link Detection & Classification
```javascript
// Detect different link types in markdown
const linkPatterns = {
  external: /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,           // [text](http://...)
  localFile: /\[([^\]]+)\]\(\/files\/([^)]+)\)/g,           // [text](/files/...)
  relativePath: /\[([^\]]+)\]\(\.\/([^)]+)\)/g,             // [text](./file.pdf)
  docusaurusPath: /\[([^\]]+)\]\(\/([^)]+)\)/g              // [text](/path/file.ext)
};
```

#### 2. Google Docs Link API Integration
```javascript
// Convert to Google Docs Link API format
const linkRequest = {
  updateTextStyle: {
    textStyle: {
      link: {
        url: "https://example.com"
      },
      foregroundColor: {
        color: {
          rgbColor: {
            blue: 1.0,
            green: 0.0,
            red: 0.0
          }
        }
      },
      underline: true
    },
    range: {
      startIndex: 100,
      endIndex: 110
    },
    fields: "link,foregroundColor,underline"
  }
};
```

#### 3. Attachment Upload Strategy
```javascript
// Local file processing workflow
async processLocalAttachment(linkText, filePath, markdownFilePath) {
  // 1. Resolve absolute path
  const absolutePath = this.resolveAttachmentPath(filePath, markdownFilePath);
  
  // 2. Upload to Google Drive
  const uploadResult = await this.googleDriveClient.uploadAttachment(absolutePath);
  
  // 3. Create Google Docs link
  return {
    text: linkText,
    url: uploadResult.publicUrl,
    fileName: uploadResult.fileName,
    fileType: uploadResult.mimeType
  };
}
```

### Required Implementation Files

#### New Files to Create
```
lib/core/gdocs/
├── link-processor.js          # Link detection and processing
├── attachment-processor.js    # File upload and link conversion
└── docs/features/gdocs/
    └── link-processing.md     # Complete documentation
```

#### Files to Modify
```
lib/core/gdocs/
├── google-docs-sync.js        # Add link processing pipeline
├── google-docs-converter.js   # Add link conversion logic
├── google-drive-client.js     # Add attachment upload methods
└── google-docs-state.js       # Track uploaded attachments
```

### Link Processing Examples

#### Input Markdown
```markdown
# Documentation Links

## External Links
- [Visit our website](http://localhost:3000/my-markdown-page)
- [GitHub Repository](https://github.com/user/repo)

## File Downloads
- [Configuration File](/files/config.json)
- [Sample PDF Document](/files/sample-document.pdf)
- [Project Template](./assets/project-template.zip)

## Media Files
- [Sample Audio](/files/sample.mp3)
- [Demo Video](/files/demo.mp4)
```

#### Processing Logic
```javascript
// 1. External Links - Process as-is
{
  type: 'external',
  text: 'Visit our website',
  url: 'http://localhost:3000/my-markdown-page',
  action: 'convert_to_google_docs_link'
}

// 2. Local Attachments - Upload to Google Drive
{
  type: 'local_attachment',
  text: 'Configuration File',
  originalPath: '/files/config.json',
  resolvedPath: '/project/static/files/config.json',
  action: 'upload_to_drive_then_convert_to_link'
}
```

#### Expected Google Docs Output
```
External Links:
- Visit our website (clickable blue underlined link)
- GitHub Repository (clickable blue underlined link)

File Downloads:
- Configuration File (clickable link to Google Drive file)
- Sample PDF Document (clickable link to Google Drive file)
- Project Template (clickable link to Google Drive file)
```

### Dependencies & API Requirements

#### Google Docs API Features
```javascript
// Text styling with links
updateTextStyle: {
  textStyle: {
    link: { url: "..." },
    foregroundColor: { color: { rgbColor: { blue: 1.0 } } },
    underline: true
  }
}
```

#### Google Drive API Extensions
```javascript
// File upload with public permissions
await drive.files.create({
  resource: {
    name: fileName,
    parents: [attachmentFolderId]
  },
  media: {
    mimeType: mimeType,
    body: fs.createReadStream(filePath)
  }
});

// Set public permissions for link access
await drive.permissions.create({
  fileId: fileId,
  resource: {
    role: 'reader',
    type: 'anyone'
  }
});
```

### Testing Strategy

#### Test Cases
```bash
# Test link processing
node test/gdocs/test-link-processing.js

# Test attachment upload
node test/gdocs/test-attachment-processing.js

# Test integrated sync with links
DEBUG_GDOCS_CONVERTER=true node ./bin/docflu.js sync --file test-links.md --gdocs
```

#### Mock Test Data
```markdown
# Test Document

[External Link](https://example.com)
[Local PDF](/files/test.pdf)
[Relative File](./assets/config.json)
```

### State Management Extensions

#### Attachment Cache Structure
```json
{
  "googleDrive": {
    "imageFolderId": "1abc123",
    "attachmentFolderId": "2def456",
    "uploadedAttachments": {
      "sha256hash": {
        "url": "https://drive.google.com/uc?id=...",
        "fileId": "3ghi789",
        "fileName": "config.json",
        "mimeType": "application/json",
        "size": 1024,
        "uploadedAt": "2024-07-01T10:30:45.123Z"
      }
    }
  }
}
```

### Performance Optimizations

#### Batch Link Processing
```javascript
// Process all links in single batch operation
const linkRequests = links.map(link => ({
  insertText: { text: link.text },
  updateTextStyle: { 
    textStyle: { link: { url: link.url } },
    range: { startIndex: link.startIndex, endIndex: link.endIndex }
  }
}));
```

#### Attachment Caching
- **SHA256 Hashing**: Prevent duplicate uploads
- **MIME Type Detection**: Automatic file type handling
- **Folder Organization**: Separate folders for images vs attachments
- **State Persistence**: Track uploads across sync sessions

## 🧪 Current Test Results

### Production Test Commands
```bash
# Single file with complex tables and images
DEBUG_GDOCS_CONVERTER=true node ./bin/docflu.js sync --file ../docusaurus-exam/docs/intro.md --gdocs

# Batch sync with multiple documents
DEBUG_GDOCS_CONVERTER=true node ./bin/docflu.js sync ../docusaurus-exam/ --docs --gdocs

# Test image processing specifically
node test/gdocs/test-image-processing.js

# Test image debug functionality
node test/gdocs/test-image-debug.js
```

### Verified Results ✅
- **Single File**: 7 tables processed, 83 cell requests, 100% success
- **Batch Mode**: 11 documents, 13 tables, 463 cell requests, 100% success
- **Image Processing**: 3 images + 2 diagrams processed, 5 native images inserted, 100% success
- **Mermaid Diagrams**: PNG generation and Google Drive upload working
- **HTML Images**: `<img>` tag processing with full attribute extraction
- **Performance**: 15-20 seconds for full batch processing
- **Reliability**: Zero failed documents in production tests

## ⚙️ Configuration

### Environment Setup
```bash
# .env file
GOOGLE_CLIENT_ID=your-oauth2-client-id.googleusercontent.com
GOOGLE_DOCUMENT_TITLE=Documentation

# Optional settings
docflu_EXCLUDE_PATTERNS=*.draft.md,private/**
docflu_RETRY_COUNT=3
DEBUG_GDOCS_CONVERTER=true  # Enable detailed logging
```

## 🎯 Success Criteria

### Phase 1 ✅ COMPLETED
- [x] OAuth2 authentication with browser flow
- [x] Complete text and table conversion
- [x] Multi-document sync capability
- [x] Production-ready performance

### Phase 2 ✅ COMPLETED
- [x] Google Drive API integration
- [x] Image upload and insertion
- [x] Mermaid diagram rendering
- [x] 100% automated media handling

### Phase 3 🎯 TARGET
- [ ] External link processing with Google Docs Link API
- [ ] Local attachment upload to Google Drive
- [ ] Link text formatting and URL handling
- [ ] File type detection and MIME handling

## 📋 Current Limitations

### Google Docs API Constraints
1. **Tab Hierarchy**: Not supported, single document approach required
2. **Internal Links**: Cannot link between sections within document
3. **Content Organization**: Limited structural options

### Implementation Gaps (Phase 3)
1. **Link Processing**: External links converted to plain text, no clickable links
2. **Attachment Handling**: Local files not uploaded to Google Drive
3. **Link Formatting**: No blue underlined link styling in Google Docs

## 🔄 Dependencies Status

### Currently Installed ✅
```json
{
  "googleapis": "^128.0.0",           // Google Docs & Drive APIs
  "google-auth-library": "^9.15.1",  // OAuth2 with PKCE
  "open": "^8.4.2",                  // Cross-platform browser opener
  "axios": "^1.6.0",                 // HTTP requests for remote images
  "mime-types": "^2.1.35",           // File type detection
  "fs-extra": "^11.1.1",             // Enhanced file operations
  "crypto": "built-in"               // SHA256 hashing for caching
}
```

### Phase 2 Optional Dependencies ✅ IMPLEMENTED
```json
{
  "optionalDependencies": {
    "@mermaid-js/mermaid-cli": "^10.6.1",    // ✅ Mermaid rendering (CLI-based)
    "sharp": "^0.33.5"                       // ✅ Image processing & SVG conversion
  }
}
```

**Note**: These are optional dependencies. If not installed, the system gracefully degrades:
- **Without @mermaid-js/mermaid-cli**: Mermaid diagrams remain as text
- **Without sharp**: SVG images uploaded as-is with warning

---

**🎯 SUMMARY**: 
- **Phase 1 ✅**: OAuth2, text, table sync hoàn chỉnh
- **Phase 2 ✅**: Image processing, Mermaid diagrams, Google Drive integration hoàn chỉnh  
- **Phase 3 🎯**: Links & attachments processing - Convert `[text](url)` to clickable Google Docs links, upload local files to Google Drive 