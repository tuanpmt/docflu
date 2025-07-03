const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

/**
 * Notion Hierarchy Manager
 * Handles creation and management of nested page structure based on directory hierarchy
 * Enhanced to support _category_.json files and proper nested structure
 */
class NotionHierarchyManager {
  constructor(notionClient, state, projectRoot = null) {
    this.client = notionClient;
    this.state = state;
    this.projectRoot = projectRoot || process.cwd();
    this.hierarchyCache = new Map(); // Cache for created parent pages
    this.categoryCache = new Map(); // Cache for _category_.json data
  }

  /**
   * Create page hierarchy for a file path with proper nested structure
   * @param {string} filePath - Relative file path (e.g., 'docs/tutorial-basics/create-a-page.md')
   * @param {string} rootPageId - Root page ID for the hierarchy
   * @param {boolean} flatMode - Whether to use flat mode (skip nested structure)
   * @returns {string} Parent page ID for the content page
   */
  async createPageHierarchy(filePath, rootPageId, flatMode = false) {
    try {
      const pathSegments = this.extractPathSegments(filePath);
      
      // For flat mode, return root directly
      if (flatMode) {
        console.log(chalk.gray(`  📄 Flat mode: Creating page directly in root for: ${filePath}`));
        return rootPageId;
      }
      
      let currentParentId = rootPageId;
      
      // Process each directory segment (exclude filename)
      // Skip the first segment if it's 'docs' to avoid creating nested Docs folder
      const shouldSkipDocs = pathSegments[0] === 'docs';
      const startIndex = shouldSkipDocs ? 1 : 0;
      
      // Only create hierarchy if there are directories to process
      if (pathSegments.length <= startIndex + 1) {
        console.log(chalk.gray(`  📄 No directories to process, creating page directly in root for: ${filePath}`));
        return rootPageId;
      }
      
      for (let i = startIndex; i < pathSegments.length - 1; i++) {
        const segment = pathSegments[i];
        const pathSoFar = pathSegments.slice(startIndex, i + 1).join('/');
        const fullDirectoryPath = pathSegments.slice(0, i + 1).join('/');
        
        // Check cache first
        if (this.hierarchyCache.has(pathSoFar)) {
          currentParentId = this.hierarchyCache.get(pathSoFar);
          continue;
        }

        // Check state for existing hierarchy
        const existingPageId = this.state.getHierarchyPageId(pathSoFar);
        if (existingPageId) {
          currentParentId = existingPageId;
          this.hierarchyCache.set(pathSoFar, existingPageId);
          continue;
        }

        // Get directory metadata from _category_.json
        const categoryData = await this.loadCategoryData(fullDirectoryPath);
        const pageTitle = categoryData.label || this.formatSegmentTitle(segment);
        
        // Check if parent page already exists
        const existingPage = await this.findChildPage(currentParentId, pageTitle);
        
        if (existingPage) {
          currentParentId = existingPage.id;
          console.log(chalk.gray(`  📁 Found existing parent page: ${pageTitle}`));
        } else {
          console.log(chalk.blue(`  📁 Creating parent page: ${pageTitle} (${pathSoFar})`));
          const newPage = await this.createParentPage(pageTitle, currentParentId, pathSoFar, categoryData);
          currentParentId = newPage.id;
        }

        // Cache and save to state
        this.hierarchyCache.set(pathSoFar, currentParentId);
        this.state.setHierarchyPageId(pathSoFar, currentParentId);
      }

      return currentParentId;
    } catch (error) {
      throw new Error(`Failed to create hierarchy for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Load category data from _category_.json file
   * @param {string} directoryPath - Directory path (e.g., 'docs/tutorial-basics')
   * @returns {Object} Category data or empty object
   */
  async loadCategoryData(directoryPath) {
    // Check cache first
    if (this.categoryCache.has(directoryPath)) {
      return this.categoryCache.get(directoryPath);
    }

    try {
      // Create absolute path to _category_.json
      const categoryFilePath = path.resolve(this.projectRoot, directoryPath, '_category_.json');
      
      if (await fs.pathExists(categoryFilePath)) {
        const categoryData = await fs.readJson(categoryFilePath);
        console.log(chalk.gray(`  📋 Loaded category data for ${directoryPath}: ${categoryData.label || 'No label'}`));
        
        // Cache the result
        this.categoryCache.set(directoryPath, categoryData);
        return categoryData;
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to load _category_.json for ${directoryPath}: ${error.message}`));
    }

