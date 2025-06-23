const Config = require('../lib/core/config');
const ConfluenceClient = require('../lib/core/confluence-client');
const chalk = require('chalk');

async function testHierarchy() {
  console.log(chalk.blue('🧪 Testing Confluence Hierarchy Structure'));
  
  try {
    // Load config
    const config = new Config();
    const confluenceConfig = await config.loadConfig();
    
    // Create client
    const client = new ConfluenceClient(confluenceConfig);
    
    // Test connection
    console.log(chalk.yellow('📡 Testing connection...'));
    const connected = await client.testConnection();
    if (!connected) {
      throw new Error('Could not connect to Confluence');
    }
    
    // Test hierarchy structure
    await testPageHierarchy(client);
    
    console.log(chalk.green('\n✅ Hierarchy test completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Hierarchy test failed:'), error.message);
    process.exit(1);
  }
}

async function testPageHierarchy(client) {
  console.log(chalk.yellow('\n📋 Checking page hierarchy...'));
  
  // Expected structure:
  // Root
  // ├── Tutorial Intro (root level)
  // ├── Tutorial Basics (parent)
  // │   ├── Create a Page
  // │   ├── Create a Document  
  // │   ├── Create a Blog Post
  // │   ├── Deploy your site
  // │   └── Congratulations!
  // └── Tutorial Extras (parent)
  //     ├── Manage Docs Versions
  //     └── Translate your site
  
  const expectedStructure = [
    { title: 'Tutorial Intro', parent: null, level: 0 },
    { title: 'Tutorial Basics', parent: null, level: 0 },
    { title: 'Tutorial Extras', parent: null, level: 0 },
    { title: 'Create a Page', parent: 'Tutorial Basics', level: 1 },
    { title: 'Create a Document', parent: 'Tutorial Basics', level: 1 },
    { title: 'Create a Blog Post', parent: 'Tutorial Basics', level: 1 },
    { title: 'Deploy your site', parent: 'Tutorial Basics', level: 1 },
    { title: 'Congratulations!', parent: 'Tutorial Basics', level: 1 },
    { title: 'Manage Docs Versions', parent: 'Tutorial Extras', level: 1 },
    { title: 'Translate your site', parent: 'Tutorial Extras', level: 1 }
  ];
  
  const pageMap = new Map();
  
  // Find all pages
  for (const expected of expectedStructure) {
    const page = await client.findPageByTitle(expected.title);
    
    if (!page) {
      console.error(chalk.red(`❌ Page not found: ${expected.title}`));
      continue;
    }
    
    pageMap.set(expected.title, page);
    console.log(chalk.green(`✓ Found: ${expected.title} (ID: ${page.id})`));
  }
  
  // Check parent-child relationships
  console.log(chalk.yellow('\n🔗 Checking parent-child relationships...'));
  
  for (const expected of expectedStructure) {
    if (expected.parent) {
      const childPage = pageMap.get(expected.title);
      const parentPage = pageMap.get(expected.parent);
      
      if (!childPage || !parentPage) {
        console.error(chalk.red(`❌ Missing page for relationship: ${expected.title} -> ${expected.parent}`));
        continue;
      }
      
      // Get children of parent page
      const children = await client.getPageChildren(parentPage.id);
      const isChild = children.some(child => child.id === childPage.id);
      
      if (isChild) {
        console.log(chalk.green(`✓ ${expected.title} is child of ${expected.parent}`));
      } else {
        console.error(chalk.red(`❌ ${expected.title} is NOT child of ${expected.parent}`));
      }
    }
  }
  
  // Show hierarchy tree
  console.log(chalk.cyan('\n🌳 Hierarchy Tree:'));
  await showHierarchyTree(client, pageMap);
}

async function showHierarchyTree(client, pageMap) {
  const rootPages = ['Tutorial Intro', 'Tutorial Basics', 'Tutorial Extras'];
  
  for (const rootTitle of rootPages) {
    const rootPage = pageMap.get(rootTitle);
    if (!rootPage) continue;
    
    console.log(chalk.white(`📁 ${rootTitle} (${rootPage.id})`));
    
    // Get children
    const children = await client.getPageChildren(rootPage.id);
    
    for (const [index, child] of children.entries()) {
      const isLast = index === children.length - 1;
      const prefix = isLast ? '└── ' : '├── ';
      console.log(chalk.gray(`   ${prefix}📄 ${child.title} (${child.id})`));
    }
    
    if (children.length === 0 && rootTitle !== 'Tutorial Intro') {
      console.log(chalk.gray('   └── (no children)'));
    }
    
    console.log('');
  }
}

// Run test
testHierarchy(); 