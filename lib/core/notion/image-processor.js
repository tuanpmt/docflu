const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const crypto = require('crypto');
const axios = require('axios');
const mime = require('mime-types');

/**
 * Notion Image Processor
 * Handles image processing and uploading for Notion
 */
class NotionImageProcessor {
  constructor(notionClient, state, config) {
    this.client = notionClient;
    this.state = state;
    this.config = config;
    
    // Initialize file uploader
    this.fileUploader = new (require('./file-uploader'))(notionClient, config.notionApiToken);
    
    // Image patterns
    this.patterns = {
      markdown: /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g,
      html: /<img[^>]+src=["']([^"']+)["'][^>]*>/g
    };
    
    // Supported image formats
    this.supportedFormats = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
      'image/svg+xml', 'image/webp', 'image/bmp'
    ];
    
    // Temporary directory for processing
    this.tempDir = path.join(process.cwd(), '.docflu', 'temp', 'notion-images');
    fs.ensureDirSync(this.tempDir);
  }

  /**
   * Process image markdown directly and return image block
   * @param {string} imageUrl - Image URL or path
   * @param {string} altText - Alt text
   * @param {string} projectRoot - Project root directory
   * @param {boolean} dryRun - Whether this is a dry run
   * @returns {Object|null} Notion image block or null
   */
  async processImageMarkdown(imageUrl, altText = '', projectRoot = null, dryRun = false) {
    try {
      console.log(chalk.cyan(`🖼️ Processing image: ${imageUrl}`));
      
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        // External URL - download and upload to avoid Notion external URL issues
        console.log(chalk.cyan(`🔗 Processing external image: ${imageUrl}`));
        
        try {
          // Download external image and upload to Notion
          const imageData = await this.downloadExternalImage(imageUrl);
          if (imageData) {
            console.log(chalk.cyan(`📤 Uploading external image: ${imageData.fileName} (${imageData.buffer.length} bytes)`));
            
            if (dryRun) {
              return {
                type: 'paragraph',
                paragraph: {
                  rich_text: [{ 
                    text: { content: altText ? `[DRY RUN - External Image: ${altText}]` : '[DRY RUN - External Image]' },
                    annotations: { italic: true, color: 'blue' }
                  }]
                }
              };
            }
            
            // Upload using file upload API
            const uploadResult = await this.fileUploader.uploadFileToNotion(imageData.buffer, imageData.fileName, imageData.mimeType);
            
            if (uploadResult && uploadResult.fileUploadId) {
              console.log(chalk.green(`✅ Uploaded external image: ${imageData.fileName}`));
              
              // Create image block from upload result
              const imageBlock = {
                object: 'block',
                type: 'image',
                image: {
                  type: 'file_upload',
                  file_upload: { 
                    id: uploadResult.fileUploadId 
                  },
                  caption: []
                }
              };
              
              return imageBlock;
            } else {
              throw new Error('Upload failed - invalid result format');
            }
          } else {
            throw new Error('Failed to download external image');
          }
        } catch (error) {
          console.log(chalk.yellow(`⚠️ Failed to process external image ${imageUrl}: ${error.message}`));
          return {
            type: 'paragraph',
            paragraph: {
              rich_text: [{ 
                text: { content: altText ? `[External Image: ${altText}]` : '[External Image]' },
                annotations: { italic: true, color: 'gray' }
              }]
            }
          };
        }
        
      } else if (imageUrl.startsWith('/')) {
        // Local absolute path (like /img/docusaurus.png)
        console.log(chalk.cyan(`📁 Processing local image: ${imageUrl}`));
        
        const fs = require('fs-extra');
        // Use the correct project root (docusaurus-exam, not docflu)
        const baseProjectRoot = projectRoot || this.config.projectRoot || process.cwd();
        const staticPath = path.resolve(baseProjectRoot, 'static', imageUrl.substring(1));
        
        // console.log(chalk.gray(`  🔍 Looking for image at: ${staticPath}`));
        
        if (await fs.pathExists(staticPath)) {
          // Upload local image using file uploader
          const imageBuffer = await fs.readFile(staticPath);
          const fileName = path.basename(staticPath);
          const mimeType = this.getMimeType(fileName);
          
          console.log(chalk.cyan(`📤 Uploading local image: ${fileName} (${imageBuffer.length} bytes)`));
          
          if (dryRun) {
            return {
              type: 'paragraph',
              paragraph: {
                rich_text: [{ 
                  text: { content: altText ? `[DRY RUN - Local Image: ${altText}]` : '[DRY RUN - Local Image]' },
                  annotations: { italic: true, color: 'blue' }
                }]
              }
            };
          }
          
          // Upload using file upload API
          const uploadResult = await this.fileUploader.uploadFileToNotion(imageBuffer, fileName, mimeType);
          
          if (uploadResult && uploadResult.fileUploadId) {
            console.log(chalk.green(`✅ Uploaded local image: ${fileName}`));
            
            // Create image block from upload result
            const imageBlock = {
              object: 'block',
              type: 'image',
              image: {
                type: 'file_upload',
                file_upload: { 
                  id: uploadResult.fileUploadId 
                },
                caption: []
              }
            };
            
            return imageBlock;
          } else {
            throw new Error('Upload failed - invalid result format');
          }
          
        } else {
          console.log(chalk.yellow(`⚠️ Local image not found: ${staticPath}`));
          return {
            type: 'paragraph',
            paragraph: {
              rich_text: [{ 
                text: { content: altText ? `[Image: ${altText}]` : '[Image]' },
                annotations: { italic: true, color: 'red' }
              }]
            }
          };
        }
        
      } else {
        // Relative path or other format
        console.log(chalk.yellow(`⚠️ Unsupported image path format: ${imageUrl}`));
        return {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ 
              text: { content: altText ? `[Image: ${altText}]` : '[Image]' },
              annotations: { italic: true, color: 'gray' }
            }]
          }
        };
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ Failed to process image ${imageUrl}: ${error.message}`));
      return {
        type: 'paragraph',
        paragraph: {
          rich_text: [{ 
            text: { content: altText ? `[Image: ${altText} - Upload failed]` : '[Image - Upload failed]' },
            annotations: { italic: true, color: 'red' }
          }]
        }
      };
    }
  }

  /**
   * Get MIME type for file extension
   * @param {string} fileName - File name
   * @returns {string} MIME type
   */
  getMimeType(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Process all images in markdown content
   * @param {string} markdown - Markdown content
   * @returns {string} Processed markdown (unchanged - direct block processing)
   */
  async processImages(markdown) {
    // Note: This method now serves as compatibility layer
    // Actual image processing happens in processImageBlocks()
    console.log(chalk.blue('🔄 Image processing will occur during block conversion...'));
    return markdown;
  }

  /**
   * Process image references directly in Notion blocks
   * @param {Array} blocks - Array of Notion blocks
   * @returns {Array} Processed blocks with image blocks
   */
  async processImageBlocks(blocks) {
    try {
      console.log(chalk.blue('🔄 Processing images in Notion blocks...'));
      
      const processedBlocks = [];
      let imageCount = 0;
      
      for (const block of blocks) {
        if (this.hasImageReference(block)) {
          // Extract and process images from this block
          const imageBlocks = await this.extractAndProcessImages(block);
          processedBlocks.push(...imageBlocks);
          imageCount += imageBlocks.length - 1; // -1 because original block is included
        } else {
          processedBlocks.push(block);
        }
      }
      
      console.log(chalk.green(`✓ Processed ${imageCount} images in Notion blocks`));
      return processedBlocks;
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Image block processing failed: ${error.message}`));
      return blocks; // Return original on error
    }
  }

  /**
   * Check if block contains image references
   * @param {Object} block - Notion block
   * @returns {boolean} Has image references
   */
  hasImageReference(block) {
    if (block.type === 'paragraph' && block.paragraph.rich_text) {
      return block.paragraph.rich_text.some(text => 
        text.text && text.text.content && 
        (text.text.content.includes('![') || text.text.content.includes('<img'))
      );
    }
    return false;
  }

  /**
   * Extract and process images from a block
   * @param {Object} block - Notion block with image references
   * @returns {Array} Array of blocks (original + image blocks)
   */
  async extractAndProcessImages(block) {
    const blocks = [block];
    
    if (block.type === 'paragraph' && block.paragraph.rich_text) {
      for (const textObj of block.paragraph.rich_text) {
        const content = textObj.text.content;
        
        // Process markdown images
        const markdownMatches = [...content.matchAll(this.patterns.markdown)];
        for (const match of markdownMatches) {
          const [fullMatch, altText, imagePath, title] = match;
          // Use title as caption if available, otherwise use altText
          const caption = title || altText;
          const imageBlock = await this.createImageBlock(imagePath, caption);
          if (imageBlock) blocks.push(imageBlock);
        }
        
        // Process HTML images
        const htmlMatches = [...content.matchAll(this.patterns.html)];
        for (const match of htmlMatches) {
          const [fullMatch, imagePath] = match;
          const altMatch = fullMatch.match(/alt=["']([^"']+)["']/);
          const altText = altMatch ? altMatch[1] : '';
          const imageBlock = await this.createImageBlock(imagePath, altText);
          if (imageBlock) blocks.push(imageBlock);
        }
      }
    }
    
    return blocks;
  }

  /**
   * Create image block directly
   * @param {string} imagePath - Image path or URL
   * @param {string} altText - Alt text
   * @returns {Object|null} Notion image block or null
   */
  async createImageBlock(imagePath, altText = '') {
    try {
      const imageInfo = await this.processImage(imagePath, altText);
      if (!imageInfo || !imageInfo.block) return null;
      
      // Remove caption to keep images clean
      if (imageInfo.block.type === 'image' && imageInfo.block.image) {
        imageInfo.block.image.caption = [];
      }
      
      return imageInfo.block;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to create image block for ${imagePath}: ${error.message}`));
      return null;
    }
  }

  /**
   * Process a single image
   * @param {string} imagePath - Image path or URL
   * @param {string} altText - Alt text
   * @returns {Object|null} Image info or null
   */
  async processImage(imagePath, altText = '') {
    try {
      // Determine if local or remote image
      const isRemote = imagePath.startsWith('http://') || imagePath.startsWith('https://');
      
      let imageBuffer;
      let fileName;
      let mimeType;
      
      if (isRemote) {
        // Download remote image
        const downloadResult = await this.downloadRemoteImage(imagePath);
        imageBuffer = downloadResult.buffer;
        fileName = downloadResult.fileName;
        mimeType = downloadResult.mimeType;
      } else {
        // Process local image
        const localResult = await this.processLocalImage(imagePath);
        imageBuffer = localResult.buffer;
        fileName = localResult.fileName;
        mimeType = localResult.mimeType;
      }
      
      // Generate image hash for caching
      const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
      
      // Check cache first
      const cachedUrl = this.state.getUploadedFileUrl(imageHash);
      if (cachedUrl) {
        // Check if cache is still valid (10 minutes)
        const cacheData = this.state.getUploadedFileData(imageHash);
        if (cacheData && this.isCacheValid(cacheData.uploadedAt)) {
          console.log(chalk.gray(`  🖼️ Using cached image: ${fileName}`));
          return {
            id: imageHash,
            url: cachedUrl,
            fileName,
            altText,
            cached: true
          };
        } else {
          console.log(chalk.yellow(`⏰ Image cache expired for: ${fileName}, re-uploading...`));
          // Remove expired cache entry
          this.state.removeUploadedFile(imageHash);
        }
      }
      
      // Upload to Notion
      const imageBlock = await this.uploadImageToNotion(imageBuffer, fileName, mimeType);
      
      // Extract URL from image block for caching
      let fileUrl = null;
      if (imageBlock.type === 'image' && imageBlock.image) {
        if (imageBlock.image.type === 'file_upload') {
          fileUrl = `notion://file_upload/${imageBlock.image.file_upload.id}`;
        } else if (imageBlock.image.type === 'external') {
          fileUrl = imageBlock.image.external.url;
        }
      }
      
      // Cache the result
      if (fileUrl) {
        this.state.setUploadedFileUrl(imageHash, fileUrl, {
          type: 'image',
          fileName,
          mimeType,
          size: imageBuffer.length,
          altText
        });
      }
      
      console.log(chalk.green(`  ✓ Processed image: ${fileName}`));
      
      return {
        id: imageHash,
        block: imageBlock,
        fileName,
        altText,
        cached: false
      };
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to process image ${imagePath}: ${error.message}`));
      return null;
    }
  }

  /**
   * Download remote image
   * @param {string} imageUrl - Image URL
   * @returns {Object} Download result
   */
  async downloadRemoteImage(imageUrl) {
    try {
      console.log(chalk.blue(`🌐 Downloading remote image: ${imageUrl}`));
      
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const buffer = Buffer.from(response.data);
      
      // Determine MIME type
      let mimeType = response.headers['content-type'];
      if (mimeType) {
        // Clean up content-type (remove charset if present)
        mimeType = mimeType.split(';')[0].trim();
      }
      
      if (!mimeType || !this.supportedFormats.includes(mimeType)) {
        // Try to determine from URL extension
        const ext = path.extname(imageUrl).toLowerCase();
        mimeType = mime.lookup(ext) || 'image/png';
      }
      
      // Generate filename
      const urlPath = new URL(imageUrl).pathname;
      let fileName = path.basename(urlPath);
      if (!fileName || !path.extname(fileName)) {
        const ext = mime.extension(mimeType) || 'png';
        fileName = `image-${Date.now()}.${ext}`;
      }
      
      console.log(chalk.green(`✅ Downloaded remote image: ${fileName} (${buffer.length} bytes, ${mimeType})`));
      
      return { buffer, fileName, mimeType };
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to download remote image: ${error.message}`));
      throw new Error(`Failed to download image from ${imageUrl}: ${error.message}`);
    }
  }

  /**
   * Process local image
   * @param {string} imagePath - Local image path
   * @returns {Object} Processing result
   */
  async processLocalImage(imagePath) {
    try {
      // Resolve relative path
      const fullPath = path.isAbsolute(imagePath) 
        ? imagePath 
        : path.resolve(this.config.projectRoot || process.cwd(), imagePath);
      
      if (!await fs.pathExists(fullPath)) {
        throw new Error(`Image file not found: ${fullPath}`);
      }
      
      const buffer = await fs.readFile(fullPath);
      const fileName = path.basename(fullPath);
      const mimeType = mime.lookup(fullPath) || 'image/png';
      
      if (!this.supportedFormats.includes(mimeType)) {
        throw new Error(`Unsupported image format: ${mimeType}`);
      }
      
      return { buffer, fileName, mimeType };
    } catch (error) {
      throw new Error(`Failed to process local image ${imagePath}: ${error.message}`);
    }
  }

  /**
   * Upload image to Notion as file
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} fileName - File name
   * @param {string} mimeType - MIME type
   * @returns {Object} Notion image block
   */
  async uploadImageToNotion(imageBuffer, fileName, mimeType) {
    try {
      // Use NotionFileUploader for upload
      const uploadResult = await this.fileUploader.uploadFileToNotion(imageBuffer, fileName, mimeType);
      
      if (uploadResult && uploadResult.fileUploadId) {
        console.log(chalk.green(`✅ Uploaded image to Notion: ${fileName}`));
        
        // Create image block from upload result
        const imageBlock = {
          object: 'block',
          type: 'image',
          image: {
            type: 'file_upload',
            file_upload: { 
              id: uploadResult.fileUploadId 
            },
            caption: [{
              text: {
                content: fileName
              }
            }]
          }
        };
        
        return imageBlock;
      } else {
        throw new Error('Upload failed - invalid result format');
      }
      
    } catch (error) {
      // Fallback to external URL if upload fails
      console.warn(chalk.yellow(`⚠️ Notion upload failed, creating fallback: ${error.message}`));
      
      const tempFile = path.join(this.tempDir, fileName);
      await fs.writeFile(tempFile, imageBuffer);
      
      // Return fallback text block
      return {
        type: 'paragraph',
        paragraph: {
          rich_text: [{ 
            text: { 
              content: `[Image: ${fileName} - Upload failed: ${error.message}]` 
            },
            annotations: { italic: true, color: 'red' }
          }]
        }
      };
    }
  }

  /**
   * Validate image file
   * @param {Buffer} buffer - Image buffer
   * @param {string} mimeType - MIME type
   * @returns {boolean} True if valid
   */
  validateImage(buffer, mimeType) {
    // Check MIME type
    if (!this.supportedFormats.includes(mimeType)) {
      return false;
    }
    
    // Check file size (Notion has limits)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (buffer.length > maxSize) {
      console.warn(chalk.yellow(`⚠️ Image too large: ${buffer.length} bytes (max: ${maxSize})`));
      return false;
    }
    
    return true;
  }

  /**
   * Check if cache is still valid (10 minutes)
   * @param {string} uploadedAt - ISO timestamp when file was uploaded
   * @returns {boolean} True if cache is still valid
   */
  isCacheValid(uploadedAt) {
    const CACHE_EXPIRY_MINUTES = 10;
    const now = new Date();
    const uploadTime = new Date(uploadedAt);
    const diffMinutes = (now - uploadTime) / (1000 * 60);
    
    return diffMinutes < CACHE_EXPIRY_MINUTES;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      if (await fs.pathExists(this.tempDir)) {
        await fs.remove(this.tempDir);
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to clean up temp directory: ${error.message}`));
    }
  }

  /**
   * Get image statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const uploadedFiles = this.state.getAllUploadedFiles();
    const images = Object.values(uploadedFiles).filter(file => file.type === 'image');
    
    const stats = {
      total: images.length,
      totalSize: images.reduce((sum, img) => sum + (img.size || 0), 0),
      byFormat: {}
    };
    
    for (const image of images) {
      const format = image.mimeType || 'unknown';
      stats.byFormat[format] = (stats.byFormat[format] || 0) + 1;
    }
    
    return stats;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStatistics() {
    const uploadedFiles = this.state.getAllUploadedFiles();
    const images = Object.values(uploadedFiles).filter(file => file.type === 'image');
    
    return {
      cachedImages: images.length,
      totalCacheSize: images.reduce((sum, img) => sum + (img.size || 0), 0),
      oldestCache: images.length > 0 ? Math.min(...images.map(img => new Date(img.uploadedAt).getTime())) : null,
      newestCache: images.length > 0 ? Math.max(...images.map(img => new Date(img.uploadedAt).getTime())) : null
    };
  }

  /**
   * Validate URL format for Notion compatibility
   * @param {string} url - Image URL
   * @returns {boolean} True if valid
   */
  isValidNotionImageUrl(url) {
    try {
      // Basic URL validation
      const urlObj = new URL(url);
      
      // Must be HTTPS (Notion prefers HTTPS)
      if (urlObj.protocol !== 'https:') {
        return false;
      }
      
      // Check if URL is too long (Notion has limits)
      if (url.length > 2000) {
        return false;
      }
      
      // Check for valid image extensions
      const pathname = urlObj.pathname.toLowerCase();
      const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'];
      const hasValidExtension = validExtensions.some(ext => pathname.includes(ext));
      
      // If no extension in path, might still be valid (some CDNs don't show extension)
      // But we'll be more lenient and allow it
      return true;
      
    } catch (error) {
      // Invalid URL format
      return false;
    }
  }

  /**
   * Download external image and upload to Notion
   * @param {string} imageUrl - Image URL
   * @returns {Object|null} Image data or null
   */
  async downloadExternalImage(imageUrl) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'docflu/1.0.0'
        }
      });
      
      const buffer = Buffer.from(response.data);
      
      // Determine MIME type
      let mimeType = response.headers['content-type'];
      if (!mimeType || !this.supportedFormats.includes(mimeType)) {
        // Try to determine from URL extension
        const ext = path.extname(imageUrl).toLowerCase();
        mimeType = mime.lookup(ext) || 'image/png';
      }
      
      // Generate filename
      const urlPath = new URL(imageUrl).pathname;
      let fileName = path.basename(urlPath);
      if (!fileName || !path.extname(fileName)) {
        const ext = mime.extension(mimeType) || 'png';
        fileName = `image-${Date.now()}.${ext}`;
      }
      
      return { buffer, fileName, mimeType };
    } catch (error) {
      throw new Error(`Failed to download external image from ${imageUrl}: ${error.message}`);
    }
  }
}

module.exports = NotionImageProcessor; 