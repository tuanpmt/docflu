const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const assert = require('assert');
const DiagramProcessor = require('../lib/core/diagram-processor');
const MarkdownParser = require('../lib/core/markdown-parser');

// Mock Confluence Client
class MockConfluenceClient {
  constructor() {
    this.uploadedAttachments = new Map();
    this.pageId = 'mock-page-123';
  }

  async api(config) {
    const { method, url, data } = config;
    
    if (method === 'POST' && url.includes('/child/attachment')) {
      // Mock attachment upload
      const mockAttachment = {
        id: `mock-attachment-${Date.now()}`,
        title: `diagram-${Date.now()}.svg`,
        _links: {
          download: `/download/attachments/${this.pageId}/diagram.svg`,
          webui: `/pages/viewpage.action?pageId=${this.pageId}`
        }
      };

      this.uploadedAttachments.set(mockAttachment.title, mockAttachment);
      
      return {
        data: {
          results: [mockAttachment]
        }
      };
    }

    if (method === 'GET' && url.includes('/child/attachment')) {
      // Mock check existing attachments
      return {
        data: {
          results: []
        }
      };
    }

    throw new Error(`Mock API: Unhandled request ${method} ${url}`);
  }
}

async function testDiagramComprehensive() {
  console.log(chalk.blue('🧪 Comprehensive Diagram Processing Test'));
  console.log('=' .repeat(50));

  const tempDir = path.join(__dirname, 'temp-diagram-comprehensive');
  await fs.ensureDir(tempDir);

  try {
    const mockClient = new MockConfluenceClient();
    const processor = new DiagramProcessor(mockClient, tempDir);

    // Test 1: Extract all diagram types
    console.log(chalk.cyan('\n📋 Test 1: Extract All Diagram Types'));
    await testExtractDiagrams(processor);

    // Test 2: Generate diagram IDs consistently
    console.log(chalk.cyan('\n🔑 Test 2: Generate Consistent Diagram IDs'));
    await testDiagramIds(processor);

    // Test 3: Convert to Confluence format
    console.log(chalk.cyan('\n🔄 Test 3: Convert to Confluence Format'));
    await testConfluenceConversion(processor);

    // Test 4: Bidirectional conversion
    console.log(chalk.cyan('\n↔️ Test 4: Bidirectional Conversion'));
    await testBidirectionalConversion(processor);

    // Test 5: Integration with MarkdownParser
    console.log(chalk.cyan('\n🔗 Test 5: Integration with MarkdownParser'));
    await testMarkdownParserIntegration(mockClient, tempDir);

    // Test 6: Error handling
    console.log(chalk.cyan('\n⚠️ Test 6: Error Handling'));
    await testErrorHandling(processor);

    console.log(chalk.green('\n🎉 All comprehensive diagram tests passed!'));

  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Cleanup
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  }
}

async function testExtractDiagrams(processor) {
  const markdownWithAllDiagrams = `# Comprehensive Diagram Test

## Mermaid Flowchart
\`\`\`mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\`\`\`

## PlantUML Sequence
\`\`\`plantuml
@startuml
Alice -> Bob: Hello
Bob -> Charlie: Hi
Charlie -> Bob: Hello Bob
Bob -> Alice: Hi Alice
@enduml
\`\`\`

## Graphviz/Dot
\`\`\`dot
digraph G {
    rankdir=LR;
    A -> B -> C;
    B -> D;
    C -> E;
    D -> E;
}
\`\`\`

## D2 Diagram
\`\`\`d2
users -> web server: request
web server -> database: query
database -> web server: result
web server -> users: response
\`\`\`

Regular code (should be ignored):
\`\`\`javascript
console.log("Not a diagram");
\`\`\`
`;

  const diagrams = processor.extractAllDiagrams(markdownWithAllDiagrams);
  
  console.log(`   Found ${diagrams.length} diagrams:`);
  diagrams.forEach(d => console.log(`   - ${d.type}: ${d.id.substring(0, 20)}...`));

  assert.equal(diagrams.length, 4, 'Should find exactly 4 diagrams');
  assert(diagrams.some(d => d.type === 'mermaid'), 'Should find Mermaid diagram');
  assert(diagrams.some(d => d.type === 'plantuml'), 'Should find PlantUML diagram');
  assert(diagrams.some(d => d.type === 'graphviz'), 'Should find Graphviz diagram');
  assert(diagrams.some(d => d.type === 'd2'), 'Should find D2 diagram');

  // Verify diagram order is preserved
  const types = diagrams.map(d => d.type);
  assert.deepEqual(types, ['mermaid', 'plantuml', 'graphviz', 'd2'], 'Should preserve diagram order');

  console.log(chalk.green('   ✅ All diagram types extracted correctly'));
}

async function testDiagramIds(processor) {
  const code1 = 'graph TD\n    A --> B';
  const code2 = 'graph TD\n    A --> B'; // Same content
  const code3 = 'graph TD\n    A --> C'; // Different content

  const id1 = processor.generateDiagramId('mermaid', code1);
  const id2 = processor.generateDiagramId('mermaid', code2);
  const id3 = processor.generateDiagramId('mermaid', code3);

  console.log(`   ID1: ${id1}`);
  console.log(`   ID2: ${id2}`);
  console.log(`   ID3: ${id3}`);

  assert.equal(id1, id2, 'Same content should generate same ID');
  assert.notEqual(id1, id3, 'Different content should generate different ID');
  assert(id1.startsWith('mermaid-'), 'ID should include diagram type');

  console.log(chalk.green('   ✅ Diagram IDs generated consistently'));
}

