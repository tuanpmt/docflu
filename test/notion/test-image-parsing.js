const NotionImageProcessor = require('../../lib/core/notion/image-processor');
const chalk = require('chalk');

// Mock Notion client
class MockNotionClient {
  constructor() {}
}

// Mock state
class MockState {
  getUploadedFileUrl() { return null; }
  setUploadedFileUrl() {}
}

// Mock config
const mockConfig = {
  projectRoot: '/test',
  notionApiToken: 'test-token'
};

async function testImageParsing() {
  console.log(chalk.blue('🧪 Testing Markdown Image Parsing'));
  console.log(chalk.gray('====================================='));

  const imageProcessor = new NotionImageProcessor(
    new MockNotionClient(),
    new MockState(),
    mockConfig
  );

  // Test cases
  const testCases = [
    {
      name: 'Image with title',
      markdown: '![Docusaurus Social Card](/img/docusaurus-social-card.jpg "Docusaurus Social Media Card")',
      expectedAlt: 'Docusaurus Social Card',
      expectedUrl: '/img/docusaurus-social-card.jpg',
      expectedTitle: 'Docusaurus Social Media Card'
    },
    {
      name: 'Image without title',
      markdown: '![GitHub Logo](https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png)',
      expectedAlt: 'GitHub Logo',
      expectedUrl: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
      expectedTitle: undefined
    },
    {
      name: 'Image with empty alt text',
      markdown: '![](/img/test.png "Test Image")',
      expectedAlt: '',
      expectedUrl: '/img/test.png',
      expectedTitle: 'Test Image'
    },
    {
      name: 'Image with spaces in URL',
      markdown: '![Test](https://example.com/image%20with%20spaces.png "Spaced Image")',
      expectedAlt: 'Test',
      expectedUrl: 'https://example.com/image%20with%20spaces.png',
      expectedTitle: 'Spaced Image'
    }
  ];

  let testsPassed = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(chalk.blue(`\n📝 Testing: ${testCase.name}`));
    console.log(chalk.gray(`   Input: ${testCase.markdown}`));

    try {
      // Test regex pattern
      const pattern = imageProcessor.patterns.markdown;
      pattern.lastIndex = 0; // Reset regex
      const match = pattern.exec(testCase.markdown);

      if (match) {
        const [fullMatch, altText, imagePath, title] = match;
        
        console.log(chalk.cyan(`   Alt Text: "${altText}"`));
        console.log(chalk.cyan(`   Image URL: "${imagePath}"`));
        console.log(chalk.cyan(`   Title: "${title || 'undefined'}"`));

        // Validate results
        const altCorrect = altText === testCase.expectedAlt;
        const urlCorrect = imagePath === testCase.expectedUrl;
        const titleCorrect = title === testCase.expectedTitle;

        if (altCorrect && urlCorrect && titleCorrect) {
          console.log(chalk.green(`   ✅ PASS: All components parsed correctly`));
          testsPassed++;
        } else {
          console.log(chalk.red(`   ❌ FAIL: Parsing mismatch`));
          if (!altCorrect) console.log(chalk.red(`      Expected alt: "${testCase.expectedAlt}", got: "${altText}"`));
          if (!urlCorrect) console.log(chalk.red(`      Expected URL: "${testCase.expectedUrl}", got: "${imagePath}"`));
          if (!titleCorrect) console.log(chalk.red(`      Expected title: "${testCase.expectedTitle}", got: "${title}"`));
        }
      } else {
        console.log(chalk.red(`   ❌ FAIL: No regex match found`));
      }

    } catch (error) {
      console.log(chalk.red(`   ❌ ERROR: ${error.message}`));
    }
  }

  // Summary
  console.log(chalk.blue('\n📊 Test Summary'));
  console.log(chalk.gray('==============='));
  console.log(chalk.green(`✅ Passed: ${testsPassed}/${totalTests}`));
  console.log(chalk.red(`❌ Failed: ${totalTests - testsPassed}/${totalTests}`));
  
  if (testsPassed === totalTests) {
    console.log(chalk.green('🎉 All tests passed!'));
  } else {
    console.log(chalk.yellow('⚠️ Some tests failed. Please check the regex pattern.'));
  }
}

// Run tests
if (require.main === module) {
  testImageParsing().catch(console.error);
}

module.exports = { testImageParsing }; 