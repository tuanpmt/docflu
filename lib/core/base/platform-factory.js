const CONSTANTS = require('../../constants');
const ConfluenceClient = require('../confluence-client');
const GoogleDocsClient = require('../gdocs/google-docs-client');
const NotionClient = require('../notion/notion-client');
const ErrorHandler = require('../../utils/error-handler');

/**
 * Factory class for creating platform-specific clients and sync objects
 */
class PlatformFactory {
  /**
   * Create platform-specific client
   * @param {string} platform - Platform name
   * @param {Object} config - Platform configuration
   * @returns {BaseClient} Platform client instance
   */
  static createClient(platform, config) {
    switch (platform) {
      case CONSTANTS.PLATFORMS.CONFLUENCE:
        return new ConfluenceClient(config);
      case CONSTANTS.PLATFORMS.GOOGLE_DOCS:
        return new GoogleDocsClient(config);
      case CONSTANTS.PLATFORMS.NOTION:
        return new NotionClient(config);
      default:
        throw ErrorHandler.createValidationError('platform', platform);
    }
  }

  /**
   * Create platform-specific sync instance
   * @param {string} platform - Platform name
   * @param {string} projectRoot - Project root directory
   * @param {Object} config - Platform configuration
   * @returns {BaseSync} Platform sync instance
   */
  static createSync(platform, projectRoot, config) {
    // Note: This would require refactoring sync classes to extend BaseSync
    // For now, we'll keep the existing structure and add this as a future improvement
    switch (platform) {
      case CONSTANTS.PLATFORMS.CONFLUENCE:
        // Would return new ConfluenceSync(projectRoot, config)
        throw new Error('ConfluenceSync not yet refactored to use BaseSync');
      case CONSTANTS.PLATFORMS.GOOGLE_DOCS:
        // Would return new GoogleDocsSync(projectRoot, config)
        throw new Error('GoogleDocsSync not yet refactored to use BaseSync');
      case CONSTANTS.PLATFORMS.NOTION:
        // Would return new NotionSync(projectRoot, config)
        throw new Error('NotionSync not yet refactored to use BaseSync');
      default:
        throw ErrorHandler.createValidationError('platform', platform);
    }
  }

  /**
   * Get list of supported platforms
   * @returns {string[]} Array of supported platform names
   */
  static getSupportedPlatforms() {
    return Object.values(CONSTANTS.PLATFORMS);
  }

  /**
   * Check if platform is supported
   * @param {string} platform - Platform name to check
   * @returns {boolean} True if platform is supported
   */
  static isSupported(platform) {
    return this.getSupportedPlatforms().includes(platform);
  }

  /**
   * Get platform-specific default configuration
   * @param {string} platform - Platform name
   * @returns {Object} Default configuration
   */
  static getDefaultConfig(platform) {
    switch (platform) {
      case CONSTANTS.PLATFORMS.CONFLUENCE:
        return {
          baseUrl: '',
          username: '',
          apiToken: '',
          spaceKey: '',
          rootPageTitle: ''
        };
      case CONSTANTS.PLATFORMS.GOOGLE_DOCS:
        return {
          clientId: '',
          clientSecret: '',
          folderId: ''
        };
      case CONSTANTS.PLATFORMS.NOTION:
        return {
          apiToken: '',
          databaseId: ''
        };
      default:
        throw ErrorHandler.createValidationError('platform', platform);
    }
  }
}

module.exports = PlatformFactory;