# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**docflu** is a CLI tool that syncs Docusaurus documentation to multiple platforms (Confluence, Google Docs, and Notion) with support for hierarchy preservation, internal link processing, image handling, and comprehensive diagram conversion.

## Common Development Commands

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:hierarchy        # Test hierarchy functionality
npm run test:mermaid         # Test Mermaid diagram processing
npm run test:references      # Test internal link processing  
npm run test:migration       # Test state migration
npm run test:init           # Test initialization
npm run test:diagram        # Test diagram processing
npm run test:gdocs          # Test Google Docs integration
npm run test:target-page    # Test target page sync feature
npm run test:all            # Run complete test suite

# Test individual components
node test/test-basic.js
node test/test-hierarchy.js
node test/test-internal-references.js
node test/test-diagram-comprehensive.js
node test/test-google-docs.js
node test/test-target-page-sync.js
```

### CLI Usage
```bash
# Initialize project configuration
node bin/docflu.js init

# Sync to different platforms
node bin/docflu.js sync --docs --conflu           # Confluence (default)
node bin/docflu.js sync --docs --gdocs            # Google Docs
node bin/docflu.js sync --docs --notion           # Notion

# Single file sync
node bin/docflu.js sync --file docs/intro.md

# Target specific Confluence page sync
node bin/docflu.js sync --file docs/intro.md --target 123456
node bin/docflu.js sync --file docs/intro.md --target "https://domain.atlassian.net/wiki/spaces/DOC/pages/123456/Page+Title"

# Dry run (preview changes)
node bin/docflu.js sync --docs --dry-run

# Cross-project sync
node bin/docflu.js sync ../other-project --docs
```

## High-Level Architecture

### Core Components

**CLI Layer** (`bin/docflu.js`)
- Commander.js-based CLI with multi-platform support
- Handles project path resolution and command routing
- Supports `--conflu`, `--gdocs`, `--notion` platform flags

**Command Layer** (`lib/commands/`)
- `sync.js` - Confluence sync orchestration
- `sync_gdocs.js` - Google Docs sync with OAuth2 authentication
- `sync_notion.js` - Notion sync with API token authentication
- `init.js` - Project initialization and configuration setup

**Core Processing** (`lib/core/`)
- `state-manager.js` - Incremental sync with `.docusaurus/sync-state.json`
- `config.js` - Multi-platform configuration management
- `docusaurus-scanner.js` - Project structure analysis and file discovery
- `markdown-parser.js` - Markdown-to-HTML conversion with frontmatter support

**Platform-Specific Processors**
- `confluence-client.js` - REST API client with hierarchy support
- `gdocs/` - Google Docs integration with OAuth2 and Drive API
- `notion/` - Notion API integration with native block processing

**Content Processors**
- `image-processor.js` - Image upload and processing
- `diagram-processor.js` - Multi-format diagram conversion (Mermaid, PlantUML, Graphviz, D2)
- `reference-processor.js` - Internal link conversion to platform URLs

### Data Flow

1. **Project Analysis**: Scanner identifies Docusaurus structure and markdown files
2. **State Management**: StateManager loads previous sync state for incremental updates
3. **Content Processing**: Files are parsed, images/diagrams processed, internal links converted
4. **Platform Sync**: Content is pushed to target platform with hierarchy preservation
5. **State Persistence**: Sync results are saved for future incremental updates

### Key Design Patterns

**Multi-Platform Architecture**: Each platform has dedicated sync engine with shared core processors
**Incremental Sync**: File modification tracking prevents unnecessary re-uploads
**Hierarchy Preservation**: Directory structure is maintained across all platforms
**Error Recovery**: Comprehensive error handling with graceful degradation
**State Migration**: Automatic migration from `.docflu/` to `.docusaurus/` directory

## Configuration

### Environment Variables (.env)
```bash
# Platform-specific configuration
CONFLUENCE_BASE_URL=https://domain.atlassian.net
CONFLUENCE_USERNAME=user@domain.com
CONFLUENCE_API_TOKEN=token
CONFLUENCE_SPACE_KEY=SPACE

