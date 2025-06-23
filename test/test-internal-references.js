const path = require('path');
const chalk = require('chalk');
const StateManager = require('../lib/core/state-manager');
const ReferenceProcessor = require('../lib/core/reference-processor');
const MarkdownParser = require('../lib/core/markdown-parser');

async function testInternalReferences() {
  console.log(chalk.cyan('🧪 Testing Internal Reference Processing\n'));

  try {
    const projectRoot = path.join(__dirname, '../docusaurus-example');
    
    // Initialize state manager
    const stateManager = new StateManager(projectRoot);
    await stateManager.init();

    // Mock some existing pages in state for testing
    const mockPages = {
      'intro.md': {
        confluenceId: '12345',
        title: 'Introduction',
        lastModified: new Date().toISOString()
      },
      'tutorial-basics/create-a-page.md': {
        confluenceId: '23456',
        title: 'Create a Page',
        lastModified: new Date().toISOString()
      },
      'tutorial-basics/deploy-your-site.md': {
        confluenceId: '34567',
        title: 'Deploy your site',
        lastModified: new Date().toISOString()
      },
      'advanced/concepts/deep-nested.md': {
        confluenceId: '45678',
        title: 'Advanced Concepts',
        lastModified: new Date().toISOString()
      }
    };

    // Add mock pages to state
    for (const [path, data] of Object.entries(mockPages)) {
      stateManager.setPageState(path, data);
    }

    // Test reference processor
    console.log(chalk.blue('1. Testing ReferenceProcessor directly'));
    const referenceProcessor = new ReferenceProcessor(projectRoot, stateManager);
    
    const testMarkdown = `# Test Internal Links

## Basic Links
- [Create a Page](./tutorial-basics/create-a-page.md)
- [Tutorial Intro](../intro.md)
- [Advanced Concepts](./advanced/concepts/deep-nested.md)

## Absolute Links
- [Tutorial Intro](/docs/intro)
- [Create Page](/docs/tutorial-basics/create-a-page)
- [Advanced](/docs/advanced/concepts/deep-nested)

## Links with Anchors
- [Create Page - Step 1](./tutorial-basics/create-a-page.md#step-1)
- [Intro - Getting Started](../intro.md#getting-started)

## External Links (should not change)
- [GitHub](https://github.com)
- [Docusaurus](https://docusaurus.io)

## Reference Style Links
[tutorial-link]: ./tutorial-basics/create-a-page.md
[deploy-link]: ./tutorial-basics/deploy-your-site.md

Check out the [tutorial][tutorial-link] and [deployment guide][deploy-link].
`;

    const currentFilePath = path.join(projectRoot, 'docs', 'test-internal-links.md');
    const baseUrl = 'https://test.atlassian.net';

    // Get link statistics
    const linkStats = referenceProcessor.getStats(testMarkdown);
    console.log(chalk.white('📊 Link Statistics:'));
    console.log(`  Total links: ${linkStats.total}`);
    console.log(`  Markdown links: ${linkStats.markdown}`);
    console.log(`  HTML links: ${linkStats.html}`);
    console.log(`  Reference links: ${linkStats.reference}`);
    console.log(`  Internal links: ${linkStats.internal}`);
    console.log(`  External links: ${linkStats.external}`);

    // Process references
    const processedMarkdown = referenceProcessor.processReferences(
      testMarkdown, 
      currentFilePath, 
      baseUrl
    );

    console.log(chalk.green('\n✅ Reference processing completed'));

    // Test with MarkdownParser integration
    console.log(chalk.blue('\n2. Testing MarkdownParser with reference processing'));
    
    const parser = new MarkdownParser(projectRoot, stateManager);
    const result = await parser.parseMarkdown(
      testMarkdown,
      { title: 'Test Internal Links' },
      currentFilePath,
      baseUrl
    );

    console.log(chalk.white('📄 Parsed Result:'));
    console.log(`  Title: ${result.title}`);
    console.log(`  Original length: ${result.originalMarkdown.length} chars`);
    console.log(`  Processed length: ${result.processedMarkdown.length} chars`);
    console.log(`  HTML length: ${result.htmlContent.length} chars`);
    
    if (result.linkStats) {
      console.log(`  Links processed: ${result.linkStats.internal} internal, ${result.linkStats.external} external`);
    }

    // Test with actual test file
    console.log(chalk.blue('\n3. Testing with actual test file'));
    
    const testFilePath = path.join(projectRoot, 'docs', 'test-internal-links.md');
    const testFileResult = await parser.parseFile(testFilePath, baseUrl);

    console.log(chalk.white('📄 Test File Result:'));
    console.log(`  Title: ${testFileResult.title}`);
    console.log(`  Content length: ${testFileResult.content.length} chars`);
    
    if (testFileResult.linkStats) {
      console.log(`  Links found: ${testFileResult.linkStats.total} total`);
      console.log(`  Internal links: ${testFileResult.linkStats.internal}`);
      console.log(`  External links: ${testFileResult.linkStats.external}`);
    }

    // Show sample conversions
    console.log(chalk.blue('\n4. Sample Link Conversions:'));
    const sampleLinks = [
      './tutorial-basics/create-a-page.md',
      '../intro.md',
      '/docs/tutorial-basics/create-a-page',
      './tutorial-basics/create-a-page.md#step-1'
    ];

    for (const link of sampleLinks) {
      const converted = referenceProcessor.processLinkUrl(link, currentFilePath, baseUrl);
      const changed = converted !== link;
      console.log(`  ${link}`);
      console.log(`  → ${converted} ${changed ? chalk.green('✓') : chalk.gray('(unchanged)')}`);
    }

    console.log(chalk.green('\n🎉 All internal reference tests completed successfully!'));

  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  testInternalReferences();
}

module.exports = { testInternalReferences }; 