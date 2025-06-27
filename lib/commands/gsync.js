const chalk = require('chalk');
const ora = require('ora');
const GoogleDocsClient = require('../core/google-docs-client');

/**
 * Main Google Docs sync function
 * @param {string} type - 'file', 'docs', or 'blog'
 * @param {string} filePath - Path to specific file (for type='file')
 * @param {boolean} dryRun - Preview mode
 * @param {string} projectRoot - Project root directory
 */
async function syncGoogleDocs(type, filePath, dryRun = false, projectRoot = process.cwd()) {
  const spinner = ora('Initializing Google Docs sync...').start();
  
  try {
    // Initialize Google Docs client
    spinner.text = 'Setting up Google Docs client...';
    const client = new GoogleDocsClient(projectRoot);
    
    // Initialize with OAuth2 PKCE authentication
    spinner.stop();
    await client.initialize();
    spinner.start('Testing Google Docs API connection...');
    
    if (dryRun) {
      spinner.succeed(chalk.green('✅ Dry run mode - Google Docs client initialized successfully'));
      console.log(chalk.yellow('🔍 Dry run mode: No actual changes will be made'));
      return;
    }
    
    // Test API connection by creating a dummy document
    spinner.text = 'Creating test document...';
    const testDoc = await client.testConnection();
    
    spinner.succeed(chalk.green('✅ Google Docs sync completed successfully'));
    
    // Show results
    console.log(chalk.blue('\n📊 Sync Results:'));
    console.log(chalk.green(`✅ Test document created: ${testDoc.title}`));
    console.log(chalk.cyan(`🔗 URL: ${testDoc.url}`));
    console.log(chalk.gray(`📄 Document ID: ${testDoc.documentId}`));
    
    // Show next steps
    console.log(chalk.blue('\n🚀 Next Steps:'));
    console.log('• Implement markdown parsing for Google Docs format');
    console.log('• Add tab hierarchy support');
    console.log('• Convert internal references');
    console.log('• Process images and diagrams');
    
    return {
      success: true,
      platform: 'google-docs',
      type: type,
      results: {
        processed: 1,
        created: 1,
        updated: 0,
        skipped: 0,
        failed: 0,
      },
      document: testDoc,
    };
    
  } catch (error) {
    spinner.fail(chalk.red('❌ Google Docs sync failed'));
    
    // Provide helpful error messages
    if (error.message.includes('GOOGLE_CLIENT_ID')) {
      console.log(chalk.yellow('\n💡 Setup Instructions:'));
      console.log('1. Go to Google Cloud Console: https://console.cloud.google.com/');
      console.log('2. Create a new project or select existing one');
      console.log('3. Enable Google Docs API');
      console.log('4. Create OAuth2 credentials (Desktop Application)');
      console.log('5. Add GOOGLE_CLIENT_ID to your .env file');
      console.log('6. Run: docflu init --gdocs');
    } else if (error.message.includes('OAuth2')) {
      console.log(chalk.yellow('\n💡 Authentication Help:'));
      console.log('• Make sure you have a valid Google account');
      console.log('• Check if port 8080 is available');
      console.log('• Try running: docflu auth --gdocs');
    } else if (error.message.includes('API')) {
      console.log(chalk.yellow('\n💡 API Help:'));
      console.log('• Check your internet connection');
      console.log('• Verify Google Docs API is enabled');
      console.log('• Check API quotas and limits');
    }
    
    throw error;
  }
}

/**
 * Sync specific file to Google Docs
 * @param {string} filePath - Path to markdown file
 * @param {boolean} dryRun - Preview mode
 * @param {string} projectRoot - Project root directory
 */
async function syncFileToGoogleDocs(filePath, dryRun = false, projectRoot = process.cwd()) {
  console.log(chalk.blue(`📄 Syncing file to Google Docs: ${filePath}`));
  
  // For now, delegate to main sync function
  return await syncGoogleDocs('file', filePath, dryRun, projectRoot);
}

/**
 * Sync all docs/ to Google Docs
 * @param {boolean} dryRun - Preview mode
 * @param {string} projectRoot - Project root directory
 */
async function syncDocsToGoogleDocs(dryRun = false, projectRoot = process.cwd()) {
  console.log(chalk.blue('📁 Syncing all docs/ to Google Docs'));
  
  // For now, delegate to main sync function
  return await syncGoogleDocs('docs', null, dryRun, projectRoot);
}

/**
 * Sync all blog/ to Google Docs
 * @param {boolean} dryRun - Preview mode
 * @param {string} projectRoot - Project root directory
 */
async function syncBlogToGoogleDocs(dryRun = false, projectRoot = process.cwd()) {
  console.log(chalk.blue('📝 Syncing all blog/ to Google Docs'));
  
  // For now, delegate to main sync function
  return await syncGoogleDocs('blog', null, dryRun, projectRoot);
}

module.exports = {
  syncGoogleDocs,
  syncFileToGoogleDocs,
  syncDocsToGoogleDocs,
  syncBlogToGoogleDocs,
}; 