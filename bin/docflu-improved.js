#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');

// Import improved architecture components
const CONSTANTS = require('../lib/constants');
const ErrorHandler = require('../lib/utils/error-handler');
const PerformanceMonitor = require('../lib/utils/performance-monitor');
const ConfigManager = require('../lib/core/config-manager');
const PlatformFactory = require('../lib/core/base/platform-factory');

// Legacy imports for backward compatibility
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
  .option('--gdocs', 'sync to Google Docs (requires OAuth2 authentication)')
  .option('--notion', 'sync to Notion (requires API token)')
  .option('--conflu', 'sync to Confluence (default)')
  .option('--dry-run', 'preview changes without syncing')
  .option('--force', 'force sync all files (ignore incremental sync)')
  .option('--debug', 'enable debug mode')
  .option('--perf', 'enable performance monitoring')
  .action(async (projectPath, options) => {
    const monitor = new PerformanceMonitor();
    
    try {
      // Setup debug mode
      if (options.debug) {
        process.env.DEBUG = 'true';
      }

      // Start performance monitoring
      if (options.perf) {
        monitor.start();
      }

      // Determine project root and file path
      const { projectRoot, filePath } = resolveProjectPaths(projectPath, options);

      // Determine platform - default to Confluence for backward compatibility
      const platform = determinePlatform(options);

      // Validate sync mode options
      validateSyncOptions(options);

      // Initialize configuration manager
      const configManager = new ConfigManager(projectRoot);

      // Load platform configuration
      monitor.startOperation('config-load');
      const config = await configManager.loadConfig(platform);
      monitor.endOperation('config-load');

      // Test platform connection
      monitor.startOperation('connection-test');
      const client = PlatformFactory.createClient(platform, config);
      const connected = await client.testConnection();
      monitor.endOperation('connection-test');

      if (!connected) {
        throw ErrorHandler.createNetworkError(`Unable to connect to ${platform}`);
      }

      // Execute sync operation
      monitor.startOperation('sync');
      await executeSyncOperation(platform, projectRoot, filePath, options, monitor);
      monitor.endOperation('sync');

      // Print success message
      console.log(chalk.green(`${CONSTANTS.CLI.SUCCESS} Sync completed successfully!`));

      // Print performance report if requested
      if (options.perf) {
        monitor.stop();
        monitor.printReport();
      }

      // Ensure process exits cleanly
      process.exit(0);

    } catch (error) {
      monitor.incrementErrors();
      ErrorHandler.handle(error, 'sync');
      
      if (options.perf) {
        monitor.stop();
        monitor.printReport();
      }
      
      process.exit(1);
    }
  });

