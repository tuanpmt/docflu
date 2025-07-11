const path = require('path');
const fs = require('fs-extra');
const CONSTANTS = require('../constants');
const ErrorHandler = require('./error-handler');

/**
 * Utility functions for common operations
 */
class Utils {
  /**
   * Check if file exists
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} True if file exists
   */
  static async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if file is markdown
   * @param {string} filePath - Path to file
   * @returns {boolean} True if file is markdown
   */
  static isMarkdownFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === CONSTANTS.EXTENSIONS.MARKDOWN || ext === CONSTANTS.EXTENSIONS.MDX;
  }

  /**
   * Check if file is image
   * @param {string} filePath - Path to file
   * @returns {boolean} True if file is image
   */
  static isImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return [
      CONSTANTS.EXTENSIONS.PNG,
      CONSTANTS.EXTENSIONS.JPG,
      CONSTANTS.EXTENSIONS.JPEG,
      CONSTANTS.EXTENSIONS.GIF,
      CONSTANTS.EXTENSIONS.WEBP,
      CONSTANTS.EXTENSIONS.SVG
    ].includes(ext);
  }

  /**
   * Normalize file path
   * @param {string} filePath - Path to normalize
   * @returns {string} Normalized path
   */
  static normalizePath(filePath) {
    return path.normalize(filePath).replace(/\\/g, '/');
  }

  /**
   * Get relative path from project root
   * @param {string} filePath - Absolute file path
   * @param {string} projectRoot - Project root directory
   * @returns {string} Relative path
   */
  static getRelativePath(filePath, projectRoot) {
    return path.relative(projectRoot, filePath);
  }

  /**
   * Ensure directory exists
   * @param {string} dirPath - Directory path
   * @returns {Promise<void>}
   */
  static async ensureDir(dirPath) {
    await fs.ensureDir(dirPath);
  }

  /**
   * Get file size in bytes
   * @param {string} filePath - Path to file
   * @returns {Promise<number>} File size in bytes
   */
  static async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      throw ErrorHandler.createError(`Unable to get file size for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Check if file size is within limits
   * @param {string} filePath - Path to file
   * @param {number} maxSize - Maximum allowed size in bytes
   * @returns {Promise<boolean>} True if file size is within limits
   */
  static async isFileSizeValid(filePath, maxSize) {
    const size = await this.getFileSize(filePath);
    return size <= maxSize;
  }

  /**
   * Generate unique ID
   * @returns {string} Unique ID
   */
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {number} maxAttempts - Maximum number of attempts
   * @param {number} initialDelay - Initial delay in milliseconds
   * @returns {Promise<any>} Function result
   */
  static async retry(fn, maxAttempts = CONSTANTS.RETRY.MAX_ATTEMPTS, initialDelay = CONSTANTS.RETRY.INITIAL_DELAY) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        const delay = initialDelay * Math.pow(CONSTANTS.RETRY.BACKOFF_FACTOR, attempt - 1);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Sanitize filename for safe usage
   * @param {string} filename - Filename to sanitize
   * @returns {string} Sanitized filename
   */
  static sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  /**
   * Get timestamp string
   * @returns {string} Timestamp string
   */
  static getTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  /**
   * Deep clone object
   * @param {Object} obj - Object to clone
   * @returns {Object} Cloned object
   */
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Check if string is empty or whitespace
   * @param {string} str - String to check
   * @returns {boolean} True if string is empty or whitespace
   */
  static isEmpty(str) {
    return !str || str.trim().length === 0;
  }

  /**
   * Truncate string to specified length
   * @param {string} str - String to truncate
   * @param {number} length - Maximum length
   * @returns {string} Truncated string
   */
  static truncate(str, length) {
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
  }
}

module.exports = Utils;