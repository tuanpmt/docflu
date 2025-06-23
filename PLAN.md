# PLAN: DocuFlu CLI - Docusaurus to Confluence Sync

## 1. Phân tích yêu cầu cụ thể

### 1.1 Mục tiêu
- **CLI Tool**: `docuflu` - command line interface
- **Command**: `docuflu sync` - đồng bộ Docusaurus lên Confluence  
- **Direction**: 1-way sync (Markdown → Confluence), có thể mở rộng 2-way sau
- **Config**: `.env` file ở thư mục gốc cho cấu hình
- **State**: `.docuflu/` folder để lưu thông tin đồng bộ
- **Auto-detect**: Tự động phát hiện Docusaurus project structure

### 1.2 Input/Output
- **Input**: Docusaurus project (`docs/`, `blog/`, `docusaurus.config.ts`)
- **Output**: Confluence pages với hierarchy tương ứng
- **State Management**: Track sync status, timestamps, page IDs trong `.docuflu/`

## 2. Architecture và Design

### 2.1 CLI Structure
```
docuflu/                        # Global CLI package
├── bin/
│   └── docuflu.js             # CLI entry point
├── lib/
│   ├── commands/
│   │   ├── sync.js            # docuflu sync command
│   │   ├── init.js            # docuflu init command  
│   │   └── status.js          # docuflu status command
│   ├── core/
│   │   ├── confluence-client.js    # Confluence API wrapper
│   │   ├── markdown-parser.js      # Markdown to Confluence converter
│   │   ├── docusaurus-scanner.js   # Scan Docusaurus structure
│   │   ├── state-manager.js        # Manage .docuflu/ state
│   │   └── config.js              # Load .env configuration
│   └── utils/
│       ├── logger.js          # Colored logging
│       └── validators.js      # Input validation
└── package.json               # CLI dependencies
```

### 2.2 Project Structure (User's Docusaurus)
```
my-docusaurus-site/
├── .env                       # Confluence config
├── .docuflu/                  # Sync state directory
│   ├── sync-state.json       # Page mappings, timestamps
│   ├── cache/                # Cached data
│   └── logs/                 # Sync logs
├── docs/                     # Docusaurus docs
├── blog/                     # Docusaurus blog  
├── docusaurus.config.ts      # Docusaurus config
└── package.json
```

### 2.3 Data Flow
```
docuflu sync → Load .env → Scan Docusaurus → Parse Markdown → Confluence API → Update .docuflu/
```

## 3. Technical Implementation

### 3.1 CLI Package Setup
```bash
# Global installation
npm install -g docuflu

# Or local project usage  
npx docuflu sync
```

### 3.2 Dependencies
```json
{
  "name": "docuflu",
  "version": "1.0.0",
  "bin": {
    "docuflu": "./bin/docuflu.js"
  },
  "dependencies": {
    "confluence-api": "^1.7.0",
    "marked": "^4.3.0", 
    "gray-matter": "^4.0.3",
    "fs-extra": "^11.1.1",
    "commander": "^9.4.1",
    "chalk": "^5.2.0",
    "dotenv": "^16.3.1",
    "ora": "^6.3.1"
  }
}
```

### 3.3 Core Features

#### 3.3.1 CLI Commands
- `docuflu init` - Setup .env và .docuflu/ 
- `docuflu sync` - Đồng bộ toàn bộ
- `docuflu sync --docs` - Chỉ sync docs/
- `docuflu sync --blog` - Chỉ sync blog/
- `docuflu status` - Xem trạng thái sync
- `docuflu --help` - Hiển thị help

#### 3.3.2 Docusaurus Scanner
- Auto-detect Docusaurus project từ docusaurus.config.ts
- Scan recursive thư mục `docs/` và `blog/`
- Parse frontmatter và metadata với gray-matter
- Build hierarchy tree từ sidebars.ts
- Detect changes so với .docuflu/sync-state.json

#### 3.3.3 Markdown Parser
- Convert markdown to Confluence Storage Format
- Handle Docusaurus-specific syntax (admonitions, code blocks)
- Process images, links, internal references
- Preserve formatting và structure

#### 3.3.4 State Management
- Track page IDs, timestamps trong .docuflu/sync-state.json
- Cache processed content để optimize performance
- Log sync history để debugging

### 3.4 Configuration

#### 3.4.1 .env File (User's Project Root)
```bash
# Confluence Configuration
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@domain.com  
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=DOC
CONFLUENCE_ROOT_PAGE_TITLE=Documentation

# Optional Settings
DOCUFLU_EXCLUDE_PATTERNS=*.draft.md,private/**
DOCUFLU_CONCURRENT_UPLOADS=5
DOCUFLU_RETRY_COUNT=3
```

