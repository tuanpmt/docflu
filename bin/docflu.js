#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const { syncFile, syncDocs, syncBlog } = require('../lib/commands/sync');
const { initProject } = require('../lib/commands/init');

const program = new Command();

// Read version from package.json
const packageJson = require('../package.json');

program
  .name('docflu')
  .description('CLI tool to sync Docusaurus documentation to Confluence with hierarchy, internal links, and Mermaid diagram support')
  .version(packageJson.version);

program
  .command('sync [projectPath]')
  .description('Sync markdown content to Confluence')
  .option('-f, --file <path>', 'specific file to sync')
  .option('--docs', 'sync all documents in docs/ directory')
  .option('--blog', 'sync all blog posts in blog/ directory')
  .option('--dry-run', 'preview changes without syncing')
  .action(async (projectPath, options) => {
    try {
      // Determine project root - use provided path or current directory
      const projectRoot = projectPath ? path.resolve(projectPath) : process.cwd();

      if (options.file) {
        console.log(chalk.blue('🚀 Syncing single file:', options.file));
        console.log(chalk.gray('📂 Project root:', projectRoot));
        await syncFile(options.file, options.dryRun, projectRoot);
      } else if (options.docs) {
        console.log(chalk.blue('🚀 Syncing all docs/'));
        console.log(chalk.gray('📂 Project root:', projectRoot));
        await syncDocs(options.dryRun, projectRoot);
      } else if (options.blog) {
        console.log(chalk.blue('🚀 Syncing all blog/'));
        console.log(chalk.gray('📂 Project root:', projectRoot));
        await syncBlog(options.dryRun, projectRoot);
      } else {
        console.log(chalk.red('❌ Please specify --file, --docs, or --blog option'));
        console.log('Examples:');
        console.log('  docflu sync --file docs/intro.md');
        console.log('  docflu sync --docs');
        console.log('  docflu sync --blog');
        console.log('  docflu sync ../docusaurus-exam --docs');
        console.log('  docflu sync /path/to/project --blog');
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('init [projectPath]')
  .description('Initialize DocFlu in current directory')
  .action(async (projectPath) => {
    try {
      // Determine project root - use provided path or current directory
      const projectRoot = projectPath ? path.resolve(projectPath) : process.cwd();
      console.log(chalk.gray('📂 Project root:', projectRoot));
      await initProject(projectRoot);
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program.parse(); 