const LinkProcessor = require('../../lib/core/gdocs/link-processor');
const AttachmentProcessor = require('../../lib/core/gdocs/attachment-processor');
const GoogleDriveClient = require('../../lib/core/gdocs/google-drive-client');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

// Mock Google Drive Client
class MockGoogleDriveClient {
  constructor() {
    this.files = new Map();
    this.folders = new Map();
    this.nextFileId = 1;
    this.nextFolderId = 1;
    this.imageFolderId = null;
    this.uploadedImages = new Map(); // Add session cache
    
    // Mock drive API
    this.drive = {
      files: {
        create: async ({ resource, media, fields }) => {
          return this.uploadFile(null, resource.name, media.mimeType, resource.parents[0]);
        },
        get: async ({ fileId, fields }) => {
          const file = this.files.get(fileId);
          if (!file) throw new Error('File not found');
          return { data: file };
        }
      },
      permissions: {
        create: async ({ fileId, resource }) => {
          return { data: { id: 'permission-1' } };
        }
      }
    };
  }

  async initialize() {
    console.log(chalk.gray('   📱 Mock Google Drive client initialized'));
    return true;
  }

  async ensureImageFolder() {
    if (!this.imageFolderId) {
      const folderId = `mock-folder-${this.nextFolderId++}`;
      this.imageFolderId = folderId;
      this.folders.set(folderId, {
        id: folderId,
        name: `docflu-files-${Date.now()}`,
        parents: ['root']
      });
      console.log(chalk.gray(`   📁 Mock folder created: ${folderId}`));
    }
    return this.imageFolderId;
  }

  async uploadFile(filePath, fileName, mimeType, parentFolderId) {
    const fileId = `mock-file-${this.nextFileId++}`;
    const fileData = {
      id: fileId,
      name: fileName,
      mimeType: mimeType,
      parents: [parentFolderId],
      size: 1024, // Mock size
      webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
      webContentLink: `https://drive.google.com/uc?id=${fileId}&export=download`
    };
    
    this.files.set(fileId, fileData);
    console.log(chalk.gray(`   📎 Mock file uploaded: ${fileName} (${fileId})`));
    
    return { data: fileData };
  }

  async makeFilePublic(fileId) {
    const file = this.files.get(fileId);
    if (file) {
      file.public = true;
      console.log(chalk.gray(`   🌐 Mock file made public: ${fileId}`));
    }
    return true;
  }
}

// Mock State Manager
class MockStateManager {
  constructor() {
    this.state = {
      googleDrive: {
        uploadedAttachments: {}
      }
    };
  }

  async getState() {
    return this.state;
  }

  async updateState(newState) {
    this.state = { ...this.state, ...newState };
    console.log(chalk.gray('   💾 Mock state updated'));
  }
}

async function createTestFiles() {
  const testDir = path.join(__dirname, 'test-files');
  await fs.ensureDir(testDir);

  // Create test attachment files
  const testFiles = [
    { name: 'test-document.pdf', content: 'Mock PDF content' },
    { name: 'test-image.jpg', content: 'Mock JPEG content' },
    { name: 'test-archive.zip', content: 'Mock ZIP content' },
    { name: 'test-code.js', content: 'console.log("Hello World");' }
  ];

  for (const file of testFiles) {
    const filePath = path.join(testDir, file.name);
    await fs.writeFile(filePath, file.content);
  }

  return testDir;
}

async function cleanupTestFiles() {
  const testDir = path.join(__dirname, 'test-files');
  await fs.remove(testDir);
}

