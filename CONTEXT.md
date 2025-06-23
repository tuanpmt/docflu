# DocuFlu CLI Development Context

## 📋 Tóm tắt dự án
- **Tên**: DocuFlu CLI - Docusaurus to Confluence Sync
- **Mục tiêu**: CLI tool đồng bộ markdown files từ Docusaurus lên Confluence
- **Trạng thái**: ✅ Phase 2 hoàn thành - Multi-file sync với hierarchy support

## 🗂️ Cấu trúc dự án đã tạo

```
docuflu/
├── bin/
│   └── docuflu.js                  # CLI entry point ✅
├── lib/
│   ├── commands/
│   │   └── sync.js                 # Sync command logic ✅  
│   └── core/
│       ├── confluence-client.js    # Confluence API wrapper ✅
│       ├── markdown-parser.js      # Markdown to Confluence converter ✅
│       ├── config.js              # Load .env configuration ✅
│       ├── image-processor.js      # Image upload & processing ✅
│       ├── docusaurus-scanner.js   # Docusaurus project scanner ✅
│       └── state-manager.js       # .docuflu/ state management ✅
├── test/
│   ├── test-basic.js              # Basic markdown parser test ✅
│   ├── test-hierarchy.js          # Hierarchy structure test ✅
│   └── test-nested-hierarchy.js   # Nested hierarchy test ✅
├── docusaurus-example/            # Test data từ examples/
├── package.json                   # Dependencies ✅
├── env.example                    # Configuration template ✅
└── PLAN.md                       # Original plan file ✅
```

## 🔧 Dependencies đã cài đặt

```json
{
  "axios": "^1.6.0",           // Confluence API calls
  "markdown-it": "^13.0.1",   // Markdown parsing  
  "gray-matter": "^4.0.3",    // Frontmatter parsing
  "fs-extra": "^11.1.1",      // File operations
  "commander": "^9.4.1",      // CLI framework
  "chalk": "^4.1.2",          // Colored output (v4 for CommonJS)
  "dotenv": "^16.3.1",        // Environment variables
  "ora": "^5.4.1",            // Spinner loading (v5 for CommonJS)
  "form-data": "^4.0.0",      // Image upload support ✅
  "mime-types": "^2.1.35"     // MIME type detection ✅
}
```

## 📝 Changes từ PLAN.md ban đầu

### 1. Dependencies Updates
- ❌ `confluence-api: ^1.7.0` (không hoạt động, package cũ)
- ✅ `axios: ^1.6.0` (thay thế để call Confluence REST API)
- ✅ `chalk: ^4.1.2` (downgrade cho CommonJS compatibility) 
- ✅ `ora: ^5.4.1` (downgrade cho CommonJS compatibility)

### 2. Architecture Changes
- **Confluence Client**: Sử dụng axios thay vì confluence-api package
- **REST API Endpoints**: 
  - Space info: `/wiki/rest/api/space/{spaceKey}`
  - Search pages: `/wiki/rest/api/content/search`
  - Create page: `/wiki/rest/api/content`
  - Update page: `/wiki/rest/api/content/{pageId}`
  - Get children: `/wiki/rest/api/content/{pageId}/child/page`
  - Upload attachment: `/wiki/rest/api/content/{pageId}/child/attachment`

## 🧪 Testing đã thực hiện

### 1. Markdown Parser Test
```bash
npm test
# ✅ Parse docusaurus-example/docs/intro.md thành công
# ✅ Extract title: "Tutorial Intro"  
# ✅ Content length: 2034 characters
# ✅ Frontmatter: {"sidebar_position": 1}
```

### 2. CLI Commands Test
```bash
node bin/docuflu.js --help           # ✅ Show help
node bin/docuflu.js sync --help      # ✅ Show sync options
node bin/docuflu.js sync --file docusaurus-example/docs/intro.md --dry-run  # ✅ Dry run
```

### 3. Live Confluence Sync Test  
```bash
# Single file sync
node bin/docuflu.js sync --file docusaurus-example/docs/intro.md
# ✅ SUCCESS: Updated page ID 45514832
# ✅ URL: https://f8a.atlassian.net/pages/viewpage.action?pageId=45514832

# Multi-file docs sync (Phase 2)
node bin/docuflu.js sync --docs
# ✅ SUCCESS: 8 processed, 7 created, 1 updated, 0 skipped, 0 failed

# Incremental sync test
node bin/docuflu.js sync --docs  
# ✅ SUCCESS: 0 processed, 8 skipped (no changes detected)
```

## 🐛 Issues đã fix

### 1. Package Compatibility Issues
- **Lỗi**: `confluence-api@^1.7.0` không tồn tại
- **Fix**: Thay bằng `axios` và implement REST API calls manually

### 2. ESM/CommonJS Issues  
- **Lỗi**: `chalk.red is not a function` (chalk v5+ dùng ESM)
- **Fix**: Downgrade `chalk: ^4.1.2`
- **Lỗi**: `ora is not a function` (ora v6+ dùng ESM)  
- **Fix**: Downgrade `ora: ^5.4.1`

