const StateManager = require('../state-manager');
const ErrorHandler = require('../../utils/error-handler');

/**
 * Abstract base class for all platform sync operations
 */
class BaseSync {
  /**
   * @param {string} projectRoot - Project root directory
   * @param {string} platform - Platform name
   * @param {Object} config - Platform configuration
   */
  constructor(projectRoot, platform, config) {
    this.projectRoot = projectRoot;
    this.platform = platform;
    this.config = config;
    this.stateManager = new StateManager(projectRoot, platform);
  }

  /**
   * Initialize sync operation
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.stateManager.init();
  }

  /**
   * Sync content to platform
   * @param {Object} options - Sync options
   * @returns {Promise<void>}
   */
  async sync(options) {
    throw new Error('sync method must be implemented by subclass');
  }

  /**
   * Process markdown file
   * @param {string} filePath - Path to markdown file
   * @returns {Promise<Object>} Processed content
   */
  async processMd(filePath) {
    throw new Error('processMd method must be implemented by subclass');
  }

  /**
   * Validate sync options
   * @param {Object} options - Sync options
   * @throws {Error} If options are invalid
   */
  validateSyncOptions(options) {
    if (!options) {
      throw ErrorHandler.createValidationError('options', 'null');
    }
  }

  /**
   * Get sync statistics
   * @returns {Object} Sync statistics
   */
  getStats() {
    return this.stateManager.getStats();
  }

  /**
   * Handle sync errors
   * @param {Error} error - Error to handle
   * @param {string} context - Error context
   */
  handleError(error, context) {
    ErrorHandler.handle(error, context);
  }
}

module.exports = BaseSync;