async function testLinkProcessor() {
  console.log(chalk.blue('🧪 Testing Link & Attachment Processor'));
  console.log(chalk.gray('======================================'));

  let testsPassed = 0;
  let totalTests = 0;

  // Setup test environment
  const testProjectRoot = path.join(__dirname, '..');
  const mockDriveClient = new MockGoogleDriveClient();
  const mockStateManager = new MockStateManager();
  const testFilesDir = await createTestFiles();

  // Initialize processors
  const attachmentProcessor = new AttachmentProcessor(mockDriveClient, mockStateManager);
  const linkProcessor = new LinkProcessor(mockDriveClient, testProjectRoot, mockStateManager);

  // Test 1: Initialize processors
  totalTests++;
  try {
    console.log(chalk.blue('\n1. Testing processor initialization...'));
    
    await mockDriveClient.initialize();
    await attachmentProcessor.initialize();
    await linkProcessor.initialize();
    
    console.log(chalk.green('   ✅ Processor initialization test passed'));
    testsPassed++;
  } catch (error) {
    console.log(chalk.red('   ❌ Processor initialization test error:', error.message));
  }

  // Test 2: Test MIME type detection
  totalTests++;
  try {
    console.log(chalk.blue('\n2. Testing MIME type detection...'));
    
    const testCases = [
      { file: 'test.pdf', expected: 'application/pdf' },
      { file: 'test.jpg', expected: 'image/jpeg' },
      { file: 'test.zip', expected: 'application/zip' },
      { file: 'test.js', expected: 'text/javascript' },
      { file: 'test.unknown', expected: 'application/octet-stream' }
    ];

    let mimeTestsPassed = 0;
    for (const testCase of testCases) {
      const detected = attachmentProcessor.getMimeType(testCase.file);
      console.log(chalk.gray(`   ${testCase.file}: ${detected}`));
      if (detected === testCase.expected) {
        mimeTestsPassed++;
      }
    }

    if (mimeTestsPassed === testCases.length) {
      console.log(chalk.green('   ✅ MIME type detection test passed'));
      testsPassed++;
    } else {
      console.log(chalk.red(`   ❌ MIME type detection test failed (${mimeTestsPassed}/${testCases.length})`));
    }
  } catch (error) {
    console.log(chalk.red('   ❌ MIME type detection test error:', error.message));
  }

  // Test 3: Test attachment upload
  totalTests++;
  try {
    console.log(chalk.blue('\n3. Testing attachment upload...'));
    
    const testFile = path.join(testFilesDir, 'test-document.pdf');
    const result = await attachmentProcessor.uploadAttachment(testFile);
    
    console.log(chalk.gray(`   Upload result: ${result.cached ? 'cached' : 'new'}`));
    console.log(chalk.gray(`   File ID: ${result.fileId}`));
    console.log(chalk.gray(`   Download URL: ${result.url}`));
    
    if (result.fileId && result.url && result.fileName) {
      console.log(chalk.green('   ✅ Attachment upload test passed'));
      testsPassed++;
    } else {
      console.log(chalk.red('   ❌ Attachment upload test failed'));
    }
  } catch (error) {
    console.log(chalk.red('   ❌ Attachment upload test error:', error.message));
  }

  // Test 4: Test caching mechanism
  totalTests++;
  try {
    console.log(chalk.blue('\n4. Testing caching mechanism...'));
    
    // Create a fresh attachment processor to test caching
    const freshAttachmentProcessor = new AttachmentProcessor(mockDriveClient, mockStateManager);
    await freshAttachmentProcessor.initialize();
    
    const testFile = path.join(testFilesDir, 'test-cache.pdf');
    await fs.writeFile(testFile, 'Test cache content');
    
    // First upload
    const result1 = await freshAttachmentProcessor.uploadAttachment(testFile);
    console.log(chalk.gray(`   First upload: ${result1.cached ? 'cached' : 'new'}`));
    
    // Second upload (should be cached)
    const result2 = await freshAttachmentProcessor.uploadAttachment(testFile);
    console.log(chalk.gray(`   Second upload: ${result2.cached ? 'cached' : 'new'}`));
    
    if (!result1.cached && result2.cached && result1.fileId === result2.fileId) {
      console.log(chalk.green('   ✅ Caching mechanism test passed'));
      testsPassed++;
    } else {
      console.log(chalk.red('   ❌ Caching mechanism test failed'));
    }
  } catch (error) {
    console.log(chalk.red('   ❌ Caching mechanism test error:', error.message));
  }

  // Test 5: Test link detection
  totalTests++;
  try {
    console.log(chalk.blue('\n5. Testing link detection...'));
    
    const testMarkdown = `
# Test Document

Visit our [GitHub](https://github.com/company/repo) repository.
Download the [Manual](./test-document.pdf) for details.
See also [API Docs](https://api.example.com/docs).
Local image: [Screenshot](./test-image.jpg)
    `;

    const testFile = path.join(testFilesDir, 'test.md');
    const links = linkProcessor.extractLinks(testMarkdown, testFile);
    console.log(chalk.gray(`   Total links found: ${links.length}`));
    
    // Debug: print all links
    for (const link of links) {
      console.log(chalk.gray(`   - ${link.type}: [${link.text}](${link.url}) -> ${link.absolutePath || 'N/A'}`));
    }
    
    const externalLinks = links.filter(link => link.type === 'external');
    const localFiles = links.filter(link => link.type === 'local_attachment');
    
    console.log(chalk.gray(`   External links: ${externalLinks.length}`));
    console.log(chalk.gray(`   Local files: ${localFiles.length}`));
    
    if (externalLinks.length === 2 && localFiles.length === 2) {
      console.log(chalk.green('   ✅ Link detection test passed'));
      testsPassed++;
    } else {
      console.log(chalk.red('   ❌ Link detection test failed'));
    }
  } catch (error) {
    console.log(chalk.red('   ❌ Link detection test error:', error.message));
  }

  // Test 6: Test link processing
  totalTests++;
  try {
    console.log(chalk.blue('\n6. Testing link processing...'));
    
    const testMarkdown = `
# Test Document

Download the [Test PDF](./test-document.pdf) file.
Visit [GitHub](https://github.com) for more info.
    `;

    const testFile = path.join(testFilesDir, 'test.md');
    const result = await linkProcessor.processLinks(testMarkdown, testFile);
    
    console.log(chalk.gray(`   Processed markdown length: ${result.processedMarkdown.length}`));
    console.log(chalk.gray(`   Link requests: ${result.linkRequests.length}`));
    
    const hasPlaceholders = result.processedMarkdown.includes('LINKREF_PLACEHOLDER');
    const hasLinkRequests = result.linkRequests.length > 0;
    
    if (hasPlaceholders && hasLinkRequests) {
      console.log(chalk.green('   ✅ Link processing test passed'));
      testsPassed++;
    } else {
      console.log(chalk.red('   ❌ Link processing test failed'));
    }
  } catch (error) {
    console.log(chalk.red('   ❌ Link processing test error:', error.message));
  }

  // Test 7: Test error handling
  totalTests++;
  try {
    console.log(chalk.blue('\n7. Testing error handling...'));
    
    const testMarkdown = `
# Test Document

Download the [Missing File](./non-existent-file.pdf) file.
Visit [GitHub](https://github.com) for more info.
    `;

    const testFile = path.join(testFilesDir, 'test.md');
    const result = await linkProcessor.processLinks(testMarkdown, testFile);
    
    console.log(chalk.gray(`   Processed despite missing file: ${result.processedMarkdown.length > 0}`));
    console.log(chalk.gray(`   Has external links: ${result.linkRequests.length > 0}`));
    
    // Should still process external links even if local file is missing
    const hasGitHubLink = result.linkRequests.some(req => req.url.includes('github.com'));
    
    if (hasGitHubLink && result.processedMarkdown.length > 0) {
      console.log(chalk.green('   ✅ Error handling test passed'));
      testsPassed++;
    } else {
      console.log(chalk.red('   ❌ Error handling test failed'));
    }
  } catch (error) {
    console.log(chalk.red('   ❌ Error handling test error:', error.message));
  }

  // Test 8: Test statistics
  totalTests++;
  try {
    console.log(chalk.blue('\n8. Testing statistics...'));
    
    const stats = attachmentProcessor.getStatistics();
    
    console.log(chalk.gray(`   Files uploaded: ${stats.uploaded}`));
    console.log(chalk.gray(`   Files cached: ${stats.cached}`));
    console.log(chalk.gray(`   Errors: ${stats.errors}`));
    
    if (typeof stats.uploaded === 'number' && typeof stats.cached === 'number') {
      console.log(chalk.green('   ✅ Statistics test passed'));
      testsPassed++;
    } else {
      console.log(chalk.red('   ❌ Statistics test failed'));
    }
  } catch (error) {
    console.log(chalk.red('   ❌ Statistics test error:', error.message));
  }

  // Test 9: Test file hash generation
  totalTests++;
  try {
    console.log(chalk.blue('\n9. Testing file hash generation...'));
    
    const testFile = path.join(testFilesDir, 'test-document.pdf');
    const hash1 = attachmentProcessor.generateFileHash(testFile);
    const hash2 = attachmentProcessor.generateFileHash(testFile);
    
    console.log(chalk.gray(`   Hash 1: ${hash1.substring(0, 16)}...`));
    console.log(chalk.gray(`   Hash 2: ${hash2.substring(0, 16)}...`));
    console.log(chalk.gray(`   Hashes match: ${hash1 === hash2}`));
    
    if (hash1 === hash2 && hash1.length === 64) {
      console.log(chalk.green('   ✅ File hash generation test passed'));
      testsPassed++;
    } else {
      console.log(chalk.red('   ❌ File hash generation test failed'));
    }
  } catch (error) {
    console.log(chalk.red('   ❌ File hash generation test error:', error.message));
  }

  // Test 10: Test integration
  totalTests++;
  try {
    console.log(chalk.blue('\n10. Testing full integration...'));
    
    const testMarkdown = `
# Integration Test

This document contains:
- External link: [GitHub](https://github.com/company/repo)
- Local attachment: [PDF File](./test-document.pdf)
- Another external link: [Google](https://google.com)
- Image file: [Screenshot](./test-image.jpg)

All links should be processed correctly.
    `;

    const testFile = path.join(testFilesDir, 'integration-test.md');
    await fs.writeFile(testFile, testMarkdown);
    
    const result = await linkProcessor.processLinks(testMarkdown, testFile);
    
    console.log(chalk.gray(`   Original length: ${testMarkdown.length}`));
    console.log(chalk.gray(`   Processed length: ${result.processedMarkdown.length}`));
    console.log(chalk.gray(`   Link requests: ${result.linkRequests.length}`));
    
    const hasPlaceholders = result.processedMarkdown.includes('LINKREF_PLACEHOLDER');
    const hasExternalLinks = result.linkRequests.some(req => req.url.includes('github.com'));
    const hasUploadedFiles = result.linkRequests.some(req => req.url.includes('drive.google.com'));
    
    if (hasPlaceholders && hasExternalLinks && hasUploadedFiles) {
      console.log(chalk.green('   ✅ Full integration test passed'));
      testsPassed++;
    } else {
      console.log(chalk.red('   ❌ Full integration test failed'));
    }
  } catch (error) {
    console.log(chalk.red('   ❌ Full integration test error:', error.message));
  }

  // Cleanup
  await cleanupTestFiles();

  // Summary
  console.log(chalk.blue('\n📊 Test Summary'));
  console.log(chalk.gray('================'));
  console.log(chalk.green(`✅ Tests passed: ${testsPassed}`));
  console.log(chalk.red(`❌ Tests failed: ${totalTests - testsPassed}`));
  console.log(chalk.blue(`📈 Success rate: ${Math.round((testsPassed / totalTests) * 100)}%`));

  if (testsPassed === totalTests) {
    console.log(chalk.green('\n🎉 All tests passed! Link & Attachment Processor is working correctly.'));
    return true;
  } else {
    console.log(chalk.red('\n💥 Some tests failed. Please check the implementation.'));
    return false;
  }
}

// Run tests if called directly
if (require.main === module) {
  testLinkProcessor()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red('Test execution failed:', error));
      process.exit(1);
    });
}

module.exports = testLinkProcessor; 