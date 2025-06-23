const path = require('path');
const MarkdownParser = require('../lib/core/markdown-parser');

async function testBasic() {
  console.log('🧪 Testing markdown parser...');
  
  try {
    const parser = new MarkdownParser();
    const testFile = path.join(__dirname, '..', 'docusaurus-example', 'docs', 'intro.md');
    
    console.log('📄 Parsing file:', testFile);
    
    const result = await parser.parseFile(testFile);
    
    console.log('✅ Parse successful!');
    console.log('📋 Title:', result.title);
    console.log('📝 Content length:', result.content.length);
    console.log('📊 Frontmatter:', JSON.stringify(result.frontmatter, null, 2));
    
    // Show first 200 chars of content
    console.log('📖 Content preview:');
    console.log(result.content.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testBasic(); 