program
  .command('init [projectPath]')
  .description('Initialize DocFlu in current directory')
  .option('--platform <platform>', 'specify platform (confluence, gdocs, notion)')
  .option('--sample-env', 'create sample environment file')
  .action(async (projectPath, options) => {
    try {
      // Determine project root - use provided path or current directory
      const projectRoot = projectPath ? path.resolve(projectPath) : process.cwd();
      console.log(chalk.gray(`${CONSTANTS.CLI.FOLDER} Project root:`), projectRoot);

      // Create sample environment file if requested
      if (options.sampleEnv) {
        const configManager = new ConfigManager(projectRoot);
        await configManager.createSampleEnv();
        console.log(chalk.green(`${CONSTANTS.CLI.SUCCESS} Sample environment file created`));
      }

      // Initialize project with legacy function for now
      await initProject(projectRoot);
      
      // Show platform-specific setup instructions
      if (options.platform) {
        showPlatformInstructions(options.platform);
      }

      // Ensure process exits cleanly
      process.exit(0);
    } catch (error) {
      ErrorHandler.handle(error, 'init');
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage configuration')
  .option('--list', 'list all configuration options')
  .option('--validate <platform>', 'validate configuration for platform')
  .option('--sample', 'create sample configuration file')
  .action(async (options) => {
    try {
      const projectRoot = process.cwd();
      const configManager = new ConfigManager(projectRoot);

      if (options.list) {
        const platforms = configManager.getSupportedPlatforms();
        console.log(chalk.blue('Supported platforms:'));
        platforms.forEach(platform => {
          console.log(`  ${CONSTANTS.CLI.INFO} ${platform}`);
        });
      }

      if (options.validate) {
        const hasConfig = await configManager.hasConfig(options.validate);
        if (hasConfig) {
          console.log(chalk.green(`${CONSTANTS.CLI.SUCCESS} ${options.validate} configuration is valid`));
        } else {
          console.log(chalk.red(`${CONSTANTS.CLI.ERROR} ${options.validate} configuration is invalid or missing`));
        }
      }

      if (options.sample) {
        await configManager.createSampleEnv();
        console.log(chalk.green(`${CONSTANTS.CLI.SUCCESS} Sample configuration created`));
      }

      process.exit(0);
    } catch (error) {
      ErrorHandler.handle(error, 'config');
      process.exit(1);
    }
  });

/**
 * Resolve project paths based on input
 */
function resolveProjectPaths(projectPath, options) {
  let projectRoot;
  let filePath = options.file;

  // Handle different scenarios for project root and file path
  if (options.file) {
    if (projectPath) {
      // Case: docflu sync /project/path --file relative/file.md
      projectRoot = path.resolve(projectPath);
    } else {
      // Case: docflu sync --file /absolute/path/to/file.md
      const absoluteFilePath = path.resolve(options.file);
      
      // Try to find project root by looking for docusaurus.config.* or .env
      let currentDir = path.dirname(absoluteFilePath);
      let foundProjectRoot = null;
      
      while (currentDir !== path.dirname(currentDir)) {
        const fs = require('fs-extra');
        const hasDocusaurusConfig = fs.pathExistsSync(path.join(currentDir, CONSTANTS.CONFIG_FILES.DOCUSAURUS_CONFIG_TS)) ||
                                   fs.pathExistsSync(path.join(currentDir, CONSTANTS.CONFIG_FILES.DOCUSAURUS_CONFIG_JS));
        const hasEnvFile = fs.pathExistsSync(path.join(currentDir, CONSTANTS.CONFIG_FILES.ENV));
        
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

  return { projectRoot, filePath };
}

/**
 * Determine platform from options
 */
function determinePlatform(options) {
  if (options.gdocs) return CONSTANTS.PLATFORMS.GOOGLE_DOCS;
  if (options.notion) return CONSTANTS.PLATFORMS.NOTION;
  return CONSTANTS.PLATFORMS.CONFLUENCE; // Default
}

/**
 * Validate sync options
 */
function validateSyncOptions(options) {
  // Validate sync mode options
  const syncModes = [options.file, options.docs, options.blog, options.dir].filter(Boolean);
  if (syncModes.length > 1) {
    throw ErrorHandler.createValidationError('sync options', 'multiple sync modes specified');
  }

  if (syncModes.length === 0) {
    throw ErrorHandler.createValidationError('sync options', 'no sync mode specified');
  }

  // Validate platform options
  const platformOptions = [options.gdocs, options.notion, options.conflu].filter(Boolean);
  if (platformOptions.length > 1) {
    throw ErrorHandler.createValidationError('platform options', 'multiple platforms specified');
  }
}

/**
 * Execute sync operation based on platform and options
 */
async function executeSyncOperation(platform, projectRoot, filePath, options, monitor) {
  console.log(chalk.blue(`${CONSTANTS.CLI.PROGRESS} Syncing to ${platform}`));
  console.log(chalk.gray(`${CONSTANTS.CLI.FOLDER} Project root:`), projectRoot);

  // For now, use legacy sync functions
  // TODO: Refactor to use new architecture
  if (options.file) {
    monitor.startOperation('file-sync');
    if (platform === CONSTANTS.PLATFORMS.GOOGLE_DOCS) {
      await syncGoogleDocs('file', filePath, options.dryRun, projectRoot);
    } else if (platform === CONSTANTS.PLATFORMS.NOTION) {
      await syncNotion(projectRoot, { file: filePath, dryRun: options.dryRun, force: options.force });
    } else {
      await syncFile(filePath, options.dryRun, projectRoot);
    }
    monitor.endOperation('file-sync');
  } else if (options.docs) {
    monitor.startOperation('docs-sync');
    if (platform === CONSTANTS.PLATFORMS.GOOGLE_DOCS) {
      await syncGoogleDocs('docs', null, options.dryRun, projectRoot);
    } else if (platform === CONSTANTS.PLATFORMS.NOTION) {
      await syncNotion(projectRoot, { docs: true, dryRun: options.dryRun, force: options.force });
    } else {
      await syncDocs(options.dryRun, projectRoot);
    }
    monitor.endOperation('docs-sync');
  } else if (options.blog) {
    monitor.startOperation('blog-sync');
    if (platform === CONSTANTS.PLATFORMS.GOOGLE_DOCS) {
      await syncGoogleDocs('blog', null, options.dryRun, projectRoot);
    } else if (platform === CONSTANTS.PLATFORMS.NOTION) {
      await syncNotion(projectRoot, { blog: true, dryRun: options.dryRun, force: options.force });
    } else {
      await syncBlog(options.dryRun, projectRoot);
    }
    monitor.endOperation('blog-sync');
  } else if (options.dir) {
    monitor.startOperation('dir-sync');
    if (platform === CONSTANTS.PLATFORMS.GOOGLE_DOCS) {
      await syncGoogleDocs('dir', options.dir, options.dryRun, projectRoot);
    } else if (platform === CONSTANTS.PLATFORMS.NOTION) {
      await syncNotion(projectRoot, { dir: options.dir, dryRun: options.dryRun, force: options.force });
    } else {
      await syncDir(options.dir, options.dryRun, projectRoot);
    }
    monitor.endOperation('dir-sync');
  }
}

/**
 * Show platform-specific setup instructions
 */
function showPlatformInstructions(platform) {
  console.log(chalk.blue(`\n${CONSTANTS.CLI.INFO} Setup instructions for ${platform}:`));
  
  switch (platform) {
    case CONSTANTS.PLATFORMS.CONFLUENCE:
      console.log(chalk.gray('1. Go to Atlassian Account Settings'));
      console.log(chalk.gray('2. Create an API Token'));
      console.log(chalk.gray('3. Add credentials to .env file'));
      break;
    case CONSTANTS.PLATFORMS.GOOGLE_DOCS:
      console.log(chalk.gray('1. Go to Google Cloud Console'));
      console.log(chalk.gray('2. Create OAuth2 credentials'));
      console.log(chalk.gray('3. Add credentials to .env file'));
      break;
    case CONSTANTS.PLATFORMS.NOTION:
      console.log(chalk.gray('1. Go to Notion Integrations'));
      console.log(chalk.gray('2. Create new integration'));
      console.log(chalk.gray('3. Add API token to .env file'));
      break;
  }
}

program.parse();