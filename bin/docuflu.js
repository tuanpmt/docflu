#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { syncFile, syncDocs, syncBlog } = require('../lib/commands/sync');

const program = new Command();

program
  .name('docuflu')
  .description('CLI tool to sync Docusaurus content to Confluence')
  .version('0.1.0');

program
  .command('sync')
  .description('Sync markdown content to Confluence')
  .option('-f, --file <path>', 'specific file to sync')
  .option('--docs', 'sync all documents in docs/ directory')
  .option('--blog', 'sync all blog posts in blog/ directory')
  .option('--dry-run', 'preview changes without syncing')
  .action(async (options) => {
    try {
      if (options.file) {
        console.log(chalk.blue('🚀 Syncing single file:', options.file));
        await syncFile(options.file, options.dryRun);
      } else if (options.docs) {
        console.log(chalk.blue('🚀 Syncing all docs/'));
        await syncDocs(options.dryRun);
      } else if (options.blog) {
        console.log(chalk.blue('🚀 Syncing all blog/'));
        await syncBlog(options.dryRun);
      } else {
        console.log(chalk.red('❌ Please specify --file, --docs, or --blog option'));
        console.log('Examples:');
        console.log('  docuflu sync --file docs/intro.md');
        console.log('  docuflu sync --docs');
        console.log('  docuflu sync --blog');
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program.parse(); 