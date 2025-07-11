const fs = require('fs-extra');
const path = require('path');
const CONSTANTS = require('../constants');
const ErrorHandler = require('../utils/error-handler');
const PlatformFactory = require('./base/platform-factory');

/**
 * Centralized configuration management
 */
class ConfigManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.configs = new Map();
    this.envPath = path.join(projectRoot, CONSTANTS.CONFIG_FILES.ENV);
  }

  /**
   * Load configuration for a specific platform
   * @param {string} platform - Platform name
   * @returns {Promise<Object>} Platform configuration
   */
  async loadConfig(platform) {
    if (this.configs.has(platform)) {
      return this.configs.get(platform);
    }

    const config = await this.loadPlatformConfig(platform);
    this.configs.set(platform, config);
    return config;
  }

  /**
   * Load platform-specific configuration
   * @param {string} platform - Platform name
   * @returns {Promise<Object>} Platform configuration
   */
  async loadPlatformConfig(platform) {
    if (!PlatformFactory.isSupported(platform)) {
      throw ErrorHandler.createValidationError('platform', platform);
    }

    // Load environment variables
    await this.loadEnvironmentVariables();

    switch (platform) {
      case CONSTANTS.PLATFORMS.CONFLUENCE:
        return await this.loadConfluenceConfig();
      case CONSTANTS.PLATFORMS.GOOGLE_DOCS:
        return await this.loadGdocsConfig();
      case CONSTANTS.PLATFORMS.NOTION:
        return await this.loadNotionConfig();
      default:
        throw ErrorHandler.createValidationError('platform', platform);
    }
  }

  /**
   * Load environment variables from .env file
   */
  async loadEnvironmentVariables() {
    if (await fs.pathExists(this.envPath)) {
      const dotenv = require('dotenv');
      dotenv.config({ path: this.envPath });
    }
  }

  /**
   * Load Confluence configuration
   * @returns {Promise<Object>} Confluence configuration
   */
  async loadConfluenceConfig() {
    const config = {
      baseUrl: process.env.CONFLUENCE_BASE_URL,
      username: process.env.CONFLUENCE_USERNAME,
      apiToken: process.env.CONFLUENCE_API_TOKEN,
      spaceKey: process.env.CONFLUENCE_SPACE_KEY,
      rootPageTitle: process.env.CONFLUENCE_ROOT_PAGE_TITLE || 'Documentation'
    };

    this.validateRequiredFields(config, ['baseUrl', 'username', 'apiToken', 'spaceKey'], 'Confluence');
    return config;
  }

  /**
   * Load Google Docs configuration
   * @returns {Promise<Object>} Google Docs configuration
   */
  async loadGdocsConfig() {
    const config = {
      clientId: process.env.GDOCS_CLIENT_ID,
      clientSecret: process.env.GDOCS_CLIENT_SECRET,
      folderId: process.env.GDOCS_FOLDER_ID
    };

    this.validateRequiredFields(config, ['clientId', 'clientSecret'], 'Google Docs');
    return config;
  }

  /**
   * Load Notion configuration
   * @returns {Promise<Object>} Notion configuration
   */
  async loadNotionConfig() {
    const config = {
      apiToken: process.env.NOTION_API_TOKEN,
      databaseId: process.env.NOTION_DATABASE_ID
    };

    this.validateRequiredFields(config, ['apiToken'], 'Notion');
    return config;
  }

  /**
   * Validate required configuration fields
   * @param {Object} config - Configuration object
   * @param {string[]} requiredFields - Required field names
   * @param {string} platform - Platform name for error messages
   */
  validateRequiredFields(config, requiredFields, platform) {
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      throw ErrorHandler.createConfigError(
        `Missing required ${platform} configuration: ${missingFields.join(', ')}`
      );
    }
  }

  /**
   * Get default configuration for a platform
   * @param {string} platform - Platform name
   * @returns {Object} Default configuration
   */
  getDefaultConfig(platform) {
    return PlatformFactory.getDefaultConfig(platform);
  }

  /**
   * Create sample .env file with all platform configurations
   * @returns {Promise<void>}
   */
  async createSampleEnv() {
    const sampleEnvPath = path.join(this.projectRoot, 'env.example');
    
    const content = `# Confluence Configuration
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@domain.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=DOC
CONFLUENCE_ROOT_PAGE_TITLE=Documentation

# Google Docs Configuration
GDOCS_CLIENT_ID=your-client-id
GDOCS_CLIENT_SECRET=your-client-secret
GDOCS_FOLDER_ID=your-folder-id

# Notion Configuration
NOTION_API_TOKEN=your-api-token
NOTION_DATABASE_ID=your-database-id

# Optional Settings
DEBUG=false
`;

    await fs.writeFile(sampleEnvPath, content);
  }

  /**
   * Check if configuration exists for a platform
   * @param {string} platform - Platform name
   * @returns {Promise<boolean>} True if configuration exists
   */
  async hasConfig(platform) {
    try {
      await this.loadConfig(platform);
      return true;
    } catch (error) {
      if (error.code === 'CONFIG_ERROR') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get all supported platforms
   * @returns {string[]} Array of supported platforms
   */
  getSupportedPlatforms() {
    return PlatformFactory.getSupportedPlatforms();
  }

  /**
   * Clear cached configurations
   */
  clearCache() {
    this.configs.clear();
  }
}

module.exports = ConfigManager;