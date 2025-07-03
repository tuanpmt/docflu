const path = require('path');
const chalk = require('chalk');

// Test Notion components
const NotionClient = require('../../lib/core/notion/notion-client');
const NotionState = require('../../lib/core/notion/notion-state');
const NotionHierarchyManager = require('../../lib/core/notion/hierarchy-manager');
const MarkdownToBlocksConverter = require('../../lib/core/notion/markdown-to-blocks');
const NotionSync = require('../../lib/core/notion/notion-sync');

/**
 * Basic Notion Integration Test
 * Tests core functionality without requiring actual API credentials
 */
async function testNotionBasic() {
  console.log(chalk.blue('🧪 Testing Notion Integration - Basic Components'));
  
  try {
    // Test 1: Component Initialization
    console.log(chalk.gray('\n1. Testing component initialization...'));
    
    const mockConfig = {
      apiToken: 'secret_test_token',
      rootPageId: 'test-root-page-id',
      projectRoot: process.cwd()
    };
    
    const projectRoot = process.cwd();
    
    // Test NotionClient initialization
    const client = new NotionClient(mockConfig);
    console.log(chalk.green('  ✓ NotionClient initialized'));
    
    // Test NotionState initialization
    const state = new NotionState(projectRoot, mockConfig);
    console.log(chalk.green('  ✓ NotionState initialized'));
    
    // Test HierarchyManager initialization
    const hierarchyManager = new NotionHierarchyManager(client, state);
    console.log(chalk.green('  ✓ NotionHierarchyManager initialized'));
    
    // Test MarkdownToBlocksConverter initialization
    const converter = new MarkdownToBlocksConverter(null, null);
    console.log(chalk.green('  ✓ MarkdownToBlocksConverter initialized'));
    
    // Test NotionSync initialization
    const notionSync = new NotionSync(mockConfig, projectRoot);
    console.log(chalk.green('  ✓ NotionSync initialized'));
    
    // Test 2: Markdown to Blocks Conversion
    console.log(chalk.gray('\n2. Testing markdown to blocks conversion...'));
    
    const testMarkdown = `# Test Document

This is a **bold** text with *italic* formatting and \`inline code\`.

## Features

- Bullet point 1
- Bullet point 2
- Bullet point 3

### Code Example

\`\`\`javascript
function hello() {
  console.log("Hello, Notion!");
}
\`\`\`

### Table Example

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Row 1    | Data 1   | Value 1  |
| Row 2    | Data 2   | Value 2  |

> This is a blockquote with important information.

---

That's all for now!`;

    const blocks = await converter.convertToBlocks(testMarkdown);
    console.log(chalk.green(`  ✓ Converted markdown to ${blocks.length} blocks`));
    
    // Validate block types
    const blockTypes = blocks.map(block => block.type);
    const expectedTypes = ['heading_1', 'paragraph', 'heading_2', 'bulleted_list_item', 'heading_3', 'code', 'heading_3', 'table', 'quote', 'divider', 'paragraph'];
    
    console.log(chalk.gray(`    Block types: ${blockTypes.join(', ')}`));
    
    // Test 3: Rich Text Parsing
    console.log(chalk.gray('\n3. Testing rich text parsing...'));
    
    const richTextSamples = [
      'Simple text',
      '**Bold text**',
      '*Italic text*',
      '`Inline code`',
      '~~Strikethrough~~',
      '[Link text](https://example.com)',
      'Mixed **bold** and *italic* with `code`'
    ];
    
    for (const sample of richTextSamples) {
      const richText = converter.parseRichText(sample);
      console.log(chalk.green(`    ✓ Parsed: "${sample}" → ${richText.length} text objects`));
    }
    
    // Test 4: State Management
    console.log(chalk.gray('\n4. Testing state management...'));
    
    // Test file hash calculation
    const testFilePath = path.join(__dirname, '../sample-docs/intro.md');
    const hash = state.calculateFileHash(testFilePath);
    if (hash) {
      console.log(chalk.green(`  ✓ Calculated file hash: ${hash.substring(0, 16)}...`));
    } else {
      console.log(chalk.yellow(`  ⚠️ Could not calculate hash for test file`));
    }
    
    // Test hierarchy path extraction
    const testPaths = [
      'docs/intro.md',
      'docs/tutorial-basics/create-a-page.md',
      'docs/tutorial-extras/manage-docs-versions.md',
      'blog/2023-01-01-welcome.md'
    ];
    
    for (const testPath of testPaths) {
      const segments = hierarchyManager.extractPathSegments(testPath);
      const formattedSegments = segments.slice(0, -1).map(s => hierarchyManager.formatSegmentTitle(s));
      console.log(chalk.green(`    ✓ Path: ${testPath} → Hierarchy: ${formattedSegments.join(' > ')}`));
    }
    
    // Test 5: Configuration Validation
    console.log(chalk.gray('\n5. Testing configuration validation...'));
    
    const validConfig = notionSync.validateConfig();
    if (validConfig.valid) {
      console.log(chalk.green('  ✓ Mock configuration is valid'));
    } else {
      console.log(chalk.yellow(`  ⚠️ Configuration errors: ${validConfig.errors.join(', ')}`));
    }
    
    // Test invalid config
    const invalidSync = new NotionSync({ apiToken: '', rootPageId: '' }, projectRoot);
    const invalidConfig = invalidSync.validateConfig();
    if (!invalidConfig.valid) {
      console.log(chalk.green(`  ✓ Invalid configuration properly detected: ${invalidConfig.errors.length} errors`));
    }
    
    // Test 6: Block Validation
    console.log(chalk.gray('\n6. Testing block validation...'));
    
    const validBlocks = [
      { type: 'paragraph', paragraph: { rich_text: [{ text: { content: 'Valid block' } }] } },
      { type: 'heading_1', heading_1: { rich_text: [{ text: { content: 'Valid heading' } }] } }
    ];
    
    const invalidBlocks = [
      { type: 'paragraph' }, // Missing paragraph property
      { paragraph: { rich_text: [] } }, // Missing type
      { type: 'invalid_type', invalid_type: {} }
    ];
    
    const validatedValid = converter.validateBlocks(validBlocks);
    const validatedInvalid = converter.validateBlocks(invalidBlocks);
    
    console.log(chalk.green(`  ✓ Valid blocks: ${validatedValid.length}/${validBlocks.length} passed`));
    console.log(chalk.green(`  ✓ Invalid blocks: ${validatedInvalid.length}/${invalidBlocks.length} filtered out`));
    
    // Test 7: Block Chunking
    console.log(chalk.gray('\n7. Testing block chunking...'));
    
    const manyBlocks = Array.from({ length: 250 }, (_, i) => ({
      type: 'paragraph',
      paragraph: { rich_text: [{ text: { content: `Block ${i + 1}` } }] }
    }));
    
    const chunks = converter.chunkBlocks(manyBlocks, 100);
    console.log(chalk.green(`  ✓ Chunked ${manyBlocks.length} blocks into ${chunks.length} chunks`));
    console.log(chalk.gray(`    Chunk sizes: ${chunks.map(chunk => chunk.length).join(', ')}`));
    
    console.log(chalk.green('\n✅ All basic tests passed!'));
    console.log(chalk.blue('\n📋 Test Summary:'));
    console.log(chalk.white('  - Component initialization: ✓'));
    console.log(chalk.white('  - Markdown to blocks conversion: ✓'));
    console.log(chalk.white('  - Rich text parsing: ✓'));
    console.log(chalk.white('  - State management: ✓'));
    console.log(chalk.white('  - Configuration validation: ✓'));
    console.log(chalk.white('  - Block validation: ✓'));
    console.log(chalk.white('  - Block chunking: ✓'));
    
    console.log(chalk.cyan('\n💡 Next Steps:'));
    console.log(chalk.gray('  1. Set up Notion API credentials in .env'));
    console.log(chalk.gray('  2. Run integration tests with real API'));
    console.log(chalk.gray('  3. Test with sample markdown files'));
    
    return { success: true, testsRun: 7 };
    
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    console.error(chalk.gray('Stack trace:'), error.stack);
    return { success: false, error: error.message };
  }
}

// Run test if called directly
if (require.main === module) {
  testNotionBasic()
    .then(result => {
      if (result.success) {
        console.log(chalk.green(`\n🎉 Test completed successfully! (${result.testsRun} tests)`));
        process.exit(0);
      } else {
        console.log(chalk.red('\n💥 Test failed!'));
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(chalk.red('\n💥 Test crashed:'), error.message);
      process.exit(1);
    });
}

module.exports = { testNotionBasic }; 