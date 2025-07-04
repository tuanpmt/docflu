# Notion Hierarchy Manager

The Hierarchy Manager is responsible for creating and managing nested page structures in Notion based on your directory hierarchy with enhanced support for `_category_.json` files and intelligent directory handling.

## Overview

The `NotionHierarchyManager` class creates a page hierarchy that mirrors your Docusaurus directory structure, ensuring organized and navigable documentation in Notion with full support for category metadata and automatic root page creation.

## Key Features

- **📁 Directory Mapping**: Converts directory structure to Notion page hierarchy
- **📋 Category Support**: Reads `_category_.json` files for enhanced metadata
- **🔄 Incremental Creation**: Only creates missing pages, reuses existing ones
- **🧹 Orphan Cleanup**: Removes references to deleted pages
- **🎯 Smart Caching**: Caches page references and category data for performance
- **🔍 Page Discovery**: Finds existing pages to avoid duplicates
- **📚 Auto Root Creation**: Automatically creates root pages when needed
- **🔧 Flat Mode**: Option to create pages directly in root (no nested structure)
- **🚫 Smart Directory Skipping**: Automatically skips 'docs' directory to avoid unnecessary nesting

## How It Works

### Directory to Page Mapping with Category Support

```
docs/
├── _category_.json             → Category metadata (position, label, description)
├── intro.md                    → 📄 Intro
├── tutorial-basics/            → 📁 Tutorial Basics (from _category_.json)
│   ├── _category_.json        →   Category metadata
│   ├── create-a-page.md       →   📄 Create A Page
│   └── markdown-features.md   →   📄 Markdown Features
└── api/                       → 📁 Api
    ├── _category_.json        →   Category metadata
    ├── authentication.md      →   📄 Authentication
    └── endpoints/             →   📁 Endpoints
        ├── _category_.json    →     Category metadata
        ├── users.md          →     📄 Users
        └── posts.md          →     📄 Posts
```

### Page Types

1. **Parent Pages** (📁): Created for directories
   - Named from `_category_.json` label or formatted directory name
   - Contains description from category metadata
   - Includes position and path information
   - Has folder emoji icon

2. **Content Pages** (📄): Created for markdown files
   - Named after file title or filename
   - Contains actual markdown content
   - Has document emoji icon

## Implementation Details

### Constructor Enhancement

```javascript
constructor(notionClient, state, projectRoot = null) {
  this.client = notionClient;
  this.state = state;
  this.projectRoot = projectRoot || process.cwd(); // Support for project root
  this.hierarchyCache = new Map(); // Cache for created parent pages
  this.categoryCache = new Map(); // Cache for _category_.json data
}
```

### Category Data Support

The hierarchy manager now loads `_category_.json` files for enhanced page metadata:

```javascript
// Example _category_.json
{
  "label": "Tutorial - Basics",
  "position": 2,
  "link": {
    "type": "generated-index",
    "description": "Learn the basics of using our platform"
  }
}
```

### Path Processing with Smart Directory Skipping

```javascript
// Example: 'docs/tutorial-basics/create-a-page.md'
const pathSegments = hierarchyManager.extractPathSegments(filePath);
// Result: ['docs', 'tutorial-basics', 'create-a-page.md']

// Smart skipping of 'docs' directory
const shouldSkipDocs = pathSegments[0] === 'docs';
const startIndex = shouldSkipDocs ? 1 : 0;
```

### Enhanced Title Formatting

```javascript
// Priority order:
// 1. _category_.json label
// 2. Formatted directory name
const categoryData = await this.loadCategoryData(fullDirectoryPath);
const pageTitle = categoryData.label || this.formatSegmentTitle(segment);

// Directory name formatting
'tutorial-basics' → 'Tutorial Basics'
'api-reference' → 'Api Reference'
'getting_started' → 'Getting Started'
```

## API Reference

### Core Methods

#### `createPageHierarchy(filePath, rootPageId, flatMode = false)`

Creates the complete page hierarchy for a file path with flat mode support.

```javascript
const parentPageId = await hierarchyManager.createPageHierarchy(
  'docs/tutorial-basics/create-a-page.md',
  rootPageId,
  false // nested mode
);

// Flat mode - creates page directly in root
const parentPageId = await hierarchyManager.createPageHierarchy(
  'docs/intro.md',
  rootPageId,
  true // flat mode
);
```

#### `loadCategoryData(directoryPath)`

Loads category metadata from `_category_.json` files with caching.

```javascript
const categoryData = await hierarchyManager.loadCategoryData('docs/tutorial-basics');
// Returns: { label: "Tutorial - Basics", position: 2, link: {...} }
```

