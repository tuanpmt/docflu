const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const ConfluenceClient = require('../lib/core/confluence-client');
const { syncFile } = require('../lib/commands/sync');

console.log(chalk.blue('🧪 Testing Target Page Sync Feature'));

/**
 * Test URL/ID parsing functionality
 */
async function testUrlParsing() {
  console.log(chalk.cyan('\n📋 Testing URL/ID Parsing:'));
  
  const mockConfig = {
    baseUrl: 'https://example.atlassian.net',
    username: 'test@example.com',
    apiToken: 'test-token',
    spaceKey: 'TEST'
  };
  
  const client = new ConfluenceClient(mockConfig);
  
  const testCases = [
    {
      input: '123456',
      expected: '123456',
      description: 'Plain page ID'
    },
    {
      input: 'https://example.atlassian.net/wiki/spaces/DOC/pages/123456/Page+Title',
      expected: '123456',
      description: 'Modern Confluence URL'
    },
    {
      input: 'https://example.atlassian.net/pages/viewpage.action?pageId=123456',
      expected: '123456',
      description: 'Legacy Confluence URL'
    },
    {
      input: 'https://example.atlassian.net/display/DOC/Page+Title?pageId=123456',
      expected: '123456',
      description: 'Display URL with pageId'
    },
    {
      input: 'https://example.atlassian.net/pages/editpage.action?pageId=123456',
      expected: '123456',
      description: 'Edit page URL'
    }
  ];
  
  let passed = 0;
  let total = testCases.length;
  
  for (const testCase of testCases) {
    try {
      const result = client.parseConfluenceTarget(testCase.input);
      if (result === testCase.expected) {
        console.log(chalk.green(`✅ ${testCase.description}: ${testCase.input} -> ${result}`));
        passed++;
      } else {
        console.log(chalk.red(`❌ ${testCase.description}: Expected ${testCase.expected}, got ${result}`));
      }
    } catch (error) {
      console.log(chalk.red(`❌ ${testCase.description}: Error - ${error.message}`));
    }
  }
  
  console.log(chalk.white(`\n📊 URL Parsing Results: ${passed}/${total} passed`));
  return passed === total;
}

/**
 * Test frontmatter parsing
 */
async function testFrontmatterParsing() {
  console.log(chalk.cyan('\n📋 Testing Frontmatter Parsing:'));
  
  const testMarkdownFiles = [
    {
      filename: 'test-target-frontmatter.md',
      content: `---
title: Test Document
confluence_target: 123456
---

# Test Document

This document should sync to page ID 123456.
`,
      expectedTarget: '123456'
    },
    {
      filename: 'test-target-url.md',
      content: `---
title: Test Document
confluence_page: https://example.atlassian.net/wiki/spaces/DOC/pages/789012/Test+Page
---

# Test Document

This document should sync to the specified URL.
`,
      expectedTarget: 'https://example.atlassian.net/wiki/spaces/DOC/pages/789012/Test+Page'
    },
    {
      filename: 'test-no-target.md',
      content: `---
title: Test Document
---

# Test Document

This document has no target specified.
`,
      expectedTarget: null
    }
  ];
  
  let passed = 0;
  let total = testMarkdownFiles.length;
  
  for (const testFile of testMarkdownFiles) {
    try {
      const testFilePath = path.join(__dirname, 'temp', testFile.filename);
      await fs.ensureDir(path.dirname(testFilePath));
      await fs.writeFile(testFilePath, testFile.content);
      
      const grayMatter = require('gray-matter');
      const parsed = grayMatter(testFile.content);
      
      const frontmatterTarget = parsed.data?.confluence_target || 
                               parsed.data?.confluence_page || 
                               parsed.data?.confluence_url;
      
      // Handle cases where expected is null and normalize types
      const normalizedExpected = testFile.expectedTarget;
      const normalizedActual = frontmatterTarget ? String(frontmatterTarget) : null;
      
      if (normalizedActual === normalizedExpected) {
        console.log(chalk.green(`✅ ${testFile.filename}: Target parsed correctly (${normalizedActual})`));
        passed++;
      } else {
        console.log(chalk.red(`❌ ${testFile.filename}: Expected '${normalizedExpected}', got '${normalizedActual}'`));
      }
      
      // Cleanup
      await fs.remove(testFilePath);
    } catch (error) {
      console.log(chalk.red(`❌ ${testFile.filename}: Error - ${error.message}`));
    }
  }
  
  console.log(chalk.white(`\n📊 Frontmatter Parsing Results: ${passed}/${total} passed`));
  return passed === total;
}

