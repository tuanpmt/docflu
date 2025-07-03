const path = require('path');
const chalk = require('chalk');

// Import test utilities
const { createTestConfig, createMockNotionClient } = require('./test-utils');

// Import the classes we're testing
const MarkdownToBlocks = require('../../lib/core/notion/markdown-to-blocks');
const NotionState = require('../../lib/core/notion/notion-state');

/**
 * Test Basic Markdown Conversion
 */
async function testBasicMarkdown() {
  console.log(chalk.blue('\n🧪 Testing Basic Markdown Conversion\n'));
  
  try {
    // Setup test environment
    const config = createTestConfig();
    const mockClient = createMockNotionClient();
    const projectRoot = process.cwd();
    const state = new NotionState(projectRoot, config);
    
    // Initialize markdown converter
    const converter = new MarkdownToBlocks(mockClient, state, config);
    
    // Test markdown content
    const testMarkdown = `## Headings

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

---`;

    console.log(chalk.cyan('📋 Test Markdown Content:'));
    console.log(testMarkdown);
    console.log('');
    
    // Convert to blocks
    console.log(chalk.yellow('🔄 Converting to Notion blocks...'));
    const startTime = Date.now();
    const blocks = await converter.convertToBlocks(testMarkdown);
    const conversionTime = Date.now() - startTime;
    
    console.log(chalk.green(`✅ Conversion completed in ${conversionTime}ms`));
    console.log(chalk.cyan(`📊 Generated ${blocks.length} blocks`));
    console.log('');
    
    // Analyze blocks
    let successCount = 0;
    let errors = [];
    
    console.log(chalk.yellow('🔍 Analyzing generated blocks:'));
    
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      console.log(`\n${i + 1}. Block Type: ${chalk.cyan(block.type)}`);
      
      try {
        // Validate block structure
        if (!block.type) {
          throw new Error('Missing block type');
        }
        
        if (!block[block.type]) {
          throw new Error(`Missing ${block.type} property`);
        }
        
        // Log block content
        if (block.type.includes('heading')) {
          const content = block[block.type].rich_text?.[0]?.text?.content || '';
          console.log(`   Content: "${content}"`);
        } else if (block.type === 'paragraph') {
          const richText = block.paragraph.rich_text || [];
          const content = richText.map(t => t.text?.content || '').join('');
          console.log(`   Content: "${content}"`);
          console.log(`   Rich Text Objects: ${richText.length}`);
          
          // Check annotations
          richText.forEach((rt, idx) => {
            if (rt.annotations && Object.keys(rt.annotations).some(key => rt.annotations[key])) {
              const annotations = Object.keys(rt.annotations).filter(key => rt.annotations[key]);
              console.log(`     [${idx}] "${rt.text?.content}" -> ${annotations.join(', ')}`);
            }
          });
        } else if (block.type === 'divider') {
          console.log(`   Divider block`);
        }
        
        successCount++;
        console.log(`   ${chalk.green('✅ Valid')}`);
        
      } catch (error) {
        errors.push(`Block ${i + 1}: ${error.message}`);
        console.log(`   ${chalk.red('❌ Invalid')}: ${error.message}`);
      }
    }
    
    // Test specific elements
    console.log(chalk.blue('\n📋 Testing Specific Elements:'));
    
    // Check for heading blocks
    const headingBlocks = blocks.filter(b => b.type.includes('heading'));
    console.log(`Headings: ${headingBlocks.length}/6 expected`);
    
    headingBlocks.forEach((block, idx) => {
      const level = parseInt(block.type.replace('heading_', ''));
      const content = block[block.type].rich_text?.[0]?.text?.content || '';
      console.log(`  H${level}: "${content}"`);
    });
    
    // Check for dividers
    const dividerBlocks = blocks.filter(b => b.type === 'divider');
    console.log(`Dividers: ${dividerBlocks.length}/2 expected`);
    
    // Check for paragraphs with formatting
    const paragraphBlocks = blocks.filter(b => b.type === 'paragraph');
    console.log(`Paragraphs: ${paragraphBlocks.length}`);
    
    paragraphBlocks.forEach((block, idx) => {
      const richText = block.paragraph.rich_text || [];
      const hasFormatting = richText.some(rt => 
        rt.annotations && Object.keys(rt.annotations).some(key => rt.annotations[key])
      );
      const content = richText.map(t => t.text?.content || '').join('');
      console.log(`  P${idx + 1}: "${content}" ${hasFormatting ? '(formatted)' : '(plain)'}`);
    });
    
    // Summary
    console.log(chalk.blue('\n📈 Conversion Test Summary:'));
    console.log(`   Success Rate: ${successCount}/${blocks.length} (${Math.round(successCount/blocks.length*100)}%)`);
    console.log(`   Conversion Time: ${conversionTime}ms`);
    console.log(`   Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log(chalk.red('\n❌ Errors Found:'));
      errors.forEach(error => console.log(`   - ${error}`));
    }
    
    return {
      success: errors.length === 0,
      successRate: successCount / blocks.length,
      totalBlocks: blocks.length,
      successCount,
      conversionTime,
      errors
    };
    
  } catch (error) {
    console.error(chalk.red(`❌ Basic markdown test failed: ${error.message}`));
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

// Run test if called directly
if (require.main === module) {
  testBasicMarkdown()
    .then(result => {
      if (result.success) {
        console.log(chalk.green('\n🎉 Basic markdown conversion test passed!'));
        process.exit(0);
      } else {
        console.log(chalk.red('\n💥 Basic markdown conversion test failed!'));
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(chalk.red('\n💥 Test execution failed:'), error);
      process.exit(1);
    });
}

module.exports = { testBasicMarkdown }; 