# Notion Integration Documentation

This directory contains comprehensive documentation for DocFlu's Notion integration features with full hierarchy support, category metadata, and advanced content processing.

## Overview

DocFlu provides complete Notion integration that allows you to sync Docusaurus markdown content to Notion pages with intelligent hierarchy management, rich content conversion, and advanced features like diagrams and images.

## Key Features

- **🏗️ Intelligent Hierarchy**: Flat or nested page hierarchy with `_category_.json` support
- **📋 Category Metadata**: Enhanced page creation with labels, descriptions, and positioning
- **📚 Auto Root Creation**: Automatically creates root pages when not provided
- **🚫 Smart Directory Skipping**: Automatically skips 'docs' directory to avoid unnecessary nesting
- **📝 Rich Content**: Direct markdown to Notion blocks conversion with 100% accuracy
- **🖼️ Image Processing**: External image support with local file upload via Notion File Upload API
- **📊 Diagram Support**: Direct SVG generation and upload for Mermaid, PlantUML, Graphviz, D2
- **🔄 Incremental Sync**: Only sync changed files for performance (docs mode)
- **🗑️ Fresh Page Creation**: Single file sync creates fresh pages for clean results
- **⚡ Rate Limiting**: Respects Notion API limits (3 requests/second)
- **🛡️ Error Handling**: Comprehensive error recovery and validation
- **🎯 Performance**: 31,500+ blocks/second conversion speed
- **✅ Quality**: 100% block validation rate with comprehensive testing

## Documentation Files

### Core Features
- [**notion-client.md**](./notion-client.md) - Notion API client with rate limiting and error handling
- [**hierarchy-manager.md**](./hierarchy-manager.md) - Enhanced directory-based page hierarchy with category support
- [**markdown-conversion.md**](./markdown-conversion.md) - Markdown to Notion blocks conversion
- [**state-management.md**](./state-management.md) - Incremental sync and caching with metadata support

### Content Processing
- [**image-processing.md**](./image-processing.md) - Centralized image processing with Notion File Upload API
- [**diagram-processing.md**](./diagram-processing.md) - Individual processors with direct SVG upload
- [**file-upload-api.md**](./file-upload-api.md) - Notion File Upload API implementation

### Setup and Usage
- [**setup-guide.md**](./setup-guide.md) - Complete setup instructions
- [**cli-usage.md**](./cli-usage.md) - Command line interface usage
- [**troubleshooting.md**](./troubleshooting.md) - Common issues and solutions

## Quick Start

1. **Setup Notion Integration**
   ```bash
   # Create INTERNAL integration at https://www.notion.so/my-integrations
   # Add credentials to .env file
   NOTION_API_TOKEN=secret_your-integration-token
   NOTION_ROOT_PAGE_ID=your-root-page-id  # Optional - will auto-create if not provided
   ```

2. **Initialize Project**
   ```bash
   docflu init
   ```

3. **Sync to Notion**
   ```bash
   # Sync single file (always creates fresh page)
   docflu sync --notion --file docs/intro.md
   
   # Sync all docs with hierarchy (incremental sync)
   docflu sync --notion --docs
   ```

## Enhanced Hierarchy Features

### Category Support with `_category_.json`

Create `_category_.json` files in directories for enhanced page metadata:

```json
{
  "label": "Tutorial - Basics",
  "position": 2,
  "link": {
    "type": "generated-index",
    "description": "Learn the basics of using our platform with step-by-step guides"
  }
}
```

### Directory Structure Example

```
docs/
├── _category_.json              # Root category metadata
├── intro.md                     → 📄 Intro
├── tutorial-basics/             → 📁 Tutorial - Basics (from _category_.json)
│   ├── _category_.json         #   Category metadata
│   ├── installation.md         →   📄 Installation
│   └── quick-start.md          →   📄 Quick Start
├── advanced/                   → 📁 Advanced Features (from _category_.json)
│   ├── _category_.json         #   Category metadata
│   └── configuration.md        →   📄 Configuration
└── api/                        → 📁 Api Reference (from _category_.json)
    ├── _category_.json         #   Category metadata
    ├── authentication.md       →   📄 Authentication
    └── endpoints/              →   📁 Endpoints
        ├── _category_.json     #     Category metadata
        ├── users.md           →     📄 Users
        └── posts.md           →     📄 Posts
```

