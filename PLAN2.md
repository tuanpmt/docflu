# PLAN 2: docflu CLI - Docusaurus to Google Docs Sync

> **🎯 CURRENT STATUS**: ✅ **Phase 1 COMPLETED** - OAuth2 + Text + Table Sync  
> **📅 Updated**: 2025-01-27  
> **🚀 NEXT**: Phase 2 - Image Processing (Mermaid, Charts, Images)

## 📊 Project Overview

### Goals
- **CLI Tool**: `docflu sync --gdocs` - Sync Docusaurus to Google Docs
- **Direction**: 1-way sync (Markdown → Google Docs)
- **Authentication**: OAuth2 Desktop App with browser approval
- **Output**: Single Google Docs document with rich formatting

### Current Project Structure ✅ IMPLEMENTED
```
docflu/                        # CLI package (53.2KB total for gdocs/)
├── bin/
│   └── docflu.js             # ✅ CLI entry point with --gdocs support
├── lib/
│   ├── commands/
│   │   ├── sync.js           # Confluence sync command (18KB)
│   │   ├── sync_gdocs.js     # ✅ Google Docs sync command (4.3KB)
│   │   └── init.js           # ✅ OAuth setup command (4.6KB)
│   ├── core/
│   │   ├── gdocs/            # ✅ Google Docs implementation (53.2KB)
│   │   │   ├── google-docs-sync.js        # ✅ Main orchestrator (53KB, 1512 lines)
│   │   │   ├── google-docs-converter.js   # ✅ Markdown converter (18KB, 610 lines)
│   │   │   ├── google-docs-client.js      # ✅ API client (13KB, 410 lines)
│   │   │   ├── google-docs-state.js       # ✅ State management (7KB, 307 lines)
│   │   │   ├── table-converter.js         # ✅ Table logic (6.3KB, 222 lines)
│   │   │   ├── backup.js                  # ✅ Backup system (20KB, 712 lines)
│   │   │   ├── README.md                  # ✅ Documentation (9.2KB, 303 lines)
│   │   │   └── DEBUG.md                   # ✅ Debug guide (9.1KB, 339 lines)
│   │   ├── config.js                      # ✅ OAuth config (2.9KB)
│   │   ├── docusaurus-scanner.js          # ✅ Reused (7.2KB)
│   │   ├── state-manager.js               # ✅ Reused (5.8KB)
│   │   ├── image-processor.js             # ⚠️ Not integrated (7.9KB, 259 lines)
│   │   ├── diagram-processor.js           # ⚠️ Not integrated (36KB, 1030 lines)
│   │   └── mermaid-processor.js           # ⚠️ Not integrated (12KB, 368 lines)
│   └── test/
│       └── gdocs/            # ✅ Complete test suite (21.3KB)
│           ├── test-converter.js          # ✅ Converter tests (9.9KB, 272 lines)
│           ├── test-sync.js               # ✅ Sync tests (8.4KB, 269 lines)
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

## ❌ PHASE 2 PENDING (8/20 Features)

### 🖼️ Image Processing (HIGH PRIORITY)
- ❌ **Local Images**: PNG, JPG, GIF, SVG upload to Google Drive
- ❌ **Remote Images**: Download and re-upload external images
- ❌ **Mermaid Diagrams**: Render syntax to PNG and insert
- ❌ **Chart Processing**: Convert code blocks to visual diagrams

### 🔗 Content Organization
- ❌ **Internal Links**: Not feasible (Google Docs API limitation)
- ❌ **Content Separation**: Alternative to tab hierarchy needed
- ❌ **Document Structure**: Better organization strategy required

## 🚀 PHASE 2 IMPLEMENTATION PLAN

### Required Dependencies
```json
{
  "new_dependencies": {
    "puppeteer": "^21.0.0",        // Mermaid rendering engine
    "sharp": "^0.32.0",            // Image processing & conversion
    "mime-types": "^2.1.35"        // File type detection
  },
  "google_api_scopes": [
    "https://www.googleapis.com/auth/documents",      // Current
    "https://www.googleapis.com/auth/drive.file"      // NEW: Image upload
  ]
}
```

### Implementation Strategy
1. **Google Drive Integration**: Setup API client for image storage
2. **Image Detection**: Scan markdown for images and Mermaid blocks
3. **Mermaid Renderer**: Convert syntax to PNG using Puppeteer
4. **Image Processor**: Handle local/remote image processing
5. **Document Integration**: Insert images into Google Docs
6. **Testing Suite**: Comprehensive image processing tests

### New Files to Create
```
lib/core/gdocs/
├── google-drive-client.js     # Google Drive API for image storage
├── gdocs-image-processor.js   # Image processing for Google Docs
├── mermaid-renderer.js        # Mermaid diagram rendering
└── media-converter.js         # Media format conversion utilities
```

### Integration Points
- **Existing Files to Modify**:
  - `google-docs-sync.js`: Add image processing pipeline
  - `google-docs-converter.js`: Detect and handle images/diagrams
  - `google-docs-client.js`: Add Google Drive API methods

## 🧪 Current Test Results

### Production Test Commands
```bash
# Single file with complex tables
DEBUG_GDOCS_CONVERTER=true node ./bin/docflu.js sync --file ../docusaurus-exam/docs/intro.md --gdocs

# Batch sync with multiple documents
DEBUG_GDOCS_CONVERTER=true node ./bin/docflu.js sync ../docusaurus-exam/ --docs --gdocs
```

### Verified Results ✅
- **Single File**: 7 tables processed, 83 cell requests, 100% success
- **Batch Mode**: 11 documents, 13 tables, 463 cell requests, 100% success
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

### Phase 2 🎯 TARGET
- [ ] Google Drive API integration
- [ ] Image upload and insertion
- [ ] Mermaid diagram rendering
- [ ] 100% automated media handling

## 📋 Current Limitations

### Google Docs API Constraints
1. **Tab Hierarchy**: Not supported, single document approach required
2. **Internal Links**: Cannot link between sections within document
3. **Content Organization**: Limited structural options

### Implementation Gaps
1. **Image Processing**: Existing processors not integrated with Google Docs
2. **Mermaid Support**: Rendering exists but not connected to Google Docs
3. **Media Handling**: No Google Drive integration yet

## 🔄 Dependencies Status

### Currently Installed ✅
```json
{
  "googleapis": "^128.0.0",           // Google Docs & Drive APIs
  "google-auth-library": "^9.4.0",   // OAuth2 with PKCE
  "open": "^8.4.0"                   // Cross-platform browser opener
}
```

### Phase 2 Requirements ❌
```json
{
  "puppeteer": "^21.0.0",     // Mermaid rendering
  "sharp": "^0.32.0",         // Image processing
  "mime-types": "^2.1.35"     // File type detection
}
```

---

**🎯 SUMMARY**: Phase 1 hoàn thành với OAuth2, text/table sync hoàn chỉnh. Phase 2 tập trung vào image processing để tích hợp các processor hiện có với Google Docs API. 