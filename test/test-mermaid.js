const path = require('path');
const chalk = require('chalk');
const MermaidProcessor = require('../lib/core/mermaid-processor');

async function testMermaidProcessor() {
  console.log(chalk.blue('🧪 Testing Mermaid Processor'));

  // Mock Confluence client
  const mockConfluenceClient = {
    api: async (config) => {
      console.log(chalk.gray(`Mock API call: ${config.method} ${config.url}`));
      return {
        data: {
          results: [{
            id: 'mock-attachment-id',
            title: 'mermaid-12345678.png',
            _links: {
              download: '/download/attachments/123/mermaid-12345678.png',
              webui: '/pages/viewpage.action?pageId=123'
            }
          }]
        }
      };
    }
  };

  const processor = new MermaidProcessor(mockConfluenceClient);

  // Test markdown with Mermaid diagrams
  const testMarkdown = `# Test Document

## Flow Chart

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    C --> D[Rethink]
    D --> B
    B ---->|No| E[End]
\`\`\`

## Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant Alice
    participant Bob
    Alice->>John: Hello John, how are you?
    loop Healthcheck
        John->>John: Fight against hypochondria
    end
    Note right of John: Rational thoughts <br/>prevail!
    John-->>Alice: Great!
    John->>Bob: How about you?
    Bob-->>John: Jolly good!
\`\`\`

## Regular Content

This is normal markdown content that should not be affected.

\`\`\`javascript
// This is a code block, not Mermaid
console.log('Hello World');
\`\`\`
`;

  console.log(chalk.white('\n1. Testing diagram extraction'));
  
  const diagrams = processor.extractMermaidDiagrams(testMarkdown);
  console.log(`Found ${diagrams.length} Mermaid diagrams`);

  diagrams.forEach((diagram, index) => {
    console.log(`  Diagram ${index + 1}: ${diagram.id}`);
    console.log(`    Code length: ${diagram.code.length} characters`);
  });

  console.log(chalk.white('\n2. Testing Mermaid CLI availability'));
  
  const hasCLI = await processor.checkMermaidCLI();
  console.log(`Mermaid CLI available: ${hasCLI ? '✅' : '❌'}`);

  if (!hasCLI) {
    console.log(chalk.yellow('⚠️ Mermaid CLI not available. Install with: npm install -g @mermaid-js/mermaid-cli'));
    console.log(chalk.gray('Skipping image generation tests...'));
    return;
  }

  console.log(chalk.white('\n3. Testing diagram processing (with mock upload)'));
  
  const pageId = 'test-page-123';
  const result = await processor.processMermaidDiagrams(pageId, testMarkdown);

  console.log(chalk.green('\n✅ Mermaid processing completed'));
  console.log(`Statistics: ${result.stats.processed}/${result.stats.total} processed, ${result.stats.failed} failed`);

  console.log(chalk.white('\n4. Testing content conversion'));
  
  // Show before/after comparison
  const originalLines = testMarkdown.split('\n').length;
  const processedLines = result.processedContent.split('\n').length;
  
  console.log(`Original content: ${originalLines} lines`);
  console.log(`Processed content: ${processedLines} lines`);
  
  // Show first few lines of processed content
  const previewLines = result.processedContent.split('\n').slice(0, 10);
  console.log(chalk.gray('\nProcessed content preview:'));
  previewLines.forEach((line, index) => {
    console.log(chalk.gray(`${index + 1}: ${line}`));
  });

  console.log(chalk.white('\n5. Testing cleanup'));
  await processor.cleanup();

  console.log(chalk.green('\n🎉 All Mermaid tests completed successfully!'));
}

// Run tests
if (require.main === module) {
  testMermaidProcessor().catch(error => {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

module.exports = { testMermaidProcessor }; 