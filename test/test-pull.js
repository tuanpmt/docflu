const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const ConfluenceToMarkdown = require('../lib/core/confluence-to-markdown');

console.log(chalk.blue('🧪 Testing Confluence to Markdown conversion...'));

// Mock Confluence client for testing
const mockConfluenceClient = {
  downloadAttachment: async (pageId, filename) => {
    console.log(`Mock: Downloading attachment ${filename} from page ${pageId}`);
    return Buffer.from('Mock attachment content');
  },
  
  getPageAttachments: async (pageId) => {
    console.log(`Mock: Getting attachments for page ${pageId}`);
    return [
      {
        id: 'att123',
        title: 'sample-image.png',
        _links: {
          download: '/mock/download/sample-image.png'
        },
        metadata: {
          mediaType: 'image/png'
        }
      }
    ];
  },
  
  downloadAttachmentById: async (attachment) => {
    console.log(`Mock: Downloading attachment by ID: ${attachment.title}`);
    return {
      data: Buffer.from(`Mock content for ${attachment.title}`),
      filename: attachment.title,
      mediaType: attachment.metadata?.mediaType || 'application/octet-stream'
    };
  }
};

// Sample Confluence Storage Format HTML
const sampleConfluenceHtml = `
<h1>Test Document</h1>
<p>This is a test document with various Confluence elements.</p>

<h2>Code Block Example</h2>
<structured-macro name="code">
  <parameter name="language">javascript</parameter>
  <plain-text-body>function hello() {
  console.log("Hello, World!");
  return "success";
}</plain-text-body>
</structured-macro>

<h2>Info Panel</h2>
<structured-macro name="info">
  <parameter name="title">Important Information</parameter>
  <rich-text-body>
    <p>This is an info panel with <strong>important</strong> information.</p>
    <ul>
      <li>Point 1</li>
      <li>Point 2</li>
    </ul>
  </rich-text-body>
</structured-macro>

<h2>Warning Panel</h2>
<structured-macro name="warning">
  <rich-text-body>
    <p>This is a warning message!</p>
  </rich-text-body>
</structured-macro>

<h2>Table Example</h2>
<table>
  <thead>
    <tr>
      <th>Column 1</th>
      <th>Column 2</th>
      <th>Column 3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Row 1, Col 1</td>
      <td>Row 1, Col 2</td>
      <td>Row 1, Col 3</td>
    </tr>
    <tr>
      <td>Row 2, Col 1</td>
      <td>Row 2, Col 2</td>
      <td>Row 2, Col 3</td>
    </tr>
  </tbody>
</table>

<h2>List Examples</h2>
<h3>Unordered List</h3>
<ul>
  <li>First item</li>
  <li>Second item with <em>emphasis</em></li>
  <li>Third item with <strong>bold text</strong></li>
</ul>

<h3>Ordered List</h3>
<ol>
  <li>First step</li>
  <li>Second step</li>
  <li>Third step</li>
</ol>

<h2>Links and References</h2>
<p>Here's a <a href="https://example.com">external link</a> and some text.</p>

<h2>Image Example</h2>
<ac:image>
  <attachment filename="sample-image.png" />
</ac:image>

<p>This document contains various formatting elements to test the conversion.</p>
`;

async function testConversion() {
  try {
    const projectRoot = path.join(__dirname, '..');
    const converter = new ConfluenceToMarkdown(mockConfluenceClient, projectRoot);
    
    console.log(chalk.yellow('📄 Converting sample Confluence HTML to Markdown...'));
    
    const result = await converter.convertToMarkdown(
      sampleConfluenceHtml,
      'mock-page-id',
      'docs/test-conversion.md'
    );
    
    console.log(chalk.green('✅ Conversion completed!'));
    console.log(chalk.white('\n📋 RESULTS:'));
    console.log(chalk.white('Frontmatter:'), JSON.stringify(result.frontmatter, null, 2));
    console.log(chalk.white('Attachments:'), result.attachments.length);
    
    console.log(chalk.cyan('\n📝 CONVERTED MARKDOWN:'));
    console.log('---');
    console.log(result.markdown);
    console.log('---');
    
    // Save to file for inspection
    const outputPath = path.join(__dirname, 'output-conversion-test.md');
    await fs.writeFile(outputPath, result.markdown, 'utf8');
    console.log(chalk.blue(`💾 Saved conversion result to: ${outputPath}`));
    
    console.log(chalk.green('\n✅ Test completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Test Confluence HTML preprocessing
function testHtmlPreprocessing() {
  console.log(chalk.yellow('\n🔧 Testing HTML preprocessing...'));
  
  const converter = new ConfluenceToMarkdown(mockConfluenceClient, __dirname);
  
  const testHtml = `
    <p><p>Nested paragraph issue</p></p>
    <structured-macro ac:name="code">
      <parameter ac:name="language">java</parameter>
      <plain-text-body>System.out.println("Hello");</plain-text-body>
    </structured-macro>
    <p>After code block</p>
  `;
  
  const preprocessed = converter.preprocessHtml(testHtml);
  console.log(chalk.white('Original HTML:'), testHtml);
  console.log(chalk.white('Preprocessed:'), preprocessed);
}

// Test markdown post-processing
function testMarkdownPostProcessing() {
  console.log(chalk.yellow('\n🔧 Testing Markdown post-processing...'));
  
  const converter = new ConfluenceToMarkdown(mockConfluenceClient, __dirname);
  
  const testMarkdown = `
# Heading


Too many empty lines


\`\`\`javascript
console.log("test");
\`\`\`
Next paragraph without proper spacing.

## Another Heading
- List item 1
- List item 2
`;
  
  const postProcessed = converter.postProcessMarkdown(testMarkdown);
  console.log(chalk.white('Original Markdown:'));
  console.log('---');
  console.log(testMarkdown);
  console.log('---');
  console.log(chalk.white('Post-processed:'));
  console.log('---');
  console.log(postProcessed);
  console.log('---');
}

// Run tests
async function runTests() {
  try {
    testHtmlPreprocessing();
    testMarkdownPostProcessing();
    await testConversion();
  } catch (error) {
    console.error(chalk.red('❌ Tests failed:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { testConversion, testHtmlPreprocessing, testMarkdownPostProcessing }; 