#### 3.4.2 .docuflu/sync-state.json (Auto-generated)
```json
{
  "lastSync": "2025-01-27T10:30:00Z",
  "pages": {
    "docs/intro.md": {
      "confluenceId": "123456789",
      "lastModified": "2025-01-27T10:25:00Z",
      "title": "Introduction",
      "parentId": "987654321"
    }
  },
  "stats": {
    "totalPages": 25,
    "created": 5,
    "updated": 3,
    "skipped": 17
  }
}
```

## 4. Implementation Steps (AI-Assisted)

### Phase 1: CLI Foundation (Ngày 1 - Sáng)
1. 🚀 Setup CLI package structure với bin/docuflu.js
2. 🚀 Implement commander.js cho CLI commands
3. 🚀 Setup package.json với global install support
4. 🚀 Create basic help và version commands

### Phase 2: Core Logic (Ngày 1 - Chiều)  
1. 🚀 Implement config.js để load .env files
2. 🚀 Build docusaurus-scanner.js để detect project
3. 🚀 Create state-manager.js cho .docuflu/ handling
4. 🚀 Implement confluence-client.js wrapper

### Phase 3: Content Processing (Ngày 2 - Sáng)
1. 🚀 Build markdown-parser.js với Confluence format
2. 🚀 Handle Docusaurus-specific syntax
3. 🚀 Implement image và asset processing
4. 🚀 Create page hierarchy mapping

### Phase 4: Commands Implementation (Ngày 2 - Chiều)
1. 🚀 Implement `docuflu init` command
2. 🚀 Build `docuflu sync` với options (--docs, --blog, --dry-run)
3. 🚀 Create `docuflu status` command
4. 🚀 Add colored logging với chalk và ora spinners

### Phase 5: Testing & Polish (Ngày 2 - Tối)
1. 🚀 Test với real Docusaurus project
2. 🚀 Error handling và user-friendly messages
3. 🚀 Performance optimization
4. 🚀 README và documentation

## 5. Usage Examples

### 5.1 Initial Setup
```bash
# Install CLI globally
npm install -g docuflu

# Or use npx
npx docuflu --version

# Initialize project
cd my-docusaurus-site
docuflu init
```

### 5.2 Configuration (.env)
```bash
# .env file created after docuflu init
CONFLUENCE_BASE_URL=https://mycompany.atlassian.net
CONFLUENCE_USERNAME=john.doe@company.com
CONFLUENCE_API_TOKEN=ATxxxxxxxxxxxxxx
CONFLUENCE_SPACE_KEY=DOC
CONFLUENCE_ROOT_PAGE_TITLE=Documentation
```

### 5.3 CLI Commands
```bash
# Sync all content
docuflu sync

# Sync specific sections  
docuflu sync --docs
docuflu sync --blog

# Check sync status
docuflu status

# Dry run (preview changes)
docuflu sync --dry-run

# Help
docuflu --help
docuflu sync --help
```

### 5.4 Output Examples
```bash
$ docuflu sync
✓ Scanning Docusaurus project...
✓ Found 15 docs, 8 blog posts
✓ Loading sync state from .docuflu/
✓ Connecting to Confluence...
✓ Creating 3 new pages...
✓ Updating 2 existing pages...
✓ Skipping 18 unchanged pages...
✓ Sync completed in 12.5s

Stats: 5 processed, 3 created, 2 updated, 18 skipped
```

## 6. Error Handling

### 6.1 Common Scenarios
- Network connectivity issues
- Authentication failures
- API rate limiting
- Invalid markdown syntax
- Missing images/assets

### 6.2 Recovery Strategies
- Retry logic với exponential backoff
- Rollback mechanism
- Detailed error logging
- Graceful degradation

## 7. Security Considerations

- Store API tokens trong environment variables
- Validate input paths
- Sanitize markdown content
- Rate limiting compliance
- Audit logging

## 8. Future Enhancements

- Bi-directional sync (Confluence → Markdown)
- Real-time collaboration features
- Custom markdown extensions
- Multi-space support
- Integration với CI/CD pipelines

## 9. Timeline (2 Ngày với AI)

### Ngày 1: Core Implementation 
- **Sáng**: Phase 1 - Setup project structure + dependencies
- **Chiều**: Phase 2 - File processing + Markdown parser

### Ngày 2: Integration & Polish
- **Sáng**: Phase 3 - Confluence integration + API client
- **Chiều**: Phase 4-5 - CLI interface + testing + documentation

### Parallel Development với AI:
- Sử dụng AI để generate code nhanh cho từng component
- Simultaneous implementation của multiple modules
- AI-assisted debugging và optimization
- Auto-generate tests và documentation
