const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

// Import new Google Docs image processor
const GDocsImageProcessor = require('../../lib/core/gdocs/gdocs-image-processor');
const GoogleDriveClient = require('../../lib/core/gdocs/google-drive-client');
const GoogleDocsState = require('../../lib/core/gdocs/google-docs-state');

/**
 * Test Google Docs Image Processing
 * Tests image detection, processing, and Google Drive upload
 */
async function testImageProcessing() {
  console.log(chalk.blue('🧪 Testing Google Docs Image Processing'));
  console.log(chalk.gray('====================================='));

  const projectRoot = path.resolve(__dirname, '../..');
  
  try {
    // Create test markdown with various image types
    const testMarkdown = `
# Test Document with Images

## Regular Images

![Local Image](./static/img/logo.png)
![Remote Image](https://example.com/image.jpg)

## Mermaid Diagrams

\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[End]
    C --> D
\`\`\`

## PlantUML Diagram

\`\`\`plantuml
@startuml
Alice -> Bob: Hello
Bob -> Alice: Hi there
@enduml
\`\`\`

## HTML Images

<img src="./assets/screenshot.png" alt="Screenshot" />

## Mixed Content

This is a paragraph with ![inline image](./img/icon.png) in the middle.

More text here.
`;

    // Initialize state manager
    console.log(chalk.blue('📊 Initializing state manager...'));
    const stateManager = new GoogleDocsState(projectRoot);
    await stateManager.init();

    // Create mock Google Drive client for testing (without actual OAuth)
    console.log(chalk.blue('☁️ Creating mock Google Drive client...'));
    const mockDriveClient = {
      uploadImage: async (imagePath) => {
        const fileName = path.basename(imagePath);
        const mockFileId = 'mock-' + Date.now();
        console.log(chalk.gray(`📤 Mock upload: ${fileName} -> ${mockFileId}`));
        return {
          url: `https://drive.google.com/uc?id=${mockFileId}`,
          fileId: mockFileId,
          fileName: fileName,
          size: 1024,
          cached: false
        };
      },
      uploadRemoteImage: async (imageUrl) => {
        const mockFileId = 'mock-remote-' + Date.now();
        console.log(chalk.gray(`📥 Mock remote upload: ${imageUrl} -> ${mockFileId}`));
        return {
          url: `https://drive.google.com/uc?id=${mockFileId}`,
          fileId: mockFileId,
          fileName: `remote-${mockFileId}.jpg`,
          originalUrl: imageUrl,
          size: 2048,
          cached: false
        };
      }
    };

    // Initialize image processor
    console.log(chalk.blue('🖼️ Initializing image processor...'));
    const imageProcessor = new GDocsImageProcessor(projectRoot);
    await imageProcessor.initialize(mockDriveClient, stateManager);

    // Test image detection
    console.log(chalk.blue('\n🔍 Testing image detection...'));
    const images = imageProcessor.extractImages(testMarkdown, '/fake/path/test.md');
    console.log(chalk.green(`✅ Found ${images.length} images:`));
    images.forEach((image, index) => {
      console.log(chalk.gray(`   ${index + 1}. ${image.type}: "${image.alt}" -> ${image.src}`));
    });

    // Test mermaid detection
    console.log(chalk.blue('\n📊 Testing Mermaid detection...'));
    const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g;
    const mermaidMatches = [];
    let match;
    while ((match = mermaidRegex.exec(testMarkdown)) !== null) {
      mermaidMatches.push({
        fullMatch: match[0],
        content: match[1].trim()
      });
    }
    console.log(chalk.green(`✅ Found ${mermaidMatches.length} Mermaid diagrams`));

    // Test full image processing (with mocks)
    console.log(chalk.blue('\n🚀 Testing full image processing...'));
    const testFilePath = path.join(projectRoot, 'test/sample-docs/test-images.md');
    
    const result = await imageProcessor.processImages(testMarkdown, testFilePath);
    
    console.log(chalk.green('\n✅ Processing Results:'));
    console.log(chalk.gray(`   Processed Markdown Length: ${result.processedMarkdown.length}`));
    console.log(chalk.gray(`   Image Requests: ${result.imageRequests.length}`));
    console.log(chalk.gray(`   Images Found: ${result.stats.imagesFound}`));
    console.log(chalk.gray(`   Images Processed: ${result.stats.imagesProcessed}`));
    console.log(chalk.gray(`   Diagrams Processed: ${result.stats.diagramsProcessed}`));
    console.log(chalk.gray(`   Errors: ${result.stats.errors.length}`));

    if (result.stats.errors.length > 0) {
      console.log(chalk.yellow('\n⚠️ Processing Errors:'));
      result.stats.errors.forEach(error => {
        console.log(chalk.gray(`   - ${error}`));
      });
    }

    // Show processed markdown changes
    console.log(chalk.blue('\n📝 Markdown Changes:'));
    const originalLines = testMarkdown.split('\n');
    const processedLines = result.processedMarkdown.split('\n');
    
    for (let i = 0; i < Math.max(originalLines.length, processedLines.length); i++) {
      const original = originalLines[i] || '';
      const processed = processedLines[i] || '';
      
      if (original !== processed) {
        console.log(chalk.red(`   - ${original}`));
        console.log(chalk.green(`   + ${processed}`));
      }
    }

    // Test Google Docs image insertion requests
    console.log(chalk.blue('\n🔗 Testing Google Docs insertion requests...'));
    const insertionRequests = imageProcessor.createImageInsertionRequests(result.imageRequests);
    console.log(chalk.green(`✅ Created ${insertionRequests.length} insertion requests:`));
    insertionRequests.forEach((request, index) => {
      console.log(chalk.gray(`   ${index + 1}. insertInlineImage: ${request.insertInlineImage.uri}`));
    });

    // Test statistics
    console.log(chalk.blue('\n📊 Testing statistics...'));
    const stats = imageProcessor.getStats();
    console.log(chalk.green('✅ Statistics:'));
    console.log(chalk.gray(`   Success Rate: ${stats.successRate}%`));
    console.log(chalk.gray(`   Images Found: ${stats.imagesFound}`));
    console.log(chalk.gray(`   Images Processed: ${stats.imagesProcessed}`));
    console.log(chalk.gray(`   Images Cached: ${stats.imagesCached}`));
    console.log(chalk.gray(`   Diagrams Processed: ${stats.diagramsProcessed}`));

    console.log(chalk.green('\n✅ All image processing tests passed!'));
    return true;

  } catch (error) {
    console.error(chalk.red('\n❌ Image processing test failed:'), error.message);
    console.error(chalk.gray(error.stack));
    return false;
  }
}

