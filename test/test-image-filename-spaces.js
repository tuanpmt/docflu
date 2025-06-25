const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const ConfluenceToMarkdown = require('../lib/core/confluence-to-markdown');

// Mock Confluence client for testing
class MockConfluenceClient {
  async getPageAttachments(pageId) {
    return [
      {
        id: 'att1',
        title: 'my image.png',
        mediaType: 'image/png',
        _links: { download: '/download/attachments/123/my%20image.png' }
      },
      {
        id: 'att2', 
        title: 'normal-image.jpg',
        mediaType: 'image/jpeg',
        _links: { download: '/download/attachments/123/normal-image.jpg' }
      },
      {
        id: 'att3',
        title: 'file with many spaces.gif',
        mediaType: 'image/gif',
        _links: { download: '/download/attachments/123/file%20with%20many%20spaces.gif' }
      }
    ];
  }

  async downloadAttachmentById(attachment) {
    // Simulate downloading attachment
    return {
      filename: attachment.title,
      data: Buffer.from('fake image data'),
      mediaType: attachment.mediaType
    };
  }
}

async function testImageFilenameSpaces() {
  console.log('🧪 Testing Image Filename Spaces Handling...\n');
  
  // Create temporary directory for testing
  const tempDir = path.join(__dirname, 'temp-image-spaces-test');
  await fs.ensureDir(tempDir);
  
  try {
    const mockClient = new MockConfluenceClient();
    const converter = new ConfluenceToMarkdown(mockClient, tempDir);

    // Test 1: URL encoding spaces
    console.log('Test 1: URL encode image filenames with spaces');
    
    const confluenceHtml = `
      <p>Here is an image with spaces:</p>
      <p><ac:image><ri:attachment ri:filename="my image.png" /></ac:image></p>
      <p>And a normal image:</p>
      <p><ac:image><ri:attachment ri:filename="normal-image.jpg" /></ac:image></p>
      <p>And another with many spaces:</p>
      <p><ac:image><ri:attachment ri:filename="file with many spaces.gif" /></ac:image></p>
    `;

    const result = await converter.convertToMarkdown(
      confluenceHtml,
      '123',
      'docs/test-page.md'
    );

    console.log('Generated markdown:');
    console.log(result.markdown);
    console.log('\nAttachments:');
    console.log(result.attachments.map(att => ({ filename: att.filename, relativePath: att.relativePath })));

    // Check that spaces are URL encoded in markdown links
    assert(result.markdown.includes('![my image.png](./img/my%20image.png)'), 
           'Should URL encode spaces in image filename');
    assert(result.markdown.includes('![normal-image.jpg](./img/normal-image.jpg)'), 
           'Should keep normal filenames unchanged');
    assert(result.markdown.includes('![file with many spaces.gif](./img/file%20with%20many%20spaces.gif)'), 
           'Should URL encode multiple spaces in filename');

    // Verify attachments were processed correctly
    assert.equal(result.attachments.length, 3, 'Should process all 3 attachments');
    
    // Check that relativePath in attachments has URL encoded filenames
    const spaceImageAttachment = result.attachments.find(att => att.filename === 'my image.png');
    assert(spaceImageAttachment, 'Should find attachment with spaces');
    assert.equal(spaceImageAttachment.relativePath, './img/my%20image.png', 
                'Attachment relativePath should be URL encoded');

    const manySpacesAttachment = result.attachments.find(att => att.filename === 'file with many spaces.gif');
    assert(manySpacesAttachment, 'Should find attachment with many spaces');
    assert.equal(manySpacesAttachment.relativePath, './img/file%20with%20many%20spaces.gif',
                'Attachment with many spaces should be URL encoded');

    // Verify files were actually saved with original filenames (not encoded)
    const imgDir = path.join(tempDir, 'docs', 'img');
    const savedFiles = await fs.readdir(imgDir);
    assert(savedFiles.includes('my image.png'), 'File should be saved with original filename');
    assert(savedFiles.includes('normal-image.jpg'), 'Normal file should be saved normally');
    assert(savedFiles.includes('file with many spaces.gif'), 'File with many spaces should be saved with original filename');
    
    console.log('✅ Test 1 Passed\n');

    // Test 2: Special characters
    console.log('Test 2: Handle special characters in filenames');
    
    // Override mock for special characters test
    converter.confluenceClient.getPageAttachments = async () => [
      {
        id: 'att1',
        title: 'image (copy).png',
        mediaType: 'image/png'
      }
    ];

    const specialCharHtml = `
      <p><ac:image><ri:attachment ri:filename="image (copy).png" /></ac:image></p>
    `;

    const specialResult = await converter.convertToMarkdown(
      specialCharHtml,
      '123',
      'docs/test-special.md'
    );

    console.log('Generated markdown for special chars:');
    console.log(specialResult.markdown);

    // Should URL encode parentheses and spaces
    assert(specialResult.markdown.includes('![image (copy).png](./img/image%20(copy).png)'), 
           'Should URL encode special characters in filename');
    
    console.log('✅ Test 2 Passed\n');
    
    console.log('🎉 All image filename spaces tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    // Clean up temp directory
    await fs.remove(tempDir);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testImageFilenameSpaces().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = testImageFilenameSpaces; 