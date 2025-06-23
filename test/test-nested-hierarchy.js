const Config = require('../lib/core/config');
const ConfluenceClient = require('../lib/core/confluence-client');
const chalk = require('chalk');

async function testNestedHierarchy() {
  console.log(chalk.blue('🧪 Testing Nested Confluence Hierarchy Structure'));
  
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
    
    // Test nested hierarchy
    await testNestedStructure(client);
    
    console.log(chalk.green('\n✅ Nested hierarchy test completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Nested hierarchy test failed:'), error.message);
    process.exit(1);
  }
}

async function testNestedStructure(client) {
  console.log(chalk.yellow('\n📋 Checking nested hierarchy structure...'));
  
  // Expected nested structure:
  // Root
  // ├── Tutorial Intro (root level)
  // ├── Tutorial Basics (parent)
  // │   └── [children pages...]
  // ├── Tutorial Extras (parent)  
  // │   └── [children pages...]
  // └── Advanced (parent)
  //     └── Concepts (child parent)
  //         └── Advanced Concepts (leaf)
  
  // Test the nested path: Advanced -> Concepts -> Advanced Concepts
  console.log(chalk.cyan('\n🔍 Testing nested path: Advanced/Concepts/Advanced Concepts'));
  
  // Find Advanced parent page
  const advancedPage = await client.findPageByTitle('Advanced');
  if (!advancedPage) {
    console.error(chalk.red('❌ Advanced parent page not found'));
    return;
  }
  console.log(chalk.green(`✓ Found Advanced page (ID: ${advancedPage.id})`));
  
  // Find Concepts child page under Advanced
  const advancedChildren = await client.getPageChildren(advancedPage.id);
  const conceptsPage = advancedChildren.find(child => child.title === 'Concepts');
  
  if (!conceptsPage) {
    console.error(chalk.red('❌ Concepts child page not found under Advanced'));
    return;
  }
  console.log(chalk.green(`✓ Found Concepts page under Advanced (ID: ${conceptsPage.id})`));
  
  // Find Advanced Concepts leaf page under Concepts
  const conceptsChildren = await client.getPageChildren(conceptsPage.id);
  const leafPage = conceptsChildren.find(child => child.title === 'Advanced Concepts');
  
  if (!leafPage) {
    console.error(chalk.red('❌ Advanced Concepts leaf page not found under Concepts'));
    return;
  }
  console.log(chalk.green(`✓ Found Advanced Concepts page under Concepts (ID: ${leafPage.id})`));
  
  // Show complete hierarchy tree
  console.log(chalk.cyan('\n🌳 Complete Hierarchy Tree:'));
  await showCompleteHierarchy(client);
}

async function showCompleteHierarchy(client) {
  // Get all root level pages (pages without parents in our space)
  const rootPages = [
    'Tutorial Intro',
    'Tutorial Basics', 
    'Tutorial Extras',
    'Advanced'
  ];
  
  for (const rootTitle of rootPages) {
    const rootPage = await client.findPageByTitle(rootTitle);
    if (!rootPage) continue;
    
    console.log(chalk.white(`📁 ${rootTitle} (${rootPage.id})`));
    await showPageHierarchy(client, rootPage.id, 1);
    console.log('');
  }
}

async function showPageHierarchy(client, pageId, level = 0) {
  const children = await client.getPageChildren(pageId);
  
  for (const [index, child] of children.entries()) {
    const isLast = index === children.length - 1;
    const indent = '   '.repeat(level);
    const prefix = isLast ? '└── ' : '├── ';
    
    // Check if this child has its own children
    const grandChildren = await client.getPageChildren(child.id);
    const icon = grandChildren.length > 0 ? '📁' : '📄';
    
    console.log(chalk.gray(`${indent}${prefix}${icon} ${child.title} (${child.id})`));
    
    // Recursively show children
    if (grandChildren.length > 0) {
      await showPageHierarchy(client, child.id, level + 1);
    }
  }
}

// Run test
testNestedHierarchy(); 