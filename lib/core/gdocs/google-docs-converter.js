const MarkdownIt = require('markdown-it');

/**
 * Google Docs Content Converter
 * Converts markdown content to Google Docs Document Resource format
 */
class GoogleDocsConverter {
  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });
  }

  /**
   * Convert markdown to Google Docs batch requests
   * @param {string} markdown - Markdown content
   * @param {Object} options - Conversion options
   * @returns {Array} - Array of Google Docs API requests
   */
  convertFromMarkdown(markdown, options = {}) {
    const requests = [];
    let currentIndex = 1;

    // Handle empty content
    if (!markdown || markdown.trim() === '') {
      return requests;
    }

    // Parse markdown line by line
    const lines = markdown.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        // Empty line - add paragraph break
        requests.push(this.createParagraphBreak(currentIndex));
        currentIndex += 1;
        continue;
      }

      // Handle headings
      if (trimmedLine.startsWith('#')) {
        const headingRequest = this.createHeading(trimmedLine, currentIndex);
        requests.push(...headingRequest.requests);
        currentIndex += headingRequest.length;
        continue;
      }

      // Handle code blocks
      if (trimmedLine.startsWith('```')) {
        const codeBlockResult = this.extractCodeBlock(lines, i);
        if (codeBlockResult) {
          const codeRequest = this.createCodeBlock(codeBlockResult.content, codeBlockResult.language, currentIndex);
          requests.push(...codeRequest.requests);
          currentIndex += codeRequest.length;
          i = codeBlockResult.endIndex; // Skip processed lines
          continue;
        }
      }

      // Handle lists
      if (trimmedLine.match(/^[\*\-\+]\s/) || trimmedLine.match(/^\d+\.\s/)) {
        const listResult = this.extractList(lines, i);
        const listRequest = this.createList(listResult.items, listResult.ordered, currentIndex);
        requests.push(...listRequest.requests);
        currentIndex += listRequest.length;
        i = listResult.endIndex; // Skip processed lines
        continue;
      }

      // Handle regular paragraphs
      const paragraphRequest = this.createParagraph(trimmedLine, currentIndex);
      requests.push(...paragraphRequest.requests);
      currentIndex += paragraphRequest.length;
    }

    return requests;
  }

  /**
   * Create heading requests
   */
  createHeading(line, startIndex) {
    const level = (line.match(/^#+/) || [''])[0].length;
    const text = line.replace(/^#+\s*/, '').trim();
    
    const requests = [
      {
        insertText: {
          text: text + '\n',
          location: { index: startIndex }
        }
      },
      {
        updateTextStyle: {
          range: {
            startIndex: startIndex,
            endIndex: startIndex + text.length
          },
          textStyle: {
            bold: true,
            fontSize: {
              magnitude: this.getHeadingSize(level),
              unit: 'PT'
            }
          },
          fields: 'bold,fontSize'
        }
      }
    ];

    return {
      requests,
      length: text.length + 1
    };
  }

  /**
   * Get heading font size based on level
   */
  getHeadingSize(level) {
    const sizes = {
      1: 20,
      2: 18,
      3: 16,
      4: 14,
      5: 12,
      6: 11
    };
    return sizes[level] || 11;
  }

  /**
   * Create paragraph requests
   */
  createParagraph(text, startIndex) {
    // Process inline formatting (bold, italic, code)
    const processedText = this.processInlineFormatting(text);
    
    const requests = [
      {
        insertText: {
          text: processedText.text + '\n',
          location: { index: startIndex }
        }
      }
    ];

    // Add formatting requests
    let currentPos = startIndex;
    for (const format of processedText.formats) {
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: currentPos + format.start,
            endIndex: currentPos + format.end
          },
          textStyle: format.style,
          fields: Object.keys(format.style).join(',')
        }
      });
    }

    return {
      requests,
      length: processedText.text.length + 1
    };
  }

  /**
   * Process inline formatting (bold, italic, code)
   */
  processInlineFormatting(text) {
    const formats = [];
    let processedText = text;
    let offset = 0;

    // Process **bold** and __bold__
    processedText = processedText.replace(/(\*\*|__)(.*?)\1/g, (match, marker, content, matchIndex) => {
      formats.push({
        start: matchIndex - offset,
        end: matchIndex - offset + content.length,
        style: { bold: true }
      });
      offset += marker.length * 2; // Remove the markers
      return content;
    });

    // Process *italic* and _italic_
    processedText = processedText.replace(/(\*|_)(.*?)\1/g, (match, marker, content, matchIndex) => {
      formats.push({
        start: matchIndex - offset,
        end: matchIndex - offset + content.length,
        style: { italic: true }
      });
      offset += marker.length * 2;
      return content;
    });

    // Process `code`
    processedText = processedText.replace(/`(.*?)`/g, (match, content, matchIndex) => {
      formats.push({
        start: matchIndex - offset,
        end: matchIndex - offset + content.length,
        style: { 
          backgroundColor: { color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } } },
          foregroundColor: { color: { rgbColor: { red: 0.8, green: 0.2, blue: 0.2 } } }
        }
      });
      offset += 2; // Remove the backticks
      return content;
    });

    return {
      text: processedText,
      formats
    };
  }

  /**
   * Extract code block from lines
   */
  extractCodeBlock(lines, startIndex) {
    const startLine = lines[startIndex];
    const language = startLine.replace('```', '').trim();
    
    let endIndex = -1;
    let content = '';
    
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === '```') {
        endIndex = i;
        break;
      }
      content += lines[i] + '\n';
    }

    if (endIndex === -1) {
      return null; // No closing ```
    }

    return {
      content: content.trim(),
      language,
      endIndex
    };
  }

  /**
   * Create code block requests
   */
  createCodeBlock(content, language, startIndex) {
    const requests = [];
    let currentIndex = startIndex;

    // Add language label if specified
    if (language) {
      const label = `[${language}]\n`;
      
      // Insert language label
      requests.push({
        insertText: {
          text: label,
          location: { index: currentIndex }
        }
      });
      
      // Style language label
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: currentIndex,
            endIndex: currentIndex + label.length - 1 // Exclude the newline
          },
          textStyle: {
            bold: true,
            fontSize: { magnitude: 9, unit: 'PT' },
            foregroundColor: { color: { rgbColor: { red: 0.5, green: 0.5, blue: 0.5 } } }
          },
          fields: 'bold,fontSize,foregroundColor'
        }
      });
      
      currentIndex += label.length;
    }

    // Insert code content
    requests.push({
      insertText: {
        text: content + '\n',
        location: { index: currentIndex }
      }
    });
    
    // Style code content
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: currentIndex,
          endIndex: currentIndex + content.length
        },
        textStyle: {
          backgroundColor: { color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } } },
          fontSize: { magnitude: 10, unit: 'PT' }
        },
        fields: 'backgroundColor,fontSize'
      }
    });

    const totalLength = (language ? language.length + 3 : 0) + content.length + 1; // [lang]\n + content + \n
    
    return {
      requests,
      length: totalLength
    };
  }

  /**
   * Extract list from lines
   */
  extractList(lines, startIndex) {
    const items = [];
    let endIndex = startIndex;
    const firstLine = lines[startIndex];
    const isOrdered = /^\d+\.\s/.test(firstLine.trim());
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        endIndex = i - 1;
        break;
      }

      const listMatch = line.match(/^([\*\-\+]|\d+\.)\s(.*)$/);
      if (listMatch) {
        items.push(listMatch[2]);
        endIndex = i;
      } else {
        endIndex = i - 1;
        break;
      }
    }

    return {
      items,
      ordered: isOrdered,
      endIndex
    };
  }

  /**
   * Create list requests
   */
  createList(items, ordered, startIndex) {
    const requests = [];
    let currentIndex = startIndex;

    for (let i = 0; i < items.length; i++) {
      const bullet = ordered ? `${i + 1}. ` : '• ';
      const text = bullet + items[i] + '\n';
      
      requests.push({
        insertText: {
          text: text,
          location: { index: currentIndex }
        }
      });

      currentIndex += text.length;
    }

    return {
      requests,
      length: currentIndex - startIndex
    };
  }

  /**
   * Create paragraph break
   */
  createParagraphBreak(startIndex) {
    return {
      insertText: {
        text: '\n',
        location: { index: startIndex }
      }
    };
  }

  /**
   * Convert internal links to proper format
   * @param {string} content - Content with links
   * @param {Object} linkMap - Map of internal links to Google Docs URLs
   * @returns {string} - Content with converted links
   */
  convertLinks(content, linkMap = {}) {
    // Convert markdown links [text](url) to Google Docs format
    return content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      // Check if it's an internal link
      if (linkMap[url]) {
        return text; // For now, just return text. Google Docs links need special handling
      }
      return text; // External links also need special handling
    });
  }
}

module.exports = GoogleDocsConverter; 