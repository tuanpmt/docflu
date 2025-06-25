const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

class ConfluenceToMarkdown {
  constructor(confluenceClient, projectRoot) {
    this.confluenceClient = confluenceClient;
    this.projectRoot = projectRoot;
    
    // Initialize Turndown with custom rules for Confluence
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
      preformattedCode: true
    });

    // Add GitHub Flavored Markdown support
    this.turndownService.use(gfm);
    
    // Add custom rules for Confluence-specific elements
    this.addConfluenceRules();
  }

  /**
   * Add custom Turndown rules for Confluence-specific elements
   */
  addConfluenceRules() {
    // Handle Confluence code blocks
    this.turndownService.addRule('confluenceCodeBlock', {
      filter: (node) => {
        return (node.nodeName === 'AC:STRUCTURED-MACRO' && node.getAttribute('ac:name') === 'code') ||
               (node.nodeName === 'STRUCTURED-MACRO' && node.getAttribute('name') === 'code');
      },
      replacement: (content, node) => {
        const language = this.getParameterValue(node, 'language') || '';
        const title = this.getParameterValue(node, 'title') || '';
        const codeContent = this.getPlainTextBody(node);
        
        // Build the code block with title if present
        let codeBlock = `\`\`\`${language}`;
        if (title) {
          codeBlock += ` title="${title}"`;
        }
        codeBlock += `\n${codeContent}\n\`\`\``;
        
        return `\n${codeBlock}\n`;
      }
    });

    // Handle standard HTML code blocks (pre/code tags)
    this.turndownService.addRule('standardCodeBlock', {
      filter: function (node) {
        return node.nodeName === 'PRE' || 
               (node.nodeName === 'DIV' && node.getAttribute('class')?.includes('code-block'));
      },
      replacement: function (content, node) {
        // Handle different code block structures
        let codeContent = '';
        let language = '';
        let title = '';
        
        if (node.nodeName === 'PRE') {
          // Standard pre tag
          const codeElement = node.querySelector('code');
          if (codeElement) {
            codeContent = codeElement.textContent || codeElement.innerText || '';
            language = codeElement.getAttribute('data-language') || 
                      codeElement.getAttribute('class')?.replace(/.*language-([^\s]+).*/, '$1') || '';
            title = codeElement.getAttribute('data-title') || '';
          } else {
            codeContent = node.textContent || node.innerText || '';
            language = node.getAttribute('data-language') || '';
            title = node.getAttribute('data-title') || '';
          }
        } else {
          // Code block div
          codeContent = node.textContent || node.innerText || '';
          language = node.getAttribute('data-language') || 
                    node.querySelector('[data-language]')?.getAttribute('data-language') || '';
          title = node.getAttribute('data-title') || 
                 node.querySelector('[data-title]')?.getAttribute('data-title') || '';
        }
        
        // Preserve the original content without extra processing
        // Remove only leading/trailing newlines, keep internal structure
        codeContent = codeContent.replace(/^\n+/, '').replace(/\n+$/, '');
        
        // Build the code block with title if present
        let codeBlock = `\`\`\`${language}`;
        if (title) {
          codeBlock += ` title="${title}"`;
        }
        codeBlock += `\n${codeContent}\n\`\`\``;
        
        return `\n${codeBlock}\n`;
      }
    });

    // Handle Confluence info/warning/note panels
    this.turndownService.addRule('confluencePanel', {
      filter: (node) => {
        const macroName = node.getAttribute('ac:name') || node.getAttribute('name');
        return ((node.nodeName === 'AC:STRUCTURED-MACRO' || node.nodeName === 'STRUCTURED-MACRO') && 
               ['info', 'warning', 'note', 'tip'].includes(macroName));
      },
      replacement: (content, node) => {
        const type = node.getAttribute('ac:name') || node.getAttribute('name');
        const title = this.getParameterValue(node, 'title') || '';
        const body = this.getRichTextBody(node);
        
        // Convert to Docusaurus admonition format
        const admonitionType = this.mapPanelToAdmonition(type);
        const titlePart = title ? ` ${title}` : '';
        return `\n:::${admonitionType}${titlePart}\n\n${body}\n\n:::\n`;
      }
    });

    // Handle Confluence images/attachments
    this.turndownService.addRule('confluenceImage', {
      filter: (node) => {
        return node.nodeName === 'IMAGE' ||  // Cheerio converts ac:image to image
               node.nodeName === 'AC:IMAGE' || 
               (node.nodeName === 'AC:STRUCTURED-MACRO' && node.getAttribute('ac:name') === 'image') ||
               (node.nodeName === 'IMG' && node.getAttribute('src'));
      },
      replacement: (content, node) => {
        // Handle IMAGE elements (after Cheerio processing)
        if (node.nodeName === 'IMAGE') {
          const attachment = node.querySelector('attachment');
          if (attachment) {
            const filename = attachment.getAttribute('filename');
            const urlEncodedFilename = encodeURIComponent(filename);
            return `![${filename}](./img/${urlEncodedFilename})`;
          }
        }
        
        // Handle AC:IMAGE elements (original format)
        const attachment = node.querySelector('ri\\:attachment');
        if (attachment) {
          const filename = attachment.getAttribute('ri:filename');
          const urlEncodedFilename = encodeURIComponent(filename);
          return `![${filename}](./img/${urlEncodedFilename})`;
        }
        
        // Handle regular IMG elements
        if (node.nodeName === 'IMG') {
          const src = node.getAttribute('src');
          const alt = node.getAttribute('alt') || '';
          
          // If src already processed to local path, use it as-is (already URL encoded)
          if (src && src.startsWith('./img/')) {
            return `![${alt}](${src})`;
          }
          
          // Extract filename from src and URL encode it
          if (src) {
            const filename = decodeURIComponent(src.split('/').pop());
            const urlEncodedFilename = encodeURIComponent(filename);
            return `![${alt}](./img/${urlEncodedFilename})`;
          }
        }
        
        return content;
      }
    });

    // Handle Confluence tables (preserve formatting)
    this.turndownService.addRule('confluenceTable', {
      filter: 'table',
      replacement: (content, node) => {
        // Use built-in table handling from turndown-plugin-gfm
        return content;
      }
    });

    // Handle line breaks properly
    this.turndownService.addRule('lineBreak', {
      filter: 'br',
      replacement: () => '\n'
    });

    // Remove empty paragraphs to prevent excessive line breaks
    this.turndownService.addRule('emptyParagraph', {
      filter: (node) => {
        return node.nodeName === 'P' && (!node.textContent || node.textContent.trim() === '');
      },
      replacement: () => ''
    });
  }

  /**
   * Convert Confluence Storage Format HTML to Markdown
   * @param {string} confluenceHtml - Confluence Storage Format HTML
   * @param {string} pageId - Confluence page ID for attachment resolution
   * @param {string} relativePath - Target relative path for the markdown file
   * @param {Object} existingFrontmatter - Existing frontmatter to preserve
   * @returns {Object} - {markdown, frontmatter, attachments}
   */
  async convertToMarkdown(confluenceHtml, pageId, relativePath, existingFrontmatter = {}) {
    try {

      
      // Pre-process CDATA sections before Cheerio parsing to preserve content
      let processedHtml = confluenceHtml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (match, content) => {
        // Encode the content to preserve it through HTML parsing
        return Buffer.from(content).toString('base64');
      });
      
      // Parse HTML with Cheerio for preprocessing
      const $ = cheerio.load(processedHtml);
      
      // Extract and download attachments (this also updates HTML with local paths)
      const attachments = await this.processAttachments($, pageId, relativePath);
      
      // Preprocess HTML to fix common issues (use updated HTML after attachment processing)
      let preprocessedHtml = this.preprocessHtml($.html());
      
      // Convert Confluence image elements to standard img tags using regex
      // Handle both self-closing and regular attachment tags
      preprocessedHtml = preprocessedHtml.replace(
        /<image[^>]*>\s*<attachment filename="([^"]+)"[^>]*>(?:[\s\S]*?<\/attachment>)?\s*<\/image>/gi,
        (match, filename) => {
          // URL encode filename for markdown links
          const urlEncodedFilename = encodeURIComponent(filename);
          return `<img src="./img/${urlEncodedFilename}" alt="${filename}" />`;
        }
      );
      
      // Also handle paragraph-wrapped images - replace <p><img /></p> with just <img />
      // This prevents Turndown from treating them as empty paragraphs
      preprocessedHtml = preprocessedHtml.replace(
        /<p>\s*(<img[^>]*>)\s*<\/p>/gi,
        (match, imgTag) => {
          return `\n${imgTag}\n`;
        }
      );
      
      // Convert to markdown
      let markdown = this.turndownService.turndown(preprocessedHtml);
      
      // Post-process markdown to fix formatting issues
      markdown = this.postProcessMarkdown(markdown);
      
      // Extract frontmatter if present, preserving existing
      const frontmatter = this.extractFrontmatter($, existingFrontmatter);
      
      return {
        markdown,
        frontmatter,
        attachments
      };
    } catch (error) {
      throw new Error(`Failed to convert Confluence HTML to Markdown: ${error.message}`);
    }
  }

  /**
   * Preprocess HTML to fix common Confluence issues
   */
  preprocessHtml(html) {
    // Remove Confluence-specific namespaces and clean up
    let cleaned = html
      .replace(/xmlns:ac="[^"]*"/g, '')
      .replace(/xmlns:ri="[^"]*"/g, '')
      .replace(/ac:/g, '')
      .replace(/ri:/g, '');
    
    // Fix nested paragraph issues
    cleaned = cleaned.replace(/<p>\s*<p>/g, '<p>');
    cleaned = cleaned.replace(/<\/p>\s*<\/p>/g, '</p>');
    
    // Ensure proper spacing around code blocks
    cleaned = cleaned.replace(/(<\/structured-macro>)\s*(<p>)/g, '$1\n\n$2');
    cleaned = cleaned.replace(/(<\/p>)\s*(<structured-macro)/g, '$1\n\n$2');
    
    // Handle CDATA sections properly - preserve them during processing
    cleaned = cleaned.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (match, content) => {
      // Encode the content to preserve it through HTML parsing
      return content;
    });
    
    // Escape HTML tags in text content so they're treated as text, not HTML
    // This prevents Turndown from interpreting them as actual HTML elements
    cleaned = this.escapeHtmlTagsInText(cleaned);
    
    return cleaned;
  }

  /**
   * No preprocessing needed - let HTML entities be handled naturally by Turndown
   */
  escapeHtmlTagsInText(html) {
    // Simply return the HTML as-is
    // Turndown will handle HTML entities correctly
    return html;
  }

  /**
   * Post-process markdown to fix formatting issues
   */
  postProcessMarkdown(markdown) {
    // Remove excessive empty lines (more than 2 consecutive)
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    
    // Fix spacing around code blocks
    markdown = markdown.replace(/\n```/g, '\n\n```');
    markdown = markdown.replace(/```\n([^\n])/g, '```\n\n$1');
    
    // Fix spacing around headings
    markdown = markdown.replace(/\n(#{1,6}\s)/g, '\n\n$1');
    
    // Fix list formatting
    markdown = markdown.replace(/\n(\s*[-*+]\s)/g, '\n$1');
    
    // Trim leading/trailing whitespace
    markdown = markdown.trim();
    
    return markdown;
  }



  /**
   * Process and download attachments from Confluence
   */
  async processAttachments($, pageId, relativePath) {
    const attachments = [];
    const processedFilenames = new Set();
    
    // Step 1: Get all attachments for the page from Confluence
    const pageAttachments = await this.confluenceClient.getPageAttachments(pageId);
    
    // Step 2: Create img directory relative to the markdown file
    const markdownDir = path.dirname(path.join(this.projectRoot, relativePath));
    const imgDir = path.join(markdownDir, 'img');
    await fs.ensureDir(imgDir);
    
    // Step 3: Process attachments referenced in HTML content
    const attachmentElements = $('ri\\:attachment, attachment, ac\\:image img, img');
    
    for (let i = 0; i < attachmentElements.length; i++) {
      const element = attachmentElements[i];
      const $element = $(element);
      
      // Get filename from various attributes
      let filename = $element.attr('ri:filename') || 
                    $element.attr('filename') ||
                    $element.attr('src') ||
                    $element.attr('data-filename');
      
      // Extract filename from src URLs if needed
      if (filename && filename.includes('/')) {
        filename = filename.split('/').pop();
      }
      
      if (filename && !processedFilenames.has(filename)) {
        processedFilenames.add(filename);
        
        // Find the attachment object
        const attachmentObj = pageAttachments.find(att => att.title === filename);
        
        if (attachmentObj) {
          try {
            // Download attachment using the new method
            const downloadResult = await this.confluenceClient.downloadAttachmentById(attachmentObj);
            
            // Determine local path in img directory
            const localPath = path.join(imgDir, downloadResult.filename);
            
            // Save attachment locally
            await fs.writeFile(localPath, downloadResult.data);
            
            // Update HTML to use local path with URL encoding for spaces
            const urlEncodedFilename = encodeURIComponent(downloadResult.filename);
            if ($element.attr('src')) {
              $element.attr('src', `./img/${urlEncodedFilename}`);
            }
            
            attachments.push({
              filename: downloadResult.filename,
              localPath,
              relativePath: `./img/${urlEncodedFilename}`,
              mediaType: downloadResult.mediaType
            });
            
            console.log(`📎 Downloaded attachment: ${downloadResult.filename}`);
          } catch (error) {
            console.warn(`⚠️ Could not download attachment ${filename}: ${error.message}`);
          }
        }
      }
    }
    
    // Step 4: Process any remaining attachments not referenced in HTML
    for (const attachment of pageAttachments) {
      if (!processedFilenames.has(attachment.title)) {
        try {
          const downloadResult = await this.confluenceClient.downloadAttachmentById(attachment);
          
          // Determine local path in img directory
          const localPath = path.join(imgDir, downloadResult.filename);
          
          // Save attachment locally
          await fs.writeFile(localPath, downloadResult.data);
          
          // URL encode filename for markdown links
          const urlEncodedFilename = encodeURIComponent(downloadResult.filename);
          
          attachments.push({
            filename: downloadResult.filename,
            localPath,
            relativePath: `./img/${urlEncodedFilename}`,
            mediaType: downloadResult.mediaType
          });
          
          console.log(`📎 Downloaded attachment: ${downloadResult.filename} (not referenced in content)`);
        } catch (error) {
          console.warn(`⚠️ Could not download attachment ${attachment.title}: ${error.message}`);
        }
      }
    }
    
    return attachments;
  }

  /**
   * Extract frontmatter from Confluence page metadata and preserve existing frontmatter
   */
  extractFrontmatter($, existingFrontmatter = {}) {
    const frontmatter = { ...existingFrontmatter }; // Preserve existing frontmatter
    
    // Extract common metadata
    const title = $('title').text() || $('h1').first().text();
    if (title) {
      frontmatter.title = title;
    }
    
    // Extract labels as tags (only if not already present)
    if (!frontmatter.tags) {
      const labels = [];
      $('label').each((i, el) => {
        labels.push($(el).text());
      });
      if (labels.length > 0) {
        frontmatter.tags = labels;
      }
    }
    
    return frontmatter;
  }

  /**
   * Helper methods for Confluence macro processing
   */
  getParameterValue(node, paramName) {
    // Handle both ac: prefixed and non-prefixed versions
    let param = node.querySelector(`ac\\:parameter[ac\\:name="${paramName}"]`);
    if (!param) {
      param = node.querySelector(`parameter[ac\\:name="${paramName}"]`);
    }
    if (!param) {
      param = node.querySelector(`parameter[name="${paramName}"]`);
    }
    return param ? param.textContent : null;
  }

  getPlainTextBody(node) {
    // Handle both ac: prefixed and non-prefixed versions
    let body = node.querySelector('ac\\:plain-text-body');
    if (!body) {
      body = node.querySelector('plain-text-body');
    }
    if (!body) {
      return '';
    }
    
    // Handle CDATA content properly
    let content = body.textContent || body.innerHTML || '';
    

    
    // If content looks like base64 (our encoded CDATA content), decode it
    try {
      if (content && content.length > 0 && !content.includes('<') && !content.includes('\n')) {
        // Try to decode as base64
        const decoded = Buffer.from(content, 'base64').toString('utf8');
        if (decoded && decoded.length > content.length / 2) { // Reasonable heuristic
          content = decoded;
        }
      }
    } catch (error) {
      // Not base64, continue with original content
    }
    
    // If content is wrapped in CDATA (original format), extract the inner content
    if (content.includes('<![CDATA[') && content.includes(']]>')) {
      const cdataMatch = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
      if (cdataMatch) {
        content = cdataMatch[1];
      }
    }
    
    // If content is wrapped in HTML comment (after Cheerio processing), extract the inner content
    if (content.includes('<!--[CDATA[') && content.includes(']]-->')) {
      const cdataMatch = content.match(/<!--\[CDATA\[([\s\S]*?)\]\]-->/);
      if (cdataMatch) {
        content = cdataMatch[1];
      }
    }
    
    return content.trim();
  }

  getRichTextBody(node) {
    // Handle both ac: prefixed and non-prefixed versions
    let body = node.querySelector('ac\\:rich-text-body');
    if (!body) {
      body = node.querySelector('rich-text-body');
    }
    return body ? this.turndownService.turndown(body.innerHTML) : '';
  }

  mapPanelToAdmonition(panelType) {
    const mapping = {
      'info': 'info',
      'warning': 'warning', 
      'note': 'note',
      'tip': 'tip'
    };
    return mapping[panelType] || 'info';
  }
}

module.exports = ConfluenceToMarkdown; 