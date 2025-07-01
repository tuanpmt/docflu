const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const mime = require('mime-types');
const chalk = require('chalk');

class ImageProcessor {
  constructor(googleDriveClient, projectRoot) {
    this.googleDriveClient = googleDriveClient;
    this.projectRoot = projectRoot;
    this.uploadedImages = new Map(); // Cache uploaded images
    
    // Debug configuration
    this.debug = process.env.DEBUG_GDOCS_CONVERTER === 'true';
  }

  /**
   * Extract images từ markdown content
   * @param {string} markdownContent - Raw markdown content
   * @param {string} filePath - Path to markdown file (for relative image paths)
   * @returns {Array} - Array of image info objects
   */
  extractImages(markdownContent, filePath) {
    const images = [];
    const fileDir = path.dirname(filePath);
    
    // 1. Find markdown images: ![alt](src "title")
    const markdownImageRegex = /!\[(.*?)\]\(([^)]+?)(?:\s+"([^"]*)")?\)/g;
    
    let match;
    while ((match = markdownImageRegex.exec(markdownContent)) !== null) {
      const [fullMatch, alt, src, title] = match;
      
      const imageInfo = {
        fullMatch,
        alt: alt || '',
        src: src.trim(),
        title: title || '',
        index: match.index,
        type: 'markdown',
        isLocal: this.isLocalImage(src),
        absolutePath: null
      };

      // Resolve absolute path cho local images
      if (imageInfo.isLocal) {
        imageInfo.absolutePath = this.resolveImagePath(src, filePath);
      }

      images.push(imageInfo);
    }
    
    // 2. Find HTML images: <img src="..." alt="..." />
    const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    
    while ((match = htmlImageRegex.exec(markdownContent)) !== null) {
      const [fullMatch, src] = match;
      
      // Extract alt text from HTML img tag
      const altMatch = fullMatch.match(/alt=["']([^"']*)["']/i);
      const alt = altMatch ? altMatch[1] : '';
      
      // Extract title from title attribute
      const titleMatch = fullMatch.match(/title=["']([^"']*)["']/i);
      const title = titleMatch ? titleMatch[1] : '';
      
      const imageInfo = {
        fullMatch,
        alt: alt,
        src: src.trim(),
        title: title,
        index: match.index,
        type: 'html',
        isLocal: this.isLocalImage(src),
        absolutePath: null
      };

      // Resolve absolute path cho local images
      if (imageInfo.isLocal) {
        imageInfo.absolutePath = this.resolveImagePath(src, filePath);
      }

      images.push(imageInfo);
    }