    // Return empty object if no category file found
    const emptyData = {};
    this.categoryCache.set(directoryPath, emptyData);
    return emptyData;
  }

  /**
   * Extract path segments from file path
   * @param {string} filePath - File path
   * @returns {Array<string>} Path segments
   */
  extractPathSegments(filePath) {
    // Remove leading slash and split by path separator
    const normalizedPath = filePath.replace(/^\/+/, '');
    return normalizedPath.split(path.sep).filter(Boolean);
  }

  /**
   * Format directory segment to readable title
   * @param {string} segment - Directory segment
   * @returns {string} Formatted title
   */
  formatSegmentTitle(segment) {
    return segment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  /**
   * Create a parent page for directory with enhanced content from _category_.json
   * @param {string} title - Page title
   * @param {string} parentId - Parent page ID
   * @param {string} pathSoFar - Current path for description
   * @param {Object} categoryData - Data from _category_.json
   * @returns {Object} Created page object
   */
  async createParentPage(title, parentId, pathSoFar, categoryData = {}) {
    try {
      // Build page content based on category data
      const children = [];
      
      // Add main description
      if (categoryData.link?.description) {
        children.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                text: { content: categoryData.link.description }
              }
            ]
          }
        });
      } else {
        children.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                text: { content: `This page contains documentation for ` }
              },
              {
                text: { content: title },
                annotations: { bold: true }
              },
              {
                text: { content: '.' }
              }
            ]
          }
        });
      }

      // Add category path info
      children.push({
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              text: { content: 'Category path: ' },
              annotations: { italic: true }
            },
            {
              text: { content: pathSoFar },
              annotations: { code: true }
            }
          ]
        }
      });

      // Add position info if available
      if (categoryData.position) {
        children.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                text: { content: 'Sidebar position: ' },
                annotations: { italic: true }
              },
              {
                text: { content: categoryData.position.toString() },
                annotations: { code: true }
              }
            ]
          }
        });
      }

      const pageData = {
        parent: { page_id: parentId },
        properties: {
          title: {
            title: [{ text: { content: title } }]
          }
        },
        icon: {
          emoji: '📁'
        },
        children: children
      };

      const response = await this.client.createPage(pageData);
      return response;
    } catch (error) {
      throw new Error(`Failed to create parent page "${title}": ${error.message}`);
    }
  }

  /**
   * Find child page by title under specific parent
   * @param {string} parentId - Parent page ID
   * @param {string} title - Page title to search for
   * @returns {Object|null} Found page or null
   */
  async findChildPage(parentId, title) {
    try {
      // Use Notion Search API to find pages with matching title
      const response = await this.client.search({
        query: title,
        filter: {
          value: 'page',
          property: 'object'
        },
        page_size: 100
      });

      // Filter results to match exact title and parent
      const matchingPage = response.results.find(page => {
        const pageTitle = page.properties.title?.title?.[0]?.text?.content;
        const pageParent = page.parent?.page_id;
        return pageTitle === title && pageParent === parentId;
      });

      return matchingPage || null;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not search for page "${title}" under parent ${parentId}: ${error.message}`));
      return null;
    }
  }

  /**
   * Get or create content page for markdown file
   * @param {string} filePath - File path
   * @param {string} title - Page title
   * @param {string} parentId - Parent page ID
   * @returns {Object} Page object (existing or newly created)
   */
  async getOrCreateContentPage(filePath, title, parentId) {
    try {
      // Check if page already exists in state
      const existingPageId = this.state.getPageId(filePath);
      if (existingPageId) {
        try {
          const existingPage = await this.client.retrievePage(existingPageId);
          return existingPage;
        } catch (error) {
          // Page might have been deleted, continue to create new one
          console.warn(chalk.yellow(`⚠️ Existing page ${existingPageId} not found, creating new one`));
        }
      }

      // Check if page exists under parent
      const existingPage = await this.findChildPage(parentId, title);
      if (existingPage) {
        this.state.setPageId(filePath, existingPage.id);
        return existingPage;
      }

      // Create new content page
      console.log(chalk.green(`  📄 Creating content page: ${title}`));
      const newPage = await this.createContentPage(title, parentId);
      this.state.setPageId(filePath, newPage.id);
      
      return newPage;
    } catch (error) {
      throw new Error(`Failed to get or create content page for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Create a content page for markdown file
   * @param {string} title - Page title
   * @param {string} parentId - Parent page ID
   * @returns {Object} Created page object
   */
  async createContentPage(title, parentId) {
    try {
      const pageData = {
        parent: { page_id: parentId },
        properties: {
          title: {
            title: [{ text: { content: title } }]
          }
        },
        icon: {
          emoji: '📄'
        }
      };

      const response = await this.client.createPage(pageData);
      return response;
    } catch (error) {
      if (error.message.includes('archived') || error.code === 'object_not_found') {
        // Parent page is archived or deleted, try to recreate the hierarchy
        console.log(chalk.yellow(`⚠️ Parent page is archived/deleted, attempting to recreate hierarchy for: ${title}`));
        
        // Try to get the root page and recreate from there
        const rootPageId = await this.getOrCreateRootPage(null, 'Documentation');
        
        // Create page directly under root if parent is problematic
        const fallbackPageData = {
          parent: { page_id: rootPageId },
          properties: {
            title: {
              title: [{ text: { content: title } }]
            }
          },
          icon: {
            emoji: '📄'
          }
        };
        
        console.log(chalk.green(`✅ Creating page under root instead: ${title}`));
        const response = await this.client.createPage(fallbackPageData);
        return response;
      }
      
      throw new Error(`Failed to create content page "${title}": ${error.message}`);
    }
  }

  /**
   * Create page hierarchy with automatic root page creation support
   * @param {string} filePath - File path
   * @param {string} rootPageId - Root page ID (optional)
   * @param {string} rootTitle - Root page title for auto-creation
   * @param {boolean} flatMode - Whether to use flat mode
   * @returns {string} Parent page ID for content page
   */
  async createPageHierarchyWithAutoRoot(filePath, rootPageId = null, rootTitle = 'Documentation', flatMode = false) {
    try {
      // Get or create root page
      const actualRootPageId = await this.getOrCreateRootPage(rootPageId, rootTitle);
      
      // Create hierarchy using the root page
      return await this.createPageHierarchy(filePath, actualRootPageId, flatMode);
    } catch (error) {
      throw new Error(`Failed to create hierarchy with auto root for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Get or create root page for documentation hierarchy
   * @param {string} rootPageId - Existing root page ID (optional)
   * @param {string} rootTitle - Title for auto-created page
   * @returns {string} Root page ID
   */
  async getOrCreateRootPage(rootPageId = null, rootTitle = 'Documentation') {
    try {
      // If root page ID is provided, validate it exists
      if (rootPageId) {
        try {
          await this.client.retrievePage(rootPageId);
          return rootPageId;
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Provided root page ${rootPageId} not found, will auto-create`));
        }
      }

      // Check if we have an auto-created root page in state
      const autoCreatedRootId = this.state.getMetadata('autoCreatedRootPageId');
      if (autoCreatedRootId) {
        try {
          await this.client.retrievePage(autoCreatedRootId);
          console.log(chalk.gray(`  📚 Using cached auto-created root page: ${autoCreatedRootId}`));
          return autoCreatedRootId;
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Cached auto-created root page not found, creating new one`));
          this.state.removeMetadata('autoCreatedRootPageId');
        }
      }

      // Create new root page
      console.log(chalk.blue(`  📚 Auto-creating root page: ${rootTitle}`));
      const newRootPage = await this.createRootPage(rootTitle);
      
      // Save to state for future use
      this.state.setMetadata('autoCreatedRootPageId', newRootPage.id);
      this.state.setMetadata('autoCreatedRootTitle', rootTitle);
      this.state.setMetadata('autoCreatedAt', new Date().toISOString());
      
      return newRootPage.id;
    } catch (error) {
      throw new Error(`Failed to get or create root page: ${error.message}`);
    }
  }

  /**
   * Create a root page for documentation
   * @param {string} title - Page title
   * @returns {Object} Created page object
   */
  async createRootPage(title) {
    try {
      const pageData = {
        parent: { type: 'workspace', workspace: true },
        properties: {
          title: {
            title: [{ text: { content: title } }]
          }
        },
        icon: {
          emoji: '📚'
        },
        children: [
          {
            type: 'heading_1',
            heading_1: {
              rich_text: [{ text: { content: title } }]
            }
          },
          {
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  text: { content: 'This page was automatically created by DocFlu to serve as the root for your documentation hierarchy.' }
                }
              ]
            }
          },
          {
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  text: { content: 'Created: ' },
                  annotations: { italic: true }
                },
                {
                  text: { content: new Date().toISOString() },
                  annotations: { code: true }
                }
              ]
            }
          }
        ]
      };

      const response = await this.client.createPage(pageData);
      return response;
    } catch (error) {
      throw new Error(`Failed to create root page "${title}": ${error.message}`);
    }
  }

  /**
   * Validate hierarchy state and clean up orphaned references
   */
  async validateHierarchy() {
    try {
      const hierarchyMap = this.state.getHierarchyMap();
      const orphanedPaths = [];

      for (const [pathKey, pageId] of Object.entries(hierarchyMap)) {
        try {
          await this.client.retrievePage(pageId);
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Orphaned hierarchy reference: ${pathKey} -> ${pageId}`));
          orphanedPaths.push(pathKey);
        }
      }

      // Clean up orphaned references
      for (const pathKey of orphanedPaths) {
        this.state.removeHierarchyPageId(pathKey);
      }

      if (orphanedPaths.length > 0) {
        console.log(chalk.blue(`🧹 Cleaned up ${orphanedPaths.length} orphaned hierarchy references`));
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to validate hierarchy: ${error.message}`));
    }
  }

  /**
   * Generate hierarchy tree for display
   * @returns {Object} Hierarchy tree structure
   */
  generateHierarchyTree() {
    const hierarchyMap = this.state.getHierarchyMap();
    const tree = {};

    for (const [pathKey, pageId] of Object.entries(hierarchyMap)) {
      const segments = pathKey.split('/');
      let current = tree;

      for (const segment of segments) {
        if (!current[segment]) {
          current[segment] = {
            pageId: null,
            children: {}
          };
        }
        current = current[segment].children;
      }

      // Set the page ID for the final segment
      const finalSegment = segments[segments.length - 1];
      if (tree[finalSegment]) {
        tree[finalSegment].pageId = pageId;
      }
    }

    return tree;
  }
}

module.exports = NotionHierarchyManager; 