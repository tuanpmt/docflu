const chalk = require('chalk');
const CONSTANTS = require('../constants');

/**
 * Performance monitoring utility
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      startTime: 0,
      endTime: 0,
      duration: 0,
      memoryUsage: {},
      apiCalls: 0,
      filesProcessed: 0,
      errorsCount: 0,
      operations: new Map()
    };
  }

  /**
   * Start performance monitoring
   */
  start() {
    this.metrics.startTime = Date.now();
    this.metrics.memoryUsage = process.memoryUsage();
  }

  /**
   * Stop performance monitoring
   */
  stop() {
    this.metrics.endTime = Date.now();
    this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
  }

  /**
   * Start timing an operation
   * @param {string} operation - Operation name
   */
  startOperation(operation) {
    this.metrics.operations.set(operation, {
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      count: (this.metrics.operations.get(operation)?.count || 0) + 1
    });
  }

  /**
   * End timing an operation
   * @param {string} operation - Operation name
   */
  endOperation(operation) {
    const op = this.metrics.operations.get(operation);
    if (op) {
      op.endTime = Date.now();
      op.duration = op.endTime - op.startTime;
    }
  }

  /**
   * Increment API call counter
   */
  incrementApiCalls() {
    this.metrics.apiCalls++;
  }

  /**
   * Increment files processed counter
   */
  incrementFilesProcessed() {
    this.metrics.filesProcessed++;
  }

  /**
   * Increment errors counter
   */
  incrementErrors() {
    this.metrics.errorsCount++;
  }

  /**
   * Get current metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      memoryUsage: process.memoryUsage(),
      operations: Object.fromEntries(this.metrics.operations)
    };
  }

  /**
   * Print performance report
   */
  printReport() {
    const metrics = this.getMetrics();
    
    console.log(chalk.cyan('\n📊 Performance Report'));
    console.log(chalk.gray('═'.repeat(50)));
    
    console.log(chalk.blue('⏱️  Duration:'), this.formatDuration(metrics.duration));
    console.log(chalk.blue('📤 API Calls:'), metrics.apiCalls);
    console.log(chalk.blue('📄 Files Processed:'), metrics.filesProcessed);
    console.log(chalk.blue('❌ Errors:'), metrics.errorsCount);
    
    console.log(chalk.blue('💾 Memory Usage:'));
    console.log(`  ${chalk.gray('Heap Used:')} ${this.formatBytes(metrics.memoryUsage.heapUsed)}`);
    console.log(`  ${chalk.gray('Heap Total:')} ${this.formatBytes(metrics.memoryUsage.heapTotal)}`);
    console.log(`  ${chalk.gray('External:')} ${this.formatBytes(metrics.memoryUsage.external)}`);
    
    if (metrics.operations && Object.keys(metrics.operations).length > 0) {
      console.log(chalk.blue('🔧 Operations:'));
      Object.entries(metrics.operations).forEach(([name, op]) => {
        console.log(`  ${chalk.gray(name)}: ${this.formatDuration(op.duration)} (${op.count}x)`);
      });
    }
    
    console.log(chalk.gray('═'.repeat(50)));
  }

  /**
   * Format duration in milliseconds
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Save metrics to file
   * @param {string} filePath - Path to save metrics
   */
  async saveMetrics(filePath) {
    const fs = require('fs-extra');
    const metrics = this.getMetrics();
    
    await fs.writeJson(filePath, metrics, { spaces: 2 });
  }

  /**
   * Load metrics from file
   * @param {string} filePath - Path to load metrics from
   * @returns {Promise<Object>} Loaded metrics
   */
  async loadMetrics(filePath) {
    const fs = require('fs-extra');
    
    if (await fs.pathExists(filePath)) {
      return await fs.readJson(filePath);
    }
    
    return null;
  }
}

module.exports = PerformanceMonitor;