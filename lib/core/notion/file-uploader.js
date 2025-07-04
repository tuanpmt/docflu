const axios = require('axios');
const FormData = require('form-data');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

class NotionFileUploader {
  constructor(notionClient, authToken = null) {
    this.notionClient = notionClient;
    this.authToken = authToken || process.env.NOTION_API_TOKEN;
    this.uploadedFiles = new Map(); // Cache for uploaded files
    this.apiVersion = '2022-06-28';
  }

  /**
   * Upload file buffer to Notion using the new File Upload API
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} filename - Filename
   * @param {string} mimeType - MIME type of the file
   * @returns {Object} - Image block with file_upload reference
   */
  async uploadFileToNotion(fileBuffer, filename, mimeType = 'application/octet-stream') {
    try {
      console.log(chalk.blue(`📤 Uploading file to Notion: ${filename} (${fileBuffer.length} bytes)`));

      // Always create fresh upload for Notion (no cache)
      // Step 1: Create File Upload Object  
      const fileUploadResponse = await this.createFileUploadForFile(filename, mimeType);
      const { id: fileUploadId, upload_url } = fileUploadResponse;

      console.log(chalk.cyan(`📋 Created file upload object: ${fileUploadId}`));

      // Step 2: Upload file buffer to upload_url using multipart/form-data
      await this.uploadFileBufferContent(upload_url, fileBuffer, filename, mimeType);

      console.log(chalk.cyan(`📤 Uploaded content to Notion storage`));

      console.log(chalk.green(`✅ Successfully uploaded file to Notion: ${filename}`));
      
      // Return upload metadata for further processing
      return {
        fileUploadId: fileUploadId,
        filename: filename,
        mimeType: mimeType,
        size: fileBuffer.length
      };

    } catch (error) {
      console.error(chalk.red(`❌ Failed to upload file to Notion: ${error.message}`));
      throw error;
    }
  }

  /**
   * Upload SVG content to Notion using the new File Upload API
   * @param {string} svgContent - SVG content
   * @param {string} filename - Filename for the SVG
   * @returns {Object} - Image block with file_upload reference
   */
  async uploadSvgToNotion(svgContent, filename = 'diagram.svg') {
    try {
      console.log(chalk.blue(`📤 Uploading SVG to Notion: ${filename} (${svgContent.length} chars)`));

      // Always create fresh upload for Notion (no cache)
      // Step 1: Create File Upload Object
      const fileUploadResponse = await this.createFileUpload(filename, svgContent);
      const { id: fileUploadId, upload_url } = fileUploadResponse;

      console.log(chalk.cyan(`📋 Created file upload object: ${fileUploadId}`));

      // Step 2: Upload content to upload_url using multipart/form-data
      await this.uploadFileContent(upload_url, svgContent, filename);

      console.log(chalk.cyan(`📤 Uploaded content to Notion storage`));

      // Step 3: Create image block with file_upload reference
      const imageBlock = {
        object: 'block',
        type: 'image',
        image: {
          type: 'file_upload',
          file_upload: { 
            id: fileUploadId 
          },
          caption: [] // Empty caption so image displays properly
        }
      };

      console.log(chalk.green(`✅ Successfully uploaded SVG to Notion: ${filename}`));
      return imageBlock;

    } catch (error) {
      console.error(chalk.red(`❌ Failed to upload SVG to Notion: ${error.message}`));
      
      // Fallback to callout block if upload fails
      return this.createFallbackCalloutBlock(svgContent, filename, error.message);
    }
  }

