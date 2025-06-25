const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

const MarkdownParser = require('../lib/core/markdown-parser');
const ConfluenceToMarkdown = require('../lib/core/confluence-to-markdown');

/**
 * Integration test for round-trip conversion
 * Tests: markdown -> confluence -> markdown preservation
 */
async function testRoundTripIntegration() {
  console.log(chalk.blue('\n🔄 Testing Round-Trip Integration...\n'));

  // Test comprehensive markdown with all features
  await testComprehensiveRoundTrip();

  console.log(chalk.green('\n✅ All Round-Trip Integration tests passed!\n'));
}

/**
 * Test comprehensive round-trip with all supported features
 */
async function testComprehensiveRoundTrip() {
  console.log(chalk.yellow('Test: Comprehensive round-trip conversion'));
  
  const parser = new MarkdownParser();
  
  // Mock confluence client
  const mockClient = {
    downloadAttachment: async () => Buffer.from('test'),
    getPageAttachments: async () => [],
    downloadAttachmentById: async (attachment) => ({
      data: Buffer.from('test'),
      filename: attachment.title,
      mediaType: 'application/octet-stream'
    })
  };
  
  const converter = new ConfluenceToMarkdown(mockClient, process.cwd());
  
  // Comprehensive test markdown with all features
  const originalMarkdown = `---
title: "Comprehensive Test"
sidebar_position: 2
sidebar_label: "Test Label"
tags: ["react", "javascript"]
---

# Comprehensive Test Document

This document tests all supported features.

## Code Blocks

### React Component with Title

\`\`\`jsx title="src/components/Button.jsx"
import React from 'react';

const Button = ({ children, onClick, disabled = false }) => {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className="btn btn-primary"
    >
      {children}
    </button>
  );
};

export default Button;
\`\`\`

### Regular Code Block

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return "success";
}
\`\`\`

## HTML Content

Here are some HTML tags: &lt;div&gt;, &lt;span&gt;, and &lt;button&gt;.

Some symbols: &amp; "quotes" and 'apostrophes'.

## Lists

- First item
- Second item with **bold** text
- Third item with *italic* text

1. Numbered list
2. Second item
3. Third item

## Tables

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Data A   | Data B   | Data C   |

## Links and References

Here's a [link](https://example.com) and some text.

That's all for now!
`;

  // Step 1: Parse markdown to confluence
  const confluenceResult = await parser.parseMarkdown(originalMarkdown, {}, 'test.md');
  
  console.log(chalk.gray('  → Converted to Confluence format'));
  

  
  // Step 2: Convert confluence back to markdown
  const markdownResult = await converter.convertToMarkdown(
    confluenceResult.content, 
    '12345', 
    'test.md',
    { sidebar_position: 2, sidebar_label: "Test Label" } // Existing frontmatter
  );
  
  console.log(chalk.gray('  → Converted back to Markdown'));
  
  // Verify key features are preserved
  const checks = [
    {
      name: 'Code block with title',
      test: () => markdownResult.markdown.includes('```jsx title="src/components/Button.jsx"'),
      error: 'Code block title not preserved'
    },
    {
      name: 'Code block content',
      test: () => markdownResult.markdown.includes('import React from') && 
                  markdownResult.markdown.includes('export default Button'),
      error: 'Code block content not preserved'
    },
    {
      name: 'Regular code block',
      test: () => markdownResult.markdown.includes('```javascript') && 
                  markdownResult.markdown.includes('function greet'),
      error: 'Regular code block not preserved'
    },
    {
      name: 'HTML entities',
      test: () => markdownResult.markdown.includes('Here are some HTML tags:') && 
                  markdownResult.markdown.includes('<div>, <span>, and <button>'),
      error: 'HTML entities not converted correctly'
    },
    {
      name: 'Symbols and quotes',
      test: () => {
        const symbolsLine = markdownResult.markdown.split('\n').find(line => line.includes('Some symbols:'));
        return symbolsLine && symbolsLine.includes('Some symbols: &') && 
               symbolsLine.includes('quotes') && symbolsLine.includes('apostrophes');
      },
      error: 'Symbols and quotes not preserved'
    },
    {
      name: 'Frontmatter preservation',
      test: () => markdownResult.frontmatter.sidebar_position === 2 && 
                  markdownResult.frontmatter.sidebar_label === "Test Label",
      error: 'Frontmatter not preserved'
    },
    {
      name: 'Title extraction',
      test: () => markdownResult.frontmatter.title === "Comprehensive Test Document",
      error: 'Title not extracted correctly'
    },
    {
      name: 'Lists preservation',
      test: () => markdownResult.markdown.includes('First item') && 
                  markdownResult.markdown.includes('Numbered list') &&
                  markdownResult.markdown.includes('1.') &&
                  markdownResult.markdown.includes('-'),
      error: 'Lists not preserved'
    },
    {
      name: 'Table preservation',
      test: () => markdownResult.markdown.includes('| Column 1 | Column 2 | Column 3 |'),
      error: 'Tables not preserved'
    },
    {
      name: 'Links preservation',
      test: () => markdownResult.markdown.includes('https://example.com') && 
                  markdownResult.markdown.includes('link'),
      error: 'Links not preserved'
    }
  ];
  
  // Run all checks
  for (const check of checks) {
    if (!check.test()) {
      throw new Error(`${check.error} (${check.name})`);
    }
    console.log(chalk.green(`    ✓ ${check.name}`));
  }
  
  console.log(chalk.green('  ✓ Comprehensive round-trip conversion works'));
}

// Run tests if called directly
if (require.main === module) {
  testRoundTripIntegration().catch(error => {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    if (process.env.DEBUG) {
      console.error(chalk.gray('Stack:'), error.stack);
    }
    process.exit(1);
  });
}

module.exports = {
  testRoundTripIntegration,
  testComprehensiveRoundTrip
}; 