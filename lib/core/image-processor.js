const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const mime = require('mime-types');
const chalk = require('chalk');

class ImageProcessor {
  constructor(confluenceClient, baseDir) {
    this.confluenceClient = confluenceClient;
    this.baseDir = baseDir;
    this.uploadedImages = new Map(); // Cache uploaded images
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
    
    // Regex để find markdown images: ![alt](src "title")
    const imageRegex = /!\[(.*?)\]\(([^)]+?)(?:\s+"([^"]*)")?\)/g;
    
    let match;
    while ((match = imageRegex.exec(markdownContent)) !== null) {
      const [fullMatch, alt, src, title] = match;
      
      const imageInfo = {
        fullMatch,
        alt: alt || '',
        src: src.trim(),
        title: title || '',
        index: match.index,
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
   * Upload images to Confluence page
   * @param {string} pageId - Confluence page ID
   * @param {Array} images - Array of image info objects
   * @returns {Map} - Map of original src -> Confluence attachment info
   */
  async uploadImages(pageId, images) {
    const attachmentMap = new Map();
    
    for (const image of images) {
      if (!image.isLocal) {
        // Skip external images - they'll be used as-is
        continue;
      }

      if (!await fs.pathExists(image.absolutePath)) {
        console.warn(chalk.yellow(`⚠️ Image not found: ${image.src}`));
        continue;
      }

      try {
        console.log(chalk.blue(`📤 Uploading image: ${image.src}`));
        
        const attachmentInfo = await this.uploadSingleImage(pageId, image);
        attachmentMap.set(image.src, attachmentInfo);
        
        console.log(chalk.green(`✓ Uploaded: ${attachmentInfo.title}`));
        
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Failed to upload ${image.src}: ${error.message}`));
      }
    }

    return attachmentMap;
  }

  /**
   * Upload single image to Confluence
   */
  async uploadSingleImage(pageId, image) {
    const fileName = path.basename(image.absolutePath);
    const mimeType = mime.lookup(image.absolutePath) || 'application/octet-stream';
    
    // Check if already uploaded
    const cacheKey = `${pageId}:${fileName}`;
    if (this.uploadedImages.has(cacheKey)) {
      return this.uploadedImages.get(cacheKey);
    }

    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(image.absolutePath), {
      filename: fileName,
      contentType: mimeType
    });
    form.append('comment', `Uploaded by DocuFlu CLI`);
    form.append('minorEdit', 'true');

    // Upload to Confluence
    const response = await this.confluenceClient.api({
      method: 'POST',
      url: `/wiki/rest/api/content/${pageId}/child/attachment`,
      data: form,
      headers: {
        ...form.getHeaders(),
        'X-Atlassian-Token': 'no-check'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const attachmentInfo = {
      id: response.data.results[0].id,
      title: response.data.results[0].title,
      downloadUrl: response.data.results[0]._links.download,
      webUrl: response.data.results[0]._links.webui
    };

    // Cache the result
    this.uploadedImages.set(cacheKey, attachmentInfo);
    
    return attachmentInfo;
  }

  /**
   * Convert image references in content to Confluence format
   * @param {string} content - HTML content with image tags
   * @param {Map} attachmentMap - Map of src -> attachment info
   * @param {string} baseUrl - Confluence base URL
   * @returns {string} - Content with Confluence image references
   */
  convertImagesToConfluenceFormat(content, attachmentMap, baseUrl) {
    // Convert HTML img tags to Confluence format
    return content.replace(/<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/g, (match, beforeSrc, src, afterSrc) => {
      const attachment = attachmentMap.get(src);
      
      if (attachment) {
        // Local image uploaded to Confluence
        return `<ac:image>
          <ri:attachment ri:filename="${attachment.title}" />
        </ac:image>`;
      } else if (!this.isLocalImage(src)) {
        // External image - keep as regular img tag
        return `<img${beforeSrc}src="${src}"${afterSrc}>`;
      } else {
        // Local image that failed to upload - show broken link warning
        console.warn(chalk.yellow(`⚠️ Image not uploaded: ${src}`));
        return `<p><em>⚠️ Image not found: ${src}</em></p>`;
      }
    });
  }

  /**
   * Process all images for a page
   * @param {string} pageId - Confluence page ID
   * @param {string} markdownContent - Original markdown content
   * @param {string} htmlContent - Converted HTML content
   * @param {string} filePath - Path to markdown file
   * @param {string} baseUrl - Confluence base URL
   * @returns {string} - Processed HTML content with Confluence images
   */
  async processImages(pageId, markdownContent, htmlContent, filePath, baseUrl) {
    // Extract images from markdown
    const images = this.extractImages(markdownContent, filePath);
    
    if (images.length === 0) {
      return htmlContent;
    }

    console.log(chalk.blue(`📷 Found ${images.length} image(s) to process`));

    // Upload local images
    const attachmentMap = await this.uploadImages(pageId, images);

    // Convert image references in HTML
    const processedContent = this.convertImagesToConfluenceFormat(htmlContent, attachmentMap, baseUrl);

    return processedContent;
  }
}

module.exports = ImageProcessor; 