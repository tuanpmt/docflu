const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const NotionSync = require('../core/notion/notion-sync');
const Config = require('../core/config');

/**
 * Notion Sync Command
 * Handles syncing Docusaurus content to Notion pages
 */
async function syncNotion(projectPath, options = {}) {
  const spinner = ora('Initializing Notion sync...').start();
  
  try {
    // Load configuration
    const projectRoot = path.resolve(projectPath || process.cwd());
    const config = new Config();
    const notionConfig = await config.loadNotionConfig(projectRoot);
    
    if (!notionConfig.apiToken) {
      spinner.fail('Notion API token not found. Please run: docflu init --notion');
      process.exit(1);
    }

    // Initialize Notion sync
    const notionSync = new NotionSync(notionConfig, projectRoot);
    await notionSync.initialize();

    spinner.succeed('Notion sync initialized');

    // Determine sync mode
    if (options.file) {
      // Single file sync
      console.log(chalk.blue(`🔄 Syncing single file: ${options.file}`));
      const fileOptions = { ...options, singleFile: true };
      await notionSync.syncFile(options.file, fileOptions);
    } else if (options.dir) {
      // Directory sync
      console.log(chalk.blue(`🔄 Syncing directory: ${options.dir}`));
      const dirOptions = { ...options, directorySync: true };
      await notionSync.syncDirectory(options.dir, dirOptions);
    } else if (options.docs) {
      // Docs directory sync
      console.log(chalk.blue('🔄 Syncing all docs/'));
      const docsOptions = { ...options, singleFile: false };
      await notionSync.syncDocs(docsOptions);
    } else {
      // Default: sync all docs
      console.log(chalk.blue('🔄 Syncing all docs/'));
      const docsOptions = { ...options, singleFile: false };
      await notionSync.syncDocs(docsOptions);
    }

    // Generate sync report
    const report = notionSync.generateSyncReport();
    
    if (options.dryRun) {
      console.log('\n' + chalk.green('✔ Notion dry run completed'));
    } else {
      console.log('\n' + chalk.green('✔ Notion sync completed'));
    }
    
    console.log('\n📊 SUMMARY:');
    console.log(`Total documents: ${report.totalDocuments}`);
    console.log(`Processed: ${report.processed}`);
    
    if (options.dryRun) {
      console.log(`Analyzed: ${chalk.blue(report.processed)}`);
      console.log(`Would create: ${chalk.green(report.created || 0)}`);
      console.log(`Would update: ${chalk.yellow(report.updated || 0)}`);
    } else {
      console.log(`Created: ${chalk.green(report.created)}`);
      console.log(`Updated: ${chalk.yellow(report.updated)}`);
    }
    
    console.log(`Skipped: ${chalk.gray(report.skipped)}`);
    console.log(`Failed: ${chalk.red(report.failed)}`);

    if (options.dryRun) {
      console.log(chalk.yellow('\n⚠️ This was a dry run. No actual changes were made to Notion.'));
    } else if (report.failed > 0) {
      console.log('\n❌ Some documents failed to sync. Check the logs for details.');
      process.exit(1);
    }

  } catch (error) {
    spinner.fail(`Notion sync failed: ${error.message}`);
    console.error(chalk.red('Error details:'), error);
    process.exit(1);
  }
}

module.exports = syncNotion; 