### 3. Confluence API Version Issue
- **Lỗi**: `Cannot read properties of undefined (reading 'number')`
- **Fix**: Thêm `expand: 'version'` trong search query
- **Fix**: Thêm safety check `existingPage.version?.number || 1`

### 4. Image Path Resolution Issue (Phase 2)
- **Lỗi**: Docusaurus absolute paths `/img/docusaurus.png` không resolve được
- **Fix**: Auto-detect Docusaurus project root từ `docusaurus.config.ts`
- **Fix**: Convert `/img/...` → `{projectRoot}/static/img/...`

### 5. Method Missing Issue (Phase 2)
- **Lỗi**: `parser.parseMarkdown is not a function`
- **Fix**: Thêm `parseMarkdown()` method vào MarkdownParser class

## 📁 Files đã tạo và nội dung

### 1. `/bin/docuflu.js` - CLI Entry Point
- Commander.js setup với sync command
- Options: `-f, --file <path>`, `--docs`, `--blog`, `--dry-run`
- Error handling và colored output
- Help messages với examples

### 2. `/lib/core/markdown-parser.js` - Markdown Parser
- Sử dụng markdown-it để convert MD → HTML
- Parse frontmatter với gray-matter
- Extract title từ frontmatter hoặc first heading
- Basic Confluence Storage Format conversion (code blocks)
- `parseFile()` method cho single file parsing
- `parseMarkdown()` method cho direct content parsing

### 3. `/lib/core/confluence-client.js` - Confluence API Client
- Axios-based REST API wrapper
- Authentication với Basic Auth (username + API token)
- Methods: testConnection, findPageByTitle, createPage, updatePage
- **Hierarchy Support**: findOrCreateParentPage, getPageChildren
- **Context-aware Search**: findPageByTitleAndParent
- **Title Formatting**: formatCategoryTitle
- Error handling với detailed messages

### 4. `/lib/core/config.js` - Configuration Loader
- Load .env files với dotenv
- Validate required environment variables
- Create sample .env file method
- Support cho optional settings

### 5. `/lib/commands/sync.js` - Sync Command Logic
- **Single File Sync**: `syncFile()` function
- **Multi-file Sync**: `syncDocs()` và `syncBlog()` functions
- **Hierarchy Building**: Pre-create parent pages trước khi sync documents
- **State-aware Processing**: Incremental sync với change detection
- Main sync workflow với ora spinner
- Support dry-run mode với preview
- Detailed success/error reporting với statistics

### 6. `/test/test-basic.js` - Basic Testing
- Test markdown parser với docusaurus-example file
- Validate parsing results
- Console output với results preview

### 7. `/lib/core/image-processor.js` - Image Processor ✅
- Extract images từ markdown với regex
- Upload images lên Confluence attachments API
- Convert HTML img tags → Confluence format  
- Cache uploaded images để tránh duplicates
- Handle both local files và external URLs
- **Docusaurus Path Resolution**: Auto-detect project root cho `/img/...` paths
- Two-stage process: create page → upload images → update page

### 8. `/lib/core/docusaurus-scanner.js` - Docusaurus Scanner ✅
- **Project Detection**: Auto-detect từ `docusaurus.config.ts`
- **Recursive Scanning**: Scan docs/ và blog/ directories
- **Frontmatter Parsing**: Extract metadata với gray-matter
- **Hierarchy Building**: Build parent-child relationships từ directory structure
- **Statistics**: Document counting và categorization
- **Filtering**: Support exclude patterns

### 9. `/lib/core/state-manager.js` - State Manager ✅
- **State Persistence**: `.docuflu/sync-state.json` management
- **Change Detection**: Track file modifications cho incremental sync
- **Page Tracking**: Store Confluence page IDs và metadata
- **Statistics Tracking**: Created, updated, skipped, failed counts
- **Cleanup**: Remove orphaned page references

## 🔑 Environment Variables Required

```bash
# Required
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@domain.com  
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=DOC

# Optional
CONFLUENCE_ROOT_PAGE_TITLE=Documentation
DOCUFLU_EXCLUDE_PATTERNS=*.draft.md,private/**
DOCUFLU_CONCURRENT_UPLOADS=5
DOCUFLU_RETRY_COUNT=3
```

## 🚀 CLI Usage hiện tại

```bash
# Help
node bin/docuflu.js --help
node bin/docuflu.js sync --help

# Single file sync
node bin/docuflu.js sync --file path/to/file.md
node bin/docuflu.js sync --file path/to/file.md --dry-run

# Multi-file sync (Phase 2)
node bin/docuflu.js sync --docs                    # Sync all docs/
node bin/docuflu.js sync --docs --dry-run          # Preview docs sync
node bin/docuflu.js sync --blog                    # Sync all blog/ (placeholder)

# Test với docusaurus example
node bin/docuflu.js sync --file docusaurus-example/docs/intro.md
cd docusaurus-example && node ../bin/docuflu.js sync --docs
```

