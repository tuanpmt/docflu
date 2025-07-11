const ErrorHandler = require('../../utils/error-handler');

/**
 * Abstract base class for all platform clients
 */
class BaseClient {
  /**
   * @param {Object} config - Platform configuration
   */
  constructor(config) {
    this.config = config;
    this.validateConfig();
  }

  /**
   * Test connection to the platform
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    throw new Error('testConnection method must be implemented by subclass');
  }

  /**
   * Validate configuration
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    if (!this.config) {
      throw ErrorHandler.createConfigError('Configuration is required');
    }
  }

  /**
   * Format error message consistently
   * @param {Error} error - The error to format
   * @returns {string} Formatted error message
   */
  formatError(error) {
    return ErrorHandler.formatError(error);
  }

  /**
   * Handle rate limiting
   * @param {Function} requestFn - Function to execute
   * @returns {Promise} Request result
   */
  async makeRequest(requestFn) {
    return await requestFn();
  }

  /**
   * Get platform-specific configuration
   * @returns {Object} Platform configuration
   */
  getConfig() {
    return this.config;
  }
}

module.exports = BaseClient;