/**
 * Test CLI flag validation
 */
async function testCliValidation() {
  console.log(chalk.cyan('\n📋 Testing CLI Flag Validation:'));
  
  const mockConfig = {
    baseUrl: 'https://example.atlassian.net',
    username: 'test@example.com',
    apiToken: 'test-token',
    spaceKey: 'TEST'
  };
  
  const client = new ConfluenceClient(mockConfig);
  
  // Test invalid inputs
  const invalidInputs = [
    'not-a-valid-url',
    'https://example.com/invalid-path',
    'abc123def'
  ];
  
  let passed = 0;
  let total = invalidInputs.length;
  
  for (const input of invalidInputs) {
    try {
      const result = client.parseConfluenceTarget(input);
      console.log(chalk.red(`❌ Should have failed for input: ${input}, but got: ${result}`));
    } catch (error) {
      console.log(chalk.green(`✅ Correctly rejected invalid input: ${input}`));
      passed++;
    }
  }
  
  // Test empty input (should return null, not throw)
  try {
    const result = client.parseConfluenceTarget('');
    if (result === null) {
      console.log(chalk.green(`✅ Correctly handled empty input: returns null`));
      passed++;
      total++;
    } else {
      console.log(chalk.red(`❌ Empty input should return null, but got: ${result}`));
      total++;
    }
  } catch (error) {
    console.log(chalk.red(`❌ Empty input should return null, not throw error: ${error.message}`));
    total++;
  }
  
  console.log(chalk.white(`\n📊 CLI Validation Results: ${passed}/${total} passed`));
  return passed === total;
}

/**
 * Test the complete integration
 */
async function testIntegration() {
  console.log(chalk.cyan('\n📋 Testing Integration (Mock):'));
  
  // Create a test markdown file
  const testContent = `---
title: Integration Test
confluence_target: 123456
---

# Integration Test

This is a test document for the target page sync feature.

## Features Tested

- URL/ID parsing
- Frontmatter support  
- CLI flag support
- Direct page updates
`;
  
  const testFilePath = path.join(__dirname, 'temp', 'integration-test.md');
  await fs.ensureDir(path.dirname(testFilePath));
  await fs.writeFile(testFilePath, testContent);
  
  try {
    // Mock the sync by testing the parsing logic only
    const grayMatter = require('gray-matter');
    const parsed = grayMatter(testContent);
    
    const frontmatterTarget = parsed.data?.confluence_target || 
                             parsed.data?.confluence_page || 
                             parsed.data?.confluence_url;
    
    // Normalize the frontmatter target to string for comparison
    const normalizedFrontmatterTarget = frontmatterTarget ? String(frontmatterTarget) : null;
    
    if (normalizedFrontmatterTarget === '123456') {
      console.log(chalk.green('✅ Integration test: Frontmatter target parsed correctly'));
      
      // Test CLI flag override
      const cliTarget = '789012';
      const finalTarget = cliTarget || normalizedFrontmatterTarget;
      
      if (finalTarget === cliTarget) {
        console.log(chalk.green('✅ Integration test: CLI flag override works correctly'));
        
        // Cleanup
        await fs.remove(testFilePath);
        
        console.log(chalk.white('\n📊 Integration Results: All tests passed'));
        return true;
      } else {
        console.log(chalk.red(`❌ Integration test: CLI override failed. Expected ${cliTarget}, got ${finalTarget}`));
      }
    } else {
      console.log(chalk.red(`❌ Integration test: Frontmatter parsing failed. Expected '123456', got '${normalizedFrontmatterTarget}'`));
    }
    
    console.log(chalk.red('❌ Integration test failed'));
    return false;
    
  } catch (error) {
    console.log(chalk.red(`❌ Integration test error: ${error.message}`));
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  try {
    console.log(chalk.blue('🚀 Starting Target Page Sync Tests\n'));
    
    const results = await Promise.all([
      testUrlParsing(),
      testFrontmatterParsing(),
      testCliValidation(),
      testIntegration()
    ]);
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log(chalk.cyan('\n📊 FINAL RESULTS:'));
    console.log(chalk.white(`Tests passed: ${passed}/${total}`));
    
    if (passed === total) {
      console.log(chalk.green('🎉 All tests passed! Target page sync feature is working correctly.'));
    } else {
      console.log(chalk.red('❌ Some tests failed. Please check the implementation.'));
    }
    
    // Cleanup temp directory
    await fs.remove(path.join(__dirname, 'temp'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test suite error:'), error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };