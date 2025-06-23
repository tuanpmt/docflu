# DocuFlu CLI Development Context

## 📋 Tóm tắt dự án
- **Tên**: DocuFlu CLI - Docusaurus to Confluence Sync
- **Mục tiêu**: CLI tool đồng bộ markdown files từ Docusaurus lên Confluence
- **Trạng thái**: ✅ Bước đầu tiên hoàn thành - có thể sync 1 file markdown

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
│       └── config.js              # Load .env configuration ✅
├── test/
│   └── test-basic.js              # Basic test file ✅
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
  "ora": "^5.4.1"             // Spinner loading (v5 for CommonJS)
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
node bin/docuflu.js sync --file docusaurus-example/docs/intro.md
# ✅ SUCCESS: Updated page ID 45514832
# ✅ URL: https://f8a.atlassian.net/pages/viewpage.action?pageId=45514832
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

## 📁 Files đã tạo và nội dung

### 1. `/bin/docuflu.js` - CLI Entry Point
- Commander.js setup với sync command
- Option `-f, --file <path>` và `--dry-run`
- Error handling và colored output

### 2. `/lib/core/markdown-parser.js` - Markdown Parser
- Sử dụng markdown-it để convert MD → HTML
- Parse frontmatter với gray-matter
- Extract title từ frontmatter hoặc first heading
- Basic Confluence Storage Format conversion (code blocks)

### 3. `/lib/core/confluence-client.js` - Confluence API Client
- Axios-based REST API wrapper
- Authentication với Basic Auth (username + API token)
- Methods: testConnection, findPageByTitle, createPage, updatePage
- Error handling với detailed messages

### 4. `/lib/core/config.js` - Configuration Loader
- Load .env files với dotenv
- Validate required environment variables
- Create sample .env file method
- Support cho optional settings

### 5. `/lib/commands/sync.js` - Sync Command Logic
- Main sync workflow với ora spinner
- Steps: load config → validate file → parse markdown → connect Confluence → sync
- Support dry-run mode với preview
- Detailed success/error reporting

### 6. `/test/test-basic.js` - Basic Testing
- Test markdown parser với docusaurus-example file
- Validate parsing results
- Console output với results preview

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

# Sync single file
node bin/docuflu.js sync --file path/to/file.md

# Dry run (preview only)
node bin/docuflu.js sync --file path/to/file.md --dry-run

# Test với docusaurus example
node bin/docuflu.js sync --file docusaurus-example/docs/intro.md
```

## ✅ Features đã hoàn thành

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

## 🎯 Next Steps (chưa implement)

### Phase 2: Enhanced Features
1. **Multiple files sync**: `docuflu sync --docs`, `docuflu sync --blog`
2. **Directory scanning**: Auto-detect Docusaurus structure  
3. **Hierarchy mapping**: Parent-child page relationships
4. **State management**: `.docuflu/sync-state.json` tracking
5. **Image processing**: Upload và link images
6. **Advanced markdown**: Admonitions, tabs, mermaid diagrams

### Phase 3: Production Ready
1. **Global installation**: `npm install -g docuflu`
2. **Init command**: `docuflu init` setup wizard
3. **Status command**: `docuflu status` sync state review
4. **Concurrency**: Parallel uploads với rate limiting
5. **Retry logic**: Exponential backoff cho failed requests
6. **Rollback**: Undo changes nếu sync fail

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

**🚧 TRONG TƯƠNG LAI**: Multi-file sync, hierarchy, state management, images

## 📞 Contact/Support Info

- Confluence instance: https://f8a.atlassian.net
- Test space: Core CEX
- Last successful sync: Page ID 45514832 (Tutorial Intro)
- Development environment: Node.js v23.5.0, macOS
