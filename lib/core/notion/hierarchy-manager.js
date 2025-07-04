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

        return rootPageId;
      }
      
      let currentParentId = rootPageId;
      
      // Process each directory segment (exclude filename)
      // Skip the first segment if it's 'docs' to avoid creating nested Docs folder
      const shouldSkipDocs = pathSegments[0] === 'docs';
      const startIndex = shouldSkipDocs ? 1 : 0;
      
      // Only create hierarchy if there are directories to process
      if (pathSegments.length <= startIndex + 1) {

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

        // Check state for existing hierarchy and validate it still exists
        const existingPageId = this.state.getHierarchyPageId(pathSoFar);
        if (existingPageId) {
          try {
            // Validate the page still exists on Notion and is not archived
            const existingPage = await this.client.retrievePage(existingPageId);
            
            // Check if page is archived
            if (existingPage.archived) {
              console.warn(chalk.yellow(`⚠️ Hierarchy page ${pathSoFar} (${existingPageId}) is archived, will recreate`));
              this.state.removeHierarchyPageId(pathSoFar);
              this.hierarchyCache.delete(pathSoFar);
            } else {
              currentParentId = existingPageId;
              this.hierarchyCache.set(pathSoFar, existingPageId);

              continue;
            }
          } catch (error) {
            // Page was deleted, remove from state and continue to recreate
            console.warn(chalk.yellow(`⚠️ Hierarchy page ${pathSoFar} (${existingPageId}) was deleted, will recreate`));
            this.state.removeHierarchyPageId(pathSoFar);
            this.hierarchyCache.delete(pathSoFar);
          }
        }

        // Get directory metadata from _category_.json
        const categoryData = await this.loadCategoryData(fullDirectoryPath);
        const pageTitle = categoryData.label || this.formatSegmentTitle(segment);
        
        // Check if parent page already exists by searching children
        const existingPage = await this.findChildPage(currentParentId, pageTitle);
        
        if (existingPage) {
          currentParentId = existingPage.id;

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
   * Get or create content page for markdown file with hierarchy recreation support
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
          if (!existingPage.archived) {
            return existingPage;
          } else {
            console.warn(chalk.yellow(`⚠️ Existing page ${existingPageId} is archived, will create new one`));
          }
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Existing page ${existingPageId} not found, creating new one`));
        }
      }

      // Check if page exists under parent
      const existingPage = await this.findChildPage(parentId, title);
      if (existingPage && !existingPage.archived) {
        this.state.setPageId(filePath, existingPage.id);
        return existingPage;
      }

      // Create new content page
      console.log(chalk.green(`  📄 Creating content page: ${title}`));
      try {
        const newPage = await this.createContentPage(title, parentId);
        this.state.setPageId(filePath, newPage.id);
        return newPage;
      } catch (error) {
        if (error.message.includes('archived') || error.code === 'object_not_found') {
          // Parent page is problematic, recreate the entire hierarchy from scratch
          console.log(chalk.yellow(`⚠️ Parent page issue detected, recreating hierarchy from scratch for: ${title}`));
          
          // Clear hierarchy cache and state for this file's path
          this.clearHierarchyForFile(filePath);
          
          // Get root page ID from config
          const rootPageId = this.state.getRootPageId();
          if (!rootPageId) {
            throw new Error('No root page ID configured. Please set NOTION_ROOT_PAGE_ID in your .env file.');
          }
          
          // Recreate hierarchy from scratch
          const newParentId = await this.createPageHierarchy(filePath, rootPageId, false);
          
          // Create content page with new parent
          const newPage = await this.createContentPage(title, newParentId);
          this.state.setPageId(filePath, newPage.id);
          
          console.log(chalk.green(`✅ Successfully recreated hierarchy and created page: ${title}`));
          return newPage;
        }
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to get or create content page for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Create a content page for markdown file
   * @param {string} title - Page title
   * @param {string} parentId - Parent page ID
   * @returns {Object} Page object (existing or newly created)
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
   * @param {boolean} autoRecreate - Whether to automatically recreate deleted pages
   * @returns {Object} Validation result with statistics
   */
  async validateHierarchy(autoRecreate = false) {
    try {
      const hierarchyMap = this.state.getHierarchyMap();
      const orphanedPaths = [];
      const validatedPaths = [];
      const recreatedPaths = [];

      console.log(chalk.blue(`🔍 Validating ${Object.keys(hierarchyMap).length} hierarchy entries...`));

      for (const [pathKey, pageId] of Object.entries(hierarchyMap)) {
        try {
          await this.client.retrievePage(pageId);
          validatedPaths.push(pathKey);

        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Orphaned hierarchy reference: ${pathKey} -> ${pageId}`));
          orphanedPaths.push(pathKey);
          
          if (autoRecreate) {
            try {
              // Try to recreate the hierarchy page
              await this.recreateHierarchyPage(pathKey);
              recreatedPaths.push(pathKey);
              console.log(chalk.green(`  ✨ Recreated hierarchy page: ${pathKey}`));
            } catch (recreateError) {
              console.warn(chalk.yellow(`  ⚠️ Failed to recreate ${pathKey}: ${recreateError.message}`));
            }
          }
        }
      }

      // Clean up orphaned references (only if not auto-recreating)
      if (!autoRecreate) {
        for (const pathKey of orphanedPaths) {
          this.state.removeHierarchyPageId(pathKey);
        }
      }

      const result = {
        total: Object.keys(hierarchyMap).length,
        valid: validatedPaths.length,
        orphaned: orphanedPaths.length,
        recreated: recreatedPaths.length,
        cleaned: autoRecreate ? 0 : orphanedPaths.length
      };

      if (result.orphaned > 0) {
        if (autoRecreate) {
          console.log(chalk.blue(`🔧 Validation complete: ${result.valid} valid, ${result.orphaned} orphaned, ${result.recreated} recreated`));
        } else {
          console.log(chalk.blue(`🧹 Cleaned up ${result.cleaned} orphaned hierarchy references`));
        }
      } else {
        console.log(chalk.green(`✅ All hierarchy entries are valid`));
      }

      return result;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to validate hierarchy: ${error.message}`));
      return { error: error.message };
    }
  }

  /**
   * Recreate a deleted hierarchy page
   * @param {string} pathKey - Path key to recreate (e.g., 'tutorial-basics')
   * @returns {string} New page ID
   */
  async recreateHierarchyPage(pathKey) {
    try {
      // Parse the path to understand the hierarchy
      const segments = pathKey.split('/');
      const lastSegment = segments[segments.length - 1];
      
      // Determine parent page ID
      let parentId = this.config.rootPageId;
      
      if (segments.length > 1) {
        // Find parent page ID from hierarchy
        const parentPath = segments.slice(0, -1).join('/');
        const parentPageId = this.state.getHierarchyPageId(parentPath);
        
        if (parentPageId) {
          // Validate parent still exists
          try {
            await this.client.retrievePage(parentPageId);
            parentId = parentPageId;
          } catch (error) {
            // Parent also deleted, use root
            console.warn(chalk.yellow(`  ⚠️ Parent page ${parentPath} also deleted, using root`));
          }
        }
      }

      // Load category data if available
      const fullDirectoryPath = pathKey.replace(/^docs\//, '').split('/').join('/');
      const categoryData = await this.loadCategoryData(`docs/${fullDirectoryPath}`);
      const pageTitle = categoryData.label || this.formatSegmentTitle(lastSegment);
      
      // Create the page
      const newPage = await this.createParentPage(pageTitle, parentId, pathKey, categoryData);
      
      // Update state
      this.state.setHierarchyPageId(pathKey, newPage.id);
      this.hierarchyCache.set(pathKey, newPage.id);
      
      return newPage.id;
    } catch (error) {
      throw new Error(`Failed to recreate hierarchy page ${pathKey}: ${error.message}`);
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

  /**
   * Clear hierarchy cache and state for a specific file path
   * @param {string} filePath - File path
   */
  clearHierarchyForFile(filePath) {
    const pathSegments = this.extractPathSegments(filePath);
    const directorySegments = pathSegments.slice(0, -1); // Remove filename
    
    // Skip 'docs' prefix if present
    const shouldSkipDocs = directorySegments[0] === 'docs';
    const startIndex = shouldSkipDocs ? 1 : 0;
    
    // Clear cache and state for each level of hierarchy
    for (let i = startIndex; i < directorySegments.length; i++) {
      const pathSoFar = directorySegments.slice(startIndex, i + 1).join('/');
      this.hierarchyCache.delete(pathSoFar);
      this.state.removeHierarchyPageId(pathSoFar);
      
    }
  }
}

module.exports = NotionHierarchyManager; 