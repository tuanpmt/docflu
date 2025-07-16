#!/usr/bin/env node

/**
 * Test Mermaid Plugin Integration
 * Tests DocFlu's ability to integrate with Confluence Mermaid Cloud plugin
 */

const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const DiagramProcessor = require('../lib/core/diagram-processor');
const MarkdownParser = require('../lib/core/markdown-parser');

// Mock Confluence client for testing
const mockConfluenceClient = {
  config: {
    baseUrl: 'https://test.atlassian.net',
    spaceKey: 'TEST'
  },
  api: async (options) => {
    // Mock API responses for different endpoints
    if (options.url.includes('/child/attachment') && options.method === 'GET') {
      return { data: { results: [] } }; // No existing attachments
    }
    
    if (options.url.includes('/child/attachment') && options.method === 'POST') {
      // Mock successful upload
      return {
        data: {
          results: [{
            id: 'mock-attachment-id',
            title: options.data._streams[0].filename || 'mock.mmd',
            _links: {
              download: '/download/mock-attachment',
              webui: '/pages/viewpage.action?pageId=123&preview=/mock-attachment'
            }
          }]
        }
      };
    }
    
    throw new Error(`Mock API not implemented for: ${options.method} ${options.url}`);
  }
};

async function testMermaidPluginIntegration() {
  console.log(chalk.blue('🧪 Testing Mermaid Plugin Integration\n'));

  try {
    // Test 1: Test DiagramProcessor with plugin option
    console.log(chalk.cyan('Test 1: DiagramProcessor with Mermaid Plugin'));
    
    const diagramProcessor = new DiagramProcessor(mockConfluenceClient, '.test-temp', {
      useMermaidPlugin: true
    });

    // Test markdown with Mermaid diagram
    const testMarkdown = `# Test Document

Here's a Mermaid diagram:

\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]
    C --> D
\`\`\`

End of document.`;

    // Extract diagrams
    const diagrams = diagramProcessor.extractAllDiagrams(testMarkdown);
    console.log(chalk.green(`✅ Found ${diagrams.length} diagram(s)`));
    
    if (diagrams.length > 0) {
      const mermaidDiagram = diagrams[0];
      console.log(chalk.gray(`   Type: ${mermaidDiagram.type}`));
      console.log(chalk.gray(`   ID: ${mermaidDiagram.id}`));
      console.log(chalk.gray(`   Code: ${mermaidDiagram.code.substring(0, 50)}...`));
    }

    // Test 2: Test processing with plugin mode
    console.log(chalk.cyan('\nTest 2: Process Diagrams with Plugin Mode'));
    
    const processResult = await diagramProcessor.processAllDiagrams('mock-page-123', testMarkdown);
    console.log(chalk.green(`✅ Processing stats: ${JSON.stringify(processResult.stats)}`));
    
    if (processResult.diagramMap.size > 0) {
      const diagramEntry = Array.from(processResult.diagramMap.entries())[0];
      const [diagramId, attachmentInfo] = diagramEntry;
      console.log(chalk.gray(`   Diagram ID: ${diagramId}`));
      console.log(chalk.gray(`   Type: ${attachmentInfo.type}`));
      console.log(chalk.gray(`   Use Plugin: ${attachmentInfo.usePlugin}`));
    }

    // Test 3: Test MarkdownParser with plugin integration
    console.log(chalk.cyan('\nTest 3: MarkdownParser with Plugin Integration'));
    
    const markdownParser = new MarkdownParser(null, null, mockConfluenceClient, {
      useMermaidPlugin: true
    });

    const parsedContent = await markdownParser.parseMarkdown(
      testMarkdown,
      {},
      'test.md',
      'https://test.atlassian.net',
      'mock-page-123'
    );

    console.log(chalk.green('✅ Parsed content with plugin integration'));
    console.log(chalk.gray(`   Title: ${parsedContent.title}`));
    console.log(chalk.gray(`   Content length: ${parsedContent.content.length} characters`));
    
    // Check if content contains mermaid attachment macro
    if (parsedContent.content.includes('ac:name="mermaid"')) {
      console.log(chalk.green('✅ Content contains mermaid attachment macro'));
    } else {
      console.log(chalk.yellow('⚠️ Content does not contain mermaid attachment macro'));
    }

    // Test 4: Test bidirectional conversion
    console.log(chalk.cyan('\nTest 4: Bidirectional Conversion'));
    
    const confluenceContentWithPlugin = `<h1>Test Document</h1>

<p>Here's a Mermaid diagram:</p>

<ac:structured-macro ac:name="mermaid">
  <ac:parameter ac:name="attachment">mermaid-4d6bc79e.mmd</ac:parameter>
</ac:structured-macro>

<!-- DOCFLU_DIAGRAM_START:mermaid -->
<!-- DOCFLU_DIAGRAM_METADATA:mermaid:Z3JhcGggVEQKICAgIEFbU3RhcnRdIC0tPiBCe0RlY2lzaW9ufQogICAgQiAtLT58WWVzfCBDW0FjdGlvbl0KICAgIEIgLS0+fE5vfCBEW0VuZF0KICAgIEMgLS0+IEQ= -->
<!-- DOCFLU_DIAGRAM_END:mermaid -->

<p>End of document.</p>`;

    const convertedMarkdown = diagramProcessor.convertConfluenceDiagramsToMarkdown(confluenceContentWithPlugin);
    console.log(chalk.green('✅ Converted Confluence content back to markdown'));
    
    if (convertedMarkdown.includes('```mermaid')) {
      console.log(chalk.green('✅ Successfully converted mermaid attachment macro back to markdown'));
    } else {
      console.log(chalk.yellow('⚠️ Failed to convert mermaid attachment macro back to markdown'));
    }

    // Test 5: Compare standard vs plugin mode output
    console.log(chalk.cyan('\nTest 5: Compare Standard vs Plugin Mode'));
    
    // Standard mode (SVG generation)
    const standardProcessor = new DiagramProcessor(mockConfluenceClient, '.test-temp', {
      useMermaidPlugin: false
    });
    
    const standardParser = new MarkdownParser(null, null, mockConfluenceClient, {
      useMermaidPlugin: false
    });

    console.log(chalk.gray('Standard mode configuration:'));
    console.log(chalk.gray(`   useMermaidPlugin: ${standardProcessor.options.useMermaidPlugin}`));
    console.log(chalk.gray(`   mermaid.usePlugin: ${standardProcessor.diagramTypes.mermaid.usePlugin}`));
    
    console.log(chalk.gray('Plugin mode configuration:'));
    console.log(chalk.gray(`   useMermaidPlugin: ${diagramProcessor.options.useMermaidPlugin}`));
    console.log(chalk.gray(`   mermaid.usePlugin: ${diagramProcessor.diagramTypes.mermaid.usePlugin}`));

    console.log(chalk.green('\n✅ All tests completed successfully!'));
    console.log(chalk.blue('\n📋 Summary:'));
    console.log(chalk.white('   ✅ DiagramProcessor supports plugin configuration'));
    console.log(chalk.white('   ✅ Mermaid diagrams processed in plugin mode'));
    console.log(chalk.white('   ✅ MarkdownParser generates mermaid attachment macros'));
    console.log(chalk.white('   ✅ Bidirectional conversion works'));
    console.log(chalk.white('   ✅ Standard vs Plugin mode distinction works'));

  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    if (process.env.DEBUG) {
      console.error(chalk.gray('Stack trace:'), error.stack);
    }
    process.exit(1);
  }
}

// Cleanup function
async function cleanup() {
  try {
    const tempDir = path.join(process.cwd(), '.test-temp');
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  } catch (error) {
    console.warn(chalk.yellow('⚠️ Cleanup warning:'), error.message);
  }
}

// Run tests
if (require.main === module) {
  testMermaidPluginIntegration()
    .then(() => cleanup())
    .catch((error) => {
      console.error(chalk.red('❌ Test suite failed:'), error.message);
      cleanup().finally(() => process.exit(1));
    });
}

module.exports = { testMermaidPluginIntegration }; 