const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

// Import test utilities
const { createTestConfig, createMockNotionClient } = require('./test-utils');

// Import the classes we're testing
const NotionImageProcessor = require('../../lib/core/notion/image-processor');
const NotionState = require('../../lib/core/notion/notion-state');

/**
 * Test Image Processing with NotionImageProcessor
 */
async function testImageProcessing() {
  console.log(chalk.blue('\n🧪 Testing Notion Image Processing\n'));
  
  try {
    // Setup test environment
    const config = createTestConfig();
    const mockClient = createMockNotionClient();
    const projectRoot = process.cwd();
    const state = new NotionState(projectRoot, config);
    
    // Initialize image processor
    const imageProcessor = new NotionImageProcessor(mockClient, state, {
      ...config,
      projectRoot
    });
    
    console.log(chalk.cyan('📋 Test Configuration:'));
    console.log(`  Project Root: ${projectRoot}`);
    console.log(`  Static Directory: ${path.join(projectRoot, 'static')}`);
    console.log('');
    
    // Test cases
    const testCases = [
      {
        name: 'External HTTPS Image',
        imageUrl: 'https://via.placeholder.com/300x200.png',
        altText: 'Placeholder Image',
        expected: 'external'
      },
      {
        name: 'Local Static Image (Docusaurus style)',
        imageUrl: '/img/docusaurus.png',
        altText: 'Docusaurus Logo',
        expected: 'file_upload'
      },
      {
        name: 'Local SVG Image',
        imageUrl: '/img/undraw_docusaurus_mountain.svg',
        altText: 'Docusaurus Mountain',
        expected: 'file_upload'
      },
      {
        name: 'Non-existent Local Image',
        imageUrl: '/img/nonexistent.png',
        altText: 'Missing Image',
        expected: 'fallback'
      },
      {
        name: 'Invalid Image Path',
        imageUrl: 'invalid-path.jpg',
        altText: 'Invalid Image',
        expected: 'fallback'
      }
    ];
    
    let successCount = 0;
    let totalTests = testCases.length;
    
    // Run tests
    for (const testCase of testCases) {
      console.log(chalk.yellow(`🔍 Testing: ${testCase.name}`));
      console.log(`   URL: ${testCase.imageUrl}`);
      console.log(`   Alt: ${testCase.altText}`);
      
      try {
        const startTime = Date.now();
        const result = await imageProcessor.processImageMarkdown(
          testCase.imageUrl, 
          testCase.altText, 
          projectRoot
        );
        const processingTime = Date.now() - startTime;
        
        if (result) {
          console.log(chalk.green(`   ✅ Success (${processingTime}ms)`));
          console.log(`   Type: ${result.type}`);
          
          if (result.type === 'image') {
            console.log(`   Image Type: ${result.image.type}`);
            if (result.image.caption && result.image.caption.length > 0) {
              console.log(`   Caption: ${result.image.caption[0].text.content}`);
            }
          } else if (result.type === 'paragraph') {
            console.log(`   Fallback Text: ${result.paragraph.rich_text[0].text.content}`);
          }
          
          successCount++;
        } else {
          console.log(chalk.red(`   ❌ Failed: No result returned`));
        }
        
      } catch (error) {
        console.log(chalk.red(`   ❌ Failed: ${error.message}`));
      }
      
      console.log('');
    }
    
    // Test image processor statistics
    console.log(chalk.cyan('📊 Testing Image Processor Statistics:'));
    try {
      const stats = imageProcessor.getStatistics();
      console.log(`   Total Images: ${stats.total}`);
      console.log(`   Total Size: ${stats.totalSize} bytes`);
      console.log(`   Formats: ${JSON.stringify(stats.byFormat, null, 2)}`);
      
      const cacheStats = imageProcessor.getCacheStatistics();
      console.log(`   Cached Images: ${cacheStats.cachedImages}`);
      console.log(`   Cache Size: ${cacheStats.totalCacheSize} bytes`);
      
    } catch (error) {
      console.log(chalk.yellow(`   ⚠️ Statistics error: ${error.message}`));
    }
    
    // Test MIME type detection
    console.log(chalk.cyan('📋 Testing MIME Type Detection:'));
    const mimeTests = [
      { file: 'image.png', expected: 'image/png' },
      { file: 'photo.jpg', expected: 'image/jpeg' },
      { file: 'graphic.svg', expected: 'image/svg+xml' },
      { file: 'icon.gif', expected: 'image/gif' },
      { file: 'unknown.xyz', expected: 'application/octet-stream' }
    ];
    
    for (const mimeTest of mimeTests) {
      const detected = imageProcessor.getMimeType(mimeTest.file);
      const correct = detected === mimeTest.expected;
      console.log(`   ${mimeTest.file}: ${detected} ${correct ? '✅' : '❌'}`);
    }
    
    // Summary
    console.log(chalk.blue('\n📈 Image Processing Test Summary:'));
    console.log(`   Success Rate: ${successCount}/${totalTests} (${Math.round(successCount/totalTests*100)}%)`);
    console.log(`   Image Processor: ${successCount > 0 ? '✅ Working' : '❌ Failed'}`);
    console.log(`   File Upload Integration: ${successCount > 0 ? '✅ Working' : '❌ Failed'}`);
    
    // Cleanup
    await imageProcessor.cleanup();
    console.log(chalk.gray('   🧹 Cleanup completed'));
    
    return {
      success: successCount === totalTests,
      successRate: successCount / totalTests,
      totalTests,
      successCount,
      imageProcessor: successCount > 0
    };
    
  } catch (error) {
    console.error(chalk.red(`❌ Image processing test failed: ${error.message}`));
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

// Test utilities for image processor
function createTestUtils() {
  return {
    createTestConfig() {
      return {
        notionApiToken: process.env.NOTION_API_TOKEN || 'test-token',
        projectRoot: process.cwd()
      };
    },
    
    createMockNotionClient() {
      return {
        // Mock methods that image processor might use
        uploadFile: async (buffer, filename, mimeType) => {
          return {
            url: `https://notion.so/files/${filename}`,
            id: 'mock-file-id'
          };
        }
      };
    }
  };
}

// Run test if called directly
if (require.main === module) {
  testImageProcessing()
    .then(result => {
      if (result.success) {
        console.log(chalk.green('\n🎉 All image processing tests passed!'));
        process.exit(0);
      } else {
        console.log(chalk.red('\n💥 Some image processing tests failed!'));
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(chalk.red('\n💥 Test execution failed:'), error);
      process.exit(1);
    });
}

module.exports = { testImageProcessing, createTestUtils }; 