async function testConfluenceConversion(processor) {
  const simpleMarkdown = `\`\`\`mermaid
graph LR
    A --> B --> C
\`\`\``;

  // Create mock diagram map
  const mockDiagramMap = new Map();
  const diagramId = processor.generateDiagramId('mermaid', 'graph LR\n    A --> B --> C');
  mockDiagramMap.set(diagramId, {
    title: `${diagramId}.svg`,
    type: 'mermaid'
  });

  const confluenceFormat = processor.convertDiagramsToConfluenceFormat(simpleMarkdown, mockDiagramMap);
  
  console.log('   Confluence format preview:');
  console.log('   ' + confluenceFormat.substring(0, 200).replace(/\n/g, '\\n') + '...');

  assert(confluenceFormat.includes('<ac:image'), 'Should contain Confluence image tag');
  assert(confluenceFormat.includes('ac:align="center"'), 'Should have center alignment');
  assert(confluenceFormat.includes('<ri:attachment'), 'Should contain attachment reference');
  assert(confluenceFormat.includes('DOCFLU_DIAGRAM_METADATA:mermaid:'), 'Should contain diagram metadata');
  assert(confluenceFormat.includes('DOCFLU_DIAGRAM_START:mermaid'), 'Should contain start marker');
  assert(confluenceFormat.includes('DOCFLU_DIAGRAM_END:mermaid'), 'Should contain end marker');

  console.log(chalk.green('   ✅ Confluence format conversion successful'));
}

async function testBidirectionalConversion(processor) {
  const originalCode = 'graph TD\n    A[Start] --> B[End]';
  const encodedCode = Buffer.from(originalCode).toString('base64');
  
  const confluenceContent = `<p>Here's a diagram:</p>

<ac:image ac:align="center" ac:layout="center">
  <ri:attachment ri:filename="mermaid-abc123.svg" />
</ac:image>

<p style="text-align: center;"><em>Mermaid Diagram</em></p>

<!-- DOCFLU_DIAGRAM_START:mermaid -->
<!-- DOCFLU_DIAGRAM_METADATA:mermaid:${encodedCode} -->
<!-- DOCFLU_DIAGRAM_END:mermaid -->

<p>End of document.</p>`;

  const backToMarkdown = processor.convertConfluenceDiagramsToMarkdown(confluenceContent);
  
  console.log('   Back to markdown preview:');
  console.log('   ' + backToMarkdown.substring(0, 200).replace(/\n/g, '\\n') + '...');

  assert(backToMarkdown.includes('```mermaid'), 'Should contain mermaid code block');
  assert(backToMarkdown.includes(originalCode), 'Should contain original diagram code');

  console.log(chalk.green('   ✅ Bidirectional conversion successful'));
}

async function testMarkdownParserIntegration(mockClient, tempDir) {
  const markdownContent = `# Integration Test

Here's a Mermaid diagram:

\`\`\`mermaid
flowchart LR
    A --> B --> C
\`\`\`

And some regular content.`;

  // Create parser with diagram support
  const parser = new MarkdownParser(tempDir, null, mockClient);
  
  // Parse with mock page ID for diagram processing
  const result = await parser.parseMarkdown(
    markdownContent, 
    { title: 'Integration Test' }, 
    null, 
    null, 
    'mock-page-123'
  );

  console.log('   Parse result stats:');
  console.log(`   - Title: ${result.title}`);
  console.log(`   - Content length: ${result.content.length}`);
  console.log(`   - Diagram stats: ${JSON.stringify(result.diagramStats)}`);

  assert.equal(result.title, 'Integration Test', 'Should extract title correctly');
  assert(result.content.length > markdownContent.length, 'Processed content should be longer');
  
  if (result.diagramStats) {
    assert(result.diagramStats.total >= 1, 'Should detect at least 1 diagram');
  }

  console.log(chalk.green('   ✅ MarkdownParser integration successful'));
}

async function testErrorHandling(processor) {
  // Test with invalid diagram syntax
  const invalidMarkdown = `\`\`\`mermaid
invalid syntax here
not a valid mermaid diagram
\`\`\``;

  const diagrams = processor.extractAllDiagrams(invalidMarkdown);
  assert.equal(diagrams.length, 1, 'Should still extract invalid diagrams');

  // Test conversion with empty diagram map (simulates failed processing)
  const emptyMap = new Map();
  const confluenceFormat = processor.convertDiagramsToConfluenceFormat(invalidMarkdown, emptyMap);
  
  assert(confluenceFormat.includes('ac:structured-macro'), 'Should fallback to code block');
  assert(confluenceFormat.includes('Not Processed'), 'Should indicate processing failure');
  assert(confluenceFormat.includes('ac:name="info"'), 'Should include info macro with explanation');

  console.log(chalk.green('   ✅ Error handling works correctly'));
}

// Run the test
if (require.main === module) {
  testDiagramComprehensive();
}

module.exports = { testDiagramComprehensive }; 