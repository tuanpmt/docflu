const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');

const Config = require('../core/config');
const MarkdownParser = require('../core/markdown-parser');
const ConfluenceClient = require('../core/confluence-client');

/**
 * Sync single markdown file to Confluence
 * @param {string} filePath - path to markdown file
 * @param {boolean} dryRun - preview mode without actual sync
 */
async function syncFile(filePath, dryRun = false) {
  const spinner = ora('Starting sync process...').start();

  try {
    // Step 1: Load configuration
    spinner.text = 'Loading configuration...';
    const config = new Config();
    const confluenceConfig = await config.loadConfig();

    // Step 2: Validate file path
    spinner.text = 'Validating file path...';
    const absolutePath = path.resolve(filePath);
    
    if (!await fs.pathExists(absolutePath)) {
      throw new Error(`File không tồn tại: ${filePath}`);
    }

    if (!filePath.endsWith('.md')) {
      throw new Error(`File phải có extension .md: ${filePath}`);
    }

    // Step 3: Parse markdown
    spinner.text = 'Parsing markdown content...';
    const parser = new MarkdownParser();
    const parsedContent = await parser.parseFile(absolutePath);

    // Step 4: Connect to Confluence
    spinner.text = 'Connecting to Confluence...';
    const confluenceClient = new ConfluenceClient(confluenceConfig);
    
    const connected = await confluenceClient.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Confluence');
    }

    // Step 5: Get parent page (if specified)
    let parentId = null;
    if (confluenceConfig.rootPageTitle) {
      spinner.text = 'Finding root page...';
      const rootPage = await confluenceClient.getRootPage();
      if (rootPage) {
        parentId = rootPage.id;
        console.log(chalk.blue('📂 Parent page found:', rootPage.title));
      }
    }

    // Step 6: Preview or sync
    if (dryRun) {
      spinner.succeed('Dry run completed');
      
      console.log(chalk.cyan('\n📋 PREVIEW:'));
      console.log(chalk.white('Title:'), parsedContent.title);
      console.log(chalk.white('Parent:'), parentId ? `ID ${parentId}` : 'None');
      console.log(chalk.white('Content length:'), parsedContent.content.length, 'characters');
      console.log(chalk.white('Frontmatter:'), JSON.stringify(parsedContent.frontmatter, null, 2));
      
      console.log(chalk.yellow('\n⚠️ This is a dry run. No changes were made to Confluence.'));
      return {
        success: true,
        action: 'preview',
        title: parsedContent.title,
        contentLength: parsedContent.content.length
      };
    }

    // Step 7: Create or update page
    spinner.text = `Syncing page "${parsedContent.title}"...`;
    
    const pageData = {
      title: parsedContent.title,
      content: parsedContent.content,
      parentId: parentId
    };

    const result = await confluenceClient.createOrUpdatePage(pageData);
    
    spinner.succeed('Sync completed successfully');
    
    console.log(chalk.green('\n✅ SUCCESS:'));
    console.log(chalk.white('Page ID:'), result.id);
    console.log(chalk.white('Title:'), result.title);
    console.log(chalk.white('URL:'), `${confluenceConfig.baseUrl}/pages/viewpage.action?pageId=${result.id}`);

    return {
      success: true,
      action: result.version?.number === 1 ? 'created' : 'updated',
      pageId: result.id,
      title: result.title,
      url: `${confluenceConfig.baseUrl}/pages/viewpage.action?pageId=${result.id}`
    };

  } catch (error) {
    spinner.fail('Sync failed');
    
    console.error(chalk.red('\n❌ ERROR:'));
    console.error(chalk.white('Message:'), error.message);
    
    if (error.stack && process.env.DEBUG) {
      console.error(chalk.gray('Stack:'), error.stack);
    }

    throw error;
  }
}

module.exports = {
  syncFile
}; 