GOOGLE_CLIENT_ID=client-id.googleusercontent.com
GOOGLE_CLIENT_SECRET=client-secret

NOTION_API_TOKEN=secret_token
NOTION_ROOT_PAGE_ID=page-id
```

### Frontmatter Configuration
```markdown
---
title: My Document
confluence_target: 123456  # Page ID
# or
confluence_page: https://domain.atlassian.net/wiki/spaces/DOC/pages/123456/Page+Title
# or
confluence_url: https://domain.atlassian.net/pages/viewpage.action?pageId=123456
---

# My Document Content
This will sync to the specified Confluence page.
```

### State Management
- **Location**: `.docusaurus/sync-state.json` (compatible with Docusaurus)
- **Purpose**: Tracks page IDs, modification times, and sync statistics
- **Migration**: Automatic migration from legacy `.docflu/` directory

## Important Implementation Details

### Diagram Processing
- **Supported Formats**: Mermaid, PlantUML, Graphviz/DOT, D2
- **Auto-Installation**: CLI tools are installed automatically when needed
- **SVG Generation**: High-quality SVG output optimized for each platform
- **Platform-Specific**: Different sizing and formatting for Confluence vs Notion vs Google Docs

### Internal Link Processing
- **Link Types**: Relative (`./file.md`), absolute (`/docs/file`), reference-style, HTML
- **URL Conversion**: Platform-specific URL formats with proper page ID resolution
- **Anchor Support**: Preserves `#section` anchors in converted links

### Target Page Sync (Confluence Only)
- **Direct Page Updates**: Sync markdown files directly to specific Confluence pages
- **URL/ID Parsing**: Supports page IDs, modern URLs, legacy URLs, and display URLs
- **CLI Flag Support**: `--target` flag for specifying target page
- **Frontmatter Support**: `confluence_target`, `confluence_page`, or `confluence_url` in frontmatter
- **Priority**: CLI flag overrides frontmatter configuration
- **Validation**: Ensures target page exists and is in the correct space

### Image Handling
- **Local Images**: Uploaded as platform attachments
- **External URLs**: Preserved as-is or downloaded and re-uploaded
- **Caching**: Prevents duplicate uploads with content-based hashing

### Error Handling
- **Graceful Degradation**: Diagrams fall back to code blocks on generation failure
- **Retry Logic**: Configurable retry attempts for network operations
- **State Recovery**: Automatic cleanup of orphaned references

## Development Guidelines

### Code Style
- Use CommonJS modules (not ES modules)
- Chalk v4 for colored output (CommonJS compatible)
- Comprehensive error handling with descriptive messages
- Consistent logging format with emoji indicators

### Testing Approach
- Test files in `test/` directory with specific naming patterns
- Mock external APIs for unit testing
- Integration tests with real platform APIs
- Comprehensive test coverage for all diagram types

### State Management
- Always use StateManager for persistence
- Handle state migration transparently
- Clean up orphaned references during sync
- Provide detailed sync statistics

### Multi-Platform Support
- Platform-specific processors in dedicated directories
- Shared core functionality for common operations
- Configuration validation per platform
- Consistent CLI interface across platforms

### Cursor Rules
- Write commit messages in English, concise and clear
- Do not automatically commit code
- Save context to CONTEXT.md when completing tasks
- Use English throughout the project

## Common Issues and Solutions

### Package Compatibility
- Use CommonJS-compatible versions (chalk v4, ora v5)
- Avoid ESM-only packages in Node.js CommonJS context

### API Integration
- Confluence: Use REST API with proper version handling
- Google Docs: Implement OAuth2 with PKCE for desktop applications
- Notion: Use integration tokens, not user tokens

### File Processing
- Handle Docusaurus absolute paths (`/img/...` → `{projectRoot}/static/img/...`)
- Process diagrams before final content upload
- Maintain file modification times for incremental sync

### Error Recovery
- Implement retry logic for network operations
- Provide fallback mechanisms for failed operations
- Log detailed error information for debugging