const NotionAttachmentProcessor = require('../../lib/core/notion/attachment-processor');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

// Mock Notion client
class MockNotionClient {
  constructor() {}
}

// Mock state
class MockState {
  getUploadedFileUrl() { return null; }
  setUploadedFileUrl() {}
}

// Mock file uploader
class MockFileUploader {
  constructor() {}
  
  async uploadFileToNotion(buffer, fileName, mimeType) {
    // Mock successful upload
    return {
      type: 'file',
      file: {
        file: {
          url: `https://mock-notion-file-url.com/${fileName}`
        }
      }
    };
  }
  
  async cleanup() {}
}

// Mock config
const mockConfig = {
  projectRoot: '/test',
  notionApiToken: 'test-token'
};

async function testAttachmentProcessing() {
  console.log(chalk.blue('🧪 Testing Attachment Processing'));
  console.log(chalk.gray('=================================='));

  // Create attachment processor
  const attachmentProcessor = new NotionAttachmentProcessor(
    new MockNotionClient(),
    new MockState(),
    mockConfig
  );

  // Override file uploader with mock
  attachmentProcessor.fileUploader = new MockFileUploader();

  // Test cases
  const testCases = [
    {
      name: 'PDF attachment',
      markdown: '📄 [Download Sample Document](/files/sample-document.pdf)',
      expectedPattern: /\[Download Sample Document\]\(https:\/\/mock-notion-file-url\.com\/sample-document\.pdf\)/
    },
    {
      name: 'JSON config file',
      markdown: '⚙️ [Download Configuration File](/files/config.json)',
      expectedPattern: /\[Download Configuration File\]\(https:\/\/mock-notion-file-url\.com\/config\.json\)/
    },
    {
      name: 'File reference with backticks',
      markdown: 'Configuration: [`config.json`](/files/config.json)',
      expectedPattern: /\[`config\.json`\]\(https:\/\/mock-notion-file-url\.com\/config\.json\)/
    },
    {
      name: 'Multiple attachments',
      markdown: `Download files:
- [Document 1](/files/doc1.pdf)
- [Document 2](/files/doc2.docx)
- [Archive](/files/data.zip)`,
      expectedCount: 3
    },
    {
      name: 'Mixed content with images (should skip)',
      markdown: `![Image](/img/test.png)
[PDF File](/files/document.pdf)
[Another Image](/img/logo.jpg)`,
      expectedCount: 1 // Only PDF should be processed
    }
  ];

  let testsPassed = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(chalk.blue(`\n📝 Testing: ${testCase.name}`));
    console.log(chalk.gray(`   Input: ${testCase.markdown.substring(0, 100)}${testCase.markdown.length > 100 ? '...' : ''}`));

    try {
      // Test pattern matching
      const patterns = attachmentProcessor.patterns;
      let matchCount = 0;
      
      console.log(chalk.gray(`   Testing patterns: ${Object.keys(patterns).join(', ')}`));
      
      for (const [patternName, pattern] of Object.entries(patterns)) {
        pattern.lastIndex = 0; // Reset regex
        let match;
        console.log(chalk.gray(`   Pattern ${patternName}: ${pattern.source}`));
        while ((match = pattern.exec(testCase.markdown)) !== null) {
          const [fullMatch, linkText, attachmentPath] = match;
          console.log(chalk.gray(`   Raw match: "${fullMatch}" -> text:"${linkText}", path:"${attachmentPath}"`));
          
          // Reconstruct full path for /files/ pattern (same logic as in attachment processor)
          const fullPath = patternName === 'localFile' ? `/files/${attachmentPath}` : attachmentPath;
          console.log(chalk.gray(`   Full path: "${fullPath}"`));
          
          // Skip images
          if (attachmentProcessor.isImageFile(fullPath)) {
            console.log(chalk.gray(`   Skipped as image: ${fullPath}`));
            continue;
          }
          
          // Check if it's an attachment
          if (attachmentProcessor.isAttachmentFile(fullPath)) {
            matchCount++;
            console.log(chalk.cyan(`   Found attachment: "${linkText}" -> "${fullPath}"`));
          } else {
            console.log(chalk.gray(`   Not an attachment: ${fullPath}`));
          }
        }
      }

      // Validate results
      if (testCase.expectedPattern) {
        // Test single pattern matching
        if (matchCount === 1) {
          console.log(chalk.green(`   ✅ PASS: Found expected attachment`));
          testsPassed++;
        } else {
          console.log(chalk.red(`   ❌ FAIL: Expected 1 attachment, found ${matchCount}`));
        }
      } else if (testCase.expectedCount !== undefined) {
        // Test count matching
        if (matchCount === testCase.expectedCount) {
          console.log(chalk.green(`   ✅ PASS: Found ${matchCount} attachments as expected`));
          testsPassed++;
        } else {
          console.log(chalk.red(`   ❌ FAIL: Expected ${testCase.expectedCount} attachments, found ${matchCount}`));
        }
      }

    } catch (error) {
      console.log(chalk.red(`   ❌ ERROR: ${error.message}`));
    }
  }

  // Test file type detection
  console.log(chalk.blue('\n🔍 Testing File Type Detection'));
  console.log(chalk.gray('==============================='));

  const fileTypeTests = [
    { file: '/files/document.pdf', isImage: false, isAttachment: true },
    { file: '/files/config.json', isImage: false, isAttachment: true },
    { file: '/img/image.png', isImage: true, isAttachment: false },
    { file: '/img/logo.jpg', isImage: true, isAttachment: false },
    { file: '/files/archive.zip', isImage: false, isAttachment: true },
    { file: './readme.md', isImage: false, isAttachment: false }, // Internal link - should not be attachment
    { file: 'noextension', isImage: false, isAttachment: false }
  ];

  let fileTypeTestsPassed = 0;
  for (const test of fileTypeTests) {
    const isImage = attachmentProcessor.isImageFile(test.file);
    const isAttachment = attachmentProcessor.isAttachmentFile(test.file);
    
    if (isImage === test.isImage && isAttachment === test.isAttachment) {
      console.log(chalk.green(`   ✅ ${test.file}: Image=${isImage}, Attachment=${isAttachment}`));
      fileTypeTestsPassed++;
    } else {
      console.log(chalk.red(`   ❌ ${test.file}: Expected Image=${test.isImage}, Attachment=${test.isAttachment}, Got Image=${isImage}, Attachment=${isAttachment}`));
    }
  }

  totalTests += fileTypeTests.length;
  testsPassed += fileTypeTestsPassed;

  // Test MIME type detection
  console.log(chalk.blue('\n🎯 Testing MIME Type Detection'));
  console.log(chalk.gray('=============================='));

  const mimeTypeTests = [
    { file: 'document.pdf', expected: 'application/pdf' },
    { file: 'config.json', expected: 'application/json' },
    { file: 'archive.zip', expected: 'application/zip' },
    { file: 'script.js', expected: 'text/javascript' },
    { file: 'unknown.xyz', expected: 'application/octet-stream' }
  ];

  let mimeTypeTestsPassed = 0;
  for (const test of mimeTypeTests) {
    const detected = attachmentProcessor.getMimeType(test.file);
    
    if (detected === test.expected) {
      console.log(chalk.green(`   ✅ ${test.file}: ${detected}`));
      mimeTypeTestsPassed++;
    } else {
      console.log(chalk.red(`   ❌ ${test.file}: Expected ${test.expected}, got ${detected}`));
    }
  }

  totalTests += mimeTypeTests.length;
  testsPassed += mimeTypeTestsPassed;

  // Summary
  console.log(chalk.blue('\n📊 Test Summary'));
  console.log(chalk.gray('==============='));
  console.log(chalk.green(`✅ Passed: ${testsPassed}/${totalTests}`));
  console.log(chalk.red(`❌ Failed: ${totalTests - testsPassed}/${totalTests}`));
  
  if (testsPassed === totalTests) {
    console.log(chalk.green('🎉 All tests passed!'));
  } else {
    console.log(chalk.yellow('⚠️ Some tests failed. Please check the implementation.'));
  }
}

// Run tests
if (require.main === module) {
  testAttachmentProcessing().catch(console.error);
}

module.exports = { testAttachmentProcessing };