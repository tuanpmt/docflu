const path = require('path');
const chalk = require('chalk');

/**
 * ConfluenceLinkConverter - Convert Confluence links back to Markdown relative links
 *
 * This class provides reverse conversion functionality:
 * - Parse Confluence URLs (modern, legacy, display, tiny formats)
 * - Convert Confluence page links to relative Markdown paths
 * - Process content containing Confluence links and convert them to Markdown
 */
class ConfluenceLinkConverter {
  constructor(projectRoot, stateManager, confluenceConfig = {}) {
    this.projectRoot = projectRoot;
    this.stateManager = stateManager;
    this.docsDir = path.join(projectRoot, 'docs');
    this.confluenceConfig = confluenceConfig;

    // Build reverse lookup map: confluenceId -> relativePath
    this.pageIdToPathMap = this.buildReverseMap();
  }

  /**
   * Build reverse lookup map from state manager
   * Maps Confluence page IDs to relative markdown paths
   */
  buildReverseMap() {
    const map = new Map();
    const allPages = this.stateManager.getAllPages();

    for (const [relativePath, pageState] of Object.entries(allPages)) {
      if (pageState.confluenceId) {
        map.set(String(pageState.confluenceId), {
          relativePath,
          title: pageState.title,
          slug: pageState.slug
        });
      }
    }

    return map;
  }

  /**
   * Refresh the reverse lookup map (call after state changes)
   */
  refreshReverseMap() {
    this.pageIdToPathMap = this.buildReverseMap();
  }

  /**
   * Process content and convert all Confluence links to Markdown links
   * @param {string} content - Content containing Confluence links
   * @param {string} currentFilePath - Current file path for relative link calculation
   * @returns {Object} - { content, stats }
   */
  processContent(content, currentFilePath = null) {
    let processedContent = content;
    const stats = {
      total: 0,
      converted: 0,
      failed: 0,
      unchanged: 0
    };

    // Process different link formats
    processedContent = this.processMarkdownLinks(processedContent, currentFilePath, stats);
    processedContent = this.processHtmlLinks(processedContent, currentFilePath, stats);
    processedContent = this.processReferenceStyleLinks(processedContent, currentFilePath, stats);
    processedContent = this.processPlainUrls(processedContent, currentFilePath, stats);

    return { content: processedContent, stats };
  }

