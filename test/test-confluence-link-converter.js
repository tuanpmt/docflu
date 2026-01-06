const path = require('path');
const chalk = require('chalk');
const StateManager = require('../lib/core/state-manager');
const ConfluenceLinkConverter = require('../lib/core/confluence-link-converter');

async function testConfluenceLinkConverter() {
  console.log(chalk.cyan('🧪 Testing Confluence Link to Markdown Converter\n'));

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
      },
      'api/reference.md': {
        confluenceId: '56789',
        title: 'API Reference',
        lastModified: new Date().toISOString()
      }
    };

    // Add mock pages to state
    for (const [pagePath, data] of Object.entries(mockPages)) {
      stateManager.setPageState(pagePath, data);
    }

    // Initialize converter
    const confluenceConfig = {
      baseUrl: 'https://test.atlassian.net',
      spaceKey: 'DOCS'
    };
    const converter = new ConfluenceLinkConverter(projectRoot, stateManager, confluenceConfig);

    // Test 1: Parse Confluence URL formats
    console.log(chalk.blue('1. Testing Confluence URL Parsing'));
    const testUrls = [
      // Modern format
      'https://test.atlassian.net/wiki/spaces/DOCS/pages/12345/Introduction',
      'https://test.atlassian.net/wiki/spaces/DOCS/pages/23456/Create+a+Page',
      // With anchor
      'https://test.atlassian.net/wiki/spaces/DOCS/pages/12345/Introduction#getting-started',
      // Legacy format
      'https://test.atlassian.net/pages/viewpage.action?pageId=34567',
      // Edit format
      'https://test.atlassian.net/pages/editpage.action?pageId=45678',
      // Display format
      'https://test.atlassian.net/display/DOCS/API+Reference?pageId=56789',
      // With query param
      'https://test.atlassian.net/wiki/display/DOCS/Page?pageId=12345&spaceKey=DOCS',
    ];

    for (const url of testUrls) {
      const parsed = converter.parseConfluenceUrl(url);
      console.log(`  URL: ${url}`);
      console.log(`    → pageId: ${parsed.pageId}, spaceKey: ${parsed.spaceKey}, anchor: ${parsed.anchor || 'none'}`);
    }
    console.log(chalk.green('  ✓ URL parsing completed\n'));

    // Test 2: Convert single URLs
    console.log(chalk.blue('2. Testing Single URL Conversion'));
    for (const url of testUrls.slice(0, 5)) {
      const result = converter.convertConfluenceUrl(url);
      if (result.success) {
        console.log(`  ${chalk.green('✓')} ${url}`);
        console.log(`    → ${result.markdownPath}`);
      } else {
        console.log(`  ${chalk.red('✗')} ${url}`);
        console.log(`    → Error: ${result.error}`);
      }
    }
    console.log();

    // Test 3: Process content with Confluence links
    console.log(chalk.blue('3. Testing Content Processing'));
    const testContent = `# Test Document

## Links to other pages

Check out the [Introduction](https://test.atlassian.net/wiki/spaces/DOCS/pages/12345/Introduction) for getting started.

You can also see:
- [Create a Page](https://test.atlassian.net/wiki/spaces/DOCS/pages/23456/Create+a+Page) - Basic tutorial
- [Deploy your site](https://test.atlassian.net/pages/viewpage.action?pageId=34567) - Legacy link format
- [Advanced Concepts](https://test.atlassian.net/pages/editpage.action?pageId=45678) - Edit link format

## HTML Links

<a href="https://test.atlassian.net/wiki/spaces/DOCS/pages/56789/API+Reference">API Docs</a>

## Reference Style Links

[intro-link]: https://test.atlassian.net/wiki/spaces/DOCS/pages/12345/Introduction

See the [intro][intro-link] for more details.

## External Links (should not change)

- [GitHub](https://github.com/example/repo)
- [External Site](https://example.com)
`;

    const currentFilePath = path.join(projectRoot, 'docs', 'test-file.md');
    const { content: processedContent, stats } = converter.processContent(testContent, currentFilePath);

    console.log(chalk.white('📊 Processing Statistics:'));
    console.log(`  Total links: ${stats.total}`);
    console.log(`  Converted: ${stats.converted}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Unchanged: ${stats.unchanged}`);

    console.log(chalk.white('\n📄 Processed Content Preview:'));
    const lines = processedContent.split('\n').slice(0, 20);
    for (const line of lines) {
      console.log(`  ${line}`);
    }
    console.log('  ...');
    console.log(chalk.green('  ✓ Content processing completed\n'));

    // Test 4: Analyze content
    console.log(chalk.blue('4. Testing Content Analysis'));
    const analysis = converter.analyzeContent(testContent);
    console.log(chalk.white('📊 Analysis Results:'));
    console.log(`  Total links: ${analysis.totalLinks}`);
    console.log(`  Confluence links: ${analysis.confluenceLinks}`);
    console.log(`  Convertible: ${analysis.convertibleLinks}`);
    console.log(`  Unconvertible: ${analysis.unconvertibleLinks}`);

    if (analysis.details.length > 0) {
      console.log(chalk.white('\n  Details:'));
      for (const detail of analysis.details.slice(0, 5)) {
        const status = detail.canConvert ? chalk.green('✓') : chalk.red('✗');
        console.log(`    ${status} [${detail.type}] pageId=${detail.pageId}`);
        if (detail.canConvert) {
          console.log(`       → ${detail.targetPath}`);
        } else {
          console.log(`       → ${detail.reason}`);
        }
      }
    }
    console.log(chalk.green('  ✓ Content analysis completed\n'));

    // Test 5: Relative path calculation
    console.log(chalk.blue('5. Testing Relative Path Calculation'));
    const pathTests = [
      { target: 'intro.md', current: 'docs/tutorial/page.md' },
      { target: 'tutorial-basics/create-a-page.md', current: 'docs/intro.md' },
      { target: 'advanced/concepts/deep-nested.md', current: 'docs/tutorial-basics/create-a-page.md' },
      { target: 'api/reference.md', current: 'docs/advanced/concepts/deep-nested.md' },
    ];

    for (const test of pathTests) {
      const relativePath = converter.calculateRelativePath(test.target, test.current);
      console.log(`  From: ${test.current}`);
      console.log(`  To:   ${test.target}`);
      console.log(`  Path: ${relativePath}`);
      console.log();
    }
    console.log(chalk.green('  ✓ Path calculation completed\n'));

    // Test 6: Batch conversion
    console.log(chalk.blue('6. Testing Batch Conversion'));
    const urlsToConvert = [
      'https://test.atlassian.net/wiki/spaces/DOCS/pages/12345/Introduction',
      'https://test.atlassian.net/wiki/spaces/DOCS/pages/99999/NonExistent', // Should fail
      'https://test.atlassian.net/wiki/spaces/DOCS/pages/23456/Create+a+Page',
    ];

    const batchResults = converter.convertMultipleUrls(urlsToConvert);
    for (const result of batchResults) {
      const status = result.success ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${status} ${result.original}`);
      if (result.success) {
        console.log(`    → ${result.markdownPath}`);
      } else {
        console.log(`    → ${result.error}`);
      }
    }
    console.log(chalk.green('  ✓ Batch conversion completed\n'));

    // Test 7: URL detection
    console.log(chalk.blue('7. Testing Confluence URL Detection'));
    const urlDetectionTests = [
      { url: 'https://test.atlassian.net/wiki/spaces/DOCS/pages/12345', expected: true },
      { url: 'https://example.com/page', expected: false },
      { url: 'https://other.atlassian.net/pages/viewpage.action?pageId=123', expected: true },
      { url: '/wiki/spaces/TEST/pages/456', expected: true },
      { url: 'https://github.com/user/repo', expected: false },
      { url: '?pageId=789', expected: true },
    ];

    for (const test of urlDetectionTests) {
      const isConfluence = converter.isConfluenceUrl(test.url);
      const status = isConfluence === test.expected ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${status} ${test.url}`);
      console.log(`    Expected: ${test.expected}, Got: ${isConfluence}`);
    }
    console.log(chalk.green('  ✓ URL detection completed\n'));

    console.log(chalk.green('🎉 All Confluence Link Converter tests completed successfully!'));

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
  testConfluenceLinkConverter();
}

module.exports = { testConfluenceLinkConverter };
