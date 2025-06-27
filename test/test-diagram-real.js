const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const MarkdownParser = require('../lib/core/markdown-parser');

// Mock Confluence Client
class MockConfluenceClient {
  constructor() {
    this.uploadedAttachments = new Map();
    this.pageId = 'test-page-123';
  }

  async api(config) {
    const { method, url } = config;
    
    if (method === 'POST' && url.includes('/child/attachment')) {
      // Mock successful attachment upload
      const mockAttachment = {
        id: `attachment-${Date.now()}`,
        title: `diagram-${Date.now()}.svg`,
        _links: {
          download: `/download/attachments/${this.pageId}/diagram.svg`,
          webui: `/pages/viewpage.action?pageId=${this.pageId}`
        }
      };

      return {
        data: {
          results: [mockAttachment]
        }
      };
    }

    if (method === 'GET' && url.includes('/child/attachment')) {
      // Mock check existing attachments - return empty
      return {
        data: {
          results: []
        }
      };
    }

    throw new Error(`Mock API: Unhandled request ${method} ${url}`);
  }
}

async function testRealDiagramConversion() {
  console.log(chalk.blue('🧪 Testing Real Diagram Conversion'));
  console.log('=' .repeat(50));

  try {
    const mockClient = new MockConfluenceClient();
    
    // Test with real markdown content containing diagrams
    const markdownWithDiagram = `# Test Document

Here's a simple flowchart:

\`\`\`mermaid
flowchart TD
    A[Configure i18n in docusaurus.config.js] --> B[Copy docs/intro.md to i18n/fr/]
    B --> C[Translate intro.md to French]
    C --> D[Start site in French locale<br/>npm run start -- --locale fr]
    D --> E[Add Locale Dropdown in config]
    E --> F[Build site for all or specific locales]
\`\`\`

Some regular content after the diagram.

And here's a PlantUML sequence:

\`\`\`plantuml
@startuml
Alice -> Bob: Hello
Bob -> Alice: Hi there!
@enduml
\`\`\`

End of document.`;

    console.log(chalk.cyan('\n📝 Original Markdown:'));
    console.log(markdownWithDiagram.substring(0, 300) + '...');

    // Parse without pageId (no diagram processing)
    const parser = new MarkdownParser(null, null, mockClient);
    const resultWithoutDiagrams = await parser.parseMarkdown(markdownWithDiagram, {}, null, null, null);
    
    console.log(chalk.cyan('\n📄 Without Diagram Processing:'));
    console.log('Content length:', resultWithoutDiagrams.content.length);
    console.log('Contains code blocks:', resultWithoutDiagrams.content.includes('ac:structured-macro'));
    console.log('Contains images:', resultWithoutDiagrams.content.includes('ac:image'));
    console.log('Preview:');
    console.log(resultWithoutDiagrams.content.substring(0, 400) + '...');

    // Parse with pageId (with diagram processing)
    const resultWithDiagrams = await parser.parseMarkdown(markdownWithDiagram, {}, null, null, 'test-page-123');
    
    console.log(chalk.cyan('\n🎨 With Diagram Processing:'));
    console.log('Content length:', resultWithDiagrams.content.length);
    console.log('Contains code blocks:', resultWithDiagrams.content.includes('ac:structured-macro'));
    console.log('Contains images:', resultWithDiagrams.content.includes('ac:image'));
    console.log('Contains diagram metadata:', resultWithDiagrams.content.includes('DOCFLU_DIAGRAM_METADATA'));
    console.log('Diagram stats:', JSON.stringify(resultWithDiagrams.diagramStats, null, 2));
    
    console.log(chalk.cyan('\n📖 Processed Content Preview:'));
    console.log(resultWithDiagrams.content.substring(0, 800) + '...');

    // Verify conversion
    const hasImages = resultWithDiagrams.content.includes('<ac:image ac:align="center"');
    const hasMetadata = resultWithDiagrams.content.includes('DOCFLU_DIAGRAM_METADATA:mermaid:');
    const hasDiagramStats = resultWithDiagrams.diagramStats && resultWithDiagrams.diagramStats.processed > 0;

    if (hasImages && hasMetadata && hasDiagramStats) {
      console.log(chalk.green('\n✅ SUCCESS: Diagrams converted to images!'));
      console.log(chalk.green('✅ Images are center-aligned'));
      console.log(chalk.green('✅ Metadata preserved for bidirectional sync'));
      console.log(chalk.green('✅ Statistics tracked correctly'));
    } else {
      console.log(chalk.red('\n❌ FAILURE: Diagram conversion incomplete'));
      console.log('Has images:', hasImages);
      console.log('Has metadata:', hasMetadata);
      console.log('Has stats:', hasDiagramStats);
    }

    // Show difference in content length
    const lengthDiff = resultWithDiagrams.content.length - resultWithoutDiagrams.content.length;
    console.log(chalk.blue(`\n📊 Content length difference: +${lengthDiff} characters`));

    // Cleanup
    await parser.cleanup();

  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testRealDiagramConversion();
}

module.exports = { testRealDiagramConversion }; 