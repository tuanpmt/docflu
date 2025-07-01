const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const chalk = require('chalk');
const axios = require('axios');

/**
 * Google Docs Image Processor
 * Handles image detection, processing, and insertion into Google Docs
 * Integrates with existing diagram processors from Confluence implementation
 */
class GDocsImageProcessor {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.driveClient = null;
    this.stateManager = null;
    
    // Google Docs specific processors
    this.diagramProcessor = null; // Google Docs diagram processor
    this.imageProcessor = null; // Google Docs image processor
    
    // Image detection patterns
    this.imagePatterns = {
      markdown: /!\[([^\]]*)\]\(([^)]+)\)/g,
      html: /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
      reference: /!\[([^\]]*)\]\[([^\]]+)\]/g
    };
    
    // Supported image extensions
    this.supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.tiff'];
    
    // Processing stats
    this.stats = {
      imagesFound: 0,
      imagesProcessed: 0,
      imagesCached: 0,
      diagramsProcessed: 0,
      errors: []
    };
    
    // Debug configuration
    this.debug = process.env.DEBUG_GDOCS_CONVERTER === 'true';
    this.debugDir = path.join(projectRoot, '.docusaurus', 'debug', 'gdocs-image-processor');
  }

  /**
   * Initialize image processor with Drive client and existing processors
   */
  async initialize(driveClient, stateManager) {
    try {
      this.driveClient = driveClient;
      this.stateManager = stateManager;
      
      // Initialize Google Docs specific image processor
      const ImageProcessor = require('./image-processor');
      this.imageProcessor = new ImageProcessor(driveClient, this.projectRoot);
      
      // Load Google Docs diagram processors
      await this.loadDiagramProcessors();
      
      console.log(chalk.green('✅ Google Docs Image Processor initialized'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize image processor:'), error.message);
      throw error;
    }
  }

  /**
   * Load Google Docs specific diagram processors
   */
  async loadDiagramProcessors() {
    try {
      // Load Google Docs diagram processor (custom implementation for Google Drive)
      const GDocsDiagramProcessor = require('./diagram-processor');
      this.diagramProcessor = new GDocsDiagramProcessor(this.driveClient, path.join(this.projectRoot, '.docusaurus', 'temp'));
      
      console.log(chalk.gray('📊 Loaded Google Docs diagram processor'));
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Could not load Google Docs diagram processor:'), error.message);
      // Continue without diagram processing
    }
  }

  /**
   * Process all images in markdown content (using placeholders)
   * @param {string} markdown - Raw markdown content  
   * @param {string} filePath - Path to the markdown file being processed
   * @returns {Object} - { processedMarkdown, imageRequests, stats }
   */
  async processImages(markdown, filePath) {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      filePath: filePath,
      processing: {
        phases: [],
        images: [],
        diagrams: []
      },
      output: null,
      errors: []
    };

    try {
      console.log(chalk.blue(`🖼️ Processing images in markdown content for: ${path.basename(filePath)}`));
      
      let processedMarkdown = markdown;
      const imageRequests = [];
      
      // Reset stats
      this.stats = {
        imagesFound: 0,
        imagesProcessed: 0,
        imagesCached: 0,
        diagramsProcessed: 0,
        errors: []
      };

      debugInfo.processing.phases.push({
        phase: 'initialization',
        timestamp: new Date().toISOString(),
        inputLength: markdown.length,
        filePath: filePath
      });

      // Extract all images from markdown to validate they exist in content
      const markdownImages = this.extractImages(markdown, filePath);
      this.stats.imagesFound = markdownImages.length;
      
      console.log(chalk.gray(`📊 Found ${markdownImages.length} image(s) in markdown content`));

      // 1. Process all diagrams (including Mermaid) using Google Docs diagram processor
      if (this.diagramProcessor) {
        debugInfo.processing.phases.push({
          phase: 'diagram_processing_start',
          timestamp: new Date().toISOString()
        });
        
        const diagramResult = await this.diagramProcessor.processAllDiagrams(processedMarkdown);
        processedMarkdown = diagramResult.processedMarkdown;
        
        // Convert diagram map to image requests - remove from markdown and add to native image requests
        for (const [originalContent, replacement] of diagramResult.diagramMap) {
          const placeholder = `[DIAGRAM_PLACEHOLDER${imageRequests.length}]`;
          
          // Remove the markdown image from processed content
          processedMarkdown = processedMarkdown.replace(
            `![${replacement.alt}](${replacement.url})`,
            placeholder
          );
          
          // Add to native image requests
          imageRequests.push({
            type: 'diagram',
            url: replacement.url,
            altText: replacement.alt,
            originalContent: originalContent,
            diagramType: replacement.type,
            placeholder: placeholder
          });
        }
        
        this.stats.diagramsProcessed += diagramResult.stats.diagramsProcessed;
        
        debugInfo.processing.phases.push({
          phase: 'diagram_processing_complete',
          timestamp: new Date().toISOString(),
          diagramsProcessed: diagramResult.stats.diagramsProcessed,
          diagramsSkipped: diagramResult.stats.diagramsSkipped
        });
        
        console.log(chalk.gray(`📊 Diagram processing: ${diagramResult.stats.diagramsProcessed} processed, ${diagramResult.stats.diagramsSkipped} kept as text`));
      }

      // 2. Process regular images - only those found in markdown content
      if (markdownImages.length > 0) {
        debugInfo.processing.phases.push({
          phase: 'image_processing_start',
          timestamp: new Date().toISOString()
        });
        
        const imageResult = await this.processRegularImagesAsNative(processedMarkdown, filePath, debugInfo);
        processedMarkdown = imageResult.processedMarkdown;
        imageRequests.push(...imageResult.imageRequests);
        
        debugInfo.processing.phases.push({
          phase: 'image_processing_complete',
          timestamp: new Date().toISOString(),
          imagesProcessed: this.stats.imagesProcessed
        });
      } else {
        console.log(chalk.gray('📊 No regular images found in markdown content'));
      }

      const totalProcessed = this.stats.imagesProcessed + this.stats.diagramsProcessed;
      console.log(chalk.green(`✅ Image processing complete: ${this.stats.imagesProcessed} images, ${this.stats.diagramsProcessed} diagrams (${totalProcessed} total)`));
      
      const result = {
        processedMarkdown,
        imageRequests,
        stats: this.stats
      };
      
      debugInfo.output = {
        processedMarkdownLength: processedMarkdown.length,
        imageRequestsCount: imageRequests.length,
        stats: this.stats,
        summary: {
          totalImagesInMarkdown: markdownImages.length,
          totalProcessed: totalProcessed,
          imagesProcessed: this.stats.imagesProcessed,
          diagramsProcessed: this.stats.diagramsProcessed,
          successRate: markdownImages.length > 0 ? 
            Math.round((totalProcessed / markdownImages.length) * 100) : 100
        }
      };
      
      if (this.debug) {
        await this.saveDebugInfo(debugInfo);
      }
      
      return result;
      
    } catch (error) {
      console.error(chalk.red('❌ Image processing failed:'), error.message);
      this.stats.errors.push(error.message);
      debugInfo.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      if (this.debug) {
        await this.saveDebugInfo(debugInfo, 'error');
      }
      
      throw error;
    }
  }

  /**
   * Process regular images as native Google Docs images
   */
  async processRegularImagesAsNative(markdown, filePath, debugInfo = null) {
    try {
      if (!this.imageProcessor) {
        console.log(chalk.yellow('⚠️ Image processor not initialized, skipping regular images'));
        return { processedMarkdown: markdown, imageRequests: [] };
      }

      // Use Google Docs image processor to upload images
      const result = await this.imageProcessor.processImages(markdown, filePath);
      
      let processedMarkdown = markdown;
      const imageRequests = [];
      
      // Convert processed images to native image requests
      // Use the processed markdown from image processor that already has Google Drive URLs
      processedMarkdown = result.processedMarkdown;
      
      // Extract image requests from the processed markdown 
      let offset = 0;
      
      // Process markdown images: ![alt](src)
      const markdownImagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let match;
      
      while ((match = markdownImagePattern.exec(result.processedMarkdown)) !== null) {
        const [fullMatch, alt, url] = match;
        
        // Check if this is a Google Drive URL (uploaded image)
        if (url.includes('drive.google.com') || url.includes('googleusercontent.com')) {
          const placeholder = `[IMAGE_PLACEHOLDER${imageRequests.length}]`;
          
          // Replace the markdown image with placeholder
          const startIndex = match.index + offset;
          const endIndex = startIndex + fullMatch.length;
          
          processedMarkdown = processedMarkdown.substring(0, startIndex) + 
                            placeholder + 
                            processedMarkdown.substring(endIndex);
          
          // Update offset for next replacement
          offset += placeholder.length - fullMatch.length;
          
          imageRequests.push({
            type: 'image',
            url: url,
            altText: alt || 'Image',
            placeholder: placeholder
          });
          
          // Reset regex lastIndex to continue from current position
          markdownImagePattern.lastIndex = startIndex + placeholder.length - offset;
        }
      }
      
      // Process HTML images: <img src="..." alt="..." />
      const htmlImagePattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      
      while ((match = htmlImagePattern.exec(processedMarkdown)) !== null) {
        const [fullMatch, url] = match;
        
        // Extract alt text from HTML img tag
        const altMatch = fullMatch.match(/alt=["']([^"']*)["']/i);
        const alt = altMatch ? altMatch[1] : 'Image';
        
        // Check if this is a Google Drive URL (uploaded image)
        if (url.includes('drive.google.com') || url.includes('googleusercontent.com')) {
          const placeholder = `[IMAGE_PLACEHOLDER${imageRequests.length}]`;
          
          // Replace the HTML image with placeholder
          const startIndex = match.index + offset;
          const endIndex = startIndex + fullMatch.length;
          
          processedMarkdown = processedMarkdown.substring(0, startIndex) + 
                            placeholder + 
                            processedMarkdown.substring(endIndex);
          
          // Update offset for next replacement
          offset += placeholder.length - fullMatch.length;
          
          imageRequests.push({
            type: 'html_image',
            url: url,
            altText: alt,
            placeholder: placeholder
          });
          
          // Reset regex lastIndex to continue from current position
          htmlImagePattern.lastIndex = startIndex + placeholder.length - offset;
        }
      }
      
      // Update stats
      this.stats.imagesProcessed += result.stats.imagesProcessed;
      this.stats.imagesCached += result.stats.imagesCached;
      this.stats.errors.push(...result.stats.errors);
      
      // Update debug info
      if (debugInfo) {
        debugInfo.processing.images = this.imageProcessor.extractImages(markdown, filePath).map(img => ({
          alt: img.alt,
          src: img.src,
          type: 'markdown',
          isRemote: this.isRemoteUrl(img.src)
        }));
      }

      return {
        processedMarkdown,
        imageRequests
      };
      
    } catch (error) {
      console.error(chalk.red('❌ Regular image processing failed:'), error.message);
      this.stats.errors.push(`Regular images: ${error.message}`);
      return { processedMarkdown: markdown, imageRequests: [] };
    }
  }

  /**
   * Extract all images from markdown
   */
  extractImages(markdown, filePath) {
    const images = [];
    
    // Markdown images: ![alt](src)
    let match;
    while ((match = this.imagePatterns.markdown.exec(markdown)) !== null) {
      images.push({
        fullMatch: match[0],
        alt: match[1],
        src: match[2],
        type: 'markdown'
      });
    }
    
    // HTML images: <img src="..." />
    this.imagePatterns.html.lastIndex = 0;
    while ((match = this.imagePatterns.html.exec(markdown)) !== null) {
      const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
      images.push({
        fullMatch: match[0],
        alt: altMatch ? altMatch[1] : '',
        src: match[1],
        type: 'html'
      });
    }
    
    return images;
  }

  /**
   * Check if URL is remote
   */
  isRemoteUrl(url) {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Resolve image path relative to markdown file
   */
  resolveImagePath(imageSrc, markdownFilePath) {
    if (path.isAbsolute(imageSrc)) {
      // Absolute path - check if it's Docusaurus static path
      if (imageSrc.startsWith('/')) {
        // Docusaurus absolute path like /img/logo.png
        return path.join(this.projectRoot, 'static', imageSrc.substring(1));
      }
      return imageSrc;
    } else {
      // Relative path
      const markdownDir = path.dirname(markdownFilePath);
      return path.resolve(markdownDir, imageSrc);
    }
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.imagesFound > 0 ? 
        Math.round((this.stats.imagesProcessed / this.stats.imagesFound) * 100) : 100
    };
  }

  /**
   * Create Google Docs image insertion requests
   * Note: This method is deprecated. Use GoogleDocsSync.createImageInsertionRequests instead
   * which properly handles placeholder replacement in the document.
   * @param {Array} imageRequests - Array of image requests from processing
   * @returns {Array} - Empty array (processing handled by GoogleDocsSync)
   */
  createImageInsertionRequests(imageRequests) {
    // This method is no longer used. Image insertion is handled by GoogleDocsSync
    // which properly finds placeholder positions in the document and replaces them.
    console.log(chalk.gray(`📸 Image insertion will be handled by GoogleDocsSync for ${imageRequests.length} images`));
    return [];
  }

  /**
   * Save debug information to JSON file
   */
  async saveDebugInfo(debugInfo, suffix = '') {
    if (!this.debug) return;
    
    try {
      await fs.ensureDir(this.debugDir);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = suffix 
        ? `image-processing-debug-${suffix}-${timestamp}.json`
        : `image-processing-debug-${timestamp}.json`;
      
      const filepath = path.join(this.debugDir, filename);
      
      // Add additional debug metadata
      const debugOutput = {
        ...debugInfo,
        metadata: {
          processorVersion: '1.0.0',
          nodeVersion: process.version,
          debugEnabled: this.debug,
          debugDir: this.debugDir,
          filename: filename,
          projectRoot: this.projectRoot
        }
      };
      
      await fs.writeJson(filepath, debugOutput, { spaces: 2 });
      
      console.log(chalk.gray(`🐛 Image processing debug info saved: ${filepath}`));
      
      // Also save a simplified summary for quick overview
      const summaryPath = path.join(this.debugDir, `image-summary-${timestamp}.json`);
      const summary = {
        timestamp: debugInfo.timestamp,
        inputLength: debugInfo.input.markdown.length,
        filePath: debugInfo.input.filePath,
        phases: debugInfo.processing.phases.length,
        imagesFound: debugInfo.processing.images.length,
        diagramsFound: debugInfo.processing.diagrams.reduce((sum, d) => sum + d.count, 0),
        uploadsCompleted: debugInfo.processing.uploads.length,
        outputStats: debugInfo.output?.stats,
        errors: debugInfo.errors.length,
        filename: filename
      };
      
      await fs.writeJson(summaryPath, summary, { spaces: 2 });
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Failed to save image processing debug info:'), error.message);
    }
  }
}

module.exports = GDocsImageProcessor; 