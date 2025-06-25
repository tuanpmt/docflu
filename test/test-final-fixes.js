const MarkdownParser = require('../lib/core/markdown-parser');
const ConfluenceToMarkdown = require('../lib/core/confluence-to-markdown');

// Mock confluence client
const mockConfluenceClient = {
  downloadAttachment: async () => ({ success: true }),
  getAttachmentUrl: () => 'https://example.com/attachment.jpg'
};

async function testCodeBlockTitleHandling() {
  console.log('\n🧪 Testing Code Block Title Handling...');
  
  const parser = new MarkdownParser();
  
  // Test markdown with code block title
  const markdown = `# Test Document

This is a code block with title:

\`\`\`jsx title="src/pages/my-react-page.js"
import React from 'react';

function MyPage() {
  return <div>Hello World</div>;
}

export default MyPage;
\`\`\`

And a code block without title:

\`\`\`javascript
console.log('Hello World');
\`\`\`
`;

  const result = await parser.parseMarkdown(markdown);
  console.log('✅ Markdown parsed successfully');
  
  // Check if title is preserved in Confluence format
  const hasTitle = result.content.includes('<ac:parameter ac:name="title">src/pages/my-react-page.js</ac:parameter>');
  const hasLanguage = result.content.includes('<ac:parameter ac:name="language">jsx</ac:parameter>');
  
  if (hasTitle && hasLanguage) {
    console.log('✅ Code block title preserved correctly');
  } else {
    console.log('❌ Code block title not preserved');
    console.log('Generated content:', result.content);
  }
  
  return hasTitle && hasLanguage;
}

async function testHtmlEntityPreservation() {
  console.log('\n🧪 Testing HTML Entity Preservation...');
  
  const parser = new MarkdownParser();
  
  // Test markdown with HTML entities
  const markdown = `# HTML Entity Test

This text contains HTML entities:
- Less than: &lt;
- Greater than: &gt;
- Ampersand: &amp;
- Quote: &quot;
- Apostrophe: &#39;

And some code:
\`\`\`html
<div class="example">
  <p>This is &lt;HTML&gt; content</p>
</div>
\`\`\`
`;

  const result = await parser.parseMarkdown(markdown);
  console.log('✅ Markdown parsed successfully');
  
  // Check if HTML entities are preserved correctly
  const hasLessThan = result.content.includes('&lt;');
  const hasGreaterThan = result.content.includes('&gt;');
  const hasAmpersand = result.content.includes('&amp;');
  
  if (hasLessThan && hasGreaterThan && hasAmpersand) {
    console.log('✅ HTML entities preserved correctly');
  } else {
    console.log('❌ HTML entities not preserved correctly');
    console.log('Generated content:', result.content);
  }
  
  return hasLessThan && hasGreaterThan && hasAmpersand;
}

async function testBidirectionalConversion() {
  console.log('\n🧪 Testing Bidirectional Conversion...');
  
  const parser = new MarkdownParser();
  const converter = new ConfluenceToMarkdown(mockConfluenceClient, '/test');
  
  // Original markdown with title and entities
  const originalMarkdown = `# Test Document

Code with title:
\`\`\`jsx title="components/Button.js"
const Button = ({ children }) => {
  return <button>{children}</button>;
};
\`\`\`

Text with entities: &lt;div&gt; and &amp; symbol.
`;

  // Convert to Confluence format
  const parseResult = await parser.parseMarkdown(originalMarkdown);
  console.log('✅ Converted to Confluence format');
  
  // Create mock Confluence HTML
  const confluenceHtml = `
    <h1>Test Document</h1>
    <p>Code with title:</p>
    <ac:structured-macro ac:name="code">
      <ac:parameter ac:name="language">jsx</ac:parameter>
      <ac:parameter ac:name="title">components/Button.js</ac:parameter>
      <ac:plain-text-body><![CDATA[const Button = ({ children }) => {
  return <button>{children}</button>;
};]]></ac:plain-text-body>
    </ac:structured-macro>
    <p>Text with entities: &lt;div&gt; and &amp; symbol.</p>
  `;
  
  // Convert back to markdown
  const backToMarkdown = await converter.convertToMarkdown(confluenceHtml, 'test-page', 'test.md');
  console.log('✅ Converted back to Markdown');
  
  // Check if title is preserved
  const titlePreserved = backToMarkdown.markdown.includes('title="components/Button.js"');
  // HTML entities should be converted to actual characters (this is the desired behavior)
  const entitiesPreserved = backToMarkdown.markdown.includes('<div>') && 
                           backToMarkdown.markdown.includes('&');
  
  if (titlePreserved && entitiesPreserved) {
    console.log('✅ Bidirectional conversion successful');
  } else {
    console.log('❌ Bidirectional conversion failed');
    console.log('Result markdown:', backToMarkdown.markdown);
  }
  
  return titlePreserved && entitiesPreserved;
}

async function runAllTests() {
  console.log('🚀 Running Final Fixes Tests...');
  
  const results = await Promise.all([
    testCodeBlockTitleHandling(),
    testHtmlEntityPreservation(),
    testBidirectionalConversion()
  ]);
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Fixes are working correctly.');
  } else {
    console.log('❌ Some tests failed. Please review the fixes.');
  }
  
  return passed === total;
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests }; 