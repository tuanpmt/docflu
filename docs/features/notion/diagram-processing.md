# Diagram Processing Implementation

DocFlu's diagram processing system converts code blocks into high-quality SVG diagrams and uploads them directly to Notion as image blocks, supporting multiple diagram languages with fallback handling and safety measures.

## Overview

The `NotionDiagramProcessor` class handles comprehensive diagram processing for Notion integration:

- **Multi-Language Support**: Mermaid, PlantUML, Graphviz, and D2 diagrams
- **Direct SVG Upload**: Converts diagrams to SVG and uploads as image blocks via File Upload API
- **Safety Measures**: Infinite loop protection, content length limits, and iteration counting
- **Fallback Handling**: Graceful degradation to code blocks or error callouts on failure
- **Integrated Processing**: Seamless integration with markdown-to-blocks conversion
- **Error Recovery**: Comprehensive error handling with detailed logging

## Class Structure

```javascript
const processor = new NotionDiagramProcessor(notionClient, state, config, authToken);
```

**Parameters:**
- `notionClient`: Notion API client instance
- `state`: NotionState instance for caching
- `config`: Configuration object
- `authToken`: Notion API token (optional, defaults to env var)

## Supported Diagram Languages

### Language Support Matrix

| Language | Processor | SVG Output | Code Block Fallback | Error Callout |
|----------|-----------|------------|---------------------|---------------|
| `mermaid` | NotionMermaidProcessor | ✅ | ✅ | ✅ |
| `plantuml` | NotionPlantUMLProcessor | ✅ | ✅ | ✅ |
| `dot` | NotionGraphvizProcessor | ✅ | ✅ | ✅ |
| `graphviz` | NotionGraphvizProcessor | ✅ | ✅ | ✅ |
| `d2` | NotionD2Processor | ✅ | ✅ | ✅ |

### Processor Initialization

```javascript
constructor(notionClient, state, config, authToken = null) {
  this.client = notionClient;
  this.state = state;
  this.config = config;
  this.authToken = authToken || process.env.NOTION_API_TOKEN;
  
  // Initialize Notion-specific processors
  this.mermaidProcessor = new NotionMermaidProcessor(notionClient);
  this.plantumlProcessor = new NotionPlantUMLProcessor(notionClient);
  this.graphvizProcessor = new NotionGraphvizProcessor(notionClient);
  this.d2Processor = new NotionD2Processor(notionClient);
  
  // Initialize file uploader for SVG uploads
  this.fileUploader = new NotionFileUploader(notionClient, this.authToken);
  
  // Temporary directory for processing
  this.tempDir = path.join(process.cwd(), '.docusaurus', 'temp', 'notion-diagrams');
  fs.ensureDirSync(this.tempDir);
}
```

## Pattern Recognition

### Diagram Code Block Patterns

```javascript
this.patterns = {
  mermaid: /```mermaid\n([\s\S]*?)```/g,
  plantuml: /```plantuml\n([\s\S]*?)```/g,
  dot: /```dot\n([\s\S]*?)```/g,
  graphviz: /```graphviz\n([\s\S]*?)```/g,
  d2: /```d2\n([\s\S]*?)```/g
};
```

### Language Detection

```javascript
isDiagramLanguage(language) {
  return ['mermaid', 'plantuml', 'dot', 'graphviz', 'd2'].includes(language);
}
```

**Supported Patterns:**
- **Mermaid**: ````mermaid\n...\n```
- **PlantUML**: ````plantuml\n...\n```
- **Graphviz**: ````dot\n...\n````, ````graphviz\n...\n```
- **D2**: ````d2\n...\n```

## Core Processing Pipeline

### Main Processing Method with Safety Measures

