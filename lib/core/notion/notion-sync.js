const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

// Core components
const NotionClient = require('./notion-client');
const NotionState = require('./notion-state');
const NotionHierarchyManager = require('./hierarchy-manager');
const MarkdownToBlocksConverter = require('./markdown-to-blocks');
const NotionDiagramProcessor = require('./diagram-processor');
const NotionImageProcessor = require('./image-processor');
const NotionAttachmentProcessor = require('./attachment-processor');

// Reuse existing components
const DocusaurusScanner = require('../docusaurus-scanner');
const MarkdownParser = require('../markdown-parser');

/**
 * Notion Sync Orchestrator
 * Main class that coordinates all Notion sync operations
 */
class NotionSync {
  constructor(config, projectRoot) {
    this.config = config;
    this.projectRoot = projectRoot;
    
    // Initialize components
    this.client = new NotionClient(config);
    this.state = new NotionState(projectRoot, config);
    this.hierarchyManager = new NotionHierarchyManager(this.client, this.state, projectRoot);
    
    // Initialize processors
    this.diagramProcessor = new NotionDiagramProcessor(this.client, this.state, config, config.notionApiToken);
    this.imageProcessor = new NotionImageProcessor(this.client, this.state, { ...config, projectRoot });
    this.attachmentProcessor = new NotionAttachmentProcessor(this.client, this.state, { ...config, projectRoot });
    this.markdownConverter = new MarkdownToBlocksConverter(this.imageProcessor, this.diagramProcessor, { ...config, projectRoot });
    
    // Set markdown converter for diagram processor to avoid circular dependency
    this.diagramProcessor.setMarkdownConverter(this.markdownConverter);
    
    // Set image processor for diagram processor to avoid circular dependency
    this.diagramProcessor.setImageProcessor(this.imageProcessor);
    
    // Reuse existing scanners
    this.scanner = new DocusaurusScanner(projectRoot);
    this.markdownParser = new MarkdownParser();
    
    // Sync statistics
    this.syncStats = {
      totalDocuments: 0,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * Initialize Notion sync
   */
  async initialize() {
    try {
      console.log(chalk.blue('🔄 Initializing Notion sync...'));
      
      // Test connection
      const connected = await this.client.testConnection();
      if (!connected) {
        throw new Error('Failed to connect to Notion API');
      }
      
      console.log(chalk.green('✓ Connected to Notion workspace'));
      
      // Clean up expired cache entries
      const cleanedCount = this.state.cleanupExpiredCache(10);
      if (cleanedCount > 0) {
        console.log(chalk.blue(`🧹 Cleaned up ${cleanedCount} expired cache entries`));
      }
      
      // Initialize processors
      await this.imageProcessor.cleanup();
      await this.diagramProcessor.cleanup();
      
      this.initialized = true;
      console.log(chalk.green('✓ Notion sync initialized'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize Notion sync:'), error.message);
      throw error;
    }
  }

  /**
   * Sync single file
   * @param {string} filePath - File path to sync
   * @param {Object} options - Sync options
   */
  async syncFile(filePath, options = {}) {
    try {
      this.syncStats.startTime = new Date();
      this.syncStats.totalDocuments = 1;
      
      console.log(chalk.blue(`🔄 Syncing file: ${filePath}`));
      
      // Resolve file path
      const fullPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.resolve(this.projectRoot, filePath);
      
      if (!await fs.pathExists(fullPath)) {
        throw new Error(`File not found: ${fullPath}`);
      }
      
      // Get relative path for state tracking
      let relativePath = path.relative(this.projectRoot, fullPath);
      
      // Normalize path to match docs sync format (remove docs/ prefix for consistency)
      if (relativePath.startsWith('docs/')) {
        relativePath = relativePath.substring(5); // Remove 'docs/' prefix
      }
      

      
      // Process file with force option only if explicitly requested
      // This allows --file to use incremental sync like --docs
      const fileOptions = { ...options, singleFile: true };
      const result = await this.processFile(relativePath, fileOptions);
      
      if (result.success) {
        if (result.skipped) {
          this.syncStats.skipped++;
        } else {
          this.syncStats.processed++;
          if (result.created) {
            this.syncStats.created++;
          }
          if (result.updated) {
            this.syncStats.updated++;
          }
        }
      } else {
        this.syncStats.failed++;
      }
      
      this.syncStats.endTime = new Date();
      
      // Generate sync report to save statistics
      this.generateSyncReport();
      
      console.log(chalk.green(`✓ File sync completed: ${filePath}`));
      
    } catch (error) {
      this.syncStats.failed++;
      this.syncStats.endTime = new Date();
      
      // Generate sync report even on failure to save statistics
      this.generateSyncReport();
      
      throw new Error(`File sync failed: ${error.message}`);
    }
  }

  /**
   * Sync specific directory
   * @param {string} dirPath - Directory path to sync
   * @param {Object} options - Sync options
   */
  async syncDirectory(dirPath, options = {}) {
    try {
      this.syncStats.startTime = new Date();
      
      console.log(chalk.blue(`🔄 Syncing directory: ${dirPath}`));
      
      // Validate directory path
      const targetDir = path.resolve(this.projectRoot, dirPath);
      
      if (!targetDir.startsWith(this.projectRoot)) {
        throw new Error('Directory must be within project root');
      }

      if (!await fs.pathExists(targetDir)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }

      // Scan for all markdown files then filter by directory
      await this.scanner.detectProject();
      const allDocuments = await this.scanner.scanDocs();
      
      // Filter documents by target directory
      const filteredDocuments = allDocuments.filter(doc => {
        const docPath = path.resolve(this.projectRoot, doc.filePath);
        return docPath.startsWith(targetDir);
      });

      const markdownFiles = filteredDocuments.map(doc => doc.relativePath);
      this.syncStats.totalDocuments = markdownFiles.length;
      
      if (markdownFiles.length === 0) {
        console.log(chalk.yellow(`⚠️ No markdown files found in directory: ${dirPath}`));
        return;
      }
      
      console.log(chalk.blue(`📁 Found ${markdownFiles.length} markdown files in ${dirPath}`));
      
      // Filter files that need sync - for directory sync, use incremental sync by default
      const filesToSync = options.force === true // Only force when explicitly requested
        ? markdownFiles 
        : this.state.getFilesNeedingSync(markdownFiles);
      
      if (filesToSync.length === 0) {
        console.log(chalk.green('✓ All files are up to date'));
        this.syncStats.skipped = markdownFiles.length;
        this.syncStats.endTime = new Date();
        return;
      }
      
      // Show sync plan
      console.log(chalk.blue(`🔄 Syncing ${filesToSync.length} files (${markdownFiles.length - filesToSync.length} skipped)`));
      this.syncStats.skipped = markdownFiles.length - filesToSync.length;
      
      if (options.dryRun) {
        console.log(chalk.yellow('\n📋 DRY RUN - Would sync these files:'));
        filesToSync.forEach((filePath, index) => {
          const title = this.extractTitleFromPath(filePath);
          console.log(`   📄 ${filePath} (${title})`);
        });
        return { success: true, dryRun: true, filesToSync };
      }
      
      // Process files with detailed batch progress
      console.log(chalk.blue('\n📝 Processing documents...'));
      
      for (let i = 0; i < filesToSync.length; i++) {
        const filePath = filesToSync[i];
        const progress = `(${i + 1}/${filesToSync.length})`;
        
        try {
          // Extract title for better logging
          const title = this.extractTitleFromPath(filePath);
          
          console.log(chalk.cyan(`🔄 ${progress} Processing ${title}...`));
          
          const result = await this.processFile(filePath, options);
          
          if (result.success) {
            if (result.dryRun) {
              // For dry run, count as processed
              this.syncStats.processed++;
              console.log(chalk.blue(`📊 ${progress} ✅ ${title} (${result.totalBlocks} blocks) [DRY RUN]`));
            } else if (result.skipped) {
              this.syncStats.skipped++;
            } else {
              this.syncStats.processed++;
              if (result.created) {
                this.syncStats.created++;
                console.log(chalk.green(`✨ ${progress} ✅ ${title} (${result.totalBlocks} blocks) [CREATED]`));
              } else {
                this.syncStats.updated++;
                console.log(chalk.green(`🔄 ${progress} ✅ ${title} (${result.totalBlocks} blocks) [REPLACED]`));
              }
            }
          } else {
            this.syncStats.failed++;
            console.log(chalk.red(`❌ ${progress} ❌ ${title} [FAILED]`));
          }
          
        } catch (error) {
          const title = this.extractTitleFromPath(filePath);
          console.error(chalk.red(`❌ ${progress} ❌ ${title}: ${error.message}`));
          this.syncStats.failed++;
        }
      }
      
      // Clean up orphaned entries (skip for dry run)
      if (!options.dryRun) {
        this.state.cleanupOrphanedEntries(markdownFiles);
      }
      
      this.syncStats.endTime = new Date();
      
      if (options.dryRun) {
        console.log(chalk.green('\n✓ Directory dry run completed'));
        console.log(chalk.yellow('⚠️ This was a dry run. No changes were made to Notion.'));
      } else {
        console.log(chalk.green('\n✓ Directory sync completed'));
      }
      
    } catch (error) {
      this.syncStats.endTime = new Date();
      throw new Error(`Directory sync failed: ${error.message}`);
    }
  }

  /**
   * Sync docs directory
   * @param {Object} options - Sync options
   */
  async syncDocs(options = {}) {
    try {
      this.syncStats.startTime = new Date();
      
      console.log(chalk.blue('🔄 Scanning for markdown files...'));
      
      // Scan for markdown files in docs directory
      await this.scanner.detectProject();
      const documents = await this.scanner.scanDocs();
      const markdownFiles = documents.map(doc => doc.relativePath); // Remove docs/ prefix
      this.syncStats.totalDocuments = markdownFiles.length;
      
      if (markdownFiles.length === 0) {
        console.log(chalk.yellow('⚠️ No markdown files found'));
        return;
      }
      
      console.log(chalk.blue(`📁 Found ${markdownFiles.length} markdown files`));
      
      // Filter files that need sync - for docs sync, use incremental sync by default
      const filesToSync = options.force === true // Only force when explicitly requested
        ? markdownFiles 
        : this.state.getFilesNeedingSync(markdownFiles);
      
      if (filesToSync.length === 0) {
        console.log(chalk.green('✓ All files are up to date'));
        this.syncStats.skipped = markdownFiles.length;
        this.syncStats.endTime = new Date();
        return;
      }
      
      // Show sync plan
      console.log(chalk.blue(`🔄 Syncing ${filesToSync.length} files (${markdownFiles.length - filesToSync.length} skipped)`));
      this.syncStats.skipped = markdownFiles.length - filesToSync.length;
      
      if (options.dryRun) {
        console.log(chalk.yellow('\n📋 DRY RUN - Would sync these files:'));
        filesToSync.forEach((filePath, index) => {
          const title = this.extractTitleFromPath(filePath);
          console.log(`   📄 ${filePath} (${title})`);
        });
        return { success: true, dryRun: true, filesToSync };
      }
      
      // Process files with detailed batch progress
      console.log(chalk.blue('\n📝 Processing documents...'));
      
      for (let i = 0; i < filesToSync.length; i++) {
        const filePath = filesToSync[i];
        const progress = `(${i + 1}/${filesToSync.length})`;
        
        try {
          // Extract title for better logging
          const title = this.extractTitleFromPath(filePath);
          
          console.log(chalk.cyan(`🔄 ${progress} Processing ${title}...`));
          
          const result = await this.processFile(filePath, options);
          
          if (result.success) {
            if (result.dryRun) {
              // For dry run, count as processed
              this.syncStats.processed++;
              console.log(chalk.blue(`📊 ${progress} ✅ ${title} (${result.totalBlocks} blocks) [DRY RUN]`));
            } else if (result.skipped) {
              this.syncStats.skipped++;
            } else {
              this.syncStats.processed++;
              if (result.created) {
                this.syncStats.created++;
                console.log(chalk.green(`✨ ${progress} ✅ ${title} (${result.totalBlocks} blocks) [CREATED]`));
              } else {
                this.syncStats.updated++;
                console.log(chalk.green(`🔄 ${progress} ✅ ${title} (${result.totalBlocks} blocks) [REPLACED]`));
              }
            }
          } else {
            this.syncStats.failed++;
            console.log(chalk.red(`❌ ${progress} ❌ ${title} [FAILED]`));
          }
          
        } catch (error) {
          const title = this.extractTitleFromPath(filePath);
          console.error(chalk.red(`❌ ${progress} ❌ ${title}: ${error.message}`));
          this.syncStats.failed++;
        }
      }
      
      // Clean up orphaned entries (skip for dry run)
      if (!options.dryRun) {
        this.state.cleanupOrphanedEntries(markdownFiles);
      }
      
      this.syncStats.endTime = new Date();
      
      if (options.dryRun) {
        console.log(chalk.green('\n✓ Docs dry run completed'));
        console.log(chalk.yellow('⚠️ This was a dry run. No changes were made to Notion.'));
      } else {
        console.log(chalk.green('\n✓ Docs sync completed'));
      }
      
    } catch (error) {
      this.syncStats.endTime = new Date();
      throw new Error(`Docs sync failed: ${error.message}`);
    }
  }

  /**
   * Validate hierarchy before sync to ensure all parent pages exist
   * @param {string} filePath - File path to validate hierarchy for
   * @returns {boolean} True if validation passed
   */
  async validateHierarchyForFile(filePath) {
    try {
      // Extract directory path from file path
      const pathSegments = filePath.split('/');
      const directorySegments = pathSegments.slice(0, -1); // Remove filename
      
      if (directorySegments.length === 0) {
        // File is in root, no hierarchy to validate
        return true;
      }
      
      // Skip 'docs' prefix if present
      const shouldSkipDocs = directorySegments[0] === 'docs';
      const startIndex = shouldSkipDocs ? 1 : 0;
      
      if (directorySegments.length <= startIndex) {
        // No hierarchy to validate after skipping docs
        return true;
      }
      
      // Check each level of hierarchy
      for (let i = startIndex; i < directorySegments.length; i++) {
        const pathSoFar = directorySegments.slice(startIndex, i + 1).join('/');
        const existingPageId = this.state.getHierarchyPageId(pathSoFar);
        
        if (existingPageId) {
          try {
            await this.client.retrievePage(existingPageId);

          } catch (error) {
            console.warn(chalk.yellow(`⚠️ Hierarchy page ${pathSoFar} (${existingPageId}) was deleted, will be recreated during sync`));
            // Remove invalid entry from state
            this.state.removeHierarchyPageId(pathSoFar);
          }
        }
      }
      
      return true;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Hierarchy validation failed for ${filePath}: ${error.message}`));
      return false;
    }
  }

  /**
   * Extract title from file path for better logging
   * @param {string} filePath - File path
   * @returns {string} Extracted title
   */
  extractTitleFromPath(filePath) {
    // Try to get title from state first (if file was synced before)
    const pageData = this.state.getPageData(filePath);
    if (pageData && pageData.title) {
      return pageData.title;
    }
    
    // Fallback to filename
    const fileName = path.basename(filePath, path.extname(filePath));
    return fileName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Process a single file
   * @param {string} filePath - Relative file path
   * @param {Object} options - Processing options
   * @returns {Object} Processing result
   */
  async processFile(filePath, options = {}) {
    try {
      // Check if file needs sync
      const currentHash = this.state.calculateFileHash(filePath);
      if (!currentHash) {
        throw new Error(`Could not calculate hash for ${filePath}`);
      }
      
      // Skip check only for docs sync (not for single file sync)
      if (!options.force && !options.singleFile && !this.state.needsSync(filePath, currentHash)) {
        return { success: true, skipped: true };
      }
      
      if (options.force) {
        console.log(chalk.blue(`  🔄 Force syncing: ${filePath}`));
      } else if (options.singleFile) {
        // Single file sync always processes but uses existing state
        const existingPageId = this.state.getPageId(filePath);
        if (existingPageId) {
          console.log(chalk.blue(`  🔄 Single file sync, updating existing page: ${filePath}`));
        } else {
          console.log(chalk.blue(`  🔄 Single file sync, creating new page: ${filePath}`));
        }
      } else {
        // Docs sync - only if file changed
        const existingPageId = this.state.getPageId(filePath);
        if (existingPageId) {
          console.log(chalk.blue(`  🔄 File changed, updating existing page: ${filePath}`));
        } else {
          console.log(chalk.blue(`  🔄 New file, creating page: ${filePath}`));
        }
      }
      
      // Read and parse markdown
      // For docs sync, files are relative to docs/ directory
      const fullPath = filePath.startsWith('docs/') 
        ? path.resolve(this.projectRoot, filePath)
        : path.resolve(this.projectRoot, 'docs', filePath);
      let markdownContent = await fs.readFile(fullPath, 'utf8');
      const frontmatter = this.markdownParser.extractFrontmatter(markdownContent);
      
      // Extract title
      const title = frontmatter.title || 
                   this.markdownParser.extractTitle(markdownContent) ||
                   path.basename(filePath, '.md');
      
      // Process attachments in content
      if (this.attachmentProcessor) {
        markdownContent = await this.attachmentProcessor.processAttachmentLinks(markdownContent, filePath, this.projectRoot, options.dryRun);
      }
      
      // Dry run mode - only preview, don't create actual pages
      if (options.dryRun) {
        console.log(chalk.yellow(`  🔍 DRY RUN: Analyzing file: ${filePath}`));
        
        // Check if markdown contains diagrams
        const hasDiagrams = this.containsDiagrams(markdownContent);
        
        let blocks;
        if (hasDiagrams) {
          // Use diagram processor for direct block conversion (no placeholders)
          blocks = await this.diagramProcessor.processMarkdownWithDiagrams(markdownContent, options.dryRun, this.projectRoot);
        } else {
          // Use regular markdown converter
          blocks = await this.markdownConverter.convertToBlocks(markdownContent);
          
          // Process images directly in blocks
          blocks = await this.processMediaInBlocks(blocks, options.dryRun);
        }
        
        // Insert file blocks at appropriate positions using marker-based approach
        blocks = this.insertFileBlocks(blocks);
        
        // Validate blocks
        const validBlocks = this.markdownConverter.validateBlocks(blocks);
        
        console.log(chalk.cyan(`  📄 Title: ${title}`));
        console.log(chalk.cyan(`  📁 Path: ${filePath}`));
        console.log(chalk.cyan(`  🧱 Blocks: ${validBlocks.length}`));
        console.log(chalk.cyan(`  📊 Has diagrams: ${hasDiagrams ? 'Yes' : 'No'}`));
        console.log(chalk.cyan(`  📎 Attachments: ${this.attachmentProcessor?.fileBlocksWithPositions?.length || 0}`));
        console.log(chalk.yellow(`  ⚠️ DRY RUN: No changes made to Notion`));
        
        return { 
          success: true, 
          dryRun: true,
          title,
          totalBlocks: validBlocks.length,
          hasDiagrams,
          attachments: this.attachmentProcessor?.fileBlocksWithPositions?.length || 0
        };
      }
      
      // Check if page exists before processing
      const existingPageId = this.state.getPageId(filePath);
      const hadExistingPage = !!existingPageId;
      
      // For force sync, single file sync, or docs sync with existing page - archive old page and create new
      if ((options.force || options.singleFile || hadExistingPage) && existingPageId) {
        try {
          await this.client.updatePage(existingPageId, {
            archived: true
          });
          if (options.singleFile) {
            console.log(chalk.yellow(`  🗑️ Archived old page to replace with new one: ${filePath}`));
          } else if (options.force) {
            console.log(chalk.yellow(`  🗑️ Force sync: Archived old page: ${filePath}`));
          } else {
            console.log(chalk.yellow(`  🗑️ Docs sync: Archived old page to replace with new one: ${filePath}`));
          }
        } catch (error) {
          console.warn(chalk.yellow(`  ⚠️ Could not archive old page: ${error.message}`));
        }
        this.state.removePage(filePath);
      }
      
      // Validate hierarchy before creating it
      await this.validateHierarchyForFile(filePath);
      
      // Create hierarchy and get parent page
      // Use nested mode for all sync modes to support proper hierarchy
      const flatMode = false; // Always use nested mode for consistent hierarchy support
      const parentPageId = await this.hierarchyManager.createPageHierarchy(filePath, this.config.rootPageId, flatMode);
      
      // Get or create content page (will always create new since we archived old one)
      const page = await this.hierarchyManager.getOrCreateContentPage(filePath, title, parentPageId);
      const isNewPage = !hadExistingPage;
      
      // Check if markdown contains diagrams
      const hasDiagrams = this.containsDiagrams(markdownContent);
      
      let blocks;
      if (hasDiagrams) {
        // Use diagram processor for direct block conversion (no placeholders)
        blocks = await this.diagramProcessor.processMarkdownWithDiagrams(markdownContent, options.dryRun, this.projectRoot);
      } else {
        // Use regular markdown converter
        blocks = await this.markdownConverter.convertToBlocks(markdownContent);
        
        // Process images directly in blocks
        blocks = await this.processMediaInBlocks(blocks, options.dryRun);
      }
      
      // Insert file blocks at appropriate positions using marker-based approach
      blocks = this.insertFileBlocks(blocks);
      
      // Validate blocks
      const validBlocks = this.markdownConverter.validateBlocks(blocks);
      
      if (validBlocks.length === 0) {
        console.log(chalk.yellow(`  ⚠️ No valid blocks generated for ${filePath}`));
        return { success: false };
      }
      
      // Since we now archive old pages for all sync modes, we don't need to clear content
      // All pages are fresh when we reach this point
      
      // Upload blocks in chunks
      const blockChunks = this.markdownConverter.chunkBlocks(validBlocks);
      let totalBlocks = 0;
      
      for (const chunk of blockChunks) {
        try {
          await this.client.appendBlocks(page.id, chunk);
          totalBlocks += chunk.length;
        } catch (error) {
          if (error.message.includes('archived') || error.code === 'object_not_found') {
            // Page became archived/deleted during upload, create new page
            console.log(chalk.yellow(`⚠️ Page became archived/deleted during upload, creating new page for: ${title}`));
            
            // Remove old page from state
            this.state.removePage(filePath);
            
            // Create new page
            const newPage = await this.hierarchyManager.getOrCreateContentPage(filePath, title, parentPageId);
            page.id = newPage.id;
            
            // Retry uploading to new page
            await this.client.appendBlocks(page.id, chunk);
            totalBlocks += chunk.length;
            
            console.log(chalk.green(`✅ Successfully uploaded to new page: ${title}`));
          } else if (error.code === 'validation_error') {
            throw new Error(`Validation error: ${error.message}`);
          } else {
            throw error;
          }
        }
      }
      
      // Update state
      this.state.setPageId(filePath, page.id, { title, totalBlocks });
      this.state.updateFileHash(filePath, currentHash, { 
        title, 
        totalBlocks,
        lastSync: new Date().toISOString()
      });
      
      // Since we archive old pages for all sync modes, all pages are effectively "Created"
      // Only truly new files (never synced before) are considered "Created", others are "Replaced"
      const action = isNewPage ? 'Created' : 'Replaced';
      console.log(chalk.green(`  ✓ ${action}: ${title} (${totalBlocks} blocks)`));
      
      return { 
        success: true, 
        created: isNewPage, 
        updated: !isNewPage, // Updated means "replaced" in this context
        title,
        totalBlocks 
      };
      
    } catch (error) {
      console.error(chalk.red(`  ❌ Processing failed: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if markdown contains diagrams
   * @param {string} markdown - Markdown content
   * @returns {boolean} True if contains diagrams
   */
  containsDiagrams(markdown) {
    const diagramPatterns = [
      /```mermaid\n/,
      /```plantuml\n/,
      /```dot\n/,
      /```graphviz\n/,
      /```d2\n/
    ];
    
    return diagramPatterns.some(pattern => pattern.test(markdown));
  }

  /**
   * Process media (images/diagrams) directly in blocks - NO PLACEHOLDERS
   * @param {Array} blocks - Array of blocks
   * @param {boolean} dryRun - Dry run flag
   * @returns {Array} Processed blocks
   */
  async processMediaInBlocks(blocks, dryRun) {
    const processedBlocks = [];
    
    for (const block of blocks) {
      if (block.type === 'paragraph' && block.paragraph.rich_text) {
        const richText = block.paragraph.rich_text;
        const newRichText = [];
        
        for (const textObj of richText) {
          let content = textObj.text.content;
          let processedContent = false;
          let lastIndex = 0;
          
          // Process all images in this text content
          const allMatches = [];
          
          // Find all markdown images
          const markdownMatches = [...content.matchAll(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g)];
          for (const match of markdownMatches) {
            allMatches.push({
              type: 'markdown',
              match: match,
              index: match.index,
              fullMatch: match[0],
              altText: match[1],
              imageUrl: match[2],
              title: match[3]
            });
          }
          
          // Find all HTML img tags
          const htmlMatches = [...content.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/g)];
          for (const match of htmlMatches) {
            const altMatch = match[0].match(/alt=["']([^"']+)["']/);
            allMatches.push({
              type: 'html',
              match: match,
              index: match.index,
              fullMatch: match[0],
              imageUrl: match[1],
              altText: altMatch ? altMatch[1] : ''
            });
          }
          
          // Sort matches by index to process in order
          allMatches.sort((a, b) => a.index - b.index);
          
          // Process each image match
          for (const imageMatch of allMatches) {
            // Add text before image
            const beforeText = content.substring(lastIndex, imageMatch.index);
            if (beforeText.trim()) {
              newRichText.push({ text: { content: beforeText } });
            }
            
            // Process image
            try {
              const imageBlock = await this.imageProcessor.processImageMarkdown(
                imageMatch.imageUrl, 
                '', 
                this.projectRoot, 
                dryRun
              );
              
              if (imageBlock) {
                processedBlocks.push(imageBlock);
              } else {
                // Fallback to text if processing failed
                const prefix = imageMatch.type === 'html' ? 'HTML Image' : 'Image';
                newRichText.push({ 
                  text: { content: imageMatch.altText ? `[${prefix}: ${imageMatch.altText}]` : `[${prefix}]` },
                  annotations: { italic: true, color: 'gray' }
                });
              }
              
            } catch (error) {
              console.log(chalk.red(`❌ Failed to process ${imageMatch.type} image ${imageMatch.imageUrl}: ${error.message}`));
              // Fallback to text
              const prefix = imageMatch.type === 'html' ? 'HTML Image' : 'Image';
              newRichText.push({ 
                text: { content: imageMatch.altText ? `[${prefix}: ${imageMatch.altText} - Upload failed]` : `[${prefix} - Upload failed]` },
                annotations: { italic: true, color: 'red' }
              });
            }
            
            // Update last processed index
            lastIndex = imageMatch.index + imageMatch.fullMatch.length;
            processedContent = true;
          }
          
          // Add any remaining text after all images
          const remainingText = content.substring(lastIndex);
          if (remainingText.trim()) {
            newRichText.push({ text: { content: remainingText } });
          } else if (!processedContent) {
            // No images found, keep original text object
            newRichText.push(textObj);
          }
        }
        
        // Add paragraph if it has content
        if (newRichText.length > 0) {
          processedBlocks.push({
            type: 'paragraph',
            paragraph: { rich_text: newRichText }
          });
        }
      } else if (block.type === 'code' && (block.code.language === 'mermaid' || block.code.language === 'plantuml' || block.code.language === 'dot')) {
        // Convert diagram code blocks to annotated text blocks
        const diagramType = block.code.language.toUpperCase();
        console.log(chalk.blue(`📊 Converting ${diagramType} diagram to code block`));
        processedBlocks.push({
          type: 'code',
          code: {
            rich_text: [{ text: { content: `[${diagramType} Diagram - External hosting required]\n\n${block.code.rich_text[0].text.content}` } }],
            language: 'plain text'
          }
        });
      } else {
        processedBlocks.push(block);
      }
    }
    
    return processedBlocks;
  }

  /**
   * Clear existing content from a page
   * @param {string} pageId - Page ID
   */
  async clearPageContent(pageId) {
    try {
      // First check if page exists and is accessible
      try {
        await this.client.retrievePage(pageId);
      } catch (error) {
        if (error.code === 'object_not_found') {
          throw new Error(`Page not found: ${pageId}`);
        }
        if (error.message.includes('archived')) {
          throw new Error(`Page is archived: ${pageId}`);
        }
        throw error;
      }
      
      let hasMore = true;
      let startCursor = null;
      let deletedCount = 0;
      
      while (hasMore) {
        const response = await this.client.retrieveBlockChildren(pageId, startCursor);
        
        // Delete blocks in reverse order to avoid index issues
        const blocksToDelete = response.results.reverse();
        
        for (const block of blocksToDelete) {
          try {
            await this.client.deleteBlock(block.id);
            deletedCount++;
          } catch (error) {
            // Skip blocks that can't be deleted (like archived blocks)
            if (!error.message.includes('archived')) {
              console.warn(chalk.yellow(`⚠️ Could not delete block ${block.id}: ${error.message}`));
            }
          }
        }
        
        hasMore = response.has_more;
        startCursor = response.next_cursor;
      }
      
    } catch (error) {
      if (error.message.includes('archived') || error.message.includes('Page not found')) {
        throw error; // Re-throw for handling in processFile
      }
      console.warn(chalk.yellow(`⚠️ Could not clear page content: ${error.message}`));
    }
  }

  /**
   * Generate sync report
   * @returns {Object} Sync report
   */
  generateSyncReport() {
    const duration = this.syncStats.endTime && this.syncStats.startTime
      ? this.syncStats.endTime - this.syncStats.startTime
      : 0;
    
    // Update state statistics
    this.state.updateStatistics({
      lastSyncDuration: duration,
      totalPages: this.syncStats.processed,
      totalBlocks: 0 // Will be calculated from individual files
    });
    
    return {
      ...this.syncStats,
      duration,
      success: this.syncStats.failed === 0
    };
  }

  /**
   * Get detailed statistics
   * @returns {Object} Detailed statistics
   */
  getDetailedStatistics() {
    const stateStats = this.state.getStatistics();
    const imageStats = this.imageProcessor.getStatistics();
    const diagramStats = this.diagramProcessor.getStatistics();
    
    return {
      sync: this.syncStats,
      state: stateStats,
      images: imageStats,
      diagrams: diagramStats,
      hierarchy: this.hierarchyManager.generateHierarchyTree()
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      await this.imageProcessor.cleanup();
      await this.diagramProcessor.cleanup();
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Cleanup failed: ${error.message}`));
    }
  }

  /**
   * Validate configuration
   * @returns {Object} Validation result
   */
  validateConfig() {
    const errors = [];
    
    if (!this.config.apiToken) {
      errors.push('NOTION_API_TOKEN is required');
    }
    
    // NOTION_ROOT_PAGE_ID is required for Internal Integration
    if (!this.config.rootPageId) {
      errors.push('NOTION_ROOT_PAGE_ID is required - Internal Integration cannot create workspace-level pages');
    } else {
      console.log(chalk.blue(`📄 Using provided root page: ${this.config.rootPageId}`));
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Test sync with dry run
   * @param {Object} options - Test options
   * @returns {Object} Test result
   */
  async testSync(options = {}) {
    try {
      console.log(chalk.blue('🧪 Running Notion sync test...'));
      
      // Validate configuration
      const configValidation = this.validateConfig();
      if (!configValidation.valid) {
        return {
          success: false,
          errors: configValidation.errors
        };
      }
      
      // Test connection
      const connected = await this.client.testConnection();
      if (!connected) {
        return {
          success: false,
          errors: ['Failed to connect to Notion API']
        };
      }
      
      // Test processors
      const processorAvailability = this.diagramProcessor.checkProcessorAvailability();
      
      console.log(chalk.green('✓ Notion sync test completed'));
      
      return {
        success: true,
        connection: true,
        processors: processorAvailability,
        config: this.config
      };
      
    } catch (error) {
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Insert file blocks at appropriate positions after their corresponding text blocks
   * @param {Array} blocks - Array of Notion blocks
   * @returns {Array} Blocks with file blocks inserted
   */
  insertFileBlocks(blocks) {
    if (!this.attachmentProcessor || !this.attachmentProcessor.fileBlocksWithPositions || 
        this.attachmentProcessor.fileBlocksWithPositions.length === 0) {
      return blocks;
    }

    const fileBlocks = this.attachmentProcessor.fileBlocksWithPositions;
    const finalBlocks = [];
    
    // Create a map of marker IDs to file blocks for quick lookup
    const markerToFileBlock = new Map();
    fileBlocks.forEach(item => {
      markerToFileBlock.set(item.markerId, item.fileBlock);
    });

    // Process each block and check if it should be followed by a file block
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      finalBlocks.push(block);
      
      // Get text content from different block types
      let blockText = '';
      
      if (block.type === 'paragraph' && block.paragraph && block.paragraph.rich_text) {
        blockText = block.paragraph.rich_text
          .map(rt => rt.plain_text || rt.text?.content || '')
          .join('');
      } else if (block.type === 'bulleted_list_item' && block.bulleted_list_item && block.bulleted_list_item.rich_text) {
        blockText = block.bulleted_list_item.rich_text
          .map(rt => rt.plain_text || rt.text?.content || '')
          .join('');
      } else if (block.type === 'numbered_list_item' && block.numbered_list_item && block.numbered_list_item.rich_text) {
        blockText = block.numbered_list_item.rich_text
          .map(rt => rt.plain_text || rt.text?.content || '')
          .join('');
      } else if (block.type === 'heading_1' && block.heading_1 && block.heading_1.rich_text) {
        blockText = block.heading_1.rich_text
          .map(rt => rt.plain_text || rt.text?.content || '')
          .join('');
      } else if (block.type === 'heading_2' && block.heading_2 && block.heading_2.rich_text) {
        blockText = block.heading_2.rich_text
          .map(rt => rt.plain_text || rt.text?.content || '')
          .join('');
      } else if (block.type === 'heading_3' && block.heading_3 && block.heading_3.rich_text) {
        blockText = block.heading_3.rich_text
          .map(rt => rt.plain_text || rt.text?.content || '')
          .join('');
      }
      
      // Check if this block contains any file reference text
      if (blockText) {
        for (const [markerId, markerInfo] of (this.attachmentProcessor.fileReferenceMarkers || new Map()).entries()) {
          if (blockText.includes(markerInfo.linkText)) {
            // This block contains the file reference text, insert file block after it
            const fileBlock = markerToFileBlock.get(markerId);
            if (fileBlock) {
              finalBlocks.push(fileBlock);
              console.log(chalk.green(`📎 Inserted file block after "${block.type}": "${markerInfo.linkText}"`));
              // Remove from map so we don't insert it again
              markerToFileBlock.delete(markerId);
            }
          }
        }
      }
    }
    
    // Add any remaining file blocks at the end (fallback)
    for (const [markerId, fileBlock] of markerToFileBlock.entries()) {
      finalBlocks.push(fileBlock);
      console.log(chalk.yellow(`📎 Added unmatched file block at end: ${markerId}`));
    }
    
    return finalBlocks;
  }
}

module.exports = NotionSync; 