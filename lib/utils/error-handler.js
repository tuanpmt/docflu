const chalk = require('chalk');

/**
 * Centralized error handling utility
 */
class ErrorHandler {
  /**
   * Handle and log errors consistently
   * @param {Error} error - The error to handle
   * @param {string} context - Optional context for the error
   */
  static handle(error, context = '') {
    const errorInfo = this.formatError(error);
    console.error(chalk.red('❌ Error' + (context ? ` (${context})` : '') + ':'), errorInfo);
    
    if (process.env.DEBUG) {
      console.error(chalk.gray('Stack trace:'), error.stack);
    }
  }

  /**
   * Format error message consistently
   * @param {Error} error - The error to format
   * @returns {string} Formatted error message
   */
  static formatError(error) {
    return error.response?.data?.message || error.message;
  }

  /**
   * Create a custom error with error code
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @returns {Error} Custom error with code
   */
  static createError(message, code = 'GENERAL_ERROR') {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  /**
   * Create validation error
   * @param {string} field - Field name
   * @param {string} value - Field value
   * @returns {Error} Validation error
   */
  static createValidationError(field, value) {
    return this.createError(`Invalid ${field}: ${value}`, 'VALIDATION_ERROR');
  }

  /**
   * Create configuration error
   * @param {string} message - Configuration error message
   * @returns {Error} Configuration error
   */
  static createConfigError(message) {
    return this.createError(message, 'CONFIG_ERROR');
  }

  /**
   * Create network error
   * @param {string} message - Network error message
   * @returns {Error} Network error
   */
  static createNetworkError(message) {
    return this.createError(message, 'NETWORK_ERROR');
  }
}

module.exports = ErrorHandler;