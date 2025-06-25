const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');
const matter = require('gray-matter');

const Config = require('../core/config');
const ConfluenceClient = require('../core/confluence-client');
const ConfluenceToMarkdown = require('../core/confluence-to-markdown');
const StateManager = require('../core/state-manager');

/**
 * Pull (sync) content from Confluence to Docusaurus
 * @param {Object} options - Pull options
 * @param {string} options.root - Root page title in Confluence
 * @param {string} options.target - Target directory (docs, blog)  
 * @param {boolean} options.dryRun - Preview mode without actual changes
 * @param {boolean} options.force - Force pull all files, ignore change detection
 */
async function pullFromConfluence(options = {}) {
  const { root, target = 'docs', dryRun = false, force = false } = options;
  const spinner = ora('Starting pull from Confluence...').start();

  try {
    const projectRoot = process.cwd();
    
    // Step 1: Load configuration
    spinner.text = 'Loading configuration...';
    const config = new Config();
    const confluenceConfig = await config.loadConfig();

    if (!root) {
      throw new Error('Root page title is required. Use --root option to specify the Confluence root page.');
    }

    // Step 2: Initialize state manager
    spinner.text = 'Initializing state manager...';
    const stateManager = new StateManager(projectRoot);
    await stateManager.init();

    // Step 3: Connect to Confluence
    spinner.text = 'Connecting to Confluence...';
    const confluenceClient = new ConfluenceClient(confluenceConfig);
    const connected = await confluenceClient.testConnection();
    
    if (!connected) {
      throw new Error('Failed to connect to Confluence');
    }

    // Step 4: Find root page
    spinner.text = `Finding root page: ${root}...`;
    const rootPage = await confluenceClient.findPageByTitle(root);
    
    if (!rootPage) {
      throw new Error(`Root page "${root}" not found in space ${confluenceConfig.spaceKey}`);
    }

    console.log(chalk.blue(`📂 Root page found: ${rootPage.title} (ID: ${rootPage.id})`));

    // Step 5: Get all pages under root
    spinner.text = 'Scanning Confluence pages...';
    const confluencePages = await confluenceClient.getPagesUnderRoot(rootPage.id);
    
    // Add root page itself to the list
    const rootPageContent = await confluenceClient.getPageContent(rootPage.id);
    confluencePages.unshift(rootPageContent);

    console.log(chalk.blue(`📄 Found ${confluencePages.length} pages in Confluence`));

    // Step 6: Initialize converter
    const converter = new ConfluenceToMarkdown(confluenceClient, projectRoot);

    // Step 7: Process pages
    spinner.text = 'Processing pages...';
    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    for (const page of confluencePages) {
      try {
        const relativePath = generateRelativePath(page, rootPage, target, stateManager);
        const localFilePath = path.join(projectRoot, relativePath);
        
        // Check if page needs to be synced
        if (!force && !await shouldPullPage(page, localFilePath, stateManager)) {
          results.skipped++;
          console.log(chalk.gray(`⏭️  Skipped: ${page.title} (no changes)`));
          continue;
        }

        results.processed++;
        
        if (dryRun) {
          console.log(chalk.cyan(`📋 Would pull: ${page.title} → ${relativePath}`));
          continue;
        }

        // Get existing frontmatter if file exists
        let existingFrontmatter = {};
        if (await fs.pathExists(localFilePath)) {
          try {
            const existingContent = await fs.readFile(localFilePath, 'utf8');
            const existingMatter = matter(existingContent);
            existingFrontmatter = existingMatter.data || {};
          } catch (error) {
            console.warn(chalk.yellow(`⚠️ Could not read existing frontmatter: ${error.message}`));
          }
        }

        // Convert Confluence content to Markdown
        spinner.text = `Converting: ${page.title}...`;
        const conversionResult = await converter.convertToMarkdown(
          page.body.storage.value,
          page.id,
          relativePath,
          existingFrontmatter
        );

        // Prepare final markdown content with frontmatter, preserving existing values
        const frontmatter = {
          ...existingFrontmatter, // Keep existing frontmatter
          title: page.title,
          confluence_id: page.id,
          confluence_version: page.version.number,
          last_modified: page.version.when,
          ...conversionResult.frontmatter
        };

        const finalMarkdown = matter.stringify(conversionResult.markdown, frontmatter);

        // Ensure directory exists
        await fs.ensureDir(path.dirname(localFilePath));

        // Check if file exists
        const fileExists = await fs.pathExists(localFilePath);

        // Write markdown file
        await fs.writeFile(localFilePath, finalMarkdown, 'utf8');

        // Update state
        await stateManager.setPageState(relativePath, {
          confluenceId: page.id,
          title: page.title,
          lastModified: new Date(page.version.when).toISOString(),
          version: page.version.number,
          localPath: relativePath,
          lastPulled: new Date().toISOString()
        });

        if (fileExists) {
          results.updated++;
          console.log(chalk.yellow(`📝 Updated: ${page.title} → ${relativePath}`));
        } else {
          results.created++;
          console.log(chalk.green(`📄 Created: ${page.title} → ${relativePath}`));
        }

        // Log attachment downloads
        if (conversionResult.attachments && conversionResult.attachments.length > 0) {
          console.log(chalk.blue(`📎 Downloaded ${conversionResult.attachments.length} attachment(s)`));
        }

      } catch (error) {
        results.failed++;
        results.errors.push({ page: page.title, error: error.message });
        console.error(chalk.red(`❌ Failed to pull ${page.title}: ${error.message}`));
      }
    }

    // Step 8: Save state
    if (!dryRun) {
      spinner.text = 'Saving state...';
      await stateManager.updateStats(results);
      await stateManager.saveState();
    }

    spinner.succeed('Pull completed');

    // Step 9: Display results
    console.log(chalk.green('\n✅ PULL SUMMARY:'));
    console.log(chalk.white('Total pages:'), confluencePages.length);
    console.log(chalk.white('Processed:'), results.processed);
    console.log(chalk.white('Created:'), results.created);
    console.log(chalk.white('Updated:'), results.updated);
    console.log(chalk.white('Skipped:'), results.skipped);
    console.log(chalk.white('Failed:'), results.failed);

    if (dryRun) {
      console.log(chalk.yellow('\n⚠️ This was a dry run. No files were actually modified.'));
    }

    if (results.errors.length > 0) {
      console.log(chalk.red('\n❌ ERRORS:'));
      results.errors.forEach(error => {
        console.log(chalk.red(`  • ${error.page}: ${error.error}`));
      });
    }

    return results;

  } catch (error) {
    spinner.fail('Pull failed');
    
    console.error(chalk.red('\n❌ ERROR:'));
    console.error(chalk.white('Message:'), error.message);
    
    if (error.stack && process.env.DEBUG) {
      console.error(chalk.gray('Stack:'), error.stack);
    }

    throw error;
  }
}

