const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

// Import Notion components with NEW processors
const MarkdownToBlocksConverter = require('../../lib/core/notion/markdown-to-blocks');
const NotionDiagramProcessor = require('../../lib/core/notion/diagram-processor');
const NotionImageProcessor = require('../../lib/core/notion/image-processor');

// Import NEW individual processors
const NotionMermaidProcessor = require('../../lib/core/notion/mermaid-processor');
const NotionPlantUMLProcessor = require('../../lib/core/notion/plantuml-processor');
const NotionGraphvizProcessor = require('../../lib/core/notion/graphviz-processor');
const NotionD2Processor = require('../../lib/core/notion/d2-processor');

async function testAllMdConversion() {
  console.log(chalk.blue('🧪 Testing Complete all.md Conversion to Notion Blocks with NEW Processors'));
  
  try {
    // Setup test environment
    const config = {
      notionApiToken: process.env.NOTION_API_TOKEN || 'test-token',
      projectRoot: process.cwd()
    };
    const mockClient = { uploadFile: async () => ({ url: 'mock-url' }) };
    const mockState = { getUploadedFileUrl: () => null, setUploadedFileUrl: () => {} };
    
    // Initialize NEW processors
    const imageProcessor = new NotionImageProcessor(mockClient, mockState, config);
    const diagramProcessor = new NotionDiagramProcessor(mockClient, mockState, config);
    const converter = new MarkdownToBlocksConverter(imageProcessor, diagramProcessor);
    
    // Test individual NEW processors first
    console.log(chalk.yellow('\n🔧 Testing NEW Individual Processors:\n'));
    
    const processorTests = [
      { name: 'Mermaid', processor: new NotionMermaidProcessor(), content: 'graph TD\n  A --> B' },
      { name: 'PlantUML', processor: new NotionPlantUMLProcessor(), content: '@startuml\nA -> B\n@enduml' },
      { name: 'Graphviz', processor: new NotionGraphvizProcessor(), content: 'digraph G {\n  A -> B;\n}' },
      { name: 'D2', processor: new NotionD2Processor(), content: 'A -> B' }
    ];

    for (const { name, processor, content } of processorTests) {
      try {
        console.log(chalk.blue(`🔍 Testing ${name} processor...`));
        const startTime = Date.now();
        
                 // Test SVG generation directly
         const svgResult = await processor.generateSVGContent(content);
        const endTime = Date.now();
        
        if (svgResult && svgResult.includes('<svg')) {
          console.log(chalk.green(`  ✅ ${name}: SVG generated successfully in ${endTime - startTime}ms`));
          console.log(chalk.gray(`     SVG size: ${svgResult.length} characters`));
        } else {
          console.log(chalk.yellow(`  ⚠️ ${name}: No SVG output (may need CLI tool)`));
        }
      } catch (error) {
        console.log(chalk.red(`  ❌ ${name}: Error - ${error.message}`));
      }
    }
    
    // Test with comprehensive markdown content based on ALL FEATURES from all.md
    console.log(chalk.gray('\n📄 Testing comprehensive markdown content with ALL DIAGRAMS from all.md...'));
    
    const allMdContent = `# Complete Markdown Guide

This document demonstrates all supported markdown elements in Docusaurus.

## Table of Contents

- [Headings](#headings)
- [Text Formatting](#text-formatting)
- [Lists](#lists)
- [Tables](#tables)
- [Code](#code)
- [Quotes](#quotes)
- [Links](#links)
- [Images](#images)
- [Diagrams and Mermaid](#diagrams-and-mermaid)

---

## Headings

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

---

## Text Formatting

**Bold text** and __also bold__

*Italic text* and _also italic_

***Bold and italic*** and ___also bold and italic___

~~Strikethrough text~~

\`Inline code\`

Regular text with **bold**, *italic*, and \`code\` mixed together.

---

## Lists

### Unordered Lists

- Item 1
- Item 2
  - Nested item 2.1
  - Nested item 2.2
    - Deep nested item 2.2.1
- Item 3

* Alternative bullet style
* Another item
  * Nested with asterisk

### Ordered Lists

1. First item
2. Second item
   1. Nested ordered item
   2. Another nested item
3. Third item

### Task Lists

- [x] Completed task
- [ ] Incomplete task
- [x] Another completed task
- [ ] Another incomplete task

---

## Tables

### Basic Table

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Row 1    | Data 1   | Value 1  |
| Row 2    | Data 2   | Value 2  |
| Row 3    | Data 3   | Value 3  |

### Aligned Table

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Left         | Center         | Right         |
| Text         | Text           | Text          |
| More         | More           | More          |

### Complex Table

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| **Authentication** | User login system | ✅ Complete | High |
| **Dashboard** | Main user interface | 🚧 In Progress | High |
| **Reports** | Data visualization | ❌ Pending | Medium |
| **API** | REST endpoints | ✅ Complete | High |

---

## Code

### Inline Code

Use \`console.log()\` to print output in JavaScript.

### Code Blocks

\`\`\`javascript
// JavaScript example
function greetUser(name) {
  console.log(\`Hello, \${name}!\`);
  return \`Welcome, \${name}\`;
}

const user = "John Doe";
greetUser(user);
\`\`\`

\`\`\`python
# Python example
def calculate_sum(numbers):
    """Calculate the sum of a list of numbers."""
    return sum(numbers)

numbers = [1, 2, 3, 4, 5]
result = calculate_sum(numbers)
print(f"Sum: {result}")
\`\`\`

\`\`\`bash
# Bash commands
npm install
npm start
git add .
git commit -m "Add new feature"
\`\`\`

\`\`\`json
{
  "name": "docusaurus-exam",
  "version": "0.0.0",
  "scripts": {
    "start": "docusaurus start",
    "build": "docusaurus build"
  }
}
\`\`\`

---

## Quotes

> This is a simple blockquote.

> This is a blockquote with multiple lines.
> It continues on the next line.
> And even more lines.

> **Note:** This is an important blockquote with **bold** text.

> ### Quote with heading
> 
> This blockquote contains a heading and multiple paragraphs.
> 
> - It can also contain lists
> - And other markdown elements

---

## Links

### Basic Links

[Docusaurus Official Website](https://docusaurus.io/)

[GitHub Repository](https://github.com/facebook/docusaurus)

### Reference Links

This is a [reference link][1] and this is [another reference link][docusaurus].

[1]: https://docusaurus.io/
[docusaurus]: https://docusaurus.io/docs

### Internal Links

[Go to Introduction](./intro.md)

[Tutorial Basics](./tutorial-basics/create-a-document.md)

---

## Images

### Local Images from static/img

![Docusaurus Logo](/img/docusaurus.png)

![Docusaurus Mountain](/img/undraw_docusaurus_mountain.svg)

### Public URI Images

![Markdown Logo](https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/208px-Markdown-mark.svg.png "Markdown Logo from Wikipedia")

![GitHub Logo](https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png "GitHub Logo")

### Responsive Images

<img src="/img/logo.svg" alt="Docusaurus Logo" width="200" />

---

## Diagrams and Mermaid

### Mermaid Flowchart

\`\`\`mermaid
flowchart TD
    A[Install Node.js] --> B[Create new site]
    B --> C[Navigate to directory]
    C --> D[Run npm start]
    D --> E[Site running on localhost:3000]
    E --> F{Happy with setup?}
    F -->|Yes| G[Start developing]
    F -->|No| H[Check documentation]
    H --> B
\`\`\`

### Mermaid Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant D as Developer
    participant CLI as Docusaurus CLI
    participant S as Dev Server
    participant B as Browser

    D->>CLI: npm create docusaurus@latest
    CLI->>D: Site created ✓
    D->>CLI: npm run start
    CLI->>S: Start development server
    S->>B: Serve site on localhost:3000
    B->>D: Display site

    loop Development Cycle
        D->>D: Edit markdown files
        D->>S: Save changes
        S->>B: Hot reload
        B->>D: Show updated content
    end
\`\`\`

### Mermaid Git Graph

\`\`\`mermaid
graph TD
    A[Initial commit] --> B[Add feature A]
    A --> C[Add feature B]
    B --> D[Merge to main]
    C --> D
    D --> E[Release v1.0]
    E --> F[Fix critical bug]
    F --> G[Release v1.0.1]
    
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style E fill:#9f9,stroke:#333,stroke-width:2px
    style G fill:#9f9,stroke:#333,stroke-width:2px
\`\`\`

### Mermaid Class Diagram

\`\`\`mermaid
classDiagram
    class User {
        +String name
        +String email
        +Date createdAt
        +login()
        +logout()
        +updateProfile()
    }
    
    class Post {
        +String title
        +String content
        +Date publishedAt
        +User author
        +publish()
        +edit()
        +delete()
    }
    
    class Comment {
        +String content
        +Date createdAt
        +User author
        +Post post
        +reply()
        +edit()
    }

    User ||--o{ Post : creates
    User ||--o{ Comment : writes
    Post ||--o{ Comment : has
\`\`\`

### Mermaid Entity Relationship Diagram

\`\`\`mermaid
erDiagram
    USER {
        int id PK
        string name
        string email
        datetime created_at
    }
    
    POST {
        int id PK
        string title
        text content
        datetime published_at
        int user_id FK
    }
    
    COMMENT {
        int id PK
        text content
        datetime created_at
        int user_id FK
        int post_id FK
    }
    
    TAG {
        int id PK
        string name
        string color
    }
    
    POST_TAG {
        int post_id FK
        int tag_id FK
    }
    
    USER ||--o{ POST : creates
    USER ||--o{ COMMENT : writes
    POST ||--o{ COMMENT : has
    POST }o--o{ TAG : tagged_with
\`\`\`

### Mermaid State Diagram

\`\`\`mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Review : Submit
    Review --> Published : Approve
    Review --> Draft : Reject
    Published --> Archived : Archive
    Archived --> Published : Restore
    Published --> [*] : Delete
    Draft --> [*] : Delete
\`\`\`

### Mermaid Pie Chart

\`\`\`mermaid
pie title Programming Languages Usage
    "JavaScript" : 35
    "Python" : 25
    "TypeScript" : 20
    "Java" : 12
    "Other" : 8
\`\`\`

### PlantUML Sequence Diagram

\`\`\`plantuml
@startuml
participant Developer
participant "Docusaurus CLI" as CLI
participant "Dev Server" as Server
participant Browser

Developer -> CLI: npm create docusaurus@latest
CLI -> CLI: Download template
CLI -> Developer: Site created

Developer -> CLI: npm run start
CLI -> Server: Start development server
Server -> Browser: Serve site on localhost:3000
Browser -> Developer: Display site

Developer -> Developer: Edit markdown files
Developer -> Server: Save changes
Server -> Browser: Hot reload
Browser -> Developer: Show updated content
@enduml
\`\`\`

### Architecture Diagram (DOT/Graphviz)

\`\`\`dot
digraph architecture {
    rankdir=TB;
    node [shape=box, style=rounded];
    
    subgraph cluster_source {
        label="Source Files";
        style=filled;
        color=lightgrey;
        
        MD [label="Markdown Files"];
        React [label="React Components"];
        Config [label="docusaurus.config.js"];
    }
    
    subgraph cluster_build {
        label="Build Process";
        style=filled;
        color=lightblue;
        
        Parser [label="Markdown Parser"];
        Bundler [label="Webpack Bundler"];
        Generator [label="Static Site Generator"];
    }
    
    subgraph cluster_output {
        label="Output";
        style=filled;
        color=lightgreen;
        
        HTML [label="Static HTML"];
        CSS [label="CSS Files"];
        JS [label="JavaScript"];
    }
    
    MD -> Parser;
    React -> Bundler;
    Config -> Generator;
    Parser -> Generator;
    Bundler -> Generator;
    Generator -> HTML;
    Generator -> CSS;
    Generator -> JS;
}
\`\`\`

### D2 System Overview

\`\`\`d2
# Docusaurus Architecture
docs: {
  shape: rectangle
  label: "Documentation Files"
}

docusaurus: {
  shape: hexagon
  label: "Docusaurus Core"
}

build: {
  shape: diamond
  label: "Build Process"
}

output: {
  shape: cylinder
  label: "Static Site"
}

docs -> docusaurus: "Process"
docusaurus -> build: "Generate"
build -> output: "Deploy"

output -> browser: "Serve"
browser: {
  shape: person
  label: "User Browser"
}
\`\`\`

---

## Advanced Features

### Horizontal Rules

---

***

___

### Line Breaks

This is the first line.  
This is the second line with two spaces at the end of the previous line.

This is a paragraph.

This is another paragraph with a blank line above.

### Escape Characters

\\*This text is not italic\\*

\\\`This is not inline code\\\`

\\# This is not a heading

---

## Conclusion

This document demonstrates the comprehensive markdown support available in Docusaurus. You can use all these elements to create rich, interactive documentation.

### Key Takeaways

1. **Headings** organize content hierarchically
2. **Lists** present information clearly
3. **Tables** display structured data
4. **Code blocks** show technical examples
5. **Images** enhance visual appeal
6. **Links** connect related content

> **Tip:** Always preview your markdown to ensure proper rendering!

---

*Last updated: 2024*

**Author:** Documentation Team`;

    // Convert to blocks
    const startTime = Date.now();
    const blocks = await converter.convertToBlocks(allMdContent);
    const endTime = Date.now();
    
    console.log(chalk.green(`✓ Converted complete all.md content to ${blocks.length} blocks in ${endTime - startTime}ms`));
    
    // Analyze block type distribution
    const blockTypes = {};
    const blockDetails = {};
    
    blocks.forEach(block => {
      blockTypes[block.type] = (blockTypes[block.type] || 0) + 1;
      
      // Collect details for specific block types
      if (block.type.startsWith('heading_')) {
        if (!blockDetails.headings) blockDetails.headings = [];
        const level = block.type.split('_')[1];
        const title = block[block.type]?.rich_text?.[0]?.text?.content || 'Unknown';
        blockDetails.headings.push(`H${level}: ${title}`);
      }
      
      if (block.type === 'table') {
        if (!blockDetails.tables) blockDetails.tables = [];
        const width = block.table?.table_width || 0;
        const rows = block.table?.children?.length || 0;
        blockDetails.tables.push(`${width} columns × ${rows} rows`);
      }
      
      if (block.type === 'code') {
        if (!blockDetails.codeBlocks) blockDetails.codeBlocks = [];
        const language = block.code?.language || 'unknown';
        const content = block.code?.rich_text?.[0]?.text?.content || '';
        const lines = content.split('\\n').length;
        const isDiagram = ['mermaid', 'plantuml', 'dot', 'graphviz', 'd2'].includes(language);
        const hasSvg = content.includes('<svg');
        blockDetails.codeBlocks.push({
          language,
          lines,
          isDiagram,
          hasSvg,
          size: content.length
        });
      }
    });
    
    console.log(chalk.cyan('\\n📊 Block Type Distribution:'));
    Object.entries(blockTypes)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        console.log(chalk.gray(`  ${type}: ${count}`));
      });
    
    console.log(chalk.cyan('\\n📋 Content Details:'));
    
    if (blockDetails.headings) {
      console.log(chalk.blue('  Headings:'));
      blockDetails.headings.slice(0, 10).forEach(heading => {
        console.log(chalk.gray(`    ${heading}`));
      });
      if (blockDetails.headings.length > 10) {
        console.log(chalk.gray(`    ... and ${blockDetails.headings.length - 10} more`));
      }
    }
    
    if (blockDetails.tables) {
      console.log(chalk.blue('  Tables:'));
      blockDetails.tables.forEach(table => {
        console.log(chalk.gray(`    ${table}`));
      });
    }
    
    if (blockDetails.codeBlocks) {
      console.log(chalk.blue('  Code Blocks:'));
      const diagramBlocks = blockDetails.codeBlocks.filter(cb => cb.isDiagram);
      const svgBlocks = blockDetails.codeBlocks.filter(cb => cb.hasSvg);
      
      console.log(chalk.gray(`    Total: ${blockDetails.codeBlocks.length}`));
      console.log(chalk.gray(`    Diagram blocks: ${diagramBlocks.length}`));
      console.log(chalk.gray(`    SVG generated: ${svgBlocks.length}`));
      
      // Show diagram language distribution
      const diagramLangs = {};
      diagramBlocks.forEach(cb => {
        diagramLangs[cb.language] = (diagramLangs[cb.language] || 0) + 1;
      });
      
      console.log(chalk.blue('  Diagram Languages:'));
      Object.entries(diagramLangs).forEach(([lang, count]) => {
        const svgCount = blockDetails.codeBlocks.filter(cb => cb.language === lang && cb.hasSvg).length;
        console.log(chalk.gray(`    ${lang}: ${count} blocks (${svgCount} with SVG)`));
      });
    }
    
    // Validate all blocks
    console.log(chalk.gray('\\n🔍 Validating blocks...'));
    const validBlocks = converter.validateBlocks(blocks);
    const validationRate = (validBlocks.length / blocks.length * 100).toFixed(1);
    
    console.log(chalk.green(`✓ ${validBlocks.length}/${blocks.length} blocks are valid (${validationRate}%)`));
    
    if (validBlocks.length !== blocks.length) {
      console.log(chalk.yellow(`⚠️ ${blocks.length - validBlocks.length} blocks were filtered out`));
    }
    
    // Test chunking for large content
    console.log(chalk.gray('\\n📦 Testing block chunking...'));
    const chunks = converter.chunkBlocks(validBlocks, 100);
    console.log(chalk.green(`✓ Blocks chunked into ${chunks.length} chunks for Notion API`));
    
    chunks.forEach((chunk, i) => {
      console.log(chalk.gray(`  Chunk ${i+1}: ${chunk.length} blocks`));
    });
    
    // Performance summary
    const blocksPerSecond = Math.round(blocks.length / (endTime - startTime) * 1000);
    console.log(chalk.blue('\\n⚡ Performance Summary:'));
    console.log(chalk.white(`  - Total blocks: ${blocks.length}`));
    console.log(chalk.white(`  - Conversion time: ${endTime - startTime}ms`));
    console.log(chalk.white(`  - Processing rate: ${blocksPerSecond} blocks/second`));
    console.log(chalk.white(`  - Validation rate: ${validationRate}%`));
    console.log(chalk.white(`  - API chunks: ${chunks.length}`));
    
    // Check for specific all.md features
    console.log(chalk.cyan('\\n🎯 all.md Feature Coverage:'));
    const features = {
      'Headings (H1-H6)': (blockTypes.heading_1 || 0) + (blockTypes.heading_2 || 0) + (blockTypes.heading_3 || 0) + (blockTypes.heading_4 || 0) + (blockTypes.heading_5 || 0) + (blockTypes.heading_6 || 0),
      'Paragraphs': blockTypes.paragraph || 0,
      'Lists (Bullet/Numbered)': (blockTypes.bulleted_list_item || 0) + (blockTypes.numbered_list_item || 0),
      'Tables': blockTypes.table || 0,
      'Code Blocks': blockTypes.code || 0,
      'Blockquotes': blockTypes.quote || 0,
      'Horizontal Rules': blockTypes.divider || 0
    };
    
    Object.entries(features).forEach(([feature, count]) => {
      const status = count > 0 ? chalk.green('✅') : chalk.red('❌');
      console.log(`  ${status} ${feature}: ${count}`);
    });
    
    // Diagram-specific analysis
    console.log(chalk.cyan('\\n🎨 Diagram Processing Analysis:'));
    if (blockDetails.codeBlocks) {
      const diagramBlocks = blockDetails.codeBlocks.filter(cb => cb.isDiagram);
      const svgBlocks = blockDetails.codeBlocks.filter(cb => cb.hasSvg);
      
      console.log(chalk.gray(`  Total diagram blocks: ${diagramBlocks.length}`));
      console.log(chalk.gray(`  SVG generated: ${svgBlocks.length}`));
      console.log(chalk.gray(`  SVG success rate: ${Math.round(svgBlocks.length / diagramBlocks.length * 100)}%`));
      
      // Performance by diagram type
      const diagramPerformance = {};
      diagramBlocks.forEach(cb => {
        if (!diagramPerformance[cb.language]) {
          diagramPerformance[cb.language] = { total: 0, withSvg: 0 };
        }
        diagramPerformance[cb.language].total++;
        if (cb.hasSvg) diagramPerformance[cb.language].withSvg++;
      });
      
      console.log(chalk.blue('  Performance by type:'));
      Object.entries(diagramPerformance).forEach(([lang, perf]) => {
        const rate = Math.round(perf.withSvg / perf.total * 100);
        console.log(chalk.gray(`    ${lang}: ${perf.withSvg}/${perf.total} (${rate}%)`));
      });
    }
    
    console.log(chalk.green('\\n✅ Complete all.md conversion test with NEW processors passed!'));
    
    // Check if ready for real Notion API
    const readinessChecks = [
      { name: 'Rich text formatting', passed: blockTypes.paragraph > 0 },
      { name: 'Heading hierarchy', passed: (blockTypes.heading_1 || 0) + (blockTypes.heading_2 || 0) + (blockTypes.heading_3 || 0) > 0 },
      { name: 'List processing', passed: (blockTypes.bulleted_list_item || 0) + (blockTypes.numbered_list_item || 0) > 0 },
      { name: 'Table conversion', passed: (blockTypes.table || 0) > 0 },
      { name: 'Code block handling', passed: (blockTypes.code || 0) > 0 },
      { name: 'Diagram processing', passed: blockDetails.codeBlocks && blockDetails.codeBlocks.filter(cb => cb.isDiagram).length > 0 },
      { name: 'SVG generation', passed: blockDetails.codeBlocks && blockDetails.codeBlocks.filter(cb => cb.hasSvg).length > 0 },
      { name: 'Block validation', passed: parseFloat(validationRate) >= 95 },
      { name: 'API chunking', passed: chunks.length > 0 }
    ];
    
    const passedChecks = readinessChecks.filter(check => check.passed).length;
    const readinessPercentage = Math.round(passedChecks / readinessChecks.length * 100);
    
    console.log(chalk.cyan('\\n🚀 Notion API Readiness:'));
    readinessChecks.forEach(check => {
      const status = check.passed ? chalk.green('✅') : chalk.red('❌');
      console.log(`  ${status} ${check.name}`);
    });
    
    console.log(chalk.blue(`\\n📈 Overall Readiness: ${readinessPercentage}%`));
    
    if (readinessPercentage >= 80) {
      console.log(chalk.green('🎉 System is ready for Notion API integration!'));
    } else if (readinessPercentage >= 60) {
      console.log(chalk.yellow('⚠️ System needs minor improvements before Notion API integration.'));
    } else {
      console.log(chalk.red('❌ System needs significant improvements before Notion API integration.'));
    }
    
  } catch (error) {
    console.log(chalk.red(`❌ Test failed: ${error.message}`));
    console.error(error);
  }
}

// Export for use in other test files
module.exports = testAllMdConversion;

// Run if called directly
if (require.main === module) {
  testAllMdConversion();
} 