```javascript
async processMarkdownWithDiagrams(markdown, dryRun = false, projectRoot = null) {
  console.log(chalk.blue('🔄 Processing diagrams for Notion with direct SVG upload...'));
  
  const blocks = [];
  let diagramsProcessed = 0;
  
  // Safety measures to prevent infinite loops
  const MAX_ITERATIONS = 10000;
  const MAX_MARKDOWN_LENGTH = 1000000; // 1MB limit
  const MAX_CODE_LINES = 1000; // Safety limit for code blocks
  
  // Check markdown length
  if (markdown.length > MAX_MARKDOWN_LENGTH) {
    console.warn(chalk.yellow(`⚠️ Markdown too long (${markdown.length} chars), truncating for safety`));
    markdown = markdown.substring(0, MAX_MARKDOWN_LENGTH) + '\n\n[Content truncated for safety]';
  }
  
  // Split markdown into lines for processing
  const lines = markdown.split('\n');
  let i = 0;
  let currentTextBlock = [];
  let iterationCount = 0;
  
  while (i < lines.length && iterationCount < MAX_ITERATIONS) {
    iterationCount++;
    
    // Safety check for infinite loop
    if (iterationCount >= MAX_ITERATIONS) {
      console.error(chalk.red(`❌ Maximum iterations reached (${MAX_ITERATIONS}), breaking to prevent infinite loop`));
      break;
    }
    
    const line = lines[i];
    
    // Check if this line starts a code block
    const codeBlockMatch = line.match(/^```(\w+)$/);
    if (codeBlockMatch) {
      const language = codeBlockMatch[1];
      
      // If we have accumulated text, convert it to blocks first
      if (currentTextBlock.length > 0) {
        const textContent = currentTextBlock.join('\n').trim();
        if (textContent) {
          try {
            const textBlocks = await this.convertTextToBlocks(textContent, projectRoot);
            blocks.push(...textBlocks);
          } catch (error) {
            console.warn(chalk.yellow(`⚠️ Failed to convert text to blocks: ${error.message}`));
            // Add as simple paragraph
            blocks.push({
              type: 'paragraph',
              paragraph: {
                rich_text: [{ text: { content: textContent } }]
              }
            });
          }
        }
        currentTextBlock = [];
      }
      
      // Find the end of the code block with safety limit
      let j = i + 1;
      const codeLines = [];
      
      while (j < lines.length && !lines[j].startsWith('```') && codeLines.length < MAX_CODE_LINES) {
        codeLines.push(lines[j]);
        j++;
      }
      
      if (j < lines.length) { // Found closing ```
        const codeContent = codeLines.join('\n').trim();
        
        // Check if this is a diagram language
        if (this.isDiagramLanguage(language)) {
          if (dryRun) {
            // Dry run: just analyze without generating
            console.log(chalk.cyan(`📊 DRY RUN: Found ${language.charAt(0).toUpperCase() + language.slice(1)} diagram (${codeContent.length} chars)`));
            blocks.push({
              type: 'paragraph',
              paragraph: {
                rich_text: [{ 
                  text: { content: `[DRY RUN - ${language.toUpperCase()} Diagram]` },
                  annotations: { italic: true, color: 'blue' }
                }]
              }
            });
            i = j + 1; // Skip past the closing ```
            continue;
          }
          
          // Process diagram code block
          const diagramId = `${language}-${crypto.createHash('md5').update(codeContent).digest('hex').substring(0, 8)}`;
          const diagram = {
            id: diagramId,
            code: codeContent,
            language: language
          };
          
          try {
            // Process diagram based on type
            let svgContent = null;
            
            if (language === 'mermaid') {
              const mermaidFile = await this.mermaidProcessor.generateDiagramImage(diagram);
              if (mermaidFile) {
                svgContent = await fs.readFile(mermaidFile, 'utf8');
                // Upload SVG to Notion
                const imageBlock = await this.fileUploader.uploadSvgToNotion(svgContent, `mermaid-diagram-${crypto.createHash('md5').update(svgContent).digest('hex').substring(0, 8)}.svg`);
                if (imageBlock) {
                  blocks.push(imageBlock);
                  diagramsProcessed++;
                }
              }
            } else if (language === 'plantuml') {
              const plantUMLFile = await this.plantumlProcessor.generatePlantUMLImage(diagram);
              if (plantUMLFile) {
                svgContent = await fs.readFile(plantUMLFile, 'utf8');
                // Upload SVG to Notion
                const imageBlock = await this.fileUploader.uploadSvgToNotion(svgContent, `plantuml-diagram-${crypto.createHash('md5').update(svgContent).digest('hex').substring(0, 8)}.svg`);
                if (imageBlock) {
                  blocks.push(imageBlock);
                  diagramsProcessed++;
                }
              }
            } else if (language === 'dot' || language === 'graphviz') {
              const graphvizFile = await this.graphvizProcessor.generateGraphvizImage(diagram);
              if (graphvizFile) {
                svgContent = await fs.readFile(graphvizFile, 'utf8');
                // Upload SVG to Notion
                const imageBlock = await this.fileUploader.uploadSvgToNotion(svgContent, `dot-diagram-${crypto.createHash('md5').update(svgContent).digest('hex').substring(0, 8)}.svg`);
                if (imageBlock) {
                  blocks.push(imageBlock);
                  diagramsProcessed++;
                }
              }
            } else if (language === 'd2') {
              const d2File = await this.d2Processor.generateD2Image(diagram);
              if (d2File) {
                svgContent = await fs.readFile(d2File, 'utf8');
                // Upload SVG to Notion
                const imageBlock = await this.fileUploader.uploadSvgToNotion(svgContent, `d2-diagram-${crypto.createHash('md5').update(svgContent).digest('hex').substring(0, 8)}.svg`);
                if (imageBlock) {
                  blocks.push(imageBlock);
                  diagramsProcessed++;
                }
              }
            }
            
            if (svgContent) {
              console.log(chalk.green(`✅ Processed ${language} diagram and uploaded`));
            } else {
              console.log(chalk.yellow(`⚠️ Failed to process ${language} diagram`));
            }
            
          } catch (error) {
            console.log(chalk.red(`❌ Error processing ${language} diagram: ${error.message}`));
            // Add error callout block instead of failing completely
            blocks.push({
              type: 'callout',
              callout: {
                rich_text: [{ 
                  text: { content: `Error processing ${language} diagram: ${error.message}` },
                  annotations: { color: 'red' }
                }],
                icon: { emoji: '⚠️' },
                color: 'red'
              }
            });
          }
          
          i = j + 1; // Skip past the closing ```
          continue;
        }
      }
      
      // Not a diagram, treat as regular code block
      if (j < lines.length) {
        const codeContent = codeLines.join('\n');
        blocks.push({
          type: 'code',
          code: {
            rich_text: [{ text: { content: codeContent } }],
            language: this.mapLanguageToNotion(language) || 'plain text'
          }
        });
        i = j + 1; // Skip past the closing ```
      } else {
        // No closing ```, treat as paragraph
        blocks.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: lines[i] } }]
          }
        });
        i++;
      }
    } else {
      // Regular line - accumulate in text block for proper markdown processing
      currentTextBlock.push(lines[i]);
      i++;
    }
  }
  
  // Process any remaining text block
  if (currentTextBlock.length > 0) {
    const textContent = currentTextBlock.join('\n').trim();
    if (textContent) {
      try {
        const textBlocks = await this.convertTextToBlocks(textContent, projectRoot);
        blocks.push(...textBlocks);
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Failed to convert final text to blocks: ${error.message}`));
        // Add as simple paragraph
        blocks.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: textContent } }]
          }
        });
      }
    }
  }
  
  if (diagramsProcessed > 0) {
    console.log(chalk.green(`✅ Processed ${diagramsProcessed} diagrams with direct SVG upload for Notion`));
  }
  
  return blocks;
}
```

**Key Safety Features:**
- **Iteration Limit**: Maximum 10,000 iterations to prevent infinite loops
- **Content Length Limit**: 1MB maximum markdown length with truncation
- **Code Block Limit**: Maximum 1,000 lines per code block
- **Error Recovery**: Comprehensive error handling with fallback blocks

## Individual Diagram Processors

### Mermaid Processor

```javascript
// Generate Mermaid diagram
const mermaidFile = await this.mermaidProcessor.generateDiagramImage(diagram);
if (mermaidFile) {
  svgContent = await fs.readFile(mermaidFile, 'utf8');
  const imageBlock = await this.fileUploader.uploadSvgToNotion(svgContent, `mermaid-diagram-${hash}.svg`);
  if (imageBlock) {
    blocks.push(imageBlock);
    diagramsProcessed++;
  }
}
```

**Features:**
- **CLI Detection**: Checks for `@mermaid-js/mermaid-cli` availability
- **Auto Installation**: Attempts to install via npm if missing
- **SVG Optimization**: SVGO processing for better Notion compatibility
- **Error Handling**: Graceful fallback to code blocks

### PlantUML Processor

```javascript
// Generate PlantUML diagram
const plantUMLFile = await this.plantumlProcessor.generatePlantUMLImage(diagram);
if (plantUMLFile) {
  svgContent = await fs.readFile(plantUMLFile, 'utf8');
  const imageBlock = await this.fileUploader.uploadSvgToNotion(svgContent, `plantuml-diagram-${hash}.svg`);
  if (imageBlock) {
    blocks.push(imageBlock);
    diagramsProcessed++;
  }
}
```

**Features:**
- **Java Detection**: Checks for Java runtime availability
- **PlantUML Download**: Downloads PlantUML JAR if needed
- **Multiple Formats**: Supports various PlantUML diagram types
- **Error Recovery**: Detailed error messages with installation guidance

### Graphviz Processor

```javascript
// Generate Graphviz diagram
const graphvizFile = await this.graphvizProcessor.generateGraphvizImage(diagram);
if (graphvizFile) {
  svgContent = await fs.readFile(graphvizFile, 'utf8');
  const imageBlock = await this.fileUploader.uploadSvgToNotion(svgContent, `dot-diagram-${hash}.svg`);
  if (imageBlock) {
    blocks.push(imageBlock);
    diagramsProcessed++;
  }
}
```

**Features:**
- **CLI Detection**: Checks for `dot` command availability
- **Platform Installation**: Platform-specific installation (brew, apt-get)
- **Language Support**: Supports both `dot` and `graphviz` language tags
- **Optimization**: Notion-optimized SVG generation settings

### D2 Processor

```javascript
// Generate D2 diagram
const d2File = await this.d2Processor.generateD2Image(diagram);
if (d2File) {
  svgContent = await fs.readFile(d2File, 'utf8');
  const imageBlock = await this.fileUploader.uploadSvgToNotion(svgContent, `d2-diagram-${hash}.svg`);
  if (imageBlock) {
    blocks.push(imageBlock);
    diagramsProcessed++;
  }
}
```

**Features:**
- **CLI Detection**: Checks for `d2` command availability
- **Auto Installation**: Platform-specific installation support
- **Syntax Validation**: Validates and fixes D2 syntax issues
- **Shape Mapping**: Maps unsupported shapes to supported ones

## Text Content Processing

### Markdown Converter Integration

```javascript
async convertTextToBlocks(text, projectRoot = null) {
  // Use proper markdown converter if available
  if (this.markdownConverter) {
    try {
      let blocks = await this.markdownConverter.convertToBlocks(text);
      // Process HTML images in blocks
      blocks = await this.processHtmlImagesInBlocks(blocks, projectRoot);
      return blocks;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Markdown converter failed, using fallback: ${error.message}`));
      // Fall back to simple conversion
    }
  }
  
  // Fallback: simple text to blocks conversion
  const blocks = [];
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (trimmed) {
      // Check for headings
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = Math.min(headingMatch[1].length, 3); // Notion supports h1, h2, h3
        const headingType = `heading_${level}`;
        
        blocks.push({
          type: headingType,
          [headingType]: {
            rich_text: [{ text: { content: headingMatch[2] } }]
          }
        });
      } else {
        // Regular paragraph
        blocks.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: trimmed } }]
          }
        });
      }
    }
  }
  
  return blocks;
}
```

**Features:**
- **Markdown Converter**: Uses full MarkdownToBlocksConverter when available
- **HTML Image Processing**: Processes HTML images in converted blocks
- **Fallback Mode**: Simple text-to-blocks conversion when converter unavailable
- **Heading Support**: Converts markdown headings to Notion heading blocks

## Error Handling and Fallbacks

### Error Callout Blocks

When diagram processing fails, the system creates informative error callouts:

```javascript
// Add error callout block instead of failing completely
blocks.push({
  type: 'callout',
  callout: {
    rich_text: [{ 
      text: { content: `Error processing ${language} diagram: ${error.message}` },
      annotations: { color: 'red' }
    }],
    icon: { emoji: '⚠️' },
    color: 'red'
  }
});
```

### Dry Run Support

```javascript
if (dryRun) {
  // Dry run: just analyze without generating
  console.log(chalk.cyan(`📊 DRY RUN: Found ${language.charAt(0).toUpperCase() + language.slice(1)} diagram (${codeContent.length} chars)`));
  blocks.push({
    type: 'paragraph',
    paragraph: {
      rich_text: [{ 
        text: { content: `[DRY RUN - ${language.toUpperCase()} Diagram]` },
        annotations: { italic: true, color: 'blue' }
      }]
    }
  });
  i = j + 1; // Skip past the closing ```
  continue;
}
```

## Language Mapping

### Notion Language Support

```javascript
mapLanguageToNotion(language) {
  const mapping = {
    'mermaid': 'plain text',
    'plantuml': 'plain text',
    'dot': 'plain text',
    'graphviz': 'plain text',
    'd2': 'plain text',
    'js': 'javascript',
    'javascript': 'javascript',
    'typescript': 'typescript',
    'python': 'python',
    'java': 'java',
    'json': 'json',
    'yaml': 'yaml',
    'xml': 'markup',
    'html': 'markup',
    'css': 'css',
    'sql': 'sql',
    'bash': 'shell',
    'shell': 'shell'
  };
  
  return mapping[language?.toLowerCase()] || 'plain text';
}
```

## Cleanup and Resource Management

### Temporary File Cleanup

```javascript
async cleanup() {
  try {
    // Clean up main temp directory
    if (await fs.pathExists(this.tempDir)) {
      await fs.remove(this.tempDir);
    }
    
    // Clean up individual processor temp directories
    await Promise.all([
      this.mermaidProcessor.cleanup(),
      this.plantumlProcessor.cleanup(),
      this.graphvizProcessor.cleanup(),
      this.d2Processor.cleanup()
    ]);
  } catch (error) {
    console.warn(chalk.yellow(`⚠️ Failed to clean up temp directories: ${error.message}`));
  }
}
```

## Statistics and Monitoring

### Processor Availability Check

```javascript
async checkProcessorAvailability() {
  try {
    return {
      mermaid: await this.mermaidProcessor.checkMermaidCLI(),
      plantuml: await this.plantumlProcessor.checkPlantUMLCLI(),
      graphviz: await this.graphvizProcessor.checkGraphvizCLI(),
      d2: await this.d2Processor.checkD2CLI()
    };
  } catch (error) {
    console.warn(chalk.yellow(`⚠️ Error checking processor availability: ${error.message}`));
    return {
      mermaid: false,
      plantuml: false,
      graphviz: false,
      d2: false
    };
  }
}
```

### Diagram Statistics

```javascript
getStatistics() {
  const uploadedFiles = this.state.getAllUploadedFiles();
  const diagrams = Object.values(uploadedFiles).filter(file => file.type === 'diagram');
  
  const stats = {
    total: diagrams.length,
    byType: {}
  };
  
  for (const diagram of diagrams) {
    const type = diagram.diagramType || 'unknown';
    stats.byType[type] = (stats.byType[type] || 0) + 1;
  }
  
  return stats;
}
```

## Usage Examples

### Basic Diagram Processing

```javascript
const processor = new NotionDiagramProcessor(notionClient, state, config);