/**
 * Generate relative path for a Confluence page
 * @param {Object} page - Confluence page data
 * @param {Object} rootPage - Root page data
 * @param {string} target - Target directory (docs, blog)
 * @param {StateManager} stateManager - State manager to check existing paths
 * @returns {string} - Relative path for the markdown file
 */
function generateRelativePath(page, rootPage, target, stateManager) {
  // Check if this page already exists in state (by confluenceId)
  const existingPageState = stateManager.getPageStateByConfluenceId(page.id);
  if (existingPageState) {
    return existingPageState.filePath;
  }

  // Check if page with same title exists in state
  const existingByTitle = stateManager.getPageStateByTitle(page.title);
  if (existingByTitle) {
    return existingByTitle.filePath;
  }

  // If it's the root page itself, use index.md
  if (page.id === rootPage.id) {
    return path.join(target, 'index.md');
  }

  // Build path from ancestors, excluding space and root page
  const pathSegments = [];
  
  if (page.ancestors) {
    const relevantAncestors = page.ancestors.filter(ancestor => 
      ancestor.id !== rootPage.id && 
      ancestor.type === 'page' &&
      ancestor.type !== 'space'  // Ignore space ancestors
    );
    
    relevantAncestors.forEach(ancestor => {
      pathSegments.push(slugify(ancestor.title));
    });
  }

  // Add the page itself
  const filename = `${slugify(page.title)}.md`;
  
  if (pathSegments.length > 0) {
    return path.join(target, ...pathSegments, filename);
  } else {
    return path.join(target, filename);
  }
}

/**
 * Convert title to filesystem-safe slug
 * @param {string} title - Page title
 * @returns {string} - Filesystem-safe slug
 */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with single
    .trim();
}

/**
 * Check if a page should be pulled based on modification dates and state
 * @param {Object} page - Confluence page data
 * @param {string} localFilePath - Local file path
 * @param {StateManager} stateManager - State manager instance
 * @returns {boolean} - True if page should be pulled
 */
async function shouldPullPage(page, localFilePath, stateManager) {
  try {
    // Check if local file exists
    const fileExists = await fs.pathExists(localFilePath);
    
    if (!fileExists) {
      return true; // Always pull if local file doesn't exist
    }

    const relativePath = path.relative(process.cwd(), localFilePath);
    
    // First check by confluence ID (most reliable)
    const pageStateById = stateManager.getPageStateByConfluenceId(page.id);
    if (pageStateById) {
      // Update the path if it changed
      if (pageStateById.filePath !== relativePath) {
        console.log(chalk.blue(`📁 Page path changed: ${pageStateById.filePath} → ${relativePath}`));
        return true;
      }
      
      // Compare versions
      const confluenceVersion = page.version.number;
      const storedVersion = pageStateById.version || 0;
      
      if (confluenceVersion > storedVersion) {
        return true; // Pull if Confluence version is newer
      }
      
      // Compare modification dates
      const confluenceModified = new Date(page.version.when);
      const lastPulled = pageStateById.lastPulled ? new Date(pageStateById.lastPulled) : new Date(0);
      
      return confluenceModified > lastPulled;
    }

    // Fallback: check by file path
    const pageState = stateManager.getPageState(relativePath);
    
    if (!pageState) {
      return true; // Pull if no state tracked
    }

    // If we have state but no confluenceId, always pull to update state
    if (!pageState.confluenceId) {
      return true;
    }

    // Compare Confluence version with stored version
    const confluenceVersion = page.version.number;
    const storedVersion = pageState.version || 0;
    
    if (confluenceVersion > storedVersion) {
      return true; // Pull if Confluence version is newer
    }

    // Compare modification dates
    const confluenceModified = new Date(page.version.when);
    const lastPulled = pageState.lastPulled ? new Date(pageState.lastPulled) : new Date(0);
    
    return confluenceModified > lastPulled;
    
  } catch (error) {
    console.warn(chalk.yellow(`⚠️ Could not check if page should be pulled: ${error.message}`));
    return true; // Pull if we can't determine
  }
}

module.exports = {
  pullFromConfluence,
  generateRelativePath
}; 