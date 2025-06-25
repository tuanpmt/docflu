const axios = require('axios');
const chalk = require('chalk');

class ConfluenceClient {
  constructor(config) {
    this.config = config;
    this.api = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${config.username}:${config.apiToken}`).toString('base64')}`
      }
    });
  }

  /**
   * Test connection to Confluence
   */
  async testConnection() {
    try {
      const response = await this.api.get(`/wiki/rest/api/space/${this.config.spaceKey}`);
      console.log(chalk.green('✓ Connected to Confluence space:', response.data.name));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Confluence connection failed:', error.response?.data?.message || error.message));
      return false;
    }
  }

  /**
   * Create hoặc update page
   * @param {Object} pageData - {title, content, parentId}
   */
  async createOrUpdatePage(pageData) {
    const { title, content, parentId } = pageData;

    try {
      // Check if page exists
      const existingPage = await this.findPageByTitle(title);

      if (existingPage) {
        console.log(chalk.yellow('📝 Updating existing page:', title));
        const version = existingPage.version?.number || 1;
        return await this.updatePage(existingPage.id, title, content, version + 1);
      } else {
        console.log(chalk.green('📄 Creating new page:', title));
        return await this.createPage(title, content, parentId);
      }
    } catch (error) {
      throw new Error(`Failed to sync page "${title}": ${error.message}`);
    }
  }

  /**
   * Find page by title trong space
   */
  async findPageByTitle(title) {
    try {
      const response = await this.api.get('/wiki/rest/api/content/search', {
        params: {
          cql: `space="${this.config.spaceKey}" AND title="${title}" AND type="page"`,
          expand: 'version'
        }
      });

      return response.data.results.length > 0 ? response.data.results[0] : null;
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Could not search for existing page:', error.response?.data?.message || error.message));
      return null;
    }
  }

  /**
   * Create new page
   */
  async createPage(title, content, parentId) {
    const pageData = {
      type: 'page',
      title: title,
      space: { key: this.config.spaceKey },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      }
    };

    // Add parent if specified
    if (parentId) {
      pageData.ancestors = [{ id: parentId }];
    }

    const response = await this.api.post('/wiki/rest/api/content', pageData);
    return response.data;
  }

  /**
   * Update existing page
   */
  async updatePage(pageId, title, content, version) {
    const pageData = {
      type: 'page',
      title: title,
      space: { key: this.config.spaceKey },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      },
      version: { number: version }
    };

    const response = await this.api.put(`/wiki/rest/api/content/${pageId}`, pageData);
    return response.data;
  }

  /**
   * Get root page by title
   */
  async getRootPage() {
    if (!this.config.rootPageTitle) {
      return null;
    }

    return await this.findPageByTitle(this.config.rootPageTitle);
  }

  /**
   * Find or create parent page for category
   */
  async findOrCreateParentPage(categoryPath, rootParentId = null) {
    if (!categoryPath) {
      return rootParentId;
    }

    // Split category path into segments (e.g., "advanced/concepts" -> ["advanced", "concepts"])
    const segments = categoryPath.split('/').filter(Boolean);
    let currentParentId = rootParentId;
    let pathSoFar = '';
    
    for (const [index, segment] of segments.entries()) {
      pathSoFar = pathSoFar ? `${pathSoFar}/${segment}` : segment;
      
      // Generate readable title from segment
      const title = this.formatCategoryTitle(segment);
      
      // Try to find existing page with specific parent context
      let page = await this.findPageByTitleAndParent(title, currentParentId);
      
      if (!page) {
        // Create new parent page
        const level = '  '.repeat(index);
        console.log(chalk.blue(`${level}📁 Creating parent page: ${title} (${pathSoFar})`));
        
        const pageData = {
          title: title,
          content: `<p>This page contains documentation for <strong>${title}</strong>.</p>
                   <p><em>Category path: ${pathSoFar}</em></p>`,
          parentId: currentParentId
        };
        
        page = await this.createOrUpdatePage(pageData);
      }
      
      currentParentId = page.id;
    }
    
    return currentParentId;
  }

  /**
   * Find page by title within specific parent context
   */
  async findPageByTitleAndParent(title, parentId) {
    try {
      if (!parentId) {
        // If no parent, use regular search
        return await this.findPageByTitle(title);
      }

      // Get children of parent page
      const children = await this.getPageChildren(parentId);
      const matchingChild = children.find(child => child.title === title);
      
      return matchingChild || null;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not search for page ${title} under parent ${parentId}`));
      return null;
    }
  }

  /**
   * Format category segment to readable title
   */
  formatCategoryTitle(segment) {
    return segment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get page children for hierarchy management
   */
  async getPageChildren(pageId) {
    try {
      const response = await this.api.get(`/wiki/rest/api/content/${pageId}/child/page`, {
        params: {
          expand: 'version'
        }
      });

      return response.data.results;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not get children for page ${pageId}`));
      return [];
    }
  }

  /**
   * Get page content with full HTML body (for pull sync)
   * @param {string} pageId - Confluence page ID
   * @returns {Object} - Page data with HTML content
   */
  async getPageContent(pageId) {
    try {
      const response = await this.api.get(`/wiki/rest/api/content/${pageId}`, {
        params: {
          expand: 'body.storage,version,space,ancestors'
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get page content for ${pageId}: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get pages under a root page (for pull sync)
   * @param {string} rootPageId - Root page ID
   * @param {number} limit - Maximum number of pages to retrieve
   * @returns {Array} - Array of page data
   */
  async getPagesUnderRoot(rootPageId, limit = 100) {
    try {
      const allPages = [];
      let start = 0;
      
      while (true) {
        const response = await this.api.get('/wiki/rest/api/content/search', {
          params: {
            cql: `space="${this.config.spaceKey}" AND type="page" AND ancestor="${rootPageId}"`,
            expand: 'body.storage,version,space,ancestors',
            limit: Math.min(limit - allPages.length, 50),
            start
          }
        });

        const pages = response.data.results;
        allPages.push(...pages);
        
        if (pages.length === 0 || allPages.length >= limit) {
          break;
        }
        
        start += pages.length;
      }

      return allPages;
    } catch (error) {
      throw new Error(`Failed to get pages under root ${rootPageId}: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get page by path from root (for pull sync)
   * @param {string} rootPageTitle - Root page title
   * @param {string} relativePath - Relative path like "category/subcategory/page"
   * @returns {Object|null} - Page data or null if not found
   */
  async getPageByPath(rootPageTitle, relativePath) {
    try {
      // Get root page first
      const rootPage = await this.findPageByTitle(rootPageTitle);
      if (!rootPage) {
        return null;
      }

      // If no path, return root page
      if (!relativePath || relativePath === '/') {
        return await this.getPageContent(rootPage.id);
      }

      // Split path and traverse hierarchy
      const pathSegments = relativePath.split('/').filter(Boolean);
      let currentPageId = rootPage.id;
      
      for (const segment of pathSegments) {
        const segmentTitle = this.formatCategoryTitle(segment);
        const children = await this.getPageChildren(currentPageId);
        const childPage = children.find(child => child.title === segmentTitle);
        
        if (!childPage) {
          return null;
        }
        
        currentPageId = childPage.id;
      }

      return await this.getPageContent(currentPageId);
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not get page by path ${relativePath}: ${error.message}`));
      return null;
    }
  }

  /**
   * Download attachment from Confluence
   * @param {string} pageId - Page ID containing the attachment
   * @param {string} filename - Attachment filename
   * @returns {Buffer} - Attachment data
   */
  async downloadAttachment(pageId, filename) {
    try {
      // First, get attachment info
      const attachmentsResponse = await this.api.get(`/wiki/rest/api/content/${pageId}/child/attachment`, {
        params: {
          filename: filename,
          expand: 'version'
        }
      });

      if (attachmentsResponse.data.results.length === 0) {
        throw new Error(`Attachment ${filename} not found`);
      }

      const attachment = attachmentsResponse.data.results[0];
      const downloadUrl = `${this.config.baseUrl}${attachment._links.download}`;

      // Download the actual file
      const fileResponse = await this.api.get(downloadUrl, {
        responseType: 'arraybuffer'
      });

      return Buffer.from(fileResponse.data);
    } catch (error) {
      throw new Error(`Failed to download attachment ${filename}: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get last modified date of a page
   * @param {string} pageId - Page ID
   * @returns {Date} - Last modified date
   */
  async getPageLastModified(pageId) {
    try {
      const pageData = await this.getPageContent(pageId);
      return new Date(pageData.version.when);
    } catch (error) {
      throw new Error(`Failed to get last modified date for ${pageId}: ${error.message}`);
    }
  }

  /**
   * Check if page has been modified since a given date
   * @param {string} pageId - Page ID
   * @param {Date} sinceDate - Date to compare against
   * @returns {boolean} - True if page was modified after sinceDate
   */
  async isPageModifiedSince(pageId, sinceDate) {
    try {
      const lastModified = await this.getPageLastModified(pageId);
      return lastModified > sinceDate;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not check modification date for page ${pageId}: ${error.message}`));
      return true; // Assume modified if we can't check
    }
  }
}

module.exports = ConfluenceClient; 