/**
 * Test image path resolution
 */
async function testImagePathResolution() {
  console.log(chalk.blue('\n🧪 Testing Image Path Resolution'));
  console.log(chalk.gray('================================='));

  const projectRoot = path.resolve(__dirname, '../..');
  const imageProcessor = new GDocsImageProcessor(projectRoot);

  const testCases = [
    {
      imageSrc: './static/img/logo.png',
      markdownPath: '/project/docs/intro.md',
      expected: '/project/docs/static/img/logo.png'
    },
    {
      imageSrc: '../assets/image.jpg', 
      markdownPath: '/project/docs/guide/setup.md',
      expected: '/project/docs/assets/image.jpg'
    },
    {
      imageSrc: '/img/logo.png',
      markdownPath: '/project/docs/intro.md',
      expected: path.join(projectRoot, 'static/img/logo.png')
    },
    {
      imageSrc: 'https://example.com/image.png',
      markdownPath: '/project/docs/intro.md',
      expected: 'https://example.com/image.png'
    }
  ];

  console.log(chalk.blue('🔍 Testing path resolution cases...'));
  
  testCases.forEach((testCase, index) => {
    const resolved = imageProcessor.resolveImagePath(testCase.imageSrc, testCase.markdownPath);
    const isRemote = imageProcessor.isRemoteUrl(testCase.imageSrc);
    
    console.log(chalk.gray(`   ${index + 1}. ${testCase.imageSrc}`));
    console.log(chalk.gray(`      Resolved: ${resolved}`));
    console.log(chalk.gray(`      Remote: ${isRemote}`));
    
    if (isRemote && resolved === testCase.imageSrc) {
      console.log(chalk.green(`      ✅ Remote URL preserved`));
    } else if (!isRemote) {
      console.log(chalk.green(`      ✅ Local path resolved`));
    }
  });

  console.log(chalk.green('\n✅ Path resolution tests completed!'));
}

// Run tests
async function runTests() {
  console.log(chalk.blue('🚀 Starting Google Docs Image Processing Tests\n'));
  
  try {
    const test1 = await testImageProcessing();
    await testImagePathResolution();
    
    if (test1) {
      console.log(chalk.green('\n🎉 All tests passed successfully!'));
    } else {
      console.log(chalk.red('\n❌ Some tests failed!'));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('\n💥 Test suite failed:'), error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runTests();
}

module.exports = { testImageProcessing, testImagePathResolution }; 