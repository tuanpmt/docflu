const { Client } = require('@notionhq/client');
const chalk = require('chalk');

/**
 * Notion API Client
 * Handles all interactions with Notion API including authentication, rate limiting, and error handling
 */
class NotionClient {
  constructor(config) {
    this.config = config;
    this.client = new Client({
      auth: config.apiToken,
      notionVersion: '2022-06-28' // Latest stable version
    });
    
    // Rate limiting
    this.requestQueue = [];
    this.processing = false;
    this.minInterval = 334; // ~3 requests/second (Notion API limit)
    this.lastRequestTime = 0;
  }

  /**
   * Test connection to Notion API
   */
  async testConnection() {
    try {
      // Try to list users instead of users.me() which might have issues
      const response = await this.makeRequest(() => this.client.users.list());
      console.log(chalk.green('✓ Connected to Notion workspace'));
      console.log(chalk.gray(`  Found ${response.results.length} users`));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Notion connection failed:'), this.formatError(error));
      return false;
    }
  }

  /**
   * Rate-limited request wrapper
   * @param {Function} requestFn - Function that makes the API request
   * @returns {Promise} Request result
   */
  async makeRequest(requestFn) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process request queue with rate limiting
   */
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const { requestFn, resolve, reject } = this.requestQueue.shift();
      
