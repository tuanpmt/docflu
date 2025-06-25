const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const DiagramProcessor = require('../lib/core/diagram-processor');

// Mock Confluence client for testing
class MockConfluenceClient {
  async api(config) {
    if (config.method === 'GET' && config.url.includes('/child/attachment')) {
      // Mock: no existing attachments
      return { data: { results: [] } };
    }
    
    if (config.method === 'POST' && config.url.includes('/child/attachment')) {
      // Mock successful upload
      return {
        data: {
          results: [{
            id: 'mock-attachment-id',
            title: 'mock-diagram.svg',
            _links: {
              download: '/download/mock-diagram.svg',
              webui: '/wiki/spaces/TEST/pages/123/mock-diagram.svg'
            }
          }]
        }
      };
    }
    
    throw new Error('Unexpected API call');
  }
}

async function testDiagramProcessor() {
  console.log('🧪 Testing Universal Diagram Processor...\n');
  
  const tempDir = path.join(__dirname, 'temp-diagram-test');
  await fs.ensureDir(tempDir);
  
  try {
    const mockClient = new MockConfluenceClient();
    const processor = new DiagramProcessor(mockClient, tempDir);

    // Test 1: Extract different diagram types
    console.log('Test 1: Extract different diagram types');
    
    const markdownWithDiagrams = `# Sample Document

Here's a Mermaid diagram:

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    B -->|No| D[End]
\`\`\`

And here's a PlantUML diagram:

\`\`\`plantuml
@startuml
Alice -> Bob: Hello
Bob -> Alice: Hi there
@enduml
\`\`\`

A Graphviz diagram:

\`\`\`dot
digraph G {
    A -> B -> C;
    B -> D;
}
\`\`\`

And a D2 diagram:

\`\`\`d2
x -> y -> z
\`\`\`

Some regular code:

\`\`\`javascript
console.log("Not a diagram");
\`\`\``;

    const diagrams = processor.extractAllDiagrams(markdownWithDiagrams);
    console.log(`Found ${diagrams.length} diagrams:`);
    diagrams.forEach(d => console.log(`  - ${d.type}: ${d.id}`));

    assert.equal(diagrams.length, 4, 'Should find 4 diagrams');
    assert(diagrams.some(d => d.type === 'mermaid'), 'Should find Mermaid diagram');
    assert(diagrams.some(d => d.type === 'plantuml'), 'Should find PlantUML diagram');
    assert(diagrams.some(d => d.type === 'graphviz'), 'Should find Graphviz diagram');
    assert(diagrams.some(d => d.type === 'd2'), 'Should find D2 diagram');

    console.log('✅ Test 1 Passed\n');

    // Test 2: Convert diagrams to Confluence format
    console.log('Test 2: Convert diagrams to Confluence format');
    
    const simpleMermaid = `\`\`\`mermaid
graph LR
    A --> B
\`\`\``;

    // Mock successful diagram processing
    const mockDiagramMap = new Map();
    const mermaidId = processor.generateDiagramId('mermaid', 'graph LR\n    A --> B');
    mockDiagramMap.set(mermaidId, {
      title: `${mermaidId}.svg`,
      type: 'mermaid',
      originalCode: 'graph LR\n    A --> B'
    });

    const confluenceFormat = processor.convertDiagramsToConfluenceFormat(simpleMermaid, mockDiagramMap);
    console.log('Converted to Confluence format:');
    console.log(confluenceFormat);

    assert(confluenceFormat.includes('<ac:image>'), 'Should contain Confluence image tag');
    assert(confluenceFormat.includes('<ri:attachment'), 'Should contain attachment reference');
    assert(confluenceFormat.includes('DOCFLU_DIAGRAM_METADATA:mermaid:'), 'Should contain diagram metadata');

    console.log('✅ Test 2 Passed\n');

    // Test 3: Bidirectional sync - convert back to markdown
    console.log('Test 3: Bidirectional sync - convert back to markdown');
    
    const confluenceWithDiagram = `<p>Here's a diagram:</p>

<ac:image>
  <ri:attachment ri:filename="${mermaidId}.svg" />
</ac:image>

<p><em>Mermaid Diagram</em></p>

<!-- DOCFLU_DIAGRAM_METADATA:mermaid:${Buffer.from('graph LR\n    A --> B').toString('base64')} -->

<p>End of document.</p>`;

    const backToMarkdown = processor.convertConfluenceDiagramsToMarkdown(confluenceWithDiagram);
    console.log('Converted back to markdown:');
    console.log(backToMarkdown);

    assert(backToMarkdown.includes('```mermaid'), 'Should contain mermaid code block');
    assert(backToMarkdown.includes('graph LR'), 'Should contain original diagram code');
    assert(backToMarkdown.includes('A --> B'), 'Should contain original diagram code');

    console.log('✅ Test 3 Passed\n');

    // Test 4: Generate diagram IDs consistently
    console.log('Test 4: Generate diagram IDs consistently');
    
    const code1 = 'graph TD\n    A --> B';
    const code2 = 'graph TD\n    A --> B'; // Same content
    const code3 = 'graph TD\n    A --> C'; // Different content

    const id1 = processor.generateDiagramId('mermaid', code1);
    const id2 = processor.generateDiagramId('mermaid', code2);
    const id3 = processor.generateDiagramId('mermaid', code3);

    assert.equal(id1, id2, 'Same content should generate same ID');
    assert.notEqual(id1, id3, 'Different content should generate different ID');

    console.log(`ID1: ${id1}`);
    console.log(`ID2: ${id2}`);
    console.log(`ID3: ${id3}`);

    console.log('✅ Test 4 Passed\n');

    console.log('🎉 All diagram processor tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await fs.remove(tempDir);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDiagramProcessor().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = testDiagramProcessor; 