const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class StateManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.stateDir = path.join(projectRoot, '.docuflu');
    this.stateFile = path.join(this.stateDir, 'sync-state.json');
    this.state = null;
  }

  /**
   * Initialize state directory and file
   */
  async init() {
    await fs.ensureDir(this.stateDir);
    
    if (!await fs.pathExists(this.stateFile)) {
      await this.createDefaultState();
    }

    await this.loadState();
  }

  /**
   * Create default state structure
   */
  async createDefaultState() {
    const defaultState = {
      version: '1.0.0',
      lastSync: null,
      pages: {},
      stats: {
        totalPages: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0
      },
      configuration: {
        excludePatterns: [],
        lastConfigCheck: new Date().toISOString()
      }
    };

    await fs.writeJson(this.stateFile, defaultState, { spaces: 2 });
    console.log(chalk.green('✓ Created .docuflu/sync-state.json'));
  }

  /**
   * Load state from file
   */
  async loadState() {
    try {
      this.state = await fs.readJson(this.stateFile);
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Failed to load state, creating new one'));
      await this.createDefaultState();
      this.state = await fs.readJson(this.stateFile);
    }
  }

  /**
   * Save state to file
   */
  async saveState() {
    try {
      await fs.writeJson(this.stateFile, this.state, { spaces: 2 });
    } catch (error) {
      console.error(chalk.red(`✗ Failed to save state: ${error.message}`));
    }
  }

  /**
   * Get page state by file path
   */
  getPageState(filePath) {
    return this.state.pages[filePath] || null;
  }

  /**
   * Set page state
   */
  setPageState(filePath, pageData) {
    this.state.pages[filePath] = {
      ...pageData,
      lastSync: new Date().toISOString()
    };
  }

  /**
   * Remove page state
   */
  removePageState(filePath) {
    delete this.state.pages[filePath];
  }

  /**
   * Check if page needs sync (modified since last sync)
   */
  needsSync(filePath, lastModified) {
    const pageState = this.getPageState(filePath);
    
    if (!pageState) {
      return true; // New file
    }

    if (!pageState.lastSync) {
      return true; // Never synced
    }

    const lastSyncTime = new Date(pageState.lastSync);
    const fileModTime = new Date(lastModified);

    return fileModTime > lastSyncTime;
  }

  /**
   * Update sync statistics
   */
  updateStats(operation) {
    this.state.stats[operation] = (this.state.stats[operation] || 0) + 1;
    this.state.lastSync = new Date().toISOString();
  }

  /**
   * Reset statistics for new sync
   */
  resetStats() {
    this.state.stats = {
      totalPages: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0
    };
  }

  /**
   * Get sync summary
   */
  getSyncSummary() {
    const { stats } = this.state;
    const processed = stats.created + stats.updated + stats.failed;
    const total = processed + stats.skipped;

    return {
      total,
      processed,
      created: stats.created,
      updated: stats.updated,
      skipped: stats.skipped,
      failed: stats.failed,
      lastSync: this.state.lastSync
    };
  }

  /**
   * Get all tracked pages
   */
  getAllPages() {
    return this.state.pages;
  }

  /**
   * Get pages by category
   */
  getPagesByCategory(category) {
    return Object.entries(this.state.pages)
      .filter(([_, page]) => page.category === category)
      .map(([filePath, page]) => ({ filePath, ...page }));
  }

  /**
   * Clean up orphaned pages (files that no longer exist)
   */
  async cleanupOrphanedPages(existingFiles) {
    const existingSet = new Set(existingFiles);
    const trackedFiles = Object.keys(this.state.pages);
    
    let cleanedCount = 0;
    
    for (const filePath of trackedFiles) {
      if (!existingSet.has(filePath)) {
        delete this.state.pages[filePath];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(chalk.blue(`🧹 Cleaned up ${cleanedCount} orphaned page(s)`));
      await this.saveState();
    }

    return cleanedCount;
  }

  /**
   * Export state for backup
   */
  async exportState(outputPath) {
    const backupData = {
      ...this.state,
      exportDate: new Date().toISOString(),
      exportVersion: '1.0.0'
    };

    await fs.writeJson(outputPath, backupData, { spaces: 2 });
    console.log(chalk.green(`✓ State exported to ${outputPath}`));
  }

  /**
   * Import state from backup
   */
  async importState(inputPath) {
    try {
      const importedState = await fs.readJson(inputPath);
      
      // Validate basic structure
      if (!importedState.pages || !importedState.stats) {
        throw new Error('Invalid state file format');
      }

      this.state = {
        version: importedState.version || '1.0.0',
        lastSync: importedState.lastSync,
        pages: importedState.pages,
        stats: importedState.stats,
        configuration: importedState.configuration || {}
      };

      await this.saveState();
      console.log(chalk.green(`✓ State imported from ${inputPath}`));
    } catch (error) {
      console.error(chalk.red(`✗ Failed to import state: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get state file path
   */
  getStateFilePath() {
    return this.stateFile;
  }

  /**
   * Check if state directory exists
   */
  async exists() {
    return await fs.pathExists(this.stateFile);
  }
}

module.exports = StateManager; 