const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const MarkdownParser = require('../lib/core/markdown-parser');
const ConfluenceToMarkdown = require('../lib/core/confluence-to-markdown');

// Mock Confluence client for testing
class MockConfluenceClient {
  async api(config) {
    if (config.method === 'GET' && config.url.includes('/child/attachment')) {
      // Mock: no existing attachments
      return { data: { results: [] } };
    }
    
    if (config.method === 'POST' && config.url.includes('/child/attachment')) {
      // Mock successful upload
      const filename = config.data.getHeaders ? 'mock-diagram.svg' : 'mock-diagram.svg';
      return {
        data: {
          results: [{
            id: 'mock-attachment-id',
            title: filename,
            _links: {
              download: `/download/${filename}`,
              webui: `/wiki/spaces/TEST/pages/123/${filename}`
            }
          }]
        }
      };
    }
    
    throw new Error('Unexpected API call');
  }

  async getPageAttachments(pageId) {
    return []; // No existing attachments
  }

  async downloadAttachmentById(attachment) {
    return {
      filename: attachment.title || 'mock-diagram.svg',
      data: Buffer.from('fake svg data'),
      mediaType: 'image/svg+xml'
    };
  }
}

async function testDiagramIntegration() {
  console.log('🧪 Testing Diagram Integration with Full Workflow...\n');
  
  const tempDir = path.join(__dirname, 'temp-diagram-integration');
  await fs.ensureDir(tempDir);
  
  try {
    const mockClient = new MockConfluenceClient();

    // Test 1: Markdown → Confluence with diagrams
    console.log('Test 1: Markdown → Confluence with diagrams');
    
    const markdownContent = `# Document with Diagrams

Here's a simple Mermaid diagram:

\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`

And here's a PlantUML sequence diagram:

\`\`\`plantuml
@startuml
Alice -> Bob: Hello
Bob -> Alice: Hi!
@enduml
\`\`\`

Some regular text after diagrams.`;

    // Create markdown parser with diagram support
    const parser = new MarkdownParser(tempDir, null, mockClient);
    
    // Parse markdown with mock page ID
    const parseResult = await parser.parseMarkdown(markdownContent, {}, null, null, 'mock-page-123');
    
    console.log('Parse result:');
    console.log('- Title:', parseResult.title);
    console.log('- Diagram stats:', parseResult.diagramStats);
    console.log('- Content preview:', parseResult.content.substring(0, 200) + '...');

    // Verify diagrams were processed
    assert(parseResult.diagramStats, 'Should have diagram stats');
    assert(parseResult.content.includes('<ac:image>'), 'Should contain Confluence image tags');
    assert(parseResult.content.includes('DOCFLU_DIAGRAM_METADATA'), 'Should contain diagram metadata');

    console.log('✅ Test 1 Passed\n');

    // Test 2: Confluence → Markdown with diagrams (bidirectional)
    console.log('Test 2: Confluence → Markdown with diagrams (bidirectional)');
    
    // Simulate Confluence content with diagram
    const confluenceContent = `<h1>Document with Diagrams</h1>

<p>Here's a simple Mermaid diagram:</p>

<ac:image>
  <ri:attachment ri:filename="mermaid-abc123.svg" />
</ac:image>

<p><em>Mermaid Diagram</em></p>

<!-- DOCFLU_DIAGRAM_METADATA:mermaid:${Buffer.from('graph TD\n    A[Start] --> B[Process]\n    B --> C[End]').toString('base64')} -->

<p>And here's a PlantUML sequence diagram:</p>

<ac:image>
  <ri:attachment ri:filename="plantuml-def456.svg" />
</ac:image>

<p><em>Plantuml Diagram</em></p>

<!-- DOCFLU_DIAGRAM_METADATA:plantuml:${Buffer.from('@startuml\nAlice -> Bob: Hello\nBob -> Alice: Hi!\n@enduml').toString('base64')} -->

<p>Some regular text after diagrams.</p>`;

    // Create confluence to markdown converter
    const converter = new ConfluenceToMarkdown(mockClient, tempDir);
    
    // Convert back to markdown
    const convertResult = await converter.convertToMarkdown(
      confluenceContent,
      'mock-page-123',
      'docs/test-diagrams.md'
    );

    console.log('Convert result:');
    console.log('- Markdown preview:', convertResult.markdown.substring(0, 300) + '...');
    console.log('- Full markdown:');
    console.log(convertResult.markdown);

    // Verify diagrams were converted back to code blocks
    assert(convertResult.markdown.includes('```mermaid'), 'Should contain mermaid code block');
    assert(convertResult.markdown.includes('```plantuml'), 'Should contain plantuml code block');
    assert(convertResult.markdown.includes('graph TD'), 'Should contain mermaid diagram code');
    assert(convertResult.markdown.includes('@startuml'), 'Should contain plantuml diagram code');

    console.log('✅ Test 2 Passed\n');

    // Test 3: Round-trip conversion
    console.log('Test 3: Round-trip conversion (Markdown → Confluence → Markdown)');
    
    const originalMarkdown = `# Round Trip Test

\`\`\`mermaid
flowchart LR
    A --> B --> C
\`\`\`

End of document.`;

    // Step 1: Markdown → Confluence
    const step1Result = await parser.parseMarkdown(originalMarkdown, {}, null, null, 'round-trip-page');
    
    // Step 2: Confluence → Markdown
    const step2Result = await converter.convertToMarkdown(
      step1Result.content,
      'round-trip-page',
      'docs/round-trip.md'
    );

    console.log('Original markdown:');
    console.log(originalMarkdown);
    console.log('\nAfter round-trip:');
    console.log(step2Result.markdown);

    // Verify round-trip preserves diagram
    assert(step2Result.markdown.includes('```mermaid'), 'Should preserve mermaid code block');
    assert(step2Result.markdown.includes('flowchart LR'), 'Should preserve diagram content');
    assert(step2Result.markdown.includes('A --> B --> C'), 'Should preserve diagram content');

    console.log('✅ Test 3 Passed\n');

    // Test 4: Multiple diagram types in one document
    console.log('Test 4: Multiple diagram types in one document');
    
    const multiDiagramMarkdown = `# Multi-Diagram Document

\`\`\`mermaid
graph LR
    A --> B
\`\`\`

\`\`\`plantuml
@startuml
A -> B
@enduml
\`\`\`

\`\`\`dot
digraph G {
    A -> B;
}
\`\`\``;

    const multiResult = await parser.parseMarkdown(multiDiagramMarkdown, {}, null, null, 'multi-page');
    
    console.log('Multi-diagram stats:', multiResult.diagramStats);
    
    // Verify all diagram types were detected
    assert(multiResult.diagramStats.total >= 3, 'Should detect multiple diagrams');
    assert(multiResult.content.includes('DOCFLU_DIAGRAM_METADATA:mermaid:'), 'Should have mermaid metadata');
    assert(multiResult.content.includes('DOCFLU_DIAGRAM_METADATA:plantuml:'), 'Should have plantuml metadata');
    assert(multiResult.content.includes('DOCFLU_DIAGRAM_METADATA:graphviz:'), 'Should have graphviz metadata');

    console.log('✅ Test 4 Passed\n');

    console.log('🎉 All diagram integration tests passed!');
    
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
  testDiagramIntegration().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = testDiagramIntegration; 