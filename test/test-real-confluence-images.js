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
          download: '/download/attachments/123/sample-image.png'
        },
        metadata: {
          mediaType: 'image/png'
        }
      },
      {
        id: 'att124',
        title: 'icon.png',
        _links: {
          download: '/download/attachments/123/icon.png'
        },
        metadata: {
          mediaType: 'image/png'
        }
      }
    ];
  }

  async getPageAttachments(pageId) {
    return this.attachments;
  }

  async downloadAttachmentById(attachment) {
    const fakeData = Buffer.from(`Mock content for ${attachment.title}`);
    return {
      data: fakeData,
      filename: attachment.title,
      mediaType: attachment.metadata?.mediaType || 'application/octet-stream'
    };
  }
}

async function testRealConfluenceImageFormats() {
  console.log('🧪 Testing real Confluence image formats...');
  
  const mockClient = new MockConfluenceClient();
  const projectRoot = path.join(__dirname, 'temp-test-real');
  const converter = new ConfluenceToMarkdown(mockClient, projectRoot);
  
  // Real Confluence Storage Format HTML with various image scenarios
  const realConfluenceHtml = `
    <h1>Test Page with Real Confluence Images</h1>
    
    <h2>Block Image in Paragraph</h2>
    <p>Before image paragraph.</p>
    <p>
      <ac:image ac:height="250">
        <ri:attachment ri:filename="sample-image.png" ri:version-at-save="1" />
      </ac:image>
    </p>
    <p>After image paragraph.</p>
    
    <h2>Inline Image</h2>
    <p>Text with inline image: 
      <ac:image ac:width="100">
        <ri:attachment ri:filename="icon.png" />
      </ac:image> in the middle of text.
    </p>
    
    <h2>Standalone Image</h2>
    <p>Before standalone image:</p>
    <ac:image>
      <ri:attachment ri:filename="sample-image.png" />
    </ac:image>
    <p>After standalone image.</p>
  `;
  
  try {
    // Clean up any existing test files
    await fs.remove(projectRoot);
    
    // Convert to markdown
    const result = await converter.convertToMarkdown(
      realConfluenceHtml,
      '123',
      'docs/real-confluence-test.md',
      {}
    );
    
    // Verify all image types are converted correctly
    const markdown = result.markdown;
    
    // Check block image
    assert(markdown.includes('![sample-image.png](./img/sample-image.png)'), 
           'Block image not converted correctly');
    
    // Check inline image
    assert(markdown.includes('![icon.png](./img/icon.png) in the middle of text'), 
           'Inline image not converted correctly');
    
    // Check standalone image positioning
    const lines = markdown.split('\n');
    
    // Find the "Before standalone image:" line
    const beforeLineIndex = lines.findIndex(line => line.includes('Before standalone image'));
    const afterLineIndex = lines.findIndex(line => line.includes('After standalone image'));
    
    // Find the standalone image that's between these lines
    let standaloneImageLineIndex = -1;
    for (let i = beforeLineIndex + 1; i < afterLineIndex; i++) {
      if (lines[i].trim() === '![sample-image.png](./img/sample-image.png)') {
        standaloneImageLineIndex = i;
        break;
      }
    }
    
    assert(standaloneImageLineIndex !== -1, 'Standalone image not found between before/after text');
    assert(standaloneImageLineIndex > beforeLineIndex && standaloneImageLineIndex < afterLineIndex, 
           'Standalone image not positioned correctly');
    
    // Verify attachments were processed
    assert(result.attachments.length >= 2, 'Not all attachments were processed');
    
    // Verify img directory was created
    const imgDir = path.join(projectRoot, 'docs', 'img');
    assert(await fs.pathExists(imgDir), 'img directory was not created');
    
    console.log('✅ Real Confluence image formats test passed');
    console.log(`📎 Processed ${result.attachments.length} attachments`);
    
    // Clean up
    await fs.remove(projectRoot);
    
  } catch (error) {
    console.error('❌ Real Confluence image formats test failed:', error.message);
    // Clean up on error
    await fs.remove(projectRoot);
    throw error;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testRealConfluenceImageFormats()
    .then(() => {
      console.log('\n🎉 Real Confluence image format test completed successfully!');
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  testRealConfluenceImageFormats
}; 