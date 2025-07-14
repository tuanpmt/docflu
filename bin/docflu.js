#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const { syncFile, syncDocs, syncBlog, syncDir } = require('../lib/commands/sync');
const { syncGoogleDocs } = require('../lib/commands/sync_gdocs');
const syncNotion = require('../lib/commands/sync_notion');
const { initProject } = require('../lib/commands/init');

const program = new Command();

// Read version from package.json
const packageJson = require('../package.json');

program
  .name('docflu')
  .description('CLI tool to sync Docusaurus documentation to Confluence, Google Docs, and Notion with hierarchy, internal links, and diagram support')
  .version(packageJson.version);

program
  .command('sync [projectPath]')
  .description('Sync markdown content to Confluence, Google Docs, or Notion')
  .option('-f, --file <path>', 'specific file to sync')
  .option('--docs', 'sync all documents in docs/ directory')
  .option('--blog', 'sync all blog posts in blog/ directory')
  .option('--dir <path>', 'sync specific directory with hierarchy')
  .option('--target <pageUrlOrId>', 'target specific Confluence page (URL or ID)')
  .option('--gdocs', 'sync to Google Docs (requires OAuth2 authentication)')
  .option('--notion', 'sync to Notion (requires API token)')
  .option('--conflu', 'sync to Confluence (default)')
  .option('--dry-run', 'preview changes without syncing')
  .option('--force', 'force sync all files (ignore incremental sync)')
  .action(async (projectPath, options) => {
    try {
      let projectRoot;
      let filePath = options.file;

      // Handle different scenarios for project root and file path
      if (options.file) {
        if (projectPath) {
          // Case: docflu sync /project/path --file relative/file.md
          projectRoot = path.resolve(projectPath);
          // filePath is already set from options.file
        } else {
          // Case: docflu sync --file /absolute/path/to/file.md
          // Need to determine project root from file path
          const absoluteFilePath = path.resolve(options.file);
          
          // Try to find project root by looking for docusaurus.config.* or .env
          let currentDir = path.dirname(absoluteFilePath);
          let foundProjectRoot = null;
          
          while (currentDir !== path.dirname(currentDir)) { // Until we reach filesystem root
            const hasDocusaurusConfig = require('fs-extra').pathExistsSync(path.join(currentDir, 'docusaurus.config.ts')) ||
                                       require('fs-extra').pathExistsSync(path.join(currentDir, 'docusaurus.config.js'));
            const hasEnvFile = require('fs-extra').pathExistsSync(path.join(currentDir, '.env'));
            
            if (hasDocusaurusConfig || hasEnvFile) {
              foundProjectRoot = currentDir;
              break;
            }
            currentDir = path.dirname(currentDir);
          }
          
          projectRoot = foundProjectRoot || path.dirname(absoluteFilePath);
          filePath = path.relative(projectRoot, absoluteFilePath);
        }
      } else {
        // Case: docflu sync /project/path --docs/--blog
        projectRoot = projectPath ? path.resolve(projectPath) : process.cwd();
      }

      // Determine platform - default to Confluence for backward compatibility
      let platform = 'confluence';
      if (options.gdocs) platform = 'google-docs';
      if (options.notion) platform = 'notion';
      
      // Validate sync mode options
      const syncModes = [options.file, options.docs, options.blog, options.dir].filter(Boolean);
      if (syncModes.length > 1) {
        console.log(chalk.red('❌ Cannot specify multiple sync modes. Choose one: --file, --docs, --blog, or --dir.'));
        process.exit(1);
      }

      // Validate platform options
      const platformOptions = [options.gdocs, options.notion, options.conflu].filter(Boolean);
      if (platformOptions.length > 1) {
        console.log(chalk.red('❌ Cannot specify multiple platforms. Choose one: --gdocs, --notion, or --conflu.'));
        process.exit(1);
      }

      // Validate target option - only for Confluence and only with --file
      if (options.target) {
        if (platform !== 'confluence') {
          console.log(chalk.red('❌ --target option is only supported for Confluence sync. Remove --gdocs or --notion flags.'));
          process.exit(1);
        }
        if (!options.file) {
          console.log(chalk.red('❌ --target option requires --file option. It cannot be used with --docs, --blog, or --dir.'));
          process.exit(1);
        }
      }

      if (options.file) {
        console.log(chalk.blue(`🚀 Syncing single file to ${platform}:`, filePath));
        console.log(chalk.gray('📂 Project root:', projectRoot));
        
        if (options.target) {
          console.log(chalk.cyan('🎯 Target page:', options.target));
        }
        
        if (platform === 'google-docs') {
          await syncGoogleDocs('file', filePath, options.dryRun, projectRoot);
        } else if (platform === 'notion') {
          await syncNotion(projectRoot, { file: filePath, dryRun: options.dryRun, force: options.force });
        } else {
          await syncFile(filePath, options.dryRun, projectRoot, options.target);
        }
        
        // Ensure process exits cleanly
        process.exit(0);
      } else if (options.docs) {
        console.log(chalk.blue(`🚀 Syncing all docs/ to ${platform}`));
        console.log(chalk.gray('📂 Project root:', projectRoot));
        
        if (platform === 'google-docs') {
          await syncGoogleDocs('docs', null, options.dryRun, projectRoot);
        } else if (platform === 'notion') {
          await syncNotion(projectRoot, { docs: true, dryRun: options.dryRun, force: options.force });
        } else {
          await syncDocs(options.dryRun, projectRoot);
        }
        
        // Ensure process exits cleanly
        process.exit(0);
      } else if (options.blog) {
        console.log(chalk.blue(`🚀 Syncing all blog/ to ${platform}`));
        console.log(chalk.gray('📂 Project root:', projectRoot));
        
        if (platform === 'google-docs') {
          await syncGoogleDocs('blog', null, options.dryRun, projectRoot);
        } else if (platform === 'notion') {
          await syncNotion(projectRoot, { blog: true, dryRun: options.dryRun, force: options.force });
        } else {
          await syncBlog(options.dryRun, projectRoot);
        }
        
        // Ensure process exits cleanly
        process.exit(0);
      } else if (options.dir) {
        console.log(chalk.blue(`🚀 Syncing directory to ${platform}: ${options.dir}`));
        console.log(chalk.gray('📂 Project root:', projectRoot));
        
        if (platform === 'google-docs') {
          await syncGoogleDocs('dir', options.dir, options.dryRun, projectRoot);
        } else if (platform === 'notion') {
          await syncNotion(projectRoot, { dir: options.dir, dryRun: options.dryRun, force: options.force });
        } else {
          await syncDir(options.dir, options.dryRun, projectRoot);
        }
        
        // Ensure process exits cleanly
        process.exit(0);
      } else {
        console.log(chalk.red('❌ Please specify --file, --docs, --blog, or --dir option'));
        console.log('Examples:');
        console.log('  docflu sync --file docs/intro.md');
        console.log('  docflu sync --file docs/intro.md --target 123456  # Sync to specific page ID');
        console.log('  docflu sync --file docs/intro.md --target "https://domain.atlassian.net/wiki/spaces/DOC/pages/123456/Page+Title"');
        console.log('  docflu sync --docs');
        console.log('  docflu sync --blog');
        console.log('  docflu sync --dir docs/tutorial-basics');
        console.log('  docflu sync --gdocs --docs  # Sync to Google Docs');
        console.log('  docflu sync --notion --docs  # Sync to Notion');
        console.log('  docflu sync --conflu --docs  # Sync to Confluence');
        console.log('  docflu sync ../docusaurus-exam --docs');
        console.log('  docflu sync /path/to/project --gdocs --blog');
        console.log('  docflu sync /path/to/project --notion --docs');
        console.log('  docflu sync /path/to/project --gdocs --dir docs/tutorial');
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
      
      // Ensure process exits cleanly
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program.parse(); 