### Auto Root Page Creation

When `NOTION_ROOT_PAGE_ID` is not provided, DocFlu automatically creates a root page:

```bash
# No root page ID in .env
docflu sync --notion --docs

# Output:
# 📚 Auto-creating root page: Documentation
# 📁 Creating parent page: Tutorial - Basics (tutorial-basics)
# 📄 Creating content page: Installation
```

**Auto-created root pages include:**
- Proper title and description
- Creation timestamp
- Book emoji icon (📚)
- Persistent caching for reuse

## Sync Modes

### Single File Sync (`--file`)
- **🗑️ Fresh Pages**: Archives old page and creates completely new one
- **⚡ Fast**: No content clearing, direct page replacement
- **🔄 Always Updates**: Ignores file change detection
- **🏗️ Nested Structure**: Creates directory-based page hierarchy (like `--docs`)
- **🎯 Ideal For**: Individual file updates, testing, quick changes

### Docs Sync (`--docs`)  
- **🏗️ Hierarchical**: Creates directory-based page structure with category support
- **📈 Incremental**: Only syncs changed files for performance
- **🗑️ Page Replacement**: Archives old pages and creates new ones (like `--file`)
- **🔍 Change Detection**: Uses file hashes to detect changes
- **📋 Category Integration**: Uses `_category_.json` for enhanced metadata
- **🚫 Smart Skipping**: Automatically skips 'docs' directory to avoid nesting
- **🎯 Ideal For**: Full documentation sync, maintaining structure

### Comparison

**Nested Mode** (`--docs`):
```
📄 Documentation (root)
├── 📄 Intro
├── 📁 Tutorial - Basics (from _category_.json)
│   ├── 📄 Installation
│   └── 📄 Quick Start
└── 📁 Advanced Features (from _category_.json)
    └── 📄 Configuration
```

**Both `--docs` and `--file` now use Nested Mode**:
```
📄 Documentation (root)
├── 📄 Intro
├── 📁 Tutorial - Basics (from _category_.json)
│   ├── 📄 Installation
│   └── 📄 Quick Start
└── 📁 Advanced Features (from _category_.json)
    └── 📄 Configuration
```

**Key Difference**:
- `--docs`: Incremental sync (only changed files)
- `--file`: Always syncs specified file (ignores change detection)

## Architecture

```
lib/core/notion/
├── notion-client.js          # API client with rate limiting
├── notion-state.js           # State management with metadata support
├── hierarchy-manager.js      # Enhanced hierarchy with category support
├── markdown-to-blocks.js     # Content conversion
├── image-processor.js        # Centralized image processing
├── diagram-processor.js      # Main diagram orchestrator
├── file-uploader.js          # Notion File Upload API
├── attachment-processor.js   # File attachment handling
├── mermaid-processor.js      # Mermaid diagrams
├── plantuml-processor.js     # PlantUML diagrams
├── graphviz-processor.js     # Graphviz/DOT diagrams
├── d2-processor.js           # D2 diagrams
└── notion-sync.js           # Main orchestrator
```

## Supported Content (v2024.12)

### Text Elements
- ✅ Headings (H1, H2, H3) - Perfect hierarchy support
- ✅ Paragraphs with rich text - Enhanced conflict resolution
- ✅ Bold, italic, code, strikethrough - Sequential parsing order
- ✅ Links with proper formatting - URL validation
- ✅ Lists (bulleted and numbered) - Proper nesting
- ✅ Blockquotes - Multi-line support
- ✅ Horizontal rules - Clean dividers

