const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');
const AttachmentProcessor = require('./attachment-processor');

/**
 * Link Processor for Google Docs
 * Handles external links and local attachment processing
 * Based on PLAN2.md Phase 3 requirements
 */
class LinkProcessor {
  constructor(googleDriveClient, projectRoot, stateManager = null) {
    this.googleDriveClient = googleDriveClient;
    this.projectRoot = projectRoot || process.cwd();
    this.stateManager = stateManager;
    this.debug = process.env.DEBUG_GDOCS_CONVERTER === 'true';
    this.debugDir = path.join(this.projectRoot, '.docusaurus', 'debug', 'gdocs-link-processor');
    
    // Initialize attachment processor
    this.attachmentProcessor = new AttachmentProcessor(googleDriveClient, stateManager, projectRoot);
    
    // Link patterns for detection
    this.linkPatterns = {
      external: /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,           // [text](http://...)
      localFile: /\[([^\]]+)\]\(\/files\/([^)]+)\)/g,           // [text](/files/...)
      relativePath: /\[([^\]]+)\]\(\.\/([^)]+)\)/g,             // [text](./file.pdf)
      docusaurusPath: /\[([^\]]+)\]\(\/([^)]+\.[^)]+)\)/g       // [text](/path/file.ext)
    };
    
    this.stats = {
      linksFound: 0,
      duplicatesRemoved: 0,
      linksProcessed: 0,
      externalLinks: 0,
      localAttachments: 0,
      attachmentsUploaded: 0,
      attachmentsCached: 0,
      errors: []
    };
  }

  /**
   * Initialize the link processor
   */
  async initialize() {
    // Initialize attachment processor
    if (this.attachmentProcessor && typeof this.attachmentProcessor.initialize === 'function') {
      await this.attachmentProcessor.initialize();
    }
  }

  /**
   * Process all links in markdown content
   * @param {string} markdownContent - Original markdown content
   * @param {string} filePath - Path to markdown file
   * @returns {Object} - { processedMarkdown, linkRequests, stats }
   */
  async processLinks(markdownContent, filePath) {
    const debugInfo = this.debug ? {
      timestamp: new Date().toISOString(),
      filePath: filePath,
      input: {
        markdownLength: markdownContent.length,
        filePath: filePath
      },
      processing: {
        phases: [],
        links: [],
        attachments: [],
        uploads: []
      },
      output: {},
      errors: []
    } : null;

    try {
      if (debugInfo) {
        debugInfo.processing.phases.push({
          phase: 'initialization',
          timestamp: new Date().toISOString(),
          inputLength: markdownContent.length,
          filePath: filePath
        });
      }

      // Reset stats
      this.stats = {
        linksFound: 0,
        duplicatesRemoved: 0,
        linksProcessed: 0,
        externalLinks: 0,
        localAttachments: 0,
        attachmentsUploaded: 0,
        attachmentsCached: 0,
        errors: []
      };

      // Extract all links from markdown
      const links = this.extractLinks(markdownContent, filePath);
      this.stats.linksFound = links.length;

      if (debugInfo) {
        debugInfo.processing.links = links.map(link => ({
          type: link.type,
          text: link.text,
          url: link.url,
          isLocal: link.isLocal,
          originalUrl: link.originalUrl || link.url
        }));
        
        debugInfo.processing.phases.push({
          phase: 'link_extraction',
          timestamp: new Date().toISOString(),
          linksFound: links.length,
          duplicatesRemoved: this.stats.duplicatesRemoved
        });
      }

      if (links.length === 0) {
        if (debugInfo) {
          debugInfo.output = {
            processedMarkdown: markdownContent,
            linkRequests: [],
            stats: this.stats
          };
          await this.saveDebugInfo(debugInfo);
        }
        
        return {
          processedMarkdown: markdownContent,
          linkRequests: [],
          stats: this.stats
        };
      }

      // Process local attachments (upload to Google Drive)
      const localLinks = links.filter(link => link.isLocal);
      const attachmentMap = await this.processAttachments(localLinks, debugInfo);
      
      // Generate link requests for Google Docs
      const { processedMarkdown, linkRequests } = this.generateLinkRequests(markdownContent, links, attachmentMap);

      this.stats.linksProcessed = linkRequests.length;

      if (debugInfo) {
        debugInfo.processing.phases.push({
          phase: 'link_formatting',
          timestamp: new Date().toISOString(),
          placeholdersProcessed: linkRequests.length,
          formattingApplied: linkRequests.length
        });
        
        debugInfo.output = {
          processedMarkdown: processedMarkdown,
          processedMarkdownLength: processedMarkdown.length,
          linkRequestsCount: linkRequests.length,
          linkRequests: linkRequests.map(req => ({
            type: req.type,
            text: req.text,
            url: req.url,
            placeholder: req.placeholder,
            isExternal: req.isExternal
          })),
          stats: this.stats
        };
        await this.saveDebugInfo(debugInfo);
      }

      return {
        processedMarkdown,
        linkRequests,
        stats: this.stats
      };

    } catch (error) {
      console.error(chalk.red('❌ Link processing failed:'), error.message);
      this.stats.errors.push(`Link processing: ${error.message}`);
      
      if (debugInfo) {
        debugInfo.errors.push({
          type: 'link_processing_error',
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        await this.saveDebugInfo(debugInfo, 'error');
      }
      
      return { processedMarkdown: markdownContent, linkRequests: [], stats: this.stats };
    }
  }

  /**
   * Extract all links from markdown content
   * @param {string} markdownContent - Markdown content
   * @param {string} filePath - Path to markdown file
   * @returns {Array} - Array of link objects
   */
  extractLinks(markdownContent, filePath) {
    const links = [];
    
    // 1. Extract external links
    let match;
    this.linkPatterns.external.lastIndex = 0;
    while ((match = this.linkPatterns.external.exec(markdownContent)) !== null) {
      // Skip markdown images (![alt](src)) - they should be handled by image processor
      const startIndex = match.index;
      if (startIndex > 0 && markdownContent[startIndex - 1] === '!') {
        continue;
      }
      
      links.push({
        fullMatch: match[0],
        text: match[1],
        url: match[2],
        type: 'external',
        isLocal: false,
        index: match.index
      });
    }

    // 2. Extract local file links (various patterns)
    const localPatterns = [
      { pattern: this.linkPatterns.localFile, prefix: '/files/' },
      { pattern: this.linkPatterns.relativePath, prefix: './' },
      { pattern: this.linkPatterns.docusaurusPath, prefix: '/' }
    ];

    const seenFiles = new Set(); // Track files for upload deduplication, but allow multiple text references

    for (const { pattern, prefix } of localPatterns) {
      pattern.lastIndex = 0;
      while ((match = pattern.exec(markdownContent)) !== null) {
        const url = match[2];
        
        // Skip markdown images (![alt](src)) - they should be handled by image processor
        const startIndex = match.index;
        if (startIndex > 0 && markdownContent[startIndex - 1] === '!') {
          continue;
        }
        
        // Check if this looks like a file (has extension) - no restrictions on file types
        if (this.isFileUrl(url)) {
          // For relative path, construct the path correctly
          let srcPath;
          if (prefix === './') {
            srcPath = './' + url;
          } else if (prefix === '/files/') {
            srcPath = '/files/' + url;
          } else {
            srcPath = '/' + url;
          }
          const absolutePath = this.resolveAttachmentPath(srcPath, filePath);
          
          // Always add link for processing (allow multiple text references to same file)
          links.push({
            fullMatch: match[0],
            text: match[1],
            url: match[2],
            originalUrl: match[2],
            absolutePath: absolutePath,
            type: 'local_attachment',
            isLocal: true,
            index: match.index,
            isDuplicateFile: seenFiles.has(absolutePath) // Track if this is a duplicate file reference
          });
          
          // Track duplicate files for stats
          if (seenFiles.has(absolutePath)) {
            this.stats.duplicatesRemoved++;
          }
          seenFiles.add(absolutePath);
        }
      }
    }

    // Sort by index to maintain order
    return links.sort((a, b) => a.index - b.index);
  }

  /**
   * Check if URL looks like a file (has extension) - exclude internal markdown links
   */
  isFileUrl(url) {
    // Simple check for file extension - accept any file extension
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(url);
    
    // Exclude internal markdown files (.md, .mdx) as Google Docs doesn't support internal linking
    if (hasExtension && /\.(md|mdx)$/i.test(url)) {
      return false;
    }
    
    return hasExtension;
  }

  /**
   * Resolve attachment path relative to markdown file
   */
  resolveAttachmentPath(src, filePath) {
    const fileDir = path.dirname(filePath);
    
    // Handle Docusaurus absolute paths (starting with /)
    if (src.startsWith('/')) {
      // Try to find docusaurus project root
      const docusaurusRoot = this.findDocusaurusRoot(filePath);
      if (docusaurusRoot) {
        // Convert /files/... to {docusaurusRoot}/static/files/...
        const staticPath = path.join(docusaurusRoot, 'static', src.substring(1));
        if (fs.existsSync(staticPath)) {
          return staticPath;
        }
      }
      
      // Fallback: treat as relative to current file directory
      return path.resolve(fileDir, src.substring(1));
    }
    
    // Handle relative paths (./...)
    if (src.startsWith('./')) {
      return path.resolve(fileDir, src.substring(2));
    }
    
    // Default: treat as relative to current file directory
    return path.resolve(fileDir, src);
  }

  /**
   * Find Docusaurus project root by looking for docusaurus.config.js/ts
   */
  findDocusaurusRoot(filePath) {
    let currentDir = path.dirname(filePath);
    
    // Go up directories to find docusaurus.config.js/ts
    while (currentDir !== path.dirname(currentDir)) {
      const configFiles = [
        'docusaurus.config.js',
        'docusaurus.config.ts'
      ];
      
      for (const configFile of configFiles) {
        if (fs.existsSync(path.join(currentDir, configFile))) {
          return currentDir;
        }
      }
      
      currentDir = path.dirname(currentDir);
    }
    
    return null;
  }

  /**
   * Process local attachments - upload to Google Drive
   * @param {Array} localLinks - Array of local link objects
   * @param {Object} debugInfo - Debug information object
   * @returns {Map} - Map of original URL -> Google Drive info
   */
  async processAttachments(localLinks, debugInfo = null) {
    const attachmentMap = new Map();
    const processedFiles = new Set(); // Track already processed files to avoid duplicate uploads
    this.stats.localAttachments = localLinks.length;

    if (debugInfo) {
      debugInfo.processing.phases.push({
        phase: 'attachment_upload',
        timestamp: new Date().toISOString(),
        attachmentCount: localLinks.length
      });
    }

    for (const link of localLinks) {
      try {
        // Check if file exists
        if (!await fs.pathExists(link.absolutePath)) {
          console.warn(chalk.yellow(`⚠️ Attachment file not found: ${link.absolutePath}`));
          this.stats.errors.push(`File not found: ${link.url}`);
          continue;
        }

        // Check if this file has already been uploaded
        if (processedFiles.has(link.absolutePath)) {
          // File already uploaded, reuse the same URL for all text references
          const existingEntry = Array.from(attachmentMap.values()).find(entry => entry.originalPath === link.absolutePath);
          if (existingEntry) {
            attachmentMap.set(link.originalUrl, {
              ...existingEntry,
              text: link.text, // Update text for this specific reference (important for different display text)
              originalPath: link.absolutePath
            });
            this.stats.attachmentsCached++; // Count as cached since we're reusing uploaded file
          }
          continue;
        }

        // Upload to Google Drive using attachment processor
        const uploadResult = await this.attachmentProcessor.uploadAttachment(link.absolutePath);
        
        attachmentMap.set(link.originalUrl, {
          ...uploadResult,
          text: link.text,
          originalPath: link.absolutePath
        });

        processedFiles.add(link.absolutePath);

        // Stats are tracked by AttachmentProcessor
        if (uploadResult.cached) {
          this.stats.attachmentsCached++;
        } else {
          this.stats.attachmentsUploaded++;
        }

        if (debugInfo) {
          debugInfo.processing.uploads.push({
            type: 'attachment',
            originalUrl: link.originalUrl,
            fileName: uploadResult.fileName,
            url: uploadResult.url,
            size: uploadResult.size,
            cached: uploadResult.cached,
            timestamp: new Date().toISOString()
          });
        }

      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Failed to upload ${link.url}: ${error.message}`));
        this.stats.errors.push(`Attachment upload: ${link.url} - ${error.message}`);
        
        if (debugInfo) {
          debugInfo.errors.push({
            type: 'attachment_upload_error',
            url: link.url,
            message: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    return attachmentMap;
  }

  /**
   * Generate Google Docs link requests
   * @param {string} markdownContent - Original markdown content
   * @param {Array} links - Array of all links
   * @param {Map} attachmentMap - Map of uploaded attachments
   * @returns {Object} - { processedMarkdown, linkRequests }
   */
  generateLinkRequests(markdownContent, links, attachmentMap) {
    const linkRequests = [];
    let processedMarkdown = markdownContent;

    // Process links from end to beginning to maintain indices
    const sortedLinks = [...links].sort((a, b) => b.index - a.index);

    // Group links by text content to handle multiple references to same file
    const textToLinkGroup = new Map();
    const placeholderMap = new Map(); // Track text -> placeholder mapping
    let placeholderCounter = 0;

    // First pass: group links by text content and assign placeholders
    for (const link of sortedLinks) {
      let finalUrl = link.url;
      
      // For local attachments, use Google Drive URL if uploaded
      if (link.isLocal && attachmentMap.has(link.originalUrl)) {
        const uploadInfo = attachmentMap.get(link.originalUrl);
        finalUrl = uploadInfo.url;
      }

      // Normalize URL for grouping (remove path variations for same file)
      let normalizedUrl = finalUrl;
      if (link.isLocal) {
        // For local files, normalize to just the filename to group same files together
        const fileName = path.basename(finalUrl);
        normalizedUrl = fileName;
      }
      
      // Create a unique key for this text+normalized URL combination
      const linkKey = `${link.text}|${normalizedUrl}`;
      
      if (!textToLinkGroup.has(linkKey)) {
        // First occurrence of this text+URL combination
        const placeholder = `[[[LINK_${placeholderCounter}]]]`;
        placeholderMap.set(linkKey, placeholder);
        
        textToLinkGroup.set(linkKey, {
          text: link.text,
          url: finalUrl,
          placeholder: placeholder,
          isExternal: !link.isLocal,
          originalUrl: link.url,
          placeholderIndex: placeholderCounter,
          occurrences: [link]
        });
        
        placeholderCounter++;
      } else {
        // Additional occurrence of same text+URL combination
        textToLinkGroup.get(linkKey).occurrences.push(link);
      }
    }

    // Second pass: replace all occurrences with their assigned placeholders
    // Collect all replacements first, then sort by index (highest first)
    const allReplacements = [];
    for (const [linkKey, linkGroup] of textToLinkGroup) {
      for (const occurrence of linkGroup.occurrences) {
        allReplacements.push({
          startIndex: occurrence.index,
          endIndex: occurrence.index + occurrence.fullMatch.length,
          placeholder: linkGroup.placeholder,
          originalText: occurrence.fullMatch
        });
      }
    }
    
    // Sort all replacements by index (highest first) to avoid index shifts
    allReplacements.sort((a, b) => b.startIndex - a.startIndex);
    
    if (this.debug) {
      console.log(chalk.gray(`🐛 Processing ${allReplacements.length} total replacements:`));
      allReplacements.forEach((repl, i) => {
        console.log(chalk.gray(`🐛   ${i + 1}. [${repl.startIndex}-${repl.endIndex}] "${repl.originalText}" → "${repl.placeholder}"`));
      });
    }
    
    // Apply replacements from end to beginning
    for (const replacement of allReplacements) {
      const { startIndex, endIndex, placeholder, originalText } = replacement;
      
      // Verify the text at this position matches what we expect
      const actualText = processedMarkdown.substring(startIndex, endIndex);
      if (actualText !== originalText) {
        if (this.debug) {
          console.warn(chalk.yellow(`🐛 Text mismatch at ${startIndex}-${endIndex}: expected "${originalText}", found "${actualText}"`));
        }
        continue; // Skip this replacement to avoid corruption
      }
      
      // Replace link with placeholder in markdown
      processedMarkdown = processedMarkdown.substring(0, startIndex) + 
                         placeholder + 
                         processedMarkdown.substring(endIndex);
      
      if (this.debug) {
        console.log(chalk.gray(`🐛 Replaced [${startIndex}-${endIndex}] "${originalText}" → "${placeholder}"`));
      }
    }

    // Third pass: create link requests for each unique text+URL combination
    for (const [linkKey, linkGroup] of textToLinkGroup) {
      // Create single link request for all occurrences of this text+URL
      linkRequests.push({
        type: 'link',
        text: linkGroup.text,
        url: linkGroup.url,
        placeholder: linkGroup.placeholder,
        isExternal: linkGroup.isExternal,
        originalUrl: linkGroup.originalUrl,
        placeholderIndex: linkGroup.placeholderIndex,
        occurrenceCount: linkGroup.occurrences.length
      });

      // Count as external links (both external and uploaded attachments)
      this.stats.externalLinks++;
    }

    // Sort link requests by placeholder index to maintain order
    linkRequests.sort((a, b) => a.placeholderIndex - b.placeholderIndex);

    if (this.debug) {
      console.log(chalk.gray(`🐛 Generated ${linkRequests.length} unique link requests for ${sortedLinks.length} total links`));
      linkRequests.forEach(req => {
        console.log(chalk.gray(`🐛   "${req.placeholder}" → "${req.text}" (${req.occurrenceCount} occurrences)`));
      });
    }

    return { 
      processedMarkdown, 
      linkRequests: linkRequests
    };
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.linksFound > 0 ? 
        Math.round(((this.stats.externalLinks + this.stats.attachmentsUploaded) / this.stats.linksFound) * 100) : 100
    };
  }

  /**
   * Save debug information to JSON file
   */
  async saveDebugInfo(debugInfo, suffix = '') {
    if (!this.debug) return;
    
    try {
      await fs.ensureDir(this.debugDir);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = suffix 
        ? `link-processing-${suffix}-${timestamp}.json`
        : `link-processing-debug-${timestamp}.json`;
      
      const filepath = path.join(this.debugDir, filename);
      
      // Add additional debug metadata
      const debugOutput = {
        ...debugInfo,
        metadata: {
          processorVersion: '1.0.0',
          nodeVersion: process.version,
          debugEnabled: this.debug,
          debugDir: this.debugDir,
          filename: filename,
          projectRoot: this.projectRoot
        }
      };
      
      await fs.writeJson(filepath, debugOutput, { spaces: 2 });
      
      // Also save a simplified summary for quick overview
      const summaryPath = path.join(this.debugDir, `link-processing-summary-${timestamp}.json`);
      const summary = {
        timestamp: debugInfo.timestamp,
        filePath: debugInfo.filePath,
        stats: this.stats,
        linksFound: debugInfo.processing.links.length,
        attachmentsUploaded: debugInfo.processing.uploads.length,
        errors: debugInfo.errors.length,
        filename: filename
      };
      
      await fs.writeJson(summaryPath, summary, { spaces: 2 });
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Failed to save link processing debug info:'), error.message);
    }
  }
}

module.exports = LinkProcessor; 