    return images;
  }

  /**
   * Resolve image path - handle both relative paths and Docusaurus absolute paths
   * @param {string} src - Image source path
   * @param {string} filePath - Path to markdown file
   * @returns {string} - Resolved absolute path
   */
  resolveImagePath(src, filePath) {
    const fileDir = path.dirname(filePath);
    
    // Handle Docusaurus absolute paths (starting with /)
    if (src.startsWith('/')) {
      // Try to find docusaurus project root
      const docusaurusRoot = this.findDocusaurusRoot(filePath);
      if (docusaurusRoot) {
        // Convert /img/... to {docusaurusRoot}/static/img/...
        const staticPath = path.join(docusaurusRoot, 'static', src.substring(1));
        if (fs.existsSync(staticPath)) {
          return staticPath;
        }
      }
      
      // Fallback: treat as relative to current file directory
      return path.resolve(fileDir, src.substring(1));
    }
    
    // Handle relative paths
    return path.resolve(fileDir, src);
  }

  /**
   * Find Docusaurus project root by looking for docusaurus.config.js/ts
   * @param {string} filePath - Current file path
   * @returns {string|null} - Docusaurus root path or null
   */
  findDocusaurusRoot(filePath) {
    let currentDir = path.dirname(filePath);
    
    // Go up directories to find docusaurus.config.js/ts
    while (currentDir !== path.dirname(currentDir)) {
      const configFiles = [
        'docusaurus.config.js',
        'docusaurus.config.ts'
      ];
      
      for (const configFile of configFiles) {
        if (fs.existsSync(path.join(currentDir, configFile))) {
          return currentDir;
        }
      }
      
      currentDir = path.dirname(currentDir);
    }
    
    return null;
  }

  /**
   * Check if image is local file
   */
  isLocalImage(src) {
    return !src.startsWith('http://') && 
           !src.startsWith('https://') && 
           !src.startsWith('//');
  }

  /**
   * Check if image is remote URL
   */
  isRemoteUrl(src) {
    return src.startsWith('http://') || 
           src.startsWith('https://') || 
           src.startsWith('//');
  }

  /**
   * Upload images to Google Drive
   * @param {Array} images - Array of image info objects
   * @returns {Map} - Map of original src -> Google Drive info
   */
  async uploadImages(images) {
    const attachmentMap = new Map();
    
    for (const image of images) {
      try {
        let uploadResult;
        
        if (image.isLocal) {
          // Local image
          if (!await fs.pathExists(image.absolutePath)) {
            console.warn(chalk.yellow(`⚠️ Image not found: ${image.src}`));
            continue;
          }
          
          console.log(chalk.blue(`📤 Uploading local image: ${image.src}`));
          uploadResult = await this.googleDriveClient.uploadImage(image.absolutePath);
          
        } else {
          // Remote image
          console.log(chalk.blue(`📤 Uploading remote image: ${image.src}`));
          uploadResult = await this.googleDriveClient.uploadRemoteImage(image.src);
        }
        
        attachmentMap.set(image.src, {
          ...uploadResult,
          alt: image.alt,
          title: image.title
        });
        
        console.log(chalk.green(`✓ Uploaded: ${uploadResult.fileName} (${uploadResult.cached ? 'cached' : 'new'})`));
        
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Failed to upload ${image.src}: ${error.message}`));
        
        if (this.debug) {
          console.log(chalk.gray(`🐛 Upload error details: ${error.stack}`));
        }
      }
    }

    return attachmentMap;
  }

  /**
   * Convert image references in markdown to Google Drive URLs
   * @param {string} markdownContent - Original markdown content
   * @param {Map} attachmentMap - Map of src -> Google Drive info
   * @returns {string} - Content with Google Drive image URLs
   */
  convertImagesToGoogleDriveFormat(markdownContent, attachmentMap) {
    let processedContent = markdownContent;
    
    // 1. Convert markdown images to Google Drive URLs
    processedContent = processedContent.replace(/!\[(.*?)\]\(([^)]+?)(?:\s+"([^"]*)")?\)/g, (match, alt, src, title) => {
      const attachment = attachmentMap.get(src);
      
      if (attachment) {
        // Image uploaded to Google Drive
        const newAlt = alt || attachment.alt || 'Image';
        const newTitle = title || attachment.title || '';
        
        if (newTitle) {
          return `![${newAlt}](${attachment.url} "${newTitle}")`;
        } else {
          return `![${newAlt}](${attachment.url})`;
        }
      } else if (this.isRemoteUrl(src)) {
        // External image that wasn't processed - keep as is
        return match;
      } else {
        // Local image that failed to upload - show warning
        console.warn(chalk.yellow(`⚠️ Image not uploaded: ${src}`));
        return `![${alt || 'Image not found'}](${src})`;
      }
    });
    
    // 2. Convert HTML images to Google Drive URLs
    processedContent = processedContent.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
      const attachment = attachmentMap.get(src);
      
      if (attachment) {
        // Image uploaded to Google Drive - convert to markdown format for consistency
        const alt = attachment.alt || 'Image';
        return `![${alt}](${attachment.url})`;
      } else if (this.isRemoteUrl(src)) {
        // External image that wasn't processed - keep as is
        return match;
      } else {
        // Local image that failed to upload - show warning
        console.warn(chalk.yellow(`⚠️ HTML image not uploaded: ${src}`));
        
        // Extract alt text for fallback
        const altMatch = match.match(/alt=["']([^"']*)["']/i);
        const alt = altMatch ? altMatch[1] : 'Image not found';
        
        return `![${alt}](${src})`;
      }
    });
    
    return processedContent;
  }

  /**
   * Process all images for Google Docs
   * @param {string} markdownContent - Original markdown content
   * @param {string} filePath - Path to markdown file
   * @returns {Object} - { processedMarkdown, imageRequests, stats }
   */
  async processImages(markdownContent, filePath) {
    const stats = {
      imagesFound: 0,
      imagesProcessed: 0,
      imagesCached: 0,
      errors: []
    };

    try {
      // Extract images from markdown
      const images = this.extractImages(markdownContent, filePath);
      stats.imagesFound = images.length;
      
      if (images.length === 0) {
        return {
          processedMarkdown: markdownContent,
          imageRequests: [],
          stats
        };
      }

      console.log(chalk.blue(`📷 Found ${images.length} image(s) to process`));

      // Upload images to Google Drive
      const attachmentMap = await this.uploadImages(images);
      stats.imagesProcessed = attachmentMap.size;
      
      // Count cached images
      for (const [src, attachment] of attachmentMap) {
        if (attachment.cached) {
          stats.imagesCached++;
        }
      }

      // Convert image references in markdown
      const processedMarkdown = this.convertImagesToGoogleDriveFormat(markdownContent, attachmentMap);

      // Create Google Docs image insertion requests (if needed)
      const imageRequests = Array.from(attachmentMap.values()).map(attachment => ({
        type: 'image',
        url: attachment.url,
        altText: attachment.alt || 'Image',
        originalSrc: attachment.originalUrl || attachment.fileName
      }));

      return {
        processedMarkdown,
        imageRequests,
        stats
      };

    } catch (error) {
      console.error(chalk.red('❌ Image processing failed:'), error.message);
      stats.errors.push(error.message);
      
      if (this.debug) {
        console.log(chalk.gray(`🐛 Processing error details: ${error.stack}`));
      }
      
      return {
        processedMarkdown: markdownContent,
        imageRequests: [],
        stats
      };
    }
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      totalUploaded: this.uploadedImages.size,
      sessionCache: Array.from(this.uploadedImages.keys())
    };
  }

  /**
   * Clear session cache
   */
  clearCache() {
    this.uploadedImages.clear();
  }
}

module.exports = ImageProcessor; 