## ✅ Features đã hoàn thành

### Phase 1: Single File Sync
1. **CLI Framework**: Commander.js setup với options
2. **Markdown Parsing**: markdown-it + gray-matter cho frontmatter  
3. **Confluence Integration**: REST API với axios
4. **Authentication**: Basic Auth với API token
5. **File Validation**: Check file exists và .md extension
6. **Content Conversion**: Basic HTML → Confluence Storage Format
7. **Page Management**: Create new hoặc update existing pages
8. **Error Handling**: Detailed error messages và recovery
9. **Dry Run Mode**: Preview changes không thực sự sync
10. **Configuration**: .env file support với validation
11. **🖼️ Image Processing**: Upload local images + convert to Confluence format

### Phase 2: Multi-file Sync với Hierarchy
12. **🗂️ Docusaurus Scanner**: Auto-detect project structure và scan directories
13. **📊 State Management**: `.docuflu/sync-state.json` cho incremental sync
14. **🌳 Hierarchy Support**: Parent-child page relationships theo folder structure
15. **🔄 Multi-file Sync**: `--docs` option sync toàn bộ docs/ directory
16. **📈 Statistics Tracking**: Detailed sync reports (created, updated, skipped, failed)
17. **🧪 Comprehensive Testing**: Hierarchy tests với nested directory support

## 🧪 Hierarchy Testing Results

### Basic Hierarchy Structure
```
📁 Tutorial Basics (45514927)
   ├── 📄 Create a Page (46629257)
   ├── 📄 Create a Document (46563779)
   ├── 📄 Create a Blog Post (46629298)
   ├── 📄 Deploy your site (46629318)
   └── 📄 Congratulations! (45514960)

📁 Tutorial Extras (46530976)
   ├── 📄 Manage Docs Versions (46530993)
   └── 📄 Translate your site (46629286)
```

### Nested Hierarchy Structure
```
📁 Advanced (46629342)
   └── 📁 Concepts (46629359)
      └── 📄 Advanced Concepts (45514993)
```

### Test Commands
```bash
# Test basic hierarchy
node test/test-hierarchy.js
# ✅ All parent-child relationships verified

# Test nested hierarchy  
node test/test-nested-hierarchy.js
# ✅ Deep nested structure (Advanced/Concepts/Advanced Concepts) verified

# Test incremental sync
node bin/docuflu.js sync --docs  # First run: 8 processed
node bin/docuflu.js sync --docs  # Second run: 8 skipped (no changes)
```

## 🎯 Next Steps (Phase 3)

### Enhanced Features
1. **Blog Sync Implementation**: Complete `syncBlog()` function
2. **Advanced Markdown Features**: Admonitions, tabs, mermaid diagrams
3. **Global Installation**: npm publish và global CLI usage
4. **Init Command**: `docuflu init` để setup project
5. **Status Command**: `docuflu status` để xem sync status
6. **Advanced Markdown**: Support Docusaurus-specific syntax
7. **Performance Optimization**: Concurrent uploads và rate limiting
8. **CI/CD Integration**: GitHub Actions workflow examples

## 📊 Current Status Summary

**✅ Phase 1 Complete**: Single file sync với image processing  
**✅ Phase 2 Complete**: Multi-file sync với hierarchy support  
**🎯 Phase 3 Next**: Blog sync, advanced features, global installation

**Total Files Created**: 9 core files + 3 test files  
**Total Features**: 17 implemented features  
**Test Coverage**: Basic parser, hierarchy structure, nested hierarchy  
**Production Ready**: ✅ Có thể sync Docusaurus projects lên Confluence với proper hierarchy

## 🧠 Lessons Learned

1. **Package compatibility**: Check ESM/CommonJS trước khi dùng
2. **Confluence API**: REST API documentation đôi khi không đầy đủ, phải test actual responses
3. **Error handling**: Cần detailed error messages để debug
4. **Version management**: Confluence pages cần version number cho updates
5. **Search API**: Cần `expand` parameter để get đầy đủ data

## 📊 Current Status

**✅ HOÀN THÀNH**: CLI có thể parse 1 file markdown và sync lên Confluence thành công
- Parse markdown với frontmatter ✅
- Convert sang Confluence format ✅  
- Connect đến Confluence ✅
- Create/update pages ✅
- Error handling ✅
- Dry run mode ✅
- **🖼️ Image processing**: Upload local images + convert format ✅

**🚧 TRONG TƯƠNG LAI**: Multi-file sync, hierarchy, state management

## 📞 Contact/Support Info

- Confluence instance: https://f8a.atlassian.net
- Test space: Core CEX
- Last successful sync: Page ID 45514832 (Tutorial Intro)
- Development environment: Node.js v23.5.0, macOS
