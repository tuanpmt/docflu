const fs = require('fs-extra');
const path = require('path');
const dotenv = require('dotenv');
const chalk = require('chalk');

class Config {
  constructor() {
    this.confluenceConfig = null;
  }

  /**
   * Load configuration from .env file
   * @param {string} projectRoot - project root directory
   */
  async loadConfig(projectRoot = process.cwd()) {
    const envPath = path.join(projectRoot, '.env');
    
    if (!await fs.pathExists(envPath)) {
      throw new Error(`File .env does not exist at: ${envPath}\nPlease create .env file with Confluence configuration.`);
    }

    // Load .env file
    const envConfig = dotenv.config({ path: envPath });
    
    if (envConfig.error) {
      throw new Error(`Cannot load .env file: ${envConfig.error.message}`);
    }

    // Validate and build confluence config
    this.confluenceConfig = this.buildConfluenceConfig(process.env);
    
    console.log(chalk.green('✓ Loaded configuration from .env'));
    return this.confluenceConfig;
  }

  /**
   * Build Confluence configuration from environment variables
   */
  buildConfluenceConfig(env) {
    const required = ['CONFLUENCE_BASE_URL', 'CONFLUENCE_USERNAME', 'CONFLUENCE_API_TOKEN', 'CONFLUENCE_SPACE_KEY'];
    const missing = required.filter(key => !env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return {
      baseUrl: env.CONFLUENCE_BASE_URL,
      username: env.CONFLUENCE_USERNAME,
      apiToken: env.CONFLUENCE_API_TOKEN,
      spaceKey: env.CONFLUENCE_SPACE_KEY,
      rootPageTitle: env.CONFLUENCE_ROOT_PAGE_TITLE || null,
      // Optional settings
      excludePatterns: env.DOCFLU_EXCLUDE_PATTERNS ? env.DOCFLU_EXCLUDE_PATTERNS.split(',') : [],
      concurrentUploads: parseInt(env.DOCFLU_CONCURRENT_UPLOADS) || 5,
      retryCount: parseInt(env.DOCFLU_RETRY_COUNT) || 3
    };
  }

  /**
   * Create sample .env file
   */
  async createSampleEnv(projectRoot = process.cwd()) {
    const envPath = path.join(projectRoot, '.env');
    
    if (await fs.pathExists(envPath)) {
      console.log(chalk.yellow('⚠️ File .env already exists'));
      return;
    }

    const sampleEnv = `# Confluence Configuration
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@domain.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=DOC
CONFLUENCE_ROOT_PAGE_TITLE=Documentation

# Optional Settings
DOCFLU_EXCLUDE_PATTERNS=*.draft.md,private/**
DOCFLU_CONCURRENT_UPLOADS=5
DOCFLU_RETRY_COUNT=3
`;

    await fs.writeFile(envPath, sampleEnv);
    console.log(chalk.green('✓ Created sample .env file'));
    console.log(chalk.blue('📋 Please edit .env with your Confluence settings'));
  }

  /**
   * Get current confluence config
   */
  getConfluenceConfig() {
    if (!this.confluenceConfig) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.confluenceConfig;
  }
}

module.exports = Config; 