#### `createPageHierarchyWithAutoRoot(filePath, rootPageId, rootTitle, flatMode)`

Enhanced hierarchy creation with automatic root page support.

```javascript
const parentId = await hierarchyManager.createPageHierarchyWithAutoRoot(
  'docs/guide/intro.md',
  null, // No root page ID - will auto-create
  'Project Documentation',
  false // nested mode
);
```

#### `getOrCreateRootPage(rootPageId, rootTitle)`

Automatically creates or validates root page for documentation hierarchy.

```javascript
// Auto-create with default title
const rootId = await hierarchyManager.getOrCreateRootPage();

// Auto-create with custom title
const rootId = await hierarchyManager.getOrCreateRootPage(null, 'My Documentation');

// Use existing page if valid, fallback to auto-create
const rootId = await hierarchyManager.getOrCreateRootPage('existing-page-id');
```

### Enhanced Page Creation

#### `createParentPage(title, parentId, pathSoFar, categoryData)`

Creates parent pages with enhanced content from `_category_.json`.

```javascript
const newPage = await hierarchyManager.createParentPage(
  'Tutorial Basics',
  parentId,
  'tutorial-basics',
  {
    label: 'Tutorial - Basics',
    position: 2,
    link: { description: 'Learn the basics of using our platform' }
  }
);
```

### Utility Methods

#### `extractPathSegments(filePath)`

Extracts path components from file path.

```javascript
const segments = hierarchyManager.extractPathSegments('docs/api/users.md');
// Returns: ['docs', 'api', 'users.md']
```

#### `formatSegmentTitle(segment)`

Formats directory name to readable title.

```javascript
const title = hierarchyManager.formatSegmentTitle('tutorial-basics');
// Returns: 'Tutorial Basics'
```

## Enhanced Page Structure

### Parent Page Template with Category Data

```javascript
{
  parent: { page_id: parentId },
  properties: {
    title: { title: [{ text: { content: "Tutorial - Basics" } }] } // From _category_.json
  },
  icon: { emoji: '📁' },
  children: [
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { text: { content: 'Learn the basics of using our platform' } } // From category description
        ]
      }
    },
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { text: { content: 'Category path: ' }, annotations: { italic: true } },
          { text: { content: 'tutorial-basics' }, annotations: { code: true } }
        ]
      }
    },
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { text: { content: 'Sidebar position: ' }, annotations: { italic: true } },
          { text: { content: '2' }, annotations: { code: true } } // From category position
        ]
      }
    }
  ]
}
```

### Auto-Created Root Page Template

```javascript
{
  parent: { type: 'workspace', workspace: true },
  properties: {
    title: { title: [{ text: { content: "Documentation" } }] }
  },
  icon: { emoji: '📚' },
  children: [
    {
      type: 'heading_1',
      heading_1: {
        rich_text: [{ text: { content: "Documentation" } }]
      }
    },
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { text: { content: 'This page was automatically created by DocFlu to serve as the root for your documentation hierarchy.' } }
        ]
      }
    },
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { text: { content: 'Created: ' }, annotations: { italic: true } },
          { text: { content: new Date().toISOString() }, annotations: { code: true } }
        ]
      }
    }
  ]
}
```

## State Management

### Enhanced Hierarchy Cache

The hierarchy manager maintains multiple caches:

```javascript
// In-memory caches
this.hierarchyCache = new Map(); // Parent pages
this.categoryCache = new Map(); // Category data

// Persistent state
this.state.setHierarchyPageId('tutorial-basics', pageId);
this.state.setMetadata('autoCreatedRootPageId', rootPageId);
```

### Auto-Created Root Page Tracking

```json
{
  "metadata": {
    "autoCreatedRootPageId": "12345678-1234-1234-1234-123456789012",
    "autoCreatedRootTitle": "Documentation",
    "autoCreatedAt": "2025-01-27T10:30:00Z"
  }
}
```

## Sync Modes

### Flat Mode (`--file`)
- **📄 Direct Placement**: Creates pages directly in root
- **🚫 No Hierarchy**: Skips directory structure creation
- **⚡ Fast**: Minimal API calls
- **🎯 Single File**: Ideal for individual file sync

```javascript
// Flat mode example
const parentId = await hierarchyManager.createPageHierarchy(
  'docs/intro.md',
  rootPageId,
  true // flatMode = true
);
// Returns rootPageId directly
```

### Nested Mode (`--docs`)
- **🏗️ Full Hierarchy**: Creates complete directory structure
- **📋 Category Support**: Uses `_category_.json` metadata
- **🧹 Smart Skipping**: Automatically skips 'docs' directory
- **🔄 Incremental**: Reuses existing pages

