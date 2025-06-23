#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { syncFile } = require('../lib/commands/sync');

const program = new Command();

program
  .name('docuflu')
  .description('CLI tool to sync Docusaurus content to Confluence')
  .version('0.1.0');

program
  .command('sync')
  .description('Sync markdown file to Confluence')
  .option('-f, --file <path>', 'specific file to sync')
  .option('--dry-run', 'preview changes without syncing')
  .action(async (options) => {
    try {
      if (options.file) {
        console.log(chalk.blue('🚀 Syncing single file:', options.file));
        await syncFile(options.file, options.dryRun);
      } else {
        console.log(chalk.red('❌ Please specify a file with --file option'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program.parse(); 