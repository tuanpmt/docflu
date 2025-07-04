# Notion Markdown Conversion

## Overview

The Notion markdown converter transforms standard markdown into Notion-compatible blocks with support for rich formatting, code blocks with metadata, nested code blocks, and comprehensive language mapping.

## Code Block Features

### Language Support & Mapping

The converter automatically maps common language aliases to Notion-supported languages:

- `jsx`, `tsx` → `javascript`, `typescript`
- `js`, `ts` → `javascript`, `typescript` 
- `py` → `python`
- `sh`, `bash`, `zsh` → `shell`
- `yml` → `yaml`
- Diagram languages (`mermaid`, `plantuml`, `d2`, `dot`) → `plain text`

### Code Block Metadata

Supports metadata parsing for enhanced code blocks:

```jsx title="src/components/HelloDocusaurus.js"
function HelloDocusaurus() {
  return <h1>Hello, Docusaurus!</h1>;
}
```

**Supported metadata formats:**
- `title="filename"` - Displays as caption
- `filename="path"` - Displays as caption
- Custom metadata - Used as-is for caption

### Nested Code Blocks

Handles nested code blocks using 4+ backticks:

````md
```jsx title="example.js"
const example = () => {
  return <div>Hello</div>;
}
```
````

**Processing:**
- Outer block: `markdown` language
- Inner content: Raw code block preserved
- Metadata: Extracted from outer block

## Rich Text Processing

### Formatting Support

- **Bold**: `**text**`
- **Italic**: `*text*`
- **Code**: `code`
- **Strikethrough**: `~~text~~`
- **Links**: `[text](url)` with URL validation
- **Bold Links**: `**[text](url)**`

### Link Validation

Automatically validates and processes URLs:
- External URLs: `http://`, `https://`, `mailto:`
- Invalid/internal links: Converted to plain text
- Relative paths: Skipped (not supported in Notion)

### Image Processing

- Inline images: `![alt](url)`
- Integration with image processor for uploads
- Fallback to text representation

## Block Types

### Supported Elements

1. **Headings**: `#`, `##`, `###` (h1-h3)
2. **Paragraphs**: Regular text with rich formatting
3. **Code Blocks**: With language and metadata support
4. **Tables**: Full table conversion with headers
5. **Lists**: Bullet, numbered, and task lists
6. **Blockquotes**: `>` syntax
7. **Horizontal Rules**: `---`
8. **File Attachments**: Via special markers

### Section Boundaries

Smart section detection for optimal block grouping:
- Headings always create new sections
- Code blocks (3+ backticks) create isolated sections
- Tables, lists, blockquotes group appropriately
- Preserves paragraph structure

## Implementation Details

### Processing Pipeline

1. **Preprocessing**: Normalize line endings, remove excess whitespace
2. **Section Splitting**: Detect logical content boundaries
3. **Block Conversion**: Transform each section to Notion blocks
4. **Validation**: Ensure block structure compliance
5. **Chunking**: Split large block arrays for API limits

### Error Handling

- Graceful fallbacks for unsupported elements
- URL validation with plain text conversion
- Image processing error recovery
- Block validation and filtering

## Usage Examples

```javascript
const converter = new MarkdownToBlocksConverter(imageProcessor, diagramProcessor);
const blocks = await converter.convertToBlocks(markdown);
```

### Configuration Options

- `imageProcessor`: Handle image uploads and processing
- `diagramProcessor`: Process diagram code blocks
- `config`: Project configuration (root path, etc.)

## Performance Considerations

- Efficient regex-based parsing
- Minimal memory footprint
- Batch processing for large documents
- Chunked API submissions (100 blocks max)

## Limitations

- Notion API block limits (100 per request)
- Limited language support (maps to Notion's supported list)
- No support for custom HTML elements
- Relative links converted to plain text 