```javascript
// Nested mode example
const parentId = await hierarchyManager.createPageHierarchy(
  'docs/tutorial-basics/create-a-page.md',
  rootPageId,
  false // flatMode = false
);
// Returns parent page ID for tutorial-basics directory
```

## Error Handling

### Enhanced Recovery Strategies

```javascript
// Orphaned page cleanup with validation
async validateHierarchy() {
  const hierarchyMap = this.state.getHierarchyMap();
  const orphanedPaths = [];

  for (const [pathKey, pageId] of Object.entries(hierarchyMap)) {
    try {
      await this.client.retrievePage(pageId);
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Orphaned hierarchy reference: ${pathKey} -> ${pageId}`));
      orphanedPaths.push(pathKey);
    }
  }

  // Clean up orphaned references
  for (const pathKey of orphanedPaths) {
    this.state.removeHierarchyPageId(pathKey);
  }
}
```

### Auto Root Page Recovery

```javascript
// Auto-created root page validation
const autoCreatedRootId = this.state.getMetadata('autoCreatedRootPageId');
if (autoCreatedRootId) {
  try {
    await this.client.retrievePage(autoCreatedRootId);
    return autoCreatedRootId;
  } catch (error) {
    console.warn(chalk.yellow(`⚠️ Cached auto-created root page not found, creating new one`));
    this.state.removeMetadata('autoCreatedRootPageId');
  }
}
```

## Performance Optimizations

### Multi-Level Caching

1. **In-Memory Cache**: Fast lookup for current session
2. **Category Cache**: Caches `_category_.json` data
3. **Persistent State**: Survives between runs
4. **Search Optimization**: Efficient Notion API usage

### Smart Directory Processing

```javascript
// Skip unnecessary directories
const shouldSkipDocs = pathSegments[0] === 'docs';
const startIndex = shouldSkipDocs ? 1 : 0;

// Only create hierarchy if there are directories to process
if (pathSegments.length <= startIndex + 1) {
  console.log(chalk.gray(`📄 No directories to process, creating page directly in root`));
  return rootPageId;
}
```

## Best Practices

### Directory Structure with Categories

1. **Use _category_.json**: Provide meaningful labels and descriptions
2. **Consistent Naming**: Use kebab-case or snake_case for directories
3. **Logical Positioning**: Use position field for sidebar ordering
4. **Reasonable Depth**: Limit nesting to 3-4 levels

### Category File Example

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

## Examples

### Simple Hierarchy with Categories

```bash
# Input structure
docs/
├── _category_.json          # { "label": "Documentation", "position": 1 }
├── intro.md
├── tutorial-basics/
│   ├── _category_.json      # { "label": "Tutorial - Basics", "position": 2 }
│   ├── installation.md
│   └── quick-start.md
└── advanced/
    ├── _category_.json      # { "label": "Advanced Features", "position": 3 }
    └── configuration.md

# Notion result (nested mode)
📄 Documentation (root)
├── 📄 Intro
├── 📁 Tutorial - Basics (from _category_.json)
│   ├── 📄 Installation
│   └── 📄 Quick Start
└── 📁 Advanced Features (from _category_.json)
    └── 📄 Configuration

# Notion result (flat mode)
📄 Documentation (root)
├── 📄 Intro
├── 📄 Installation
├── 📄 Quick Start
└── 📄 Configuration
```

### Auto Root Page Creation

```bash
# No NOTION_ROOT_PAGE_ID provided
docflu sync --notion --docs

# Output:
# 📚 Auto-creating root page: Documentation
# 📁 Creating parent page: Tutorial Basics (tutorial-basics)
# 📄 Creating content page: Create A Page
```

## Debugging

### Enhanced Hierarchy Visualization

```javascript
// Generate hierarchy tree
const tree = hierarchyManager.generateHierarchyTree();
console.log(JSON.stringify(tree, null, 2));

// View category cache
console.log('Category cache:', hierarchyManager.categoryCache);

// View state
const hierarchyMap = state.getHierarchyMap();
const autoRootId = state.getMetadata('autoCreatedRootPageId');
```

### Validation and Cleanup

```javascript
// Validate and clean up orphaned references
await hierarchyManager.validateHierarchy();

// Check specific path
const pageId = state.getHierarchyPageId('tutorial-basics');
```

## Related Components

- [**notion-state.md**](./state-management.md) - State persistence and metadata
- [**notion-client.md**](./notion-client.md) - API interactions and rate limiting
- [**notion-sync.md**](./sync-orchestration.md) - Main sync workflow integration
- [**setup-guide.md**](./setup-guide.md) - Configuration and setup instructions 