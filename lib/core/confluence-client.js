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
}

module.exports = ConfluenceClient; 