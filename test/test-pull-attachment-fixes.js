const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const ConfluenceToMarkdown = require('../lib/core/confluence-to-markdown');

// Mock Confluence client for testing
class MockConfluenceClient {
  constructor() {
    this.attachments = [
      {
        id: 'att123',
        title: 'sample-image.png',
        _links: {
          download: '/wiki/download/attachments/123/sample-image.png'
        },
        metadata: {
          mediaType: 'image/png'
        }
      },
      {
        id: 'att124', 
        title: 'document.pdf',
        _links: {
          download: '/wiki/download/attachments/123/document.pdf'
        },
        metadata: {
          mediaType: 'application/pdf'
        }
      },
      {
        id: 'att125',
        title: 'screenshot.jpg',
        _links: {
          download: '/wiki/download/attachments/123/screenshot.jpg'
        },
        metadata: {
          mediaType: 'image/jpeg'
        }
      }
    ];
  }

  async getPageAttachments(pageId) {
    return this.attachments;
  }

  async downloadAttachmentById(attachment) {
    // Mock download - return fake data
    const fakeData = Buffer.from(`Mock content for ${attachment.title}`);
    return {
      data: fakeData,
      filename: attachment.title,
      mediaType: attachment.metadata?.mediaType || 'application/octet-stream'
    };
  }
}

async function testAttachmentProcessing() {
  console.log('🧪 Testing attachment processing...');
  
  const mockClient = new MockConfluenceClient();
  const projectRoot = path.join(__dirname, 'temp-test');
  const converter = new ConfluenceToMarkdown(mockClient, projectRoot);
  
  // Test HTML with various attachment references
  const testHtml = `
    <h1>Test Page with Attachments</h1>
    <p>Here's an image:</p>
    <ac:image>
      <ri:attachment ri:filename="sample-image.png" />
    </ac:image>
    
    <p>Another image with regular img tag:</p>
    <img src="/wiki/download/attachments/123/screenshot.jpg" alt="Screenshot" />
    
    <p>Text content here.</p>
    
    <p>Link to document: <a href="/wiki/download/attachments/123/document.pdf">document.pdf</a></p>
  `;
  
  try {
    // Clean up any existing test files
    await fs.remove(projectRoot);
    
    // Convert to markdown
    const result = await converter.convertToMarkdown(
      testHtml,
      '123',
      'docs/test-page.md',
      {}
    );
    
    // Verify attachments were processed
    assert(result.attachments.length === 3, `Expected 3 attachments, got ${result.attachments.length}`);
    
    // Verify attachment paths
    const imageAttachment = result.attachments.find(att => att.filename === 'sample-image.png');
    assert(imageAttachment, 'sample-image.png attachment not found');
    assert(imageAttachment.relativePath === './img/sample-image.png', 
           `Expected './img/sample-image.png', got '${imageAttachment.relativePath}'`);
    
    // Verify img directory was created
    const imgDir = path.join(projectRoot, 'docs', 'img');
    assert(await fs.pathExists(imgDir), 'img directory was not created');
    
    // Verify files were saved
    const imagePath = path.join(imgDir, 'sample-image.png');
    assert(await fs.pathExists(imagePath), 'sample-image.png was not saved');
    
    // Verify markdown contains correct image references
    assert(result.markdown.includes('![sample-image.png](./img/sample-image.png)'), 
           'Markdown does not contain correct image reference');
    assert(result.markdown.includes('![Screenshot](./img/screenshot.jpg)'), 
           'Markdown does not contain correct screenshot reference');
    
    console.log('✅ Attachment processing test passed');
    console.log(`📎 Processed ${result.attachments.length} attachments`);
    
    // Clean up
    await fs.remove(projectRoot);
    
  } catch (error) {
    console.error('❌ Attachment processing test failed:', error.message);
    // Clean up on error
    await fs.remove(projectRoot);
    throw error;
  }
}