### Advanced Elements
- ✅ Code blocks with syntax highlighting - Integrity preservation
- ✅ Tables with headers - Rich text cell support
- ✅ Images (markdown syntax) - Direct block creation
- ✅ Images (HTML img tags) - Full attribute support (src, alt, width, height)
- ✅ Images (external URLs) - Download and upload to Notion
- ✅ Images (local files) - Upload via Notion File Upload API
- ✅ Diagrams (direct SVG upload) - Mermaid, PlantUML, Graphviz, D2
- ✅ File attachments - Complete Notion File Upload API support

### Hierarchy Features
- ✅ Directory-based page structure with category metadata
- ✅ Parent-child page relationships
- ✅ Automatic page creation with enhanced content
- ✅ Orphaned page cleanup and validation
- ✅ Auto root page creation when not provided
- ✅ Smart directory skipping (automatically skips 'docs')
- ✅ Flat mode for simple structures

### Quality Metrics (all.md test)
- **129 total blocks** processed from complex markdown
- **100% validation rate** - All blocks conform to Notion API
- **31,500 blocks/second** - High-performance conversion
- **7/7 readiness checks** - Full feature coverage

## Performance

- **Rate Limiting**: 3 requests/second (Notion API limit)
- **Incremental Sync**: Only changed files processed
- **Batch Processing**: Up to 100 blocks per request
- **Multi-Level Caching**: Hierarchy, category, and image caching
- **Parallel Processing**: Multiple file uploads in parallel
- **Smart Validation**: Orphaned reference cleanup

## Enhanced Error Handling

### Hierarchy Validation
- Automatic orphaned page reference cleanup
- Auto-created root page validation and recovery
- Category file loading with graceful fallbacks

### Content Processing
- Image upload fallbacks with error recovery
- Diagram generation with timeout protection
- File attachment processing with validation

## Requirements

- Node.js 16+
- Notion workspace with integration permissions
- Optional: Mermaid CLI for diagrams
- Optional: PlantUML for UML diagrams

## Configuration Examples

### Basic Setup (.env)
```bash
NOTION_API_TOKEN=secret_your-integration-token
# NOTION_ROOT_PAGE_ID is optional - will auto-create if not provided
```

### Advanced Setup (.env)
```bash
NOTION_API_TOKEN=secret_your-integration-token
NOTION_ROOT_PAGE_ID=your-root-page-id  # Use existing page
```

### Category Configuration (_category_.json)
```json
{
  "label": "Getting Started Guide",
  "position": 1,
  "link": {
    "type": "generated-index",
    "description": "Everything you need to know to get started with our platform"
  }
}
```

## Usage Examples

### Single File Sync
```bash
# Sync single file with fresh page creation
docflu sync --notion --file docs/intro.md

# Sync with custom root page
NOTION_ROOT_PAGE_ID=your-page-id docflu sync --notion --file docs/guide.md
```

### Full Documentation Sync
```bash
# Sync all docs with hierarchy and categories
docflu sync --notion --docs

# Force sync all files (ignore change detection)
docflu sync --notion --docs --force
```

### Auto Root Page Creation
```bash
# Let DocFlu create root page automatically
unset NOTION_ROOT_PAGE_ID
docflu sync --notion --docs
```

## Troubleshooting

### Common Issues

1. **Missing Root Page**: Auto-creation will handle this automatically
2. **Category File Errors**: Graceful fallback to directory name formatting
3. **Orphaned Pages**: Automatic cleanup during validation
4. **Rate Limiting**: Built-in 334ms delay between requests

### Debug Commands

```bash
# View hierarchy state
node -e "
const state = require('./lib/core/state-manager');
console.log(state.getHierarchyMap());
"

# Validate hierarchy
docflu sync --notion --docs --validate-hierarchy
```

## Examples

See [setup-guide.md](./setup-guide.md) for complete examples and [hierarchy-manager.md](./hierarchy-manager.md) for detailed hierarchy management documentation. 