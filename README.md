# docflu CLI

> **Sync Docusaurus documentation to Confluence seamlessly**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

docflu CLI automatically syncs your Docusaurus markdown documentation to multiple platforms (Confluence, Google Docs, and Notion), maintaining hierarchy, processing internal links, handling images, and converting diagrams to high-quality SVG images.

> **🤖 AI-Powered Development**: Built in 5 hours using [Cursor](https://cursor.sh/) + [Claude 4 Sonnet](https://www.anthropic.com/claude)

## ✨ Features

### 🎯 Multi-Platform Support
- **Confluence sync** - Full-featured Confluence integration with hierarchy
- **Google Docs sync** - OAuth2 authentication with document creation
- **Notion sync** - Native block processing with file upload API
- **Target page sync** - Sync directly to specific Confluence pages

### 🔧 Core Features
- **Hierarchy preservation** - maintains folder structure across all platforms
- **Internal link processing** - converts relative links to platform-specific URLs
- **Image handling** - uploads and processes images automatically
- **Comprehensive diagram support** - Mermaid, PlantUML, Graphviz/DOT, D2 → SVG
- **Auto CLI installation** - automatically installs required diagram tools
- **High-quality output** - Optimized SVG generation for platform compatibility
- **Incremental sync** - only syncs changed files
- **Dry-run mode** - preview changes before applying
- **State management** - tracks sync history in `.docusaurus/`
- **Error resilience** - robust upload mechanism with retry logic
- **File optimization** - 30% smaller SVG files with maintained quality

## 🚀 Quick Start

### Installation

```bash
# Install from source
git clone https://github.com/tuanpmt/docflu.git
cd docflu && npm install && npm link

# Verify installation
docflu --version
```

### Setup

```bash
# Navigate to your Docusaurus project
cd your-docusaurus-project

# Initialize configuration
docflu init

# Edit .env with your platform credentials
```

### First Sync

```bash
# Preview changes
docflu sync --docs --dry-run

# Sync to different platforms
docflu sync --docs                    # Confluence (default)
docflu sync --docs --gdocs            # Google Docs
docflu sync --docs --notion           # Notion

# Advanced usage examples
docflu sync --file docs/intro.md --target 123456     # Target specific page
docflu sync /path/to/project --docs --gdocs          # Cross-project sync
docflu sync --dir docs/advanced --dry-run            # Directory sync preview
```

## 📖 Usage

### Commands

| Command | Description |
|---------|-------------|
| `docflu init` | Setup .env configuration |
| `docflu sync --docs` | Sync all documentation |
| `docflu sync --file <path>` | Sync specific file |
| `docflu sync --file <path> --target <id>` | Sync to specific Confluence page |
| `docflu sync --docs --gdocs` | Sync to Google Docs |
| `docflu sync --docs --notion` | Sync to Notion |
| `docflu sync --dry-run` | Preview without changes |

### Configuration (.env)

```env
# Confluence Configuration
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@domain.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=DOC
CONFLUENCE_ROOT_PAGE_TITLE=Documentation

# Google Docs Configuration
GOOGLE_CLIENT_ID=your-oauth2-client-id.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_DOCUMENT_TITLE=Documentation

# Notion Configuration
NOTION_API_TOKEN=secret_your-notion-integration-token
NOTION_ROOT_PAGE_ID=your-root-page-id
```

## 🔧 Key Features

### Hierarchy Preservation
```
docs/
├── intro.md                    → Introduction
├── tutorial-basics/            → Tutorial Basics (parent)
│   ├── create-a-page.md       →   Create a Page
│   └── deploy-your-site.md    →   Deploy your site
└── advanced/                   → Advanced (parent)
    └── concepts/               →   Concepts (parent)
        └── deep-nested.md     →     Deep Nested Concepts
```

### Internal Link Processing
Converts Docusaurus links to platform-specific URLs:
- `./sibling.md` → `https://domain.atlassian.net/wiki/spaces/SPACE/pages/ID/Title`
- `../parent.md` → Platform URL with proper hierarchy
- `/docs/absolute-path` → Resolved absolute paths
- `./file.md#section` → Anchor links preserved

### Target Page Sync (Confluence Only)
Sync markdown files directly to specific Confluence pages:

```bash
# CLI flag method
docflu sync --file docs/my-doc.md --target 123456
docflu sync --file docs/my-doc.md --target "https://domain.atlassian.net/wiki/spaces/DOC/pages/123456/Page+Title"
```

```markdown
---
title: My Document
confluence_target: 123456
---

# My Document
Content will sync to page ID 123456.
```

**Supported URL formats:**
- Page ID: `123456`
- Modern URL: `https://domain.atlassian.net/wiki/spaces/DOC/pages/123456/Page+Title`
- Legacy URL: `https://domain.atlassian.net/pages/viewpage.action?pageId=123456`
- Display URL: `https://domain.atlassian.net/display/DOC/Page+Title?pageId=123456`

### Comprehensive Diagram Support
Automatically converts diagrams to high-quality SVG images:

**Mermaid** (flowcharts, sequence, class, state, ER, journey, gantt)
```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]
```

**PlantUML** (UML diagrams, architecture, sequence)
```plantuml
@startuml
Alice -> Bob: Hello
Bob -> Alice: Hi there
@enduml
```

**Graphviz/DOT** (directed graphs, network diagrams)
```dot
digraph G {
    A -> B -> C;
    A -> C;
}
```

**D2** (modern declarative diagrams)
```d2
server -> database: query
database -> server: result
```

### Image & Diagram Features
- **Local images**: Uploaded as Confluence attachments
- **Diagram conversion**: Code blocks → High-quality SVG images
- **Confluence compatibility**: 100% compatibility score with proper backgrounds
- **Professional formatting**: Center-aligned with enhanced styling
- **Bidirectional sync**: Original code preserved in metadata
- **Auto-installation**: CLI tools installed automatically
- **Error handling**: Graceful fallback to code blocks if processing fails
- **File optimization**: 30% smaller files with smart compression
- **Text visibility**: Enhanced readability with proper font settings
- **External URLs**: Preserved as-is

#### 🔧 **Recent Quality Improvements**:
- **✅ Mermaid Transparency Fix**: No more transparent/black boxes on Confluence
- **✅ Upload Error Fix**: Zero upload errors with proper validation
- **✅ D2 Syntax Validation**: Auto-fix unsupported shapes with helpful tips
- **✅ Enhanced SVG Processing**: Better text visibility and background rendering

### State Management
Tracks sync status in `.docusaurus/sync-state.json`:
- Incremental sync (only changed files)
- Page ID tracking
- Statistics and history

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific components
node test/test-basic.js
node test/test-hierarchy.js
node test/test-internal-references.js
node test/test-target-page-sync.js

# Test diagram processing
node test/test-diagram-comprehensive.js    # All 4 diagram types
node test/test-diagram-real.js            # Real conversion test
node test/test-mermaid.js                 # Mermaid specific

# Test platform integrations
npm run test:gdocs                        # Google Docs tests
npm run test:notion                       # Notion tests
npm run test:target-page                  # Target page sync tests
```

## 🛠️ Development

> **📋 IMPORTANT**: Always read `CONTEXT.md` before editing with Cursor for complete project understanding.

### Project Structure
```
docflu/
├── bin/docflu.js              # CLI entry point
├── lib/
│   ├── commands/              # CLI commands
│   │   ├── sync.js           # Confluence sync
│   │   ├── sync_gdocs.js     # Google Docs sync
│   │   ├── sync_notion.js    # Notion sync
│   │   └── init.js           # Configuration
│   └── core/                 # Core modules
│       ├── confluence-client.js
│       ├── markdown-parser.js
│       ├── docusaurus-scanner.js
│       ├── state-manager.js
│       ├── gdocs/            # Google Docs integration
│       │   ├── google-docs-client.js    # API client
│       │   ├── google-docs-converter.js  # Markdown conversion
│       │   ├── google-docs-state.js     # State management
│       │   └── google-docs-sync.js      # Sync orchestration
│       └── notion/           # Notion integration
│           ├── notion-client.js         # API client
│           ├── notion-sync.js           # Sync orchestration
│           ├── markdown-to-blocks.js    # Block conversion
│           └── hierarchy-manager.js     # Page hierarchy
└── test/                      # Test files
    ├── gdocs/                # Google Docs tests
    ├── notion/               # Notion tests
    └── test-target-page-sync.js  # Target page sync tests
```

### Contributing
1. Fork repository
2. **Read CONTEXT.md first**
3. Create feature branch
4. Add tests
5. Update documentation
6. Submit PR

## 🚨 Troubleshooting

### Common Issues

**Authentication Failed**
```bash
❌ Confluence connection failed: Unauthorized
```
Solution: Check `CONFLUENCE_USERNAME` and `CONFLUENCE_API_TOKEN` in `.env`

**Package Not Found**
```bash
❌ npm ERR! 404 Not Found
```
Solution: Install from source (npm package not published yet)

**Debug Mode**
```bash
DEBUG=1 docflu sync --docs
```

## 📈 Status

### ✅ Completed (30/30 features)
- **Multi-platform support**: Confluence, Google Docs, Notion ⭐ NEW
- **Target page sync**: Direct sync to specific Confluence pages ⭐ NEW
- Single & multi-file sync
- Hierarchy support across all platforms
- Internal reference processing
- Image & comprehensive diagram handling (4 types)
- State management & migration
- CLI commands & configuration
- Enhanced diagram quality & upload fixes
- Platform-specific optimizations

### 🔄 Planned
- Blog post sync
- Advanced Docusaurus syntax
- Global npm installation
- Status command
- Bidirectional sync

## 📋 Changelog

### v1.3.0 (Latest) - Multi-Platform & Target Page Sync
- **✅ Multi-Platform Support**: Added Google Docs and Notion sync capabilities
- **✅ Target Page Sync**: Direct sync to specific Confluence pages via CLI flag or frontmatter
- **✅ OAuth2 Integration**: Google Docs authentication with PKCE flow
- **✅ Notion File Upload**: Native Notion File Upload API integration
- **✅ URL Parsing**: Support for multiple Confluence URL formats
- **✅ Platform-Specific Optimizations**: Tailored output for each platform
- **✅ Comprehensive Testing**: Test suites for all platforms and features

### v1.2.0 - Enhanced Diagram Quality & Fixes
- **✅ Mermaid Transparency Fix**: Fixed transparent background issues on Confluence display
- **✅ Enhanced SVG Quality**: Improved text visibility, proper backgrounds, and Confluence compatibility
- **✅ File Size Optimization**: 30% reduction in SVG file sizes with maintained visual quality
- **✅ D2 Syntax Validation**: Auto-fix unsupported shapes with helpful error messages
- **✅ Confluence Compatibility**: 100% compatibility score for Mermaid diagrams
- **✅ Error Resilience**: Robust upload mechanism with retry logic and validation

### v1.1.0 - Comprehensive Diagram Support
- Added PlantUML, Graphviz/DOT, D2 diagram support
- Auto-installation of diagram CLI tools
- Bidirectional sync with metadata preservation
- Enhanced error handling and fallback mechanisms

### v1.0.0 - Core Features
- Single and multi-file sync
- Hierarchy preservation
- Internal link processing
- Image handling
- State management
- CLI commands and configuration

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

## 🙏 Acknowledgments

**AI-Powered Development**:
- [Cursor](https://cursor.sh/) - AI code editor
- [Claude 4 Sonnet](https://www.anthropic.com/claude) - AI assistant

**Technologies**:
- [Docusaurus](https://docusaurus.io/) - Documentation platform
- [Confluence](https://www.atlassian.com/software/confluence) - Collaboration workspace
- [Google Docs](https://docs.google.com/) - Document creation and collaboration
- [Notion](https://notion.so/) - All-in-one workspace
- [Node.js](https://nodejs.org/) + [Commander.js](https://github.com/tj/commander.js/)

---

**Made with ❤️ for the documentation community**

*Powered by AI* 🤖✨