// Process markdown with diagrams
const blocks = await processor.processMarkdownWithDiagrams(markdown, false, projectRoot);

// Add blocks to Notion page
await notionClient.appendBlocks(pageId, blocks);
```

### Dry Run Mode

```javascript
// Test diagram processing without actually generating SVGs
const blocks = await processor.processMarkdownWithDiagrams(markdown, true, projectRoot);
console.log(`Found ${blocks.filter(b => b.type === 'paragraph' && b.paragraph.rich_text[0]?.text?.content?.includes('DRY RUN')).length} diagrams`);
```

### Error Handling

```javascript
try {
  const blocks = await processor.processMarkdownWithDiagrams(markdown);
  await notionClient.appendBlocks(pageId, blocks);
} catch (error) {
  console.error(`Diagram processing failed: ${error.message}`);
  // Fallback to regular markdown processing
  const fallbackBlocks = await markdownConverter.convertToBlocks(markdown);
  await notionClient.appendBlocks(pageId, fallbackBlocks);
} finally {
  await processor.cleanup();
}
```

## Best Practices

### Performance Optimization

1. **Use Dry Run**: Test diagram processing before actual generation
2. **Monitor Content Length**: Be aware of markdown length limits
3. **Clean Up Resources**: Always call cleanup() after processing
4. **Check Availability**: Verify processor availability before use

### Error Recovery

1. **Graceful Degradation**: Always provide fallback blocks
2. **Informative Errors**: Use error callouts for user feedback
3. **Resource Cleanup**: Clean up even when errors occur
4. **Logging**: Comprehensive logging for debugging

### Safety Measures

1. **Iteration Limits**: Prevent infinite loops with MAX_ITERATIONS
2. **Content Limits**: Truncate oversized content safely
3. **Timeout Handling**: Handle long-running diagram generation
4. **Memory Management**: Clean up temporary files promptly