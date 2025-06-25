#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { syncFile, syncDocs, syncBlog } = require('../lib/commands/sync');
const { initProject } = require('../lib/commands/init');
const { pullFromConfluence } = require('../lib/commands/pull');

const program = new Command();

// Read version from package.json
const packageJson = require('../package.json');

program
  .name('docflu')
  .description('CLI tool to sync Docusaurus documentation to Confluence with hierarchy, internal links, and Mermaid diagram support')
  .version(packageJson.version);

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
        console.log('  docflu sync --file docs/intro.md');
        console.log('  docflu sync --docs');
        console.log('  docflu sync --blog');
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize DocFlu in current directory')
  .action(async () => {
    try {
      await initProject();
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('pull')
  .description('Pull content from Confluence to Docusaurus')
  .option('--root <title>', 'root page title in Confluence')
  .option('--docs', 'pull to docs/ directory')
  .option('--blog', 'pull to blog/ directory')
  .option('--dry-run', 'preview changes without pulling')
  .option('--force', 'force pull all files, ignore change detection')
  .action(async (options) => {
    try {
      let target = 'docs'; // default
      
      if (options.blog) {
        target = 'blog';
      }
      
      console.log(chalk.blue(`🔄 Pulling from Confluence to ${target}/`));
      
      await pullFromConfluence({
        root: options.root,
        target: target,
        dryRun: options.dryRun,
        force: options.force
      });
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program.parse(); 