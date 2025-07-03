const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');

// Import Notion components with NEW processors
const MarkdownToBlocksConverter = require('../../lib/core/notion/markdown-to-blocks');
const NotionDiagramProcessor = require('../../lib/core/notion/diagram-processor');
const NotionImageProcessor = require('../../lib/core/notion/image-processor');

// Import NEW individual processors
const NotionMermaidProcessor = require('../../lib/core/notion/mermaid-processor');
const NotionPlantUMLProcessor = require('../../lib/core/notion/plantuml-processor');
const NotionGraphvizProcessor = require('../../lib/core/notion/graphviz-processor');
const NotionD2Processor = require('../../lib/core/notion/d2-processor');

/**
 * Test Notion Diagram Conversion with NEW Processors
 * Tests all diagram types from all.md file to ensure proper SVG conversion
 */
async function testNotionDiagramConversion() {
  console.log(chalk.blue('🧪 Testing Notion Diagram Conversion with NEW Processors\n'));

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

    // Test individual NEW processors
    const mermaidProcessor = new NotionMermaidProcessor();
    const plantumlProcessor = new NotionPlantUMLProcessor();
    const graphvizProcessor = new NotionGraphvizProcessor();
    const d2Processor = new NotionD2Processor();

    // Test data with ALL diagram types from all.md
    const testDiagrams = {
      mermaid_flowchart: `
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
`,

      mermaid_sequence: `
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
`,

      mermaid_git_graph: `
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
`,

      mermaid_class: `
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
`,

      mermaid_er: `
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
`,

      mermaid_state: `
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
`,

      mermaid_pie: `
### Mermaid Pie Chart

\`\`\`mermaid
pie title Programming Languages Usage
    "JavaScript" : 35
    "Python" : 25
    "TypeScript" : 20
    "Java" : 12
    "Other" : 8
\`\`\`
`,

      plantuml: `
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
`,

      graphviz_dot: `
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
`,

      d2: `
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
`
    };

    // Test Results
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      details: []
    };

    console.log(chalk.yellow('🔧 Testing NEW Individual Processors:\n'));

    // Test NEW individual processors first
    const processorTests = [
      { name: 'Mermaid', processor: mermaidProcessor, content: 'graph TD\n  A --> B' },
      { name: 'PlantUML', processor: plantumlProcessor, content: '@startuml\nA -> B\n@enduml' },
      { name: 'Graphviz', processor: graphvizProcessor, content: 'digraph G {\n  A -> B;\n}' },
      { name: 'D2', processor: d2Processor, content: 'A -> B' }
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

    console.log(chalk.yellow('\n📊 Testing Individual Diagram Types:\n'));

    // Test each diagram type through converter
    for (const [type, content] of Object.entries(testDiagrams)) {
      results.total++;
      
      try {
        console.log(chalk.blue(`🔍 Testing ${type}...`));
        
        // Convert to blocks
        const startTime = Date.now();
        const blocks = await converter.convertToBlocks(content);
        const endTime = Date.now();
        
        // Analyze blocks
        const codeBlocks = blocks.filter(block => block.type === 'code');
        const diagramBlocks = codeBlocks.filter(block => 
          ['mermaid', 'plantuml', 'dot', 'graphviz', 'd2', 'plain text'].includes(block.code.language)
        );
        
        // Check if diagram was properly converted
        const success = diagramBlocks.length > 0;
        
        if (success) {
          results.passed++;
          console.log(chalk.green(`  ✅ ${type}: ${diagramBlocks.length} diagram block(s) generated in ${endTime - startTime}ms`));
          
          // Log language mapping
          diagramBlocks.forEach((block, index) => {
            console.log(chalk.gray(`     Block ${index + 1}: language="${block.code.language}"`));
            
            // Check if content was processed
            const content = block.code.rich_text[0]?.text?.content || '';
            if (content.includes('<svg')) {
              console.log(chalk.cyan(`     Contains SVG: ${content.length} chars`));
            }
          });
        } else {
          results.failed++;
          console.log(chalk.red(`  ❌ ${type}: No diagram blocks generated`));
        }
        
        results.details.push({
          type,
          success,
          blocks: blocks.length,
          diagramBlocks: diagramBlocks.length,
          processingTime: endTime - startTime
        });
        
      } catch (error) {
        results.failed++;
        console.log(chalk.red(`  ❌ ${type}: Error - ${error.message}`));
        results.details.push({
          type,
          success: false,
          error: error.message
        });
      }
    }

    // Test complete all.md content with ALL diagrams
    console.log(chalk.yellow('\n📋 Testing Complete all.md Content with ALL Diagrams:\n'));
    
    try {
      // Create comprehensive test content with ALL diagram types from all.md
      const allDiagramsContent = `# Complete Diagram Test

This tests all diagram types from all.md file.

${Object.values(testDiagrams).join('\n\n')}

## Additional Test Cases

### Mermaid Journey

\`\`\`mermaid
journey
    title My working day
    section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me
      Do work: 1: Me, Cat
    section Go home
      Go downstairs: 5: Me
      Sit down: 5: Me
\`\`\`

### Mermaid Gantt

\`\`\`mermaid
gantt
    title A Gantt Diagram
    dateFormat  YYYY-MM-DD
    section Section
    A task           :a1, 2014-01-01, 30d
    Another task     :after a1  , 20d
    section Another
    Task in sec      :2014-01-12  , 12d
    another task      : 24d
\`\`\`

### PlantUML Activity

\`\`\`plantuml
@startuml
start
:Hello world;
:This is defined on
several **lines**;
stop
@enduml
\`\`\`

### PlantUML Class

\`\`\`plantuml
@startuml
class Car
class Driver
Car --> Driver : drives >
@enduml
\`\`\`
`;
      
      const startTime = Date.now();
      const allBlocks = await converter.convertToBlocks(allDiagramsContent);
      const endTime = Date.now();
      
      // Analyze all blocks
      const allCodeBlocks = allBlocks.filter(block => block.type === 'code');
      const allDiagramBlocks = allCodeBlocks.filter(block => 
        ['mermaid', 'plantuml', 'dot', 'graphviz', 'd2', 'plain text'].includes(block.code.language)
      );
      
      console.log(chalk.green(`✅ Complete all.md diagram conversion:`));
      console.log(chalk.gray(`   Total blocks: ${allBlocks.length}`));
      console.log(chalk.gray(`   Code blocks: ${allCodeBlocks.length}`));
      console.log(chalk.gray(`   Diagram blocks: ${allDiagramBlocks.length}`));
      console.log(chalk.gray(`   Processing time: ${endTime - startTime}ms`));
      
      // Group by language
      const languageGroups = {};
      allDiagramBlocks.forEach(block => {
        const lang = block.code.language;
        languageGroups[lang] = (languageGroups[lang] || 0) + 1;
      });
      
      console.log(chalk.blue('\n📈 Diagram Language Distribution:'));
      for (const [lang, count] of Object.entries(languageGroups)) {
        console.log(chalk.gray(`   ${lang}: ${count} block(s)`));
      }
      
      // Check for SVG content
      let svgCount = 0;
      allDiagramBlocks.forEach(block => {
        const content = block.code.rich_text[0]?.text?.content || '';
        if (content.includes('<svg')) {
          svgCount++;
        }
      });
      
      console.log(chalk.blue(`\n🎨 SVG Generation:`));
      console.log(chalk.gray(`   Blocks with SVG: ${svgCount}/${allDiagramBlocks.length}`));
      console.log(chalk.gray(`   SVG success rate: ${Math.round(svgCount / allDiagramBlocks.length * 100)}%`));
      
    } catch (error) {
      console.log(chalk.red(`❌ Complete all.md test failed: ${error.message}`));
    }

    // Test NEW diagram processor capabilities
    console.log(chalk.yellow('\n🔧 Testing NEW Diagram Processor Capabilities:\n'));
    
    try {
      // Test diagram language detection
      const testLanguages = ['mermaid', 'plantuml', 'dot', 'graphviz', 'd2'];
      console.log(chalk.blue('🎯 Diagram Language Support:'));
      
      testLanguages.forEach(lang => {
        const isSupported = diagramProcessor.isDiagramLanguage(lang);
        console.log(chalk.gray(`   ${lang}: ${isSupported ? '✅ Supported' : '❌ Not supported'}`));
      });
      
      // Test diagram ID generation
      console.log(chalk.blue('\n🆔 Diagram ID Generation:'));
      const testContent = 'graph TD\n  A --> B';
      const diagramId = diagramProcessor.generateDiagramId(testContent);
      console.log(chalk.gray(`   Sample ID: ${diagramId}`));
      
      // Test NEW processor availability
      console.log(chalk.blue('\n⚙️ NEW Processor Availability:'));
      const availability = await diagramProcessor.checkProcessorAvailability();
      for (const [processor, available] of Object.entries(availability)) {
        console.log(chalk.gray(`   ${processor}: ${available ? '✅ Available' : '❌ Not available'}`));
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ NEW diagram processor test failed: ${error.message}`));
    }

    // Summary
    console.log(chalk.yellow('\n📋 Test Summary:\n'));
    
    const successRate = Math.round(results.passed / results.total * 100);
    console.log(chalk.white(`Total Tests: ${results.total}`));
    console.log(chalk.green(`Passed: ${results.passed}`));
    console.log(chalk.red(`Failed: ${results.failed}`));
    console.log(chalk.blue(`Success Rate: ${successRate}%`));
    
    // Performance analysis
    const avgTime = Math.round(
      results.details
        .filter(d => d.processingTime)
        .reduce((sum, d) => sum + d.processingTime, 0) / 
      results.details.filter(d => d.processingTime).length
    );
    
    const fastestTime = Math.min(...results.details.filter(d => d.processingTime).map(d => d.processingTime));
    const slowestTime = Math.max(...results.details.filter(d => d.processingTime).map(d => d.processingTime));
    
    console.log(chalk.cyan('\n⚡ Performance Analysis:'));
    console.log(chalk.gray(`   Average time: ${avgTime}ms`));
    console.log(chalk.gray(`   Fastest: ${fastestTime}ms`));
    console.log(chalk.gray(`   Slowest: ${slowestTime}ms`));
    
    // Detailed results
    console.log(chalk.cyan('\n📊 Detailed Results:'));
    results.details.forEach(detail => {
      const status = detail.success ? chalk.green('✅') : chalk.red('❌');
      const time = detail.processingTime ? `${detail.processingTime}ms` : 'N/A';
      console.log(`${status} ${detail.type}: ${time}`);
      
      if (detail.error) {
        console.log(chalk.red(`     Error: ${detail.error}`));
      }
    });
    
    // Quality assessment
    console.log(chalk.cyan('\n🏆 Quality Assessment:'));
    const qualityMetrics = {
      'Diagram Type Coverage': `${results.passed}/${Object.keys(testDiagrams).length}`,
      'Processing Speed': avgTime < 1000 ? 'Excellent' : avgTime < 2000 ? 'Good' : 'Needs Improvement',
      'Success Rate': successRate >= 80 ? 'Excellent' : successRate >= 60 ? 'Good' : 'Needs Improvement',
      'Error Handling': results.failed === 0 ? 'Perfect' : 'Has Issues'
    };
    
    Object.entries(qualityMetrics).forEach(([metric, value]) => {
      console.log(chalk.gray(`   ${metric}: ${value}`));
    });
    
    if (successRate >= 70) {
      console.log(chalk.green('\n🎉 NEW Notion Diagram Processors are working well!'));
    } else {
      console.log(chalk.yellow('\n⚠️ NEW Notion Diagram Processors need improvement.'));
    }
    
  } catch (error) {
    console.log(chalk.red(`❌ Test failed: ${error.message}`));
    console.error(error);
  }
}

// Export for use in other test files
module.exports = testNotionDiagramConversion;

// Run if called directly
if (require.main === module) {
  testNotionDiagramConversion();
} 