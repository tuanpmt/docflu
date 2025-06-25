const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

const MarkdownParser = require('../lib/core/markdown-parser');
const ConfluenceToMarkdown = require('../lib/core/confluence-to-markdown');

/**
 * Test for Code Block Title and HTML Entity Fixes
 */
async function testCodeBlockTitleFixes() {
  console.log(chalk.blue('\n🧪 Testing Code Block Title and HTML Entity Fixes...\n'));

  // Test 1: Code block title parsing (markdown to confluence)
  await testCodeBlockTitleParsing();
  
  // Test 2: Code block title preservation (confluence to markdown)
  await testCodeBlockTitlePreservation();
  
  // Test 3: HTML entity preservation
  await testHtmlEntityPreservation();

  console.log(chalk.green('\n✅ All Code Block Title and HTML Entity tests passed!\n'));
}

/**
 * Test 1: Code block title parsing in markdown parser
 */
async function testCodeBlockTitleParsing() {
  console.log(chalk.yellow('Test 1: Code block title parsing'));
  
  const parser = new MarkdownParser();
  
  // Test markdown with code block title
  const testMarkdown = `
# Test Page

Here's a React component:

\`\`\`jsx title="src/pages/my-react-page.js"
import React from 'react';

function MyComponent() {
  return <div>Hello World</div>;
}

export default MyComponent;
\`\`\`

And a regular code block:

\`\`\`javascript
console.log("Hello");
\`\`\`
`;

  const result = await parser.parseMarkdown(testMarkdown, {}, 'test.md');
  
  // Verify title parameter is included in Confluence format
  if (!result.content.includes('<ac:parameter ac:name="title">src/pages/my-react-page.js</ac:parameter>')) {
    throw new Error('Code block title not preserved in Confluence format');
  }
  
  // Verify language is still present
  if (!result.content.includes('<ac:parameter ac:name="language">jsx</ac:parameter>')) {
    throw new Error('Code block language not preserved');
  }
  
  // Verify regular code block still works
  if (!result.content.includes('<ac:parameter ac:name="language">javascript</ac:parameter>')) {
    throw new Error('Regular code block language not preserved');
  }
  
  console.log(chalk.green('  ✓ Code block title parsing works'));
}

/**
 * Test 2: Code block title preservation in confluence to markdown
 */
async function testCodeBlockTitlePreservation() {
  console.log(chalk.yellow('Test 2: Code block title preservation'));
  
  // Mock confluence client
  const mockClient = {
    downloadAttachment: async () => Buffer.from('test')
  };
  
  const converter = new ConfluenceToMarkdown(mockClient, process.cwd());
  
  // Test Confluence Storage Format with code block title
  const confluenceHtml = `
    <ac:structured-macro ac:name="code" ac:schema-version="1">
      <ac:parameter ac:name="language">jsx</ac:parameter>
      <ac:parameter ac:name="title">src/pages/my-react-page.js</ac:parameter>
      <ac:plain-text-body><![CDATA[
import React from 'react';

function MyComponent() {
  return <div>Hello World</div>;
}

export default MyComponent;
      ]]></ac:plain-text-body>
    </ac:structured-macro>
  `;
  
  const result = await converter.convertToMarkdown(confluenceHtml, '12345', 'test.md');
  
  // Verify title is preserved in markdown
  if (!result.markdown.includes('```jsx title="src/pages/my-react-page.js"')) {
    throw new Error('Code block title not preserved in markdown output');
  }
  
  // Verify code content is preserved
  if (!result.markdown.includes('import React from')) {
    throw new Error('Code block content not preserved');
  }
  
  console.log(chalk.green('  ✓ Code block title preservation works'));
}

/**
 * Test 3: HTML entity preservation
 */
async function testHtmlEntityPreservation() {
  console.log(chalk.yellow('Test 3: HTML entity preservation'));
  
  // Mock confluence client
  const mockClient = {
    downloadAttachment: async () => Buffer.from('test')
  };
  
  const converter = new ConfluenceToMarkdown(mockClient, process.cwd());
  
  // Test Confluence HTML with escaped entities
  const confluenceHtml = `
    <h1>Test Page</h1>
    <p>Here are some tags: &lt;div&gt; and &lt;span&gt;</p>
    <p>Some symbols: &amp; &quot;quotes&quot; and &#39;apostrophe&#39;</p>
    
    <ac:structured-macro ac:name="code" ac:schema-version="1">
      <ac:parameter ac:name="language">html</ac:parameter>
      <ac:plain-text-body><![CDATA[
<div class="container">
  <span>Hello & "World"</span>
</div>
      ]]></ac:plain-text-body>
    </ac:structured-macro>
  `;
  
  const result = await converter.convertToMarkdown(confluenceHtml, '12345', 'test.md');
  

  
  // Verify HTML entities are properly unescaped in text content
  if (!result.markdown.includes('Here are some tags: <div> and <span>')) {
    throw new Error('HTML entities not properly unescaped in text content');
  }
  
  if (!result.markdown.includes('Some symbols: & "quotes" and \'apostrophe\'')) {
    throw new Error('HTML entities not properly unescaped for symbols');
  }
  
  // Verify code block content preserves original formatting
  if (!result.markdown.includes('<div class="container">')) {
    throw new Error('Code block HTML content not preserved');
  }
  
  if (!result.markdown.includes('Hello & "World"')) {
    throw new Error('Code block entities not preserved correctly');
  }
  
  console.log(chalk.green('  ✓ HTML entity preservation works'));
}

/**
 * Test 4: Round-trip conversion (markdown -> confluence -> markdown)
 */
async function testRoundTripConversion() {
  console.log(chalk.yellow('Test 4: Round-trip conversion'));
  
  const parser = new MarkdownParser();
  
  // Mock confluence client
  const mockClient = {
    downloadAttachment: async () => Buffer.from('test')
  };
  
  const converter = new ConfluenceToMarkdown(mockClient, process.cwd());
  
  // Original markdown
  const originalMarkdown = `
# Test Document

Here's some content with <tags> and "quotes".

\`\`\`jsx title="components/Button.jsx"
import React from 'react';

const Button = ({ children, onClick }) => {
  return (
    <button onClick={onClick}>
      {children}
    </button>
  );
};

export default Button;
\`\`\`

More content here.
`;

  // Step 1: Convert markdown to confluence
  const confluenceResult = await parser.parseMarkdown(originalMarkdown, {}, 'test.md');
  
  // Step 2: Convert confluence back to markdown
  const markdownResult = await converter.convertToMarkdown(
    confluenceResult.content, 
    '12345', 
    'test.md'
  );
  
  // Verify key elements are preserved
  if (!markdownResult.markdown.includes('```jsx title="components/Button.jsx"')) {
    throw new Error('Code block title lost in round-trip conversion');
  }
  
  if (!markdownResult.markdown.includes('Here\'s some content with <tags> and "quotes"')) {
    throw new Error('HTML entities not preserved in round-trip conversion');
  }
  
  if (!markdownResult.markdown.includes('import React from')) {
    throw new Error('Code content lost in round-trip conversion');
  }
  
  console.log(chalk.green('  ✓ Round-trip conversion works'));
}

// Run tests if called directly
if (require.main === module) {
  testCodeBlockTitleFixes().catch(error => {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    if (process.env.DEBUG) {
      console.error(chalk.gray('Stack:'), error.stack);
    }
    process.exit(1);
  });
}

module.exports = {
  testCodeBlockTitleFixes,
  testCodeBlockTitleParsing,
  testCodeBlockTitlePreservation,
  testHtmlEntityPreservation
}; 