  /**
   * Process standard markdown links [text](url)
   */
  processMarkdownLinks(content, currentFilePath, stats) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    return content.replace(linkRegex, (match, linkText, linkUrl) => {
      stats.total++;

      if (!this.isConfluenceUrl(linkUrl)) {
        stats.unchanged++;
        return match;
      }

      const result = this.convertConfluenceUrl(linkUrl, currentFilePath);
      if (result.success) {
        stats.converted++;
        console.log(chalk.blue(`🔗 Converted: ${linkUrl} → ${result.markdownPath}`));
        return `[${linkText}](${result.markdownPath})`;
      } else {
        stats.failed++;
        console.warn(chalk.yellow(`⚠️ Could not convert: ${linkUrl}`));
        return match;
      }
    });
  }

  /**
   * Process HTML links <a href="url">text</a>
   */
  processHtmlLinks(content, currentFilePath, stats) {
    const htmlLinkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;

    return content.replace(htmlLinkRegex, (match, linkUrl, linkText) => {
      stats.total++;

      if (!this.isConfluenceUrl(linkUrl)) {
        stats.unchanged++;
        return match;
      }

      const result = this.convertConfluenceUrl(linkUrl, currentFilePath);
      if (result.success) {
        stats.converted++;
        console.log(chalk.blue(`🔗 Converted HTML: ${linkUrl} → ${result.markdownPath}`));
        // Convert to markdown link format
        return `[${linkText || result.title}](${result.markdownPath})`;
      } else {
        stats.failed++;
        console.warn(chalk.yellow(`⚠️ Could not convert HTML link: ${linkUrl}`));
        return match;
      }
    });
  }

  /**
   * Process reference-style links [text][ref] and [ref]: url
   */
  processReferenceStyleLinks(content, currentFilePath, stats) {
    const refDefRegex = /^\s*\[([^\]]+)\]:\s*(.+)$/gm;

    return content.replace(refDefRegex, (match, refId, refUrl) => {
      const trimmedUrl = refUrl.trim();
      stats.total++;

      if (!this.isConfluenceUrl(trimmedUrl)) {
        stats.unchanged++;
        return match;
      }

      const result = this.convertConfluenceUrl(trimmedUrl, currentFilePath);
      if (result.success) {
        stats.converted++;
        console.log(chalk.blue(`🔗 Converted ref: ${trimmedUrl} → ${result.markdownPath}`));
        return `[${refId}]: ${result.markdownPath}`;
      } else {
        stats.failed++;
        console.warn(chalk.yellow(`⚠️ Could not convert ref: ${trimmedUrl}`));
        return match;
      }
    });
  }

  /**
   * Process plain URLs in text (not wrapped in links)
   */
  processPlainUrls(content, currentFilePath, stats) {
    // Match Confluence URLs that are not already part of a markdown/HTML link
    const plainUrlRegex = /(?<!\]\()(?<!")(?<!')(?<!=)(https?:\/\/[^\s\])"'>]+\/wiki\/[^\s\])"'>]+)/g;

    return content.replace(plainUrlRegex, (match, url) => {
      if (!this.isConfluenceUrl(url)) {
        return match;
      }

      stats.total++;
      const result = this.convertConfluenceUrl(url, currentFilePath);
      if (result.success) {
        stats.converted++;
        console.log(chalk.blue(`🔗 Converted plain URL: ${url} → ${result.markdownPath}`));
        return result.markdownPath;
      } else {
        stats.failed++;
        return match;
      }
    });
  }

  /**
   * Check if URL is a Confluence URL
   */
  isConfluenceUrl(url) {
    if (!url) return false;

    const confluencePatterns = [
      /\/wiki\/spaces\/[^\/]+\/pages\/\d+/,           // Modern format
      /\/pages\/viewpage\.action\?pageId=\d+/,       // Legacy format
      /\/display\/[^\/]+\/.*\?pageId=\d+/,           // Display format
      /\/pages\/editpage\.action\?pageId=\d+/,       // Edit format
      /\/x\/[A-Za-z0-9]+/,                           // Tiny link format
      /[\?&]pageId=\d+/                              // Any URL with pageId param
    ];

    // Also check against configured base URL
    const baseUrl = this.confluenceConfig.baseUrl;
    if (baseUrl && url.includes(baseUrl)) {
      return true;
    }

    return confluencePatterns.some(pattern => pattern.test(url));
  }

  /**
   * Convert Confluence URL to Markdown path
   * @param {string} url - Confluence URL
   * @param {string} currentFilePath - Current file for relative path calculation
   * @returns {Object} - { success, markdownPath, title, pageId }
   */
  convertConfluenceUrl(url, currentFilePath = null) {
    try {
      const parseResult = this.parseConfluenceUrl(url);

      if (!parseResult.pageId) {
        return { success: false, error: 'Could not extract page ID from URL' };
      }

      // Look up page in reverse map
      const pageInfo = this.pageIdToPathMap.get(String(parseResult.pageId));

      if (!pageInfo) {
        return {
          success: false,
          error: `Page ID ${parseResult.pageId} not found in state`,
          pageId: parseResult.pageId
        };
      }

      // Calculate relative path
      let markdownPath = this.calculateRelativePath(pageInfo.relativePath, currentFilePath);

      // Add anchor if present
      if (parseResult.anchor) {
        markdownPath += `#${parseResult.anchor}`;
      }

      return {
        success: true,
        markdownPath,
        title: pageInfo.title,
        pageId: parseResult.pageId,
        relativePath: pageInfo.relativePath
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse Confluence URL to extract page ID and other info
   * @param {string} url - Confluence URL
   * @returns {Object} - { pageId, spaceKey, title, anchor }
   */
  parseConfluenceUrl(url) {
    const result = {
      pageId: null,
      spaceKey: null,
      title: null,
      anchor: null
    };

    if (!url) return result;

    // Extract anchor if present
    const [urlWithoutAnchor, anchor] = url.split('#');
    result.anchor = anchor || null;

    // Pattern 1: Modern format /wiki/spaces/SPACE/pages/123456/Page+Title
    const modernMatch = urlWithoutAnchor.match(/\/wiki\/spaces\/([^\/]+)\/pages\/(\d+)(?:\/([^?#]+))?/);
    if (modernMatch) {
      result.spaceKey = modernMatch[1];
      result.pageId = modernMatch[2];
      result.title = modernMatch[3] ? decodeURIComponent(modernMatch[3].replace(/\+/g, ' ')) : null;
      return result;
    }

    // Pattern 2: Legacy format /pages/viewpage.action?pageId=123456
    const legacyMatch = urlWithoutAnchor.match(/\/pages\/viewpage\.action\?pageId=(\d+)/);
    if (legacyMatch) {
      result.pageId = legacyMatch[1];
      return result;
    }

    // Pattern 3: Edit format /pages/editpage.action?pageId=123456
    const editMatch = urlWithoutAnchor.match(/\/pages\/editpage\.action\?pageId=(\d+)/);
    if (editMatch) {
      result.pageId = editMatch[1];
      return result;
    }

    // Pattern 4: Display format /display/SPACE/Title with pageId query param
    const displayMatch = urlWithoutAnchor.match(/\/display\/([^\/]+)\/([^?]+)/);
    if (displayMatch) {
      result.spaceKey = displayMatch[1];
      result.title = decodeURIComponent(displayMatch[2].replace(/\+/g, ' '));

      // Try to extract pageId from query string
      const pageIdMatch = urlWithoutAnchor.match(/[\?&]pageId=(\d+)/);
      if (pageIdMatch) {
        result.pageId = pageIdMatch[1];
      }
      return result;
    }

    // Pattern 5: Tiny link format /x/abcdef (Base64 encoded page ID)
    const tinyMatch = urlWithoutAnchor.match(/\/x\/([A-Za-z0-9_-]+)/);
    if (tinyMatch) {
      // Tiny links use Base64 encoding of the page ID
      try {
        const decoded = Buffer.from(tinyMatch[1], 'base64').toString('utf-8');
        const pageIdFromTiny = decoded.match(/(\d+)/);
        if (pageIdFromTiny) {
          result.pageId = pageIdFromTiny[1];
        }
      } catch (e) {
        // If decoding fails, try using it directly
        result.pageId = tinyMatch[1];
      }
      return result;
    }

    // Pattern 6: Any URL with pageId parameter
    const pageIdParamMatch = urlWithoutAnchor.match(/[\?&]pageId=(\d+)/);
    if (pageIdParamMatch) {
      result.pageId = pageIdParamMatch[1];

      // Try to extract space key
      const spaceMatch = urlWithoutAnchor.match(/\/spaces\/([^\/]+)/);
      if (spaceMatch) {
        result.spaceKey = spaceMatch[1];
      }
      return result;
    }

    return result;
  }

  /**
   * Calculate relative path from current file to target file
   * @param {string} targetPath - Target file relative path from docs root
   * @param {string} currentFilePath - Current file path
   * @returns {string} - Relative path
   */
  calculateRelativePath(targetPath, currentFilePath = null) {
    // Ensure .md extension
    let normalizedTarget = targetPath;
    if (!normalizedTarget.endsWith('.md')) {
      normalizedTarget += '.md';
    }

    // If no current file, return as docs-relative path
    if (!currentFilePath) {
      return `./${normalizedTarget}`;
    }

    // Get current file directory relative to docs
    const currentDir = path.dirname(currentFilePath);

    // Calculate relative path
    const relativePath = path.relative(currentDir, normalizedTarget);

    // Ensure it starts with ./ or ../
    if (!relativePath.startsWith('.')) {
      return `./${relativePath}`;
    }

    return relativePath;
  }

  /**
   * Get statistics about convertible links in content
   */
  analyzeContent(content) {
    const stats = {
      totalLinks: 0,
      confluenceLinks: 0,
      convertibleLinks: 0,
      unconvertibleLinks: 0,
      details: []
    };

    // Find all links
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const htmlLinkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;

    let match;

    // Check markdown links
    while ((match = markdownLinkRegex.exec(content)) !== null) {
      stats.totalLinks++;
      const url = match[2];

      if (this.isConfluenceUrl(url)) {
        stats.confluenceLinks++;
        const parseResult = this.parseConfluenceUrl(url);
        const pageInfo = parseResult.pageId ? this.pageIdToPathMap.get(String(parseResult.pageId)) : null;

        if (pageInfo) {
          stats.convertibleLinks++;
          stats.details.push({
            type: 'markdown',
            url,
            pageId: parseResult.pageId,
            canConvert: true,
            targetPath: pageInfo.relativePath
          });
        } else {
          stats.unconvertibleLinks++;
          stats.details.push({
            type: 'markdown',
            url,
            pageId: parseResult.pageId,
            canConvert: false,
            reason: parseResult.pageId ? 'Page ID not in state' : 'Could not parse page ID'
          });
        }
      }
    }

    // Check HTML links
    while ((match = htmlLinkRegex.exec(content)) !== null) {
      stats.totalLinks++;
      const url = match[1];

      if (this.isConfluenceUrl(url)) {
        stats.confluenceLinks++;
        const parseResult = this.parseConfluenceUrl(url);
        const pageInfo = parseResult.pageId ? this.pageIdToPathMap.get(String(parseResult.pageId)) : null;

        if (pageInfo) {
          stats.convertibleLinks++;
          stats.details.push({
            type: 'html',
            url,
            pageId: parseResult.pageId,
            canConvert: true,
            targetPath: pageInfo.relativePath
          });
        } else {
          stats.unconvertibleLinks++;
          stats.details.push({
            type: 'html',
            url,
            pageId: parseResult.pageId,
            canConvert: false,
            reason: parseResult.pageId ? 'Page ID not in state' : 'Could not parse page ID'
          });
        }
      }
    }

    return stats;
  }

  /**
   * Convert a single Confluence URL to markdown path (convenience method)
   * @param {string} url - Confluence URL
   * @returns {string|null} - Markdown path or null if conversion failed
   */
  convertSingleUrl(url) {
    const result = this.convertConfluenceUrl(url);
    return result.success ? result.markdownPath : null;
  }

  /**
   * Batch convert multiple URLs
   * @param {string[]} urls - Array of Confluence URLs
   * @returns {Object[]} - Array of conversion results
   */
  convertMultipleUrls(urls) {
    return urls.map(url => ({
      original: url,
      ...this.convertConfluenceUrl(url)
    }));
  }
}

module.exports = ConfluenceLinkConverter;