  /**
   * Step 1: Create File Upload Object for generic files
   * POST /v1/file_uploads
   */
  async createFileUploadForFile(filename, mimeType) {
    try {
      const response = await axios.post('https://api.notion.com/v1/file_uploads', {
        filename: filename,
        content_type: mimeType
      }, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Notion-Version': this.apiVersion,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('File upload API not available. This feature may not be supported yet.');
      }
      throw new Error(`Failed to create file upload: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Step 1: Create File Upload Object for SVG
   * POST /v1/file_uploads
   */
  async createFileUpload(filename, content) {
    try {
      const response = await axios.post('https://api.notion.com/v1/file_uploads', {
        filename: filename,
        content_type: 'image/svg+xml'
      }, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Notion-Version': this.apiVersion,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('File upload API not available. This feature may not be supported yet.');
      }
      throw new Error(`Failed to create file upload: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Step 2: Upload file buffer content to upload_url using multipart/form-data
   */
  async uploadFileBufferContent(uploadUrl, fileBuffer, filename, mimeType) {
    try {
      const form = new FormData();
      
      // Add file buffer to form data with proper MIME type
      form.append('file', fileBuffer, {
        filename: filename,
        contentType: mimeType
      });

      const response = await axios.post(uploadUrl, form, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Notion-Version': this.apiVersion,
          ...form.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to upload file content: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Step 2: Upload SVG content to upload_url using multipart/form-data
   */
  async uploadFileContent(uploadUrl, content, filename) {
    try {
      const form = new FormData();
      
      // Create a buffer from SVG content
      const buffer = Buffer.from(content, 'utf8');
      
      // Add file to form data with proper MIME type
      form.append('file', buffer, {
        filename: filename,
        contentType: 'image/svg+xml'
      });

      const response = await axios.post(uploadUrl, form, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Notion-Version': this.apiVersion,
          ...form.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to upload file content: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create fallback text block if file upload fails
   */
  createFallbackTextBlock(filename, errorMessage) {
    console.log(chalk.yellow(`⚠️ Creating fallback text block for ${filename}`));
    
    return {
      type: 'paragraph',
      paragraph: {
        rich_text: [{ 
          text: { 
            content: `[Image: ${filename} - Upload failed: ${errorMessage}]` 
          },
          annotations: { italic: true, color: 'red' }
        }]
      }
    };
  }

  /**
   * Create fallback callout block if upload fails
   */
  createFallbackCalloutBlock(svgContent, filename, errorMessage) {
    console.log(chalk.yellow(`⚠️ Creating fallback callout block for ${filename}`));
    
    return {
      type: 'callout',
      callout: {
        icon: { emoji: '📊' },
        color: 'orange_background',
        rich_text: [{ 
          text: { 
            content: `SVG Diagram: ${filename}\n\nSize: ${svgContent.length} characters\nUpload failed: ${errorMessage}\n\nNote: SVG content was generated successfully but could not be uploaded to Notion. This may be due to API limitations or file size constraints.` 
          },
          annotations: { bold: true }
        }]
      }
    };
  }

  /**
   * Generate cache key for buffer content
   */
  generateCacheKeyFromBuffer(buffer) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * Generate cache key for SVG content
   */
  generateCacheKey(content) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Check if file upload API is available
   */
  async checkFileUploadAvailability() {
    try {
      // Try to create a test file upload to check if API is available
      const response = await this.createFileUpload('test.svg', '<svg></svg>');
      console.log(chalk.green(`✅ File Upload API is available! Test upload ID: ${response.id}`));
      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(chalk.red('❌ File Upload API not available (404)'));
        return false;
      }
      console.log(chalk.yellow(`⚠️ File Upload API test failed but endpoint exists: ${error.message}`));
      // Other errors might indicate the API is available but there's another issue
      return true;
    }
  }

  /**
   * Get file size limits for current plan
   */
  getFileSizeLimits() {
    return {
      free: 20 * 1024 * 1024, // 20 MB as per official docs
      paid: 20 * 1024 * 1024 // 20 MB for small files (larger files need multi-part upload)
    };
  }

  /**
   * Check if content size is within limits
   */
  isWithinSizeLimit(content, isPaidPlan = false) {
    const limits = this.getFileSizeLimits();
    const limit = isPaidPlan ? limits.paid : limits.free;
    
    // Handle both Buffer and string content
    const size = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, 'utf8');
    
    return {
      withinLimit: size <= limit,
      size: size,
      limit: limit,
      sizeFormatted: this.formatBytes(size),
      limitFormatted: this.formatBytes(limit)
    };
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if MIME type is for an image
   * @param {string} mimeType - MIME type to check
   * @returns {boolean} True if it's an image MIME type
   */
  isImageMimeType(mimeType) {
    const imageMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/svg+xml',
      'image/webp',
      'image/bmp',
      'image/tiff',
      'image/ico'
    ];
    return imageMimeTypes.includes(mimeType.toLowerCase());
  }

  /**
   * Clear upload cache
   */
  clearCache() {
    this.uploadedFiles.clear();
    console.log(chalk.blue('🧹 Cleared file upload cache'));
  }
}

module.exports = NotionFileUploader; 