const path = require('path');
const chalk = require('chalk');

class ReferenceProcessor {
  constructor(projectRoot, stateManager) {
    this.projectRoot = projectRoot;
    this.stateManager = stateManager;
    this.docsDir = path.join(projectRoot, 'docs');
    this.staticDir = path.join(projectRoot, 'static');
  }

  /**
   * Process all internal references in markdown content
   * @param {string} markdown - Original markdown content
   * @param {string} currentFilePath - Path of current file being processed
   * @param {string} baseUrl - Confluence base URL
   * @returns {string} - Processed markdown with converted references
   */
  processReferences(markdown, currentFilePath, baseUrl) {
    let processedMarkdown = markdown;

    // Process different types of references
    processedMarkdown = this.processMarkdownLinks(processedMarkdown, currentFilePath, baseUrl);
    processedMarkdown = this.processReferenceStyleLinks(processedMarkdown, currentFilePath, baseUrl);
    processedMarkdown = this.processHtmlLinks(processedMarkdown, currentFilePath, baseUrl);

    return processedMarkdown;
  }

  /**
   * Process standard markdown links [text](url)
   */
  processMarkdownLinks(markdown, currentFilePath, baseUrl) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    return markdown.replace(linkRegex, (match, linkText, linkUrl) => {
      const processedUrl = this.processLinkUrl(linkUrl, currentFilePath, baseUrl);
      return `[${linkText}](${processedUrl})`;
    });
  }

  /**
   * Process reference-style links [text][ref] and [ref]: url
   */
  processReferenceStyleLinks(markdown, currentFilePath, baseUrl) {
    // Find all reference definitions [ref]: url
    const refDefRegex = /^\s*\[([^\]]+)\]:\s*(.+)$/gm;
    const refDefs = new Map();
    
    // Extract reference definitions
    let match;
    while ((match = refDefRegex.exec(markdown)) !== null) {
      const [fullMatch, refId, refUrl] = match;
      const processedUrl = this.processLinkUrl(refUrl.trim(), currentFilePath, baseUrl);
      refDefs.set(refId, processedUrl);
    }

    // Replace reference definitions with processed URLs
    let processedMarkdown = markdown.replace(refDefRegex, (match, refId, refUrl) => {
      const processedUrl = refDefs.get(refId);
      return `[${refId}]: ${processedUrl}`;
    });

    return processedMarkdown;
  }

  /**
   * Process HTML links <a href="url">text</a>
   */
  processHtmlLinks(markdown, currentFilePath, baseUrl) {
    const htmlLinkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    
    return markdown.replace(htmlLinkRegex, (match, linkUrl, linkText) => {
      const processedUrl = this.processLinkUrl(linkUrl, currentFilePath, baseUrl);
      return match.replace(linkUrl, processedUrl);
    });
  }

  /**
   * Process individual link URL
   */
  processLinkUrl(url, currentFilePath, baseUrl) {
    // Skip external URLs
    if (this.isExternalUrl(url)) {
      return url;
    }

    // Skip anchor-only links
    if (url.startsWith('#')) {
      return url;
    }

    // Process internal references
    if (this.isInternalDocReference(url)) {
      return this.convertToConfluenceUrl(url, currentFilePath, baseUrl);
    }

    // Return unchanged for other cases
    return url;
  }

  /**
   * Check if URL is external
   */
  isExternalUrl(url) {
    return /^https?:\/\//.test(url) || /^mailto:/.test(url) || /^tel:/.test(url);
  }

  /**
   * Check if URL is internal doc reference
   */
  isInternalDocReference(url) {
    // Docusaurus relative paths
    if (url.startsWith('./') || url.startsWith('../')) {
      return url.includes('.md');
    }

    // Docusaurus absolute paths
    if (url.startsWith('/docs/')) {
      return true;
    }

    // Root-relative paths
    if (url.startsWith('/') && !url.startsWith('/img/') && !url.startsWith('/static/')) {
      return true;
    }

    return false;
  }

  /**
   * Convert internal reference to Confluence URL
   */
  convertToConfluenceUrl(url, currentFilePath, baseUrl) {
    try {
      const targetPath = this.resolveTargetPath(url, currentFilePath);
      const pageState = this.findPageByPath(targetPath);

      if (pageState) {
        // Extract anchor if present
        const [urlPath, anchor] = url.split('#');
        
        // Use modern Confluence URL format: /wiki/spaces/SPACE/pages/ID/title
        // Extract space key from baseUrl if available
        const spaceKey = this.extractSpaceKey(baseUrl) || 'DOCS';
        const pageTitle = this.slugifyTitle(pageState.title);
        let confluenceUrl = `${baseUrl}/wiki/spaces/${spaceKey}/pages/${pageState.confluenceId}/${pageTitle}`;
        
        if (anchor) {
          confluenceUrl += `#${anchor}`;
        }

        console.log(chalk.blue(`🔗 Converted link: ${url} → ${confluenceUrl}`));
        return confluenceUrl;
      } else {
        console.warn(chalk.yellow(`⚠️ Could not resolve internal reference: ${url}`));
        return url; // Keep original if can't resolve
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Error processing reference ${url}: ${error.message}`));
      return url;
    }
  }

  /**
   * Extract space key from Confluence config or detect from existing state
   */
  extractSpaceKey(baseUrl) {
    // Try to get space key from environment or config
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
    if (spaceKey) {
      return spaceKey;
    }

    // Try to detect from existing pages in state
    const allPages = this.stateManager.getAllPages();
    const firstPage = Object.values(allPages)[0];
    if (firstPage && firstPage.spaceKey) {
      return firstPage.spaceKey;
    }

    // Default fallback
    return 'DOCS';
  }

  /**
   * Convert page title to URL-friendly slug
   */
  slugifyTitle(title) {
    return title
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '+')     // Replace spaces with +
      .replace(/-+/g, '-')      // Replace multiple dashes with single
      .replace(/^-|-$/g, '');   // Remove leading/trailing dashes
  }

  /**
   * Resolve target path from URL
   */
  resolveTargetPath(url, currentFilePath) {
    const currentDir = path.dirname(currentFilePath);
    
    // Handle different URL formats
    if (url.startsWith('./') || url.startsWith('../')) {
      // Relative path
      const relativePath = url.split('#')[0]; // Remove anchor
      const absolutePath = path.resolve(currentDir, relativePath);
      return path.relative(this.docsDir, absolutePath);
    } else if (url.startsWith('/docs/')) {
      // Docusaurus absolute path
      const docPath = url.replace('/docs/', '').split('#')[0];
      return docPath.endsWith('.md') ? docPath : `${docPath}.md`;
    } else if (url.startsWith('/')) {
      // Root-relative path
      const docPath = url.substring(1).split('#')[0];
      return docPath.endsWith('.md') ? docPath : `${docPath}.md`;
    }

    return url;
  }

  /**
   * Find page state by file path
   */
  findPageByPath(targetPath) {
    const allPages = this.stateManager.getAllPages();
    
    // Try exact match first
    if (allPages[targetPath]) {
      return allPages[targetPath];
    }

    // Try with .md extension
    const withMd = targetPath.endsWith('.md') ? targetPath : `${targetPath}.md`;
    if (allPages[withMd]) {
      return allPages[withMd];
    }

    // Try without .md extension
    const withoutMd = targetPath.replace(/\.md$/, '');
    const matchingKey = Object.keys(allPages).find(key => 
      key.replace(/\.md$/, '') === withoutMd
    );

    if (matchingKey) {
      return allPages[matchingKey];
    }

    // Try fuzzy matching
    const fuzzyMatch = Object.keys(allPages).find(key => {
      const keyNormalized = key.replace(/\.md$/, '').replace(/[\/\\]/g, '/');
      const targetNormalized = targetPath.replace(/\.md$/, '').replace(/[\/\\]/g, '/');
      return keyNormalized.endsWith(targetNormalized) || targetNormalized.endsWith(keyNormalized);
    });

    if (fuzzyMatch) {
      return allPages[fuzzyMatch];
    }

    return null;
  }

  /**
   * Get reference statistics
   */
  getStats(markdown) {
    const markdownLinks = (markdown.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length;
    const htmlLinks = (markdown.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi) || []).length;
    const referenceLinks = (markdown.match(/^\s*\[([^\]]+)\]:\s*(.+)$/gm) || []).length;

    const internalLinks = this.countInternalLinks(markdown);
    const externalLinks = markdownLinks + htmlLinks - internalLinks;

    return {
      total: markdownLinks + htmlLinks + referenceLinks,
      markdown: markdownLinks,
      html: htmlLinks,
      reference: referenceLinks,
      internal: internalLinks,
      external: externalLinks
    };
  }

  /**
   * Count internal links in markdown
   */
  countInternalLinks(markdown) {
    const allLinkRegex = /\[([^\]]+)\]\(([^)]+)\)|<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let count = 0;
    let match;

    while ((match = allLinkRegex.exec(markdown)) !== null) {
      const url = match[2] || match[3]; // markdown or HTML link
      if (url && this.isInternalDocReference(url)) {
        count++;
      }
    }

    return count;
  }
}

module.exports = ReferenceProcessor; 