      // Ensure minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.minInterval) {
        const delay = this.minInterval - timeSinceLastRequest;
        await this.sleep(delay);
      }

      try {
        const result = await requestFn();
        this.lastRequestTime = Date.now();
        resolve(result);
      } catch (error) {
        reject(this.handleError(error));
      }
    }

    this.processing = false;
  }

  /**
   * Handle Notion API errors
   * @param {Error} error - Original error
   * @returns {Error} Formatted error
   */
  handleError(error) {
    if (error.code) {
      switch (error.code) {
        case 'rate_limited':
          return new Error(`Rate limited: ${error.message}. Please wait before retrying.`);
        case 'validation_error':
          return new Error(`Validation error: ${error.message}`);
        case 'object_not_found':
          return new Error(`Object not found: ${error.message}`);
        case 'unauthorized':
          return new Error(`Unauthorized: ${error.message}. Check your API token.`);
        case 'restricted_resource':
          return new Error(`Restricted resource: ${error.message}. Check page permissions.`);
        default:
          return new Error(`Notion API error (${error.code}): ${error.message}`);
      }
    }
    
    return error;
  }

  /**
   * Format error message for display
   * @param {Error} error - Error to format
   * @returns {string} Formatted error message
   */
  formatError(error) {
    if (error.code === 'unauthorized') {
      return 'Invalid API token or insufficient permissions';
    }
    return error.message || 'Unknown error';
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Page API methods

  /**
   * Create a new page
   * @param {Object} pageData - Page creation data
   * @returns {Promise<Object>} Created page
   */
  async createPage(pageData) {
    return this.makeRequest(() => this.client.pages.create(pageData));
  }

  /**
   * Retrieve a page by ID
   * @param {string} pageId - Page ID
   * @returns {Promise<Object>} Page object
   */
  async retrievePage(pageId) {
    return this.makeRequest(() => this.client.pages.retrieve({ page_id: pageId }));
  }

  /**
   * Update page properties
   * @param {string} pageId - Page ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated page
   */
  async updatePage(pageId, updateData) {
    return this.makeRequest(() => this.client.pages.update({
      page_id: pageId,
      ...updateData
    }));
  }

  // Block API methods

  /**
   * Append blocks to a page
   * @param {string} pageId - Page ID
   * @param {Array} children - Array of block objects
   * @returns {Promise<Object>} Response with created blocks
   */
  async appendBlocks(pageId, children) {
    // Split into chunks if too many blocks
    const maxBlocksPerRequest = 100;
    const results = [];

    for (let i = 0; i < children.length; i += maxBlocksPerRequest) {
      const chunk = children.slice(i, i + maxBlocksPerRequest);
      const result = await this.makeRequest(() => 
        this.client.blocks.children.append({
          block_id: pageId,
          children: chunk
        })
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Retrieve block children
   * @param {string} blockId - Block ID
   * @param {string} startCursor - Pagination cursor
   * @returns {Promise<Object>} Block children response
   */
  async retrieveBlockChildren(blockId, startCursor = null) {
    const params = { block_id: blockId };
    if (startCursor) {
      params.start_cursor = startCursor;
    }

    return this.makeRequest(() => this.client.blocks.children.list(params));
  }

  /**
   * Update a block
   * @param {string} blockId - Block ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated block
   */
  async updateBlock(blockId, updateData) {
    return this.makeRequest(() => this.client.blocks.update({
      block_id: blockId,
      ...updateData
    }));
  }

  /**
   * Delete a block
   * @param {string} blockId - Block ID
   * @returns {Promise<Object>} Deleted block
   */
  async deleteBlock(blockId) {
    return this.makeRequest(() => this.client.blocks.delete({
      block_id: blockId
    }));
  }

  // Search API methods

  /**
   * Search for pages/databases
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} Search results
   */
  async search(searchParams) {
    return this.makeRequest(() => this.client.search(searchParams));
  }

  // File Upload API methods

  /**
   * Upload file to Notion using File Upload API
   * @param {Buffer} fileBuffer - File content buffer
   * @param {string} fileName - File name
   * @param {string} mimeType - MIME type
   * @returns {Promise<Object>} Upload result with URL and expiry
   */
  async uploadFile(fileBuffer, fileName, mimeType) {
    try {
      // Step 1: Create file upload
      const createResponse = await this.makeRequest(() => 
        this.client.request({
          method: 'POST',
          url: 'https://api.notion.com/v1/files',
          headers: {
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          data: {
            name: fileName,
            type: mimeType,
            size: fileBuffer.length
          }
        })
      );

      const uploadId = createResponse.id;
      const uploadUrl = createResponse.upload_url;

      // Step 2: Upload file content to presigned URL
      await this.makeRequest(() => 
        this.client.request({
          method: 'PUT',
          url: uploadUrl,
          headers: {
            'Content-Type': mimeType
          },
          data: fileBuffer
        })
      );

      // Step 3: Complete upload
      const completeResponse = await this.makeRequest(() => 
        this.client.request({
          method: 'POST',
          url: `https://api.notion.com/v1/files/${uploadId}/complete`,
          headers: {
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          }
        })
      );

      return {
        url: completeResponse.url,
        expiry_time: completeResponse.expiry_time,
        file_id: uploadId
      };

    } catch (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  // User API methods

  /**
   * List all users
   * @returns {Promise<Object>} Users list
   */
  async listUsers() {
    return this.makeRequest(() => this.client.users.list());
  }

  /**
   * Get current bot user
   * @returns {Promise<Object>} Bot user info
   */
  async getBotUser() {
    return this.makeRequest(() => this.client.users.me());
  }

  // Utility methods

  /**
   * Get page properties
   * @param {Object} page - Page object
   * @returns {Object} Simplified properties
   */
  getPageProperties(page) {
    const properties = {};
    
    for (const [key, value] of Object.entries(page.properties)) {
      switch (value.type) {
        case 'title':
          properties[key] = value.title.map(t => t.text.content).join('');
          break;
        case 'rich_text':
          properties[key] = value.rich_text.map(t => t.text.content).join('');
          break;
        case 'number':
          properties[key] = value.number;
          break;
        case 'select':
          properties[key] = value.select?.name || null;
          break;
        case 'multi_select':
          properties[key] = value.multi_select.map(s => s.name);
          break;
        case 'date':
          properties[key] = value.date?.start || null;
          break;
        case 'checkbox':
          properties[key] = value.checkbox;
          break;
        case 'url':
          properties[key] = value.url;
          break;
        case 'email':
          properties[key] = value.email;
          break;
        case 'phone_number':
          properties[key] = value.phone_number;
          break;
        default:
          properties[key] = value;
      }
    }
    
    return properties;
  }

  /**
   * Extract page title
   * @param {Object} page - Page object
   * @returns {string} Page title
   */
  getPageTitle(page) {
    const titleProperty = Object.values(page.properties).find(prop => prop.type === 'title');
    if (titleProperty && titleProperty.title.length > 0) {
      return titleProperty.title.map(t => t.text.content).join('');
    }
    return 'Untitled';
  }
}

module.exports = NotionClient; 