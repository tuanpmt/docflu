const MarkdownParser = require('../lib/core/markdown-parser');
const ConfluenceToMarkdown = require('../lib/core/confluence-to-markdown');

// Mock confluence client
const mockConfluenceClient = {
  downloadAttachment: async () => ({ success: true }),
  getAttachmentUrl: () => 'https://example.com/attachment.jpg'
};

async function testCodeContentPreservation() {
  console.log('\n🧪 Testing Code Content Preservation...');
  
  const parser = new MarkdownParser();
  const converter = new ConfluenceToMarkdown(mockConfluenceClient, '/test');
  
  // Test markdown with various quotes and special characters in code
  const markdown = `# Code Content Test

Here's some JavaScript code with quotes:

\`\`\`javascript
export default {
  tutorialSidebar: [
    'intro',
    // highlight-next-line
    'hello',
    {
      type: 'category',
      label: 'Tutorial',
      items: ['tutorial-basics/create-a-document'],
    },
  ],
};
\`\`\`

And some HTML code:

\`\`\`html
<div class="example">
  <p>This has 'single' and "double" quotes</p>
  <span data-value='test'>Content</span>
</div>
\`\`\`
`;

  console.log('Original markdown code content:');
  console.log("  - 'intro', 'hello', 'category', 'Tutorial'");
  console.log('  - "double" and \'single\' quotes in HTML');

  // Step 1: Parse markdown to confluence
  const parseResult = await parser.parseMarkdown(markdown);
  console.log('✅ Converted to Confluence format');
  
  // Check if quotes are properly handled in Confluence format
  const hasPreservedQuotes = parseResult.content.includes("'intro'") && 
                            parseResult.content.includes("'hello'") &&
                            parseResult.content.includes("'category'");
  
  if (hasPreservedQuotes) {
    console.log('✅ Quotes preserved in Confluence format');
  } else {
    console.log('❌ Quotes not preserved in Confluence format');
    console.log('Confluence content:', parseResult.content);
  }
  
  // Step 2: Convert back to markdown
  const backToMarkdown = await converter.convertToMarkdown(parseResult.content, 'test-page', 'test.md');
  console.log('✅ Converted back to Markdown');
  
  // Check if quotes are preserved in the round-trip
  const finalHasQuotes = backToMarkdown.markdown.includes("'intro'") && 
                        backToMarkdown.markdown.includes("'hello'") &&
                        backToMarkdown.markdown.includes("'category'") &&
                        backToMarkdown.markdown.includes("'Tutorial'");
  
  const noEscapedQuotes = !backToMarkdown.markdown.includes('&#39;');
  
  console.log('Final markdown code content check:');
  console.log(`  - Has original quotes: ${finalHasQuotes ? '✅' : '❌'}`);
  console.log(`  - No escaped quotes (&#39;): ${noEscapedQuotes ? '✅' : '❌'}`);
  
  if (!finalHasQuotes || !noEscapedQuotes) {
    console.log('\nFinal markdown content:');
    console.log(backToMarkdown.markdown);
  }
  
  return hasPreservedQuotes && finalHasQuotes && noEscapedQuotes;
}

async function testSpecialCharacterPreservation() {
  console.log('\n🧪 Testing Special Character Preservation...');
  
  const parser = new MarkdownParser();
  const converter = new ConfluenceToMarkdown(mockConfluenceClient, '/test');
  
  // Test with various special characters
  const markdown = `# Special Characters Test

\`\`\`javascript
const config = {
  // Various quotes
  single: 'value',
  double: "value", 
  backtick: \`template\`,
  
  // Special characters
  symbols: '< > & " \\' @ # $ % ^ * ( ) [ ] { }',
  
  // Real-world example
  regex: /[a-z]+'s/g,
  template: \`Hello \${name}!\`,
};
\`\`\`
`;

  const parseResult = await parser.parseMarkdown(markdown);
  const backToMarkdown = await converter.convertToMarkdown(parseResult.content, 'test-page', 'test.md');
  
  // Check for specific preservations
  const checks = [
    { name: 'Single quotes', test: () => backToMarkdown.markdown.includes("'value'") },
    { name: 'Double quotes', test: () => backToMarkdown.markdown.includes('"value"') },
    { name: 'Template literals', test: () => backToMarkdown.markdown.includes('`template`') },
    { name: 'Quotes preserved in symbols string', test: () => backToMarkdown.markdown.includes('" \\\'') },
    { name: 'No escaped quotes', test: () => !backToMarkdown.markdown.includes('&#39;') },
    { name: 'No escaped double quotes', test: () => !backToMarkdown.markdown.includes('&quot;') },
    { name: 'HTML chars properly escaped', test: () => backToMarkdown.markdown.includes('&lt; &gt; &amp;') }
  ];
  
  let allPassed = true;
  for (const check of checks) {
    const passed = check.test();
    console.log(`  ${passed ? '✅' : '❌'} ${check.name}`);
    if (!passed) allPassed = false;
  }
  
  if (!allPassed) {
    console.log('\nActual result:');
    console.log(backToMarkdown.markdown);
  }
  
  return allPassed;
}

async function runAllTests() {
  console.log('🚀 Running Code Content Preservation Tests...');
  
  const results = await Promise.all([
    testCodeContentPreservation(),
    testSpecialCharacterPreservation()
  ]);
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Code content is properly preserved.');
  } else {
    console.log('❌ Some tests failed. Code content preservation needs work.');
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