async function testAttachmentPositioning() {
  console.log('🧪 Testing attachment positioning in markdown...');
  
  const mockClient = new MockConfluenceClient();
  const projectRoot = path.join(__dirname, 'temp-test-positioning');
  const converter = new ConfluenceToMarkdown(mockClient, projectRoot);
  
  // Test HTML with attachments at specific positions
  const testHtml = `
    <h1>Document Title</h1>
    <p>Introduction paragraph.</p>
    
    <h2>Section 1</h2>
    <p>Before image paragraph.</p>
    <ac:image>
      <ri:attachment ri:filename="sample-image.png" />
    </ac:image>
    <p>After image paragraph.</p>
    
    <h2>Section 2</h2>
    <p>Some text with inline reference to <img src="/wiki/download/attachments/123/screenshot.jpg" alt="inline screenshot" /> in the middle.</p>
    
    <h2>Section 3</h2>
    <p>Final paragraph.</p>
  `;
  
  try {
    // Clean up any existing test files
    await fs.remove(projectRoot);
    
    // Convert to markdown
    const result = await converter.convertToMarkdown(
      testHtml,
      '123',
      'docs/positioning-test.md',
      {}
    );
    
    console.log('Generated markdown:');
    console.log('---');
    console.log(result.markdown);
    console.log('---');
    
    // Verify positioning is maintained
    const lines = result.markdown.split('\n');
    
    // Find the image line
    const imageLineIndex = lines.findIndex(line => line.includes('![sample-image.png](./img/sample-image.png)'));
    assert(imageLineIndex !== -1, 'Image reference not found in markdown');
    
    // Verify image is positioned correctly (after "Before image paragraph" and before "After image paragraph")
    const beforeImageIndex = lines.findIndex(line => line.includes('Before image paragraph'));
    const afterImageIndex = lines.findIndex(line => line.includes('After image paragraph'));
    
    assert(beforeImageIndex < imageLineIndex, 'Image is not positioned after "Before image paragraph"');
    assert(imageLineIndex < afterImageIndex, 'Image is not positioned before "After image paragraph"');
    
    // Verify inline image
    const inlineImageLine = lines.find(line => line.includes('inline reference') && line.includes('![inline screenshot](./img/screenshot.jpg)'));
    assert(inlineImageLine, 'Inline image not found or not positioned correctly');
    
    console.log('✅ Attachment positioning test passed');
    
    // Clean up
    await fs.remove(projectRoot);
    
  } catch (error) {
    console.error('❌ Attachment positioning test failed:', error.message);
    // Clean up on error
    await fs.remove(projectRoot);
    throw error;
  }
}

async function testUnreferencedAttachments() {
  console.log('🧪 Testing unreferenced attachments download...');
  
  const mockClient = new MockConfluenceClient();
  const projectRoot = path.join(__dirname, 'temp-test-unreferenced');
  const converter = new ConfluenceToMarkdown(mockClient, projectRoot);
  
  // Test HTML that doesn't reference all attachments
  const testHtml = `
    <h1>Test Page</h1>
    <p>This page only references one attachment:</p>
    <ac:image>
      <ri:attachment ri:filename="sample-image.png" />
    </ac:image>
    <p>But the page has other attachments not referenced in content.</p>
  `;
  
  try {
    // Clean up any existing test files
    await fs.remove(projectRoot);
    
    // Convert to markdown
    const result = await converter.convertToMarkdown(
      testHtml,
      '123',
      'docs/unreferenced-test.md',
      {}
    );
    
    // Verify all attachments were downloaded (referenced and unreferenced)
    assert(result.attachments.length === 3, `Expected 3 attachments, got ${result.attachments.length}`);
    
    // Verify unreferenced files exist
    const imgDir = path.join(projectRoot, 'docs', 'img');
    assert(await fs.pathExists(path.join(imgDir, 'document.pdf')), 'Unreferenced document.pdf was not downloaded');
    assert(await fs.pathExists(path.join(imgDir, 'screenshot.jpg')), 'Unreferenced screenshot.jpg was not downloaded');
    
    console.log('✅ Unreferenced attachments test passed');
    console.log(`📎 Downloaded ${result.attachments.length} attachments (including unreferenced ones)`);
    
    // Clean up
    await fs.remove(projectRoot);
    
  } catch (error) {
    console.error('❌ Unreferenced attachments test failed:', error.message);
    // Clean up on error
    await fs.remove(projectRoot);
    throw error;
  }
}

// Run all tests
async function runAllTests() {
  try {
    await testAttachmentProcessing();
    await testAttachmentPositioning();
    await testUnreferencedAttachments();
    
    console.log('\n🎉 All attachment tests passed!');
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testAttachmentProcessing,
  testAttachmentPositioning,
  testUnreferencedAttachments,
  runAllTests
}; 