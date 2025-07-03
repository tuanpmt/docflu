const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const chalk = require('chalk');

/**
 * Notion State Manager
 * Handles state tracking for incremental sync and hierarchy management
 */
class NotionState {
  constructor(projectRoot, config) {
    this.projectRoot = projectRoot;
    this.config = config;
    this.stateFile = path.join(projectRoot, '.docflu', 'notion-state.json');
    this.state = {
      version: '1.0.0',
      rootPageId: config.rootPageId,
      lastSync: null,
      pages: {}, // filePath -> { pageId, lastModified, hash, title }
      hierarchy: {}, // path -> pageId (for directory pages)
      files: {}, // uploaded files cache
      statistics: {
        totalSyncs: 0,
        lastSyncDuration: 0,
        totalPages: 0,
        totalBlocks: 0
      },
      metadata: {}
    };
    
    this.loadState();
  }

  /**
   * Load state from file
   */
  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const stateData = fs.readJsonSync(this.stateFile);
        this.state = { ...this.state, ...stateData };
        
        // Validate root page ID
        if (this.state.rootPageId !== this.config.rootPageId) {
          console.log(chalk.yellow('⚠️ Root page ID changed, resetting state'));
          this.resetState();
        }
      } else {
        // Create state directory if it doesn't exist
        fs.ensureDirSync(path.dirname(this.stateFile));
        this.saveState();
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not load state file: ${error.message}`));
      console.log(chalk.blue('🔄 Starting with fresh state'));
      this.resetState();
    }
  }

  /**
   * Save state to file
   */
  saveState() {
    try {
      fs.ensureDirSync(path.dirname(this.stateFile));
      fs.writeJsonSync(this.stateFile, this.state, { spaces: 2 });
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not save state: ${error.message}`));
    }
  }

  /**
   * Reset state (clear all tracking data)
   */
  resetState() {
    this.state = {
      version: '1.0.0',
      rootPageId: this.config.rootPageId,
      lastSync: null,
      pages: {},
      hierarchy: {},
      files: {},
      statistics: {
        totalSyncs: 0,
        lastSyncDuration: 0,
        totalPages: 0,
        totalBlocks: 0
      },
      metadata: {}
    };
    this.saveState();
  }

  // Page Management

  /**
   * Get page ID for a file path
   * @param {string} filePath - File path
   * @returns {string|null} Page ID or null
   */
  getPageId(filePath) {
    return this.state.pages[filePath]?.pageId || null;
  }

  /**
   * Get page data for a file path
   * @param {string} filePath - File path
   * @returns {Object|null} Page data or null
   */
  getPageData(filePath) {
    return this.state.pages[filePath] || null;
  }

  /**
   * Set page ID for a file path
   * @param {string} filePath - File path
   * @param {string} pageId - Page ID
   * @param {Object} metadata - Additional metadata
   */
  setPageId(filePath, pageId, metadata = {}) {
    if (!this.state.pages[filePath]) {
      this.state.pages[filePath] = {};
    }
    
    this.state.pages[filePath].pageId = pageId;
    this.state.pages[filePath].lastModified = new Date().toISOString();
    
    // Add metadata
    Object.assign(this.state.pages[filePath], metadata);
    
    this.saveState();
  }

  /**
   * Remove page tracking
   * @param {string} filePath - File path
   */
  removePage(filePath) {
    delete this.state.pages[filePath];
    this.saveState();
  }

  /**
   * Check if file needs sync based on hash
   * @param {string} filePath - File path
   * @param {string} currentHash - Current file hash
   * @returns {boolean} True if sync needed
   */
  needsSync(filePath, currentHash) {
    const pageData = this.state.pages[filePath];
    if (!pageData || !pageData.pageId) {
      return true; // New file
    }
    
    return pageData.hash !== currentHash;
  }

  /**
   * Update file hash after sync
   * @param {string} filePath - File path
   * @param {string} hash - File hash
   * @param {Object} metadata - Additional metadata
   */
  updateFileHash(filePath, hash, metadata = {}) {
    if (!this.state.pages[filePath]) {
      this.state.pages[filePath] = {};
    }
    
    this.state.pages[filePath].hash = hash;
    this.state.pages[filePath].lastSync = new Date().toISOString();
    
    // Add metadata
    Object.assign(this.state.pages[filePath], metadata);
    
    this.saveState();
  }

  /**
   * Get all tracked pages
   * @returns {Object} Pages object
   */
  getAllPages() {
    return { ...this.state.pages };
  }

  // Hierarchy Management

  /**
   * Get hierarchy page ID for a path
   * @param {string} pathKey - Path key (e.g., 'docs/tutorial-basics')
   * @returns {string|null} Page ID or null
   */
  getHierarchyPageId(pathKey) {
    return this.state.hierarchy[pathKey] || null;
  }

  /**
   * Set hierarchy page ID for a path
   * @param {string} pathKey - Path key
   * @param {string} pageId - Page ID
   */
  setHierarchyPageId(pathKey, pageId) {
    this.state.hierarchy[pathKey] = pageId;
    this.saveState();
  }

  /**
   * Remove hierarchy page ID
   * @param {string} pathKey - Path key
   */
  removeHierarchyPageId(pathKey) {
    delete this.state.hierarchy[pathKey];
    this.saveState();
  }

  /**
   * Get hierarchy map
   * @returns {Object} Hierarchy map
   */
  getHierarchyMap() {
    return { ...this.state.hierarchy };
  }

  // File Upload Management

  /**
   * Get uploaded file URL by hash
   * @param {string} fileHash - File hash
   * @returns {string|null} File URL or null
   */
  getUploadedFileUrl(fileHash) {
    return this.state.files[fileHash]?.url || null;
  }

  /**
   * Get uploaded file data by hash
   * @param {string} fileHash - File hash
   * @returns {Object|null} File data or null
   */
  getUploadedFileData(fileHash) {
    return this.state.files[fileHash] || null;
  }

  /**
   * Set uploaded file URL
   * @param {string} fileHash - File hash
   * @param {string} url - File URL
   * @param {Object} metadata - File metadata
   */
  setUploadedFileUrl(fileHash, url, metadata = {}) {
    this.state.files[fileHash] = {
      url,
      uploadedAt: new Date().toISOString(),
      ...metadata
    };
    this.saveState();
  }

  /**
   * Remove uploaded file
   * @param {string} fileHash - File hash
   */
  removeUploadedFile(fileHash) {
    delete this.state.files[fileHash];
    this.saveState();
  }

  /**
   * Clean up expired cache entries
   * @param {number} expiryMinutes - Cache expiry in minutes (default: 10)
   * @returns {number} Number of entries removed
   */
  cleanupExpiredCache(expiryMinutes = 10) {
    const now = new Date();
    const expiredHashes = [];
    
    for (const [fileHash, fileData] of Object.entries(this.state.files)) {
      if (fileData.uploadedAt) {
        const uploadTime = new Date(fileData.uploadedAt);
        const diffMinutes = (now - uploadTime) / (1000 * 60);
        
        if (diffMinutes >= expiryMinutes) {
          expiredHashes.push(fileHash);
        }
      }
    }
    
    // Remove expired entries
    for (const hash of expiredHashes) {
      delete this.state.files[hash];
    }
    
    if (expiredHashes.length > 0) {
      console.log(chalk.blue(`🧹 Cleaned up ${expiredHashes.length} expired cache entries`));
      this.saveState();
    }
    
    return expiredHashes.length;
  }

  /**
   * Get cache statistics with expiry info
   * @param {number} expiryMinutes - Cache expiry in minutes (default: 10)
   * @returns {Object} Cache statistics
   */
  getCacheStatistics(expiryMinutes = 10) {
    const now = new Date();
    let validEntries = 0;
    let expiredEntries = 0;
    let totalSize = 0;
    
    for (const fileData of Object.values(this.state.files)) {
      if (fileData.uploadedAt) {
        const uploadTime = new Date(fileData.uploadedAt);
        const diffMinutes = (now - uploadTime) / (1000 * 60);
        
        if (diffMinutes < expiryMinutes) {
          validEntries++;
          totalSize += fileData.size || 0;
        } else {
          expiredEntries++;
        }
      }
    }
    
    return {
      totalEntries: Object.keys(this.state.files).length,
      validEntries,
      expiredEntries,
      totalSize,
      expiryMinutes
    };
  }

  /**
   * Get all uploaded files
   * @returns {Object} Files object
   */
  getAllUploadedFiles() {
    return { ...this.state.files };
  }

  // Statistics

  /**
   * Update sync statistics
   * @param {Object} stats - Statistics update
   */
  updateStatistics(stats) {
    Object.assign(this.state.statistics, stats);
    this.state.lastSync = new Date().toISOString();
    this.state.statistics.totalSyncs++;
    this.saveState();
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    return { ...this.state.statistics };
  }

  // Utility Methods

  /**
   * Calculate file hash
   * @param {string} filePath - File path (relative or absolute)
   * @returns {string} File hash
   */
  calculateFileHash(filePath) {
    try {
      // Resolve path relative to project root if not absolute
      let fullPath;
      if (path.isAbsolute(filePath)) {
        fullPath = filePath;
      } else if (filePath.startsWith('docs/')) {
        // Path already has docs/ prefix
        fullPath = path.resolve(this.projectRoot, filePath);
      } else {
        // For relative paths without docs/ prefix, assume they're in docs/ directory
        // This matches the behavior in notion-sync.js processFile method
        fullPath = path.resolve(this.projectRoot, 'docs', filePath);
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not calculate hash for ${filePath}: ${error.message}`));
      return null;
    }
  }

  /**
   * Calculate content hash
   * @param {string} content - Content string
   * @returns {string} Content hash
   */
  calculateContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get files that need sync
   * @param {Array<string>} filePaths - Array of file paths
   * @returns {Array<string>} Files that need sync
   */
  getFilesNeedingSync(filePaths) {
    const needSync = [];
    
    for (const filePath of filePaths) {
      const currentHash = this.calculateFileHash(filePath);
      
      // If we can't calculate hash, assume file needs sync (safer approach)
      if (!currentHash) {
        console.warn(chalk.yellow(`⚠️ Could not calculate hash for ${filePath}, will sync anyway`));
        needSync.push(filePath);
        continue;
      }
      
      // Check if file needs sync based on hash comparison
      if (this.needsSync(filePath, currentHash)) {
        needSync.push(filePath);
      }
    }
    
    return needSync;
  }

  /**
   * Clean up orphaned state entries
   * @param {Array<string>} existingFiles - Array of existing file paths
   */
  cleanupOrphanedEntries(existingFiles) {
    const existingSet = new Set(existingFiles);
    const orphanedPages = [];
    
    // Clean up page entries
    for (const filePath of Object.keys(this.state.pages)) {
      if (!existingSet.has(filePath)) {
        orphanedPages.push(filePath);
        delete this.state.pages[filePath];
      }
    }
    
    if (orphanedPages.length > 0) {
      console.log(chalk.blue(`🧹 Cleaned up ${orphanedPages.length} orphaned page entries`));
      this.saveState();
    }
  }

  /**
   * Generate sync report
   * @returns {Object} Sync report
   */
  generateSyncReport() {
    const totalPages = Object.keys(this.state.pages).length;
    const totalHierarchy = Object.keys(this.state.hierarchy).length;
    const totalFiles = Object.keys(this.state.files).length;
    
    return {
      totalPages,
      totalHierarchy,
      totalFiles,
      lastSync: this.state.lastSync,
      statistics: this.state.statistics
    };
  }

  /**
   * Export state for debugging
   * @returns {Object} State object
   */
  exportState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Get state file path
   * @returns {string} State file path
   */
  getStateFilePath() {
    return this.stateFile;
  }

  /**
   * Set metadata value
   * @param {string} key - Metadata key
   * @param {any} value - Metadata value
   */
  setMetadata(key, value) {
    if (!this.state.metadata) {
      this.state.metadata = {};
    }
    this.state.metadata[key] = value;
    this.saveState();
  }

  /**
   * Get metadata value
   * @param {string} key - Metadata key
   * @returns {any} Metadata value
   */
  getMetadata(key) {
    return this.state.metadata?.[key] || null;
  }

  /**
   * Remove metadata value
   * @param {string} key - Metadata key
   */
  removeMetadata(key) {
    if (this.state.metadata && this.state.metadata[key]) {
      delete this.state.metadata[key];
      this.saveState();
    }
  }

  /**
   * Get all metadata
   * @returns {Object} All metadata
   */
  getAllMetadata() {
    return this.state.metadata || {};
  }
}

module.exports = NotionState; 