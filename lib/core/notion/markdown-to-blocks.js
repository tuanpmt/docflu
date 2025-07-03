const chalk = require('chalk');

/**
 * Markdown to Notion Blocks Converter
 * Converts markdown content to Notion block format supporting all elements from all.md
 */
class MarkdownToBlocksConverter {
  constructor(imageProcessor, diagramProcessor, config = null) {
    this.imageProcessor = imageProcessor;
    this.diagramProcessor = diagramProcessor;
    this.config = config;
    this.pendingBlocks = []; // Store blocks that need to be inserted between sections
    
    // Define patterns for markdown parsing
    this.patterns = {
      heading: /^(#{1,6})\s+(.+)$/gm,
      codeBlock: /^```(\w*)\n?([\s\S]*?)```$/gm,
      table: /^\|(.+)\|$/gm,
      list: /^[\*\-\+]\s+(.+)$/gm,
      numberedList: /^\d+\.\s+(.+)$/gm,
      taskList: /^[\*\-\+]\s+\[([ xX])\]\s+(.+)$/gm,
      blockquote: /^>\s*(.+)$/gm,
      image: /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g,
      link: /\[([^\]]+)\]\(([^)]+)\)/g,
      horizontalRule: /^---+$/gm,
      bold: /\*\*([^*]+)\*\*/g,
      italic: /\*([^*]+)\*/g,
      inlineCode: /`([^`]+)`/g,
      strikethrough: /~~([^~]+)~~/g
    };
  }

  /**
   * Convert markdown content to Notion blocks
   * @param {string} markdown - Markdown content
   * @param {Object} options - Conversion options
   * @returns {Array} Array of Notion blocks
   */
  async convertToBlocks(markdown, options = {}) {
    try {
      // Track conversion stats
      this.conversionStats = {
        validUrls: 0,
        invalidUrls: 0,
        tables: 0,
        codeBlocks: 0
      };
      
      // Preprocess markdown
      let processedMarkdown = await this.preprocessMarkdown(markdown);
      
      // Split into logical sections
      const sections = this.splitIntoSections(processedMarkdown);
      
      // Convert each section to blocks
      const blocks = [];
      for (const section of sections) {
        const sectionBlocks = await this.convertSection(section);
        blocks.push(...sectionBlocks);
      }

      return blocks;
    } catch (error) {
      throw new Error(`Failed to convert markdown to blocks: ${error.message}`);
    }
  }

  /**
   * Preprocess markdown for better conversion
   * @param {string} markdown - Raw markdown
   * @returns {string} Processed markdown
   */
  async preprocessMarkdown(markdown) {
    let processed = markdown;

    // NOTE: Diagram processing is now handled directly in notion-sync.js
    // This method only handles basic preprocessing for regular markdown conversion

    // NOTE: Image processing is now handled directly in notion-sync.js
    // during processMediaInBlocks() for better integration

    // Normalize line endings
    processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remove excessive blank lines
    processed = processed.replace(/\n{3,}/g, '\n\n');
    
    return processed;
  }

  /**
   * Split markdown into logical sections
   * @param {string} markdown - Processed markdown
   * @returns {Array} Array of sections
   */
  splitIntoSections(markdown) {
    const lines = markdown.split('\n');
    const sections = [];
    let currentSection = [];
    let inCodeBlock = false;
    let codeBlockType = null; // Track if it's ``` or ````
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Track code block state - handle both ``` and ````
      if (trimmed.startsWith('````') || trimmed.startsWith('```')) {
        if (inCodeBlock) {
          // Check if this is the matching closing backticks
          if ((codeBlockType === '```' && trimmed.startsWith('```')) ||
              (codeBlockType === '````' && trimmed.startsWith('````'))) {
            // End of code block
            currentSection.push(line);
            sections.push(currentSection.join('\n'));
            currentSection = [];
            inCodeBlock = false;
            codeBlockType = null;
            continue;
          }
        } else {
          // Start of code block - finish current section first
          if (currentSection.length > 0) {
            sections.push(currentSection.join('\n'));
            currentSection = [];
          }
          inCodeBlock = true;
          codeBlockType = trimmed.startsWith('````') ? '````' : '```';
          currentSection.push(line);
          continue;
        }
      }
      
      // If inside code block, just add the line
      if (inCodeBlock) {
        currentSection.push(line);
        continue;
      }
      
      // Normal section boundary logic (only when not in code block)
      if (this.isSectionBoundary(line, currentSection)) {
        if (currentSection.length > 0) {
          sections.push(currentSection.join('\n'));
          currentSection = [];
        }
      }
      
      currentSection.push(line);
    }
    
    // Add final section
    if (currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
    }
    
    return sections.filter(section => section.trim());
  }

  /**
   * Check if line is a section boundary
   * @param {string} line - Current line
   * @param {Array} currentSection - Current section lines
   * @returns {boolean} True if boundary
   */
  isSectionBoundary(line, currentSection) {
    if (currentSection.length === 0) return false;
    
    const lastLine = currentSection[currentSection.length - 1];
    const currentLineType = this.getLineType(line);
    const lastLineType = this.getLineType(lastLine);
    
    // Always break on headings
    if (currentLineType === 'heading') return true;
    
    // Always break on code blocks
    if (currentLineType === 'code_block') return true;
    
    // Always break on horizontal rules
    if (currentLineType === 'horizontal_rule') return true;
    
    // Break when switching between different content types
    if (currentLineType !== lastLineType && 
        currentLineType !== 'paragraph' && 
        lastLineType !== 'paragraph') {
      return true;
    }
    
    // Break when starting a table
    if (currentLineType === 'table' && lastLineType !== 'table') {
      return true;
    }
    
    // Break when starting a list
    if (currentLineType === 'list' && lastLineType !== 'list') {
      return true;
    }
    
    // Break when starting a blockquote
    if (currentLineType === 'blockquote' && lastLineType !== 'blockquote') {
      return true;
    }
    
    return false;
  }

  /**
   * Determine the type of a markdown line
   * @param {string} line - Line to analyze
   * @returns {string} Line type
   */
  getLineType(line) {
    if (!line || !line.trim()) return 'empty';
    
    const trimmed = line.trim();
    
    if (trimmed.match(/^#{1,6}\s+/)) return 'heading';
    if (trimmed.startsWith('````') || trimmed.startsWith('```')) return 'code_block';
    if (trimmed.match(/^---+$/)) return 'horizontal_rule';
    if (trimmed.startsWith('|')) return 'table';
    if (trimmed.match(/^[\*\-\+]\s+/) || trimmed.match(/^\d+\.\s+/)) return 'list';
    if (trimmed.startsWith('>')) return 'blockquote';
    
    return 'paragraph';
  }

  /**
   * Convert a section to Notion blocks
   * @param {string} section - Section content
   * @returns {Array} Array of blocks
   */
  async convertSection(section) {
    const trimmed = section.trim();
    if (!trimmed) return [];

    // Determine section type and convert
    if (trimmed.match(/^#{1,6}\s+/)) {
      return [this.convertHeading(trimmed)];
    }
    
    if (trimmed.startsWith('````') || trimmed.startsWith('```')) {
      return [await this.convertCodeBlock(trimmed)];
    }
    
    if (trimmed.includes('|') && this.isTable(trimmed)) {
      return [await this.convertTable(trimmed)];
    }
    
    if (trimmed.match(/^[\*\-\+]\s+(\[([ xX])\]\s+)?/) || trimmed.match(/^\d+\.\s+/)) {
      return this.convertList(trimmed);
    }
    
    if (trimmed.startsWith('>')) {
      return [this.convertBlockquote(trimmed)];
    }
    
    if (trimmed.match(/^---+$/)) {
      return [this.convertHorizontalRule()];
    }
    
    // Default to paragraph(s)
    return await this.convertParagraphs(trimmed);
  }

  /**
   * Convert heading to Notion block
   * @param {string} text - Heading text
   * @returns {Object} Heading block
   */
  convertHeading(text) {
    const match = text.match(/^(#{1,6})\s+(.+)$/);
    if (!match) return this.convertParagraph(text);
    
    const level = Math.min(match[1].length, 3); // Notion supports h1, h2, h3
    const content = this.parseRichText(match[2]);
    
    return {
      type: `heading_${level}`,
      [`heading_${level}`]: {
        rich_text: content
      }
    };
  }

  /**
   * Convert code block to Notion block
   * @param {string} text - Code block text
   * @returns {Object} Code block
   */
  async convertCodeBlock(text) {
    // Handle nested code blocks with 4+ backticks
    let match;
    
    // Try to match 4+ backticks first (for nested code blocks)
    match = text.match(/^````(\w*)([^\n]*)\n([\s\S]*?)````$/);
    if (match) {
      const language = match[1] || 'markdown'; // Default to markdown for nested blocks
      const metadata = match[2].trim();
      const code = match[3].trim();
      
      // For nested code blocks, the content should be the inner code block
      const codeBlock = {
        type: 'code',
        code: {
          language: this.mapLanguage(language),
          rich_text: [{ text: { content: code } }]
        }
      };
      
      // Add caption if metadata is present
      if (metadata) {
        codeBlock.code.caption = [{ text: { content: metadata } }];
      }
      
      return codeBlock;
    }
    
    // Handle regular 3-backtick code blocks
    match = text.match(/^```(\w+)([^\n]*)\n([\s\S]*?)```$/);
    if (!match) return this.convertParagraph(text);
    
    const language = match[1] || 'plain text';
    const metadata = match[2].trim(); // e.g., 'title="src/components/HelloDocusaurus.js"'
    const code = match[3].trim();
    
    // Parse metadata if present
    let caption = '';
    if (metadata) {
      // Extract title from metadata
      const titleMatch = metadata.match(/title=["']([^"']+)["']/);
      if (titleMatch) {
        caption = titleMatch[1];
      }
      // Extract filename from metadata
      else {
        const filenameMatch = metadata.match(/filename=["']([^"']+)["']/);
        if (filenameMatch) {
          caption = filenameMatch[1];
        }
        // If no title or filename, use the whole metadata as caption
        else {
          caption = metadata;
        }
      }
    }
    
    // Create code block with caption if available
    const codeBlock = {
      type: 'code',
      code: {
        language: this.mapLanguage(language),
        rich_text: [{ text: { content: code } }]
      }
    };
    
    // Add caption only if we have metadata
    if (caption) {
      codeBlock.code.caption = [{ text: { content: caption } }];
    }
    
    return codeBlock;
  }

  /**
   * Convert table to Notion block
   * @param {string} text - Table text
   * @returns {Object} Table block
   */
  async convertTable(text) {
    const lines = text.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) return this.convertParagraph(text);
    
    // Parse header
    const headerCells = this.parseTableRow(lines[0]);
    const tableWidth = headerCells.length;
    
    // Parse separator (skip)
    // lines[1] contains the separator
    
    // Parse data rows and normalize cell count
    const dataRows = [];
    for (let i = 2; i < lines.length; i++) {
      const cells = this.parseTableRow(lines[i]);
      
      // Normalize row to match table width
      while (cells.length < tableWidth) {
        cells.push('');
      }
      if (cells.length > tableWidth) {
        cells.length = tableWidth;
      }
      
      dataRows.push(cells);
    }
    
    // Create table block
    const tableBlock = {
      type: 'table',
      table: {
        table_width: tableWidth,
        has_column_header: true,
        has_row_header: false,
        children: []
      }
    };
    
    // Add header row
    const headerRow = {
      type: 'table_row',
      table_row: {
        cells: headerCells.map(cell => [{ text: { content: cell } }])
      }
    };
    tableBlock.table.children.push(headerRow);
    
    // Add data rows
    for (const row of dataRows) {
      const tableRow = {
        type: 'table_row',
        table_row: {
          cells: row.map(cell => [{ text: { content: cell } }])
        }
      };
      tableBlock.table.children.push(tableRow);
    }
    
    this.conversionStats.tables++;
    return tableBlock;
  }

  /**
   * Parse table row into cells
   * @param {string} row - Table row
   * @returns {Array} Array of cell contents
   */
  parseTableRow(row) {
    return row
      .split('|')
      .slice(1, -1) // Remove empty first and last elements
      .map(cell => cell.trim());
  }

  /**
   * Check if text is a table
   * @param {string} text - Text to check
   * @returns {boolean} True if table
   */
  isTable(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return false;
    
    // Check if has header separator
    const hasHeaderSeparator = lines[1] && lines[1].match(/^\|[\s\-\:\|]+\|$/);
    
    // Check if multiple lines start with |
    const tableLines = lines.filter(line => line.trim().startsWith('|')).length;
    
    return hasHeaderSeparator && tableLines >= 2;
  }

  /**
   * Convert list to Notion blocks
   * @param {string} text - List text
   * @returns {Array} Array of list item blocks
   */
  convertList(text) {
    const lines = text.trim().split('\n');
    const blocks = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Check list type - Task list has priority over regular bullet list
      const taskMatch = trimmed.match(/^[\*\-\+]\s+\[([ xX])\]\s+(.+)$/);
      const bulletMatch = trimmed.match(/^[\*\-\+]\s+(.+)$/);
      const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      
      if (taskMatch) {
        // Task list item (todo)
        const isChecked = taskMatch[1].toLowerCase() === 'x';
        const content = taskMatch[2];
        
        // Check if this is a file block marker
        if (content.includes('__NOTION_FILE_BLOCK__') && content.includes('__END_FILE_BLOCK__')) {
          const match = content.match(/__NOTION_FILE_BLOCK__(.+?)__END_FILE_BLOCK__/);
          if (match) {
            try {
              const fileBlock = JSON.parse(match[1]);
              console.log(chalk.green(`📎 Processing file block in task list: ${fileBlock.file?.caption?.[0]?.text?.content || 'Unknown file'}`));
              blocks.push(fileBlock);
              continue;
            } catch (error) {
              console.log(chalk.red(`❌ Failed to parse file block in task list: ${error.message}`));
            }
          }
        }
        
        blocks.push({
          type: 'to_do',
          to_do: {
            rich_text: this.parseRichText(content),
            checked: isChecked
          }
        });
      } else if (bulletMatch) {
        const content = bulletMatch[1];
        
        // Check if this is a file block marker
        if (content.includes('__NOTION_FILE_BLOCK__') && content.includes('__END_FILE_BLOCK__')) {
          const match = content.match(/__NOTION_FILE_BLOCK__(.+?)__END_FILE_BLOCK__/);
          if (match) {
            try {
              const fileBlock = JSON.parse(match[1]);
              console.log(chalk.green(`📎 Processing file block in list: ${fileBlock.file?.caption?.[0]?.text?.content || 'Unknown file'}`));
              blocks.push(fileBlock);
              continue;
            } catch (error) {
              console.log(chalk.red(`❌ Failed to parse file block in list: ${error.message}`));
            }
          }
        }
        
        blocks.push({
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: this.parseRichText(content)
          }
        });
      } else if (numberedMatch) {
        const content = numberedMatch[1];
        
        // Check if this is a file block marker
        if (content.includes('__NOTION_FILE_BLOCK__') && content.includes('__END_FILE_BLOCK__')) {
          const match = content.match(/__NOTION_FILE_BLOCK__(.+?)__END_FILE_BLOCK__/);
          if (match) {
            try {
              const fileBlock = JSON.parse(match[1]);
              console.log(chalk.green(`📎 Processing file block in numbered list: ${fileBlock.file?.caption?.[0]?.text?.content || 'Unknown file'}`));
              blocks.push(fileBlock);
              continue;
            } catch (error) {
              console.log(chalk.red(`❌ Failed to parse file block in numbered list: ${error.message}`));
            }
          }
        }
        
        blocks.push({
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: this.parseRichText(content)
          }
        });
      }
    }
    
    return blocks;
  }

  /**
   * Convert blockquote to Notion block
   * @param {string} text - Blockquote text
   * @returns {Object} Quote block
   */
  convertBlockquote(text) {
    const content = text
      .split('\n')
      .map(line => line.replace(/^>\s*/, ''))
      .join('\n')
      .trim();
    
    return {
      type: 'quote',
      quote: {
        rich_text: this.parseRichText(content)
      }
    };
  }

  /**
   * Convert horizontal rule to Notion block
   * @returns {Object} Divider block
   */
  convertHorizontalRule() {
    return {
      type: 'divider',
      divider: {}
    };
  }

  /**
   * Convert paragraphs to Notion blocks
   * @param {string} text - Paragraph text
   * @returns {Array} Array of paragraph blocks
   */
  async convertParagraphs(text) {
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    
    const blocks = [];
    for (const paragraph of paragraphs) {
      const block = await this.convertParagraph(paragraph);
      blocks.push(block);
    }
    
    return blocks;
  }

  /**
   * Convert paragraph to Notion block
   * @param {string} content - Paragraph content
   * @returns {Object} Paragraph block
   */
  async convertParagraph(content) {
    if (!content || !content.trim()) {
      return {
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: '' } }]
        }
      };
    }

    // Check for image markdown first
    const imageMatch = content.match(/^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)\s*$/);
    if (imageMatch && this.imageProcessor) {
      const [, altText, imageSrc, title] = imageMatch;
      
      try {
        const imageBlock = await this.imageProcessor.processImageMarkdown(imageSrc, altText, this.config?.projectRoot);
        if (imageBlock && imageBlock.type === 'image') {
          return imageBlock;
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️ Failed to process image ${imageSrc}: ${error.message}`));
      }
      
      // Fallback: create paragraph with image text
      return {
        type: 'paragraph',
        paragraph: {
          rich_text: [{ 
            text: { content: altText ? `[Image: ${altText}]` : '[Image]' },
            annotations: { italic: true, color: 'gray' }
          }]
        }
      };
    }
    
    // Check if rich text contains file block markers
    const richText = this.parseRichText(content);
    if (richText.length === 1 && richText[0].text.content.includes('__FILE_BLOCK_MARKER__')) {
      const markerMatch = richText[0].text.content.match(/__FILE_BLOCK_MARKER__(.+?)__END_MARKER__/);
      if (markerMatch) {
        try {
          const fileBlock = JSON.parse(markerMatch[1]);
          console.log(chalk.green(`📎 Processing file block from rich text: ${fileBlock.file?.caption?.[0]?.text?.content || 'Unknown file'}`));
          return fileBlock;
        } catch (error) {
          console.log(chalk.red(`❌ Failed to parse file block from rich text: ${error.message}`));
        }
      }
    }

    return {
      type: 'paragraph',
      paragraph: {
        rich_text: richText
      }
    };
  }

  /**
   * Parse rich text with formatting
   * @param {string} text - Text to parse
   * @returns {Array} Array of rich text objects
   */
  parseRichText(text) {
    if (!text || typeof text !== 'string') {
      return [{ text: { content: '' } }];
    }
    
    // Check for file block markers and return special indicator
    if (text.includes('__NOTION_FILE_BLOCK__') && text.includes('__END_FILE_BLOCK__')) {
      const match = text.match(/__NOTION_FILE_BLOCK__(.+?)__END_FILE_BLOCK__/);
      if (match) {
        try {
          const fileBlock = JSON.parse(match[1]);
          // Return a special marker that will be handled by the parent
          return [{ text: { content: `__FILE_BLOCK_MARKER__${match[1]}__END_MARKER__` } }];
        } catch (error) {
          console.log(chalk.red(`❌ Failed to parse file block in rich text: ${error.message}`));
        }
      }
    }
    
    const richText = [];
    let processedText = text;
    
    // Process formatting in order of precedence to avoid conflicts
    // 1. Images first (most specific - they start with !)
    const imageMatches = [];
    let imageMatch;
    const imageRegex = /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g;
    while ((imageMatch = imageRegex.exec(text)) !== null) {
      imageMatches.push({
        type: 'image',
        start: imageMatch.index,
        end: imageMatch.index + imageMatch[0].length,
        altText: imageMatch[1],
        url: imageMatch[2], // URL only, without title
        title: imageMatch[3], // Optional title
        full: imageMatch[0]
      });
    }

    // 2. Links (after images to avoid conflict)
    const linkMatches = [];
    let linkMatch;
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    while ((linkMatch = linkRegex.exec(text)) !== null) {
      // Skip if inside an image
      const isInsideImage = imageMatches.some(img => 
        linkMatch.index >= img.start && linkMatch.index < img.end
      );
      if (!isInsideImage) {
        linkMatches.push({
          type: 'link',
          start: linkMatch.index,
          end: linkMatch.index + linkMatch[0].length,
          text: linkMatch[1],
          url: linkMatch[2],
          full: linkMatch[0]
        });
      }
    }
    
    // 3. Code (to avoid conflict with other formatting)
    const codeMatches = [];
    let codeMatch;
    const codeRegex = /`([^`]+)`/g;
    while ((codeMatch = codeRegex.exec(text)) !== null) {
      // Skip if inside an image or link
      const isInsideOther = [...imageMatches, ...linkMatches].some(other => 
        codeMatch.index >= other.start && codeMatch.index < other.end
      );
      if (!isInsideOther) {
        codeMatches.push({
          type: 'code',
          start: codeMatch.index,
          end: codeMatch.index + codeMatch[0].length,
          text: codeMatch[1],
          full: codeMatch[0]
        });
      }
    }
    
    // 4. Bold (before italic to handle ** correctly)
    const boldMatches = [];
    let boldMatch;
    const boldRegex = /\*\*([^*]+)\*\*/g;
    while ((boldMatch = boldRegex.exec(text)) !== null) {
      // Skip if inside image, link or code
      const isInsideOther = [...imageMatches, ...linkMatches, ...codeMatches].some(other => 
        boldMatch.index >= other.start && boldMatch.index < other.end
      );
      if (!isInsideOther) {
        // Check if this bold contains a link - if so, we need to handle it specially
        const boldContent = boldMatch[1];
        const linkInBold = /\[([^\]]+)\]\(([^)]+)\)/.exec(boldContent);
        
        if (linkInBold) {
          // This bold contains a link - create a bold link instead of separate bold and link
          boldMatches.push({
            type: 'bold_link',
            start: boldMatch.index,
            end: boldMatch.index + boldMatch[0].length,
            text: linkInBold[1],
            url: linkInBold[2],
            full: boldMatch[0]
          });
          
          // Remove the link match that would conflict
          const conflictingLinkIndex = linkMatches.findIndex(link => 
            link.start >= boldMatch.index && link.end <= boldMatch.index + boldMatch[0].length
          );
          if (conflictingLinkIndex !== -1) {
            linkMatches.splice(conflictingLinkIndex, 1);
          }
        } else {
          boldMatches.push({
            type: 'bold',
            start: boldMatch.index,
            end: boldMatch.index + boldMatch[0].length,
            text: boldMatch[1],
            full: boldMatch[0]
          });
        }
      }
    }
    
    // 5. Italic (after bold)
    const italicMatches = [];
    let italicMatch;
    const italicRegex = /\*([^*]+)\*/g;
    while ((italicMatch = italicRegex.exec(text)) !== null) {
      // Skip if inside image, link, code, or bold
      const isInsideOther = [...imageMatches, ...linkMatches, ...codeMatches, ...boldMatches].some(other => 
        italicMatch.index >= other.start && italicMatch.index < other.end
      );
      if (!isInsideOther) {
        italicMatches.push({
          type: 'italic',
          start: italicMatch.index,
          end: italicMatch.index + italicMatch[0].length,
          text: italicMatch[1],
          full: italicMatch[0]
        });
      }
    }
    
    // 6. Strikethrough
    const strikeMatches = [];
    let strikeMatch;
    const strikeRegex = /~~([^~]+)~~/g;
    while ((strikeMatch = strikeRegex.exec(text)) !== null) {
      // Skip if inside other formatting
      const isInsideOther = [...imageMatches, ...linkMatches, ...codeMatches, ...boldMatches, ...italicMatches].some(other => 
        strikeMatch.index >= other.start && strikeMatch.index < other.end
      );
      if (!isInsideOther) {
        strikeMatches.push({
          type: 'strikethrough',
          start: strikeMatch.index,
          end: strikeMatch.index + strikeMatch[0].length,
          text: strikeMatch[1],
          full: strikeMatch[0]
        });
      }
    }
    
    // Combine all matches and sort by position
    const allMatches = [...imageMatches, ...linkMatches, ...codeMatches, ...boldMatches, ...italicMatches, ...strikeMatches];
    allMatches.sort((a, b) => a.start - b.start);
    
    // Process text with formatting
    let currentPos = 0;
    
    for (const match of allMatches) {
      // Add plain text before match
      if (match.start > currentPos) {
        const plainText = text.substring(currentPos, match.start);
        if (plainText) {
          richText.push({ text: { content: plainText } });
        }
      }
      
      // Add formatted text
      const textObj = { text: { content: match.text } };
      
      switch (match.type) {
        case 'image':
          // For images in rich text, keep original markdown syntax
          textObj.text.content = match.full;
          textObj.annotations = { color: 'gray', italic: true };
          break;
        case 'bold':
          textObj.annotations = { bold: true };
          break;
        case 'bold_link':
          // Handle bold link combination
          const cleanBoldUrl = this.validateAndCleanUrl(match.url);
          if (cleanBoldUrl) {
            textObj.text.link = { url: cleanBoldUrl };
            textObj.annotations = { bold: true, color: 'blue' };
            if (this.conversionStats) this.conversionStats.validUrls++;
          } else {
            // If URL is invalid, treat as bold text
            textObj.text.content = `[${match.text}](${match.url})`;
            textObj.annotations = { bold: true, color: 'gray' };
            if (this.conversionStats) this.conversionStats.invalidUrls++;
          }
          break;
        case 'italic':
          textObj.annotations = { italic: true };
          break;
        case 'code':
          textObj.annotations = { code: true };
          break;
        case 'strikethrough':
          textObj.annotations = { strikethrough: true };
          break;
        case 'link':
          // Validate and clean URL
          const cleanUrl = this.validateAndCleanUrl(match.url);
          if (cleanUrl) {
            textObj.text.link = { url: cleanUrl };
            textObj.annotations = { color: 'blue' };
            if (this.conversionStats) this.conversionStats.validUrls++;
          } else {
            // If URL is invalid, treat as plain text
            textObj.text.content = `[${match.text}](${match.url})`;
            textObj.annotations = { color: 'gray' };
            if (this.conversionStats) this.conversionStats.invalidUrls++;
          }
          break;
      }
      
      richText.push(textObj);
      currentPos = match.end;
    }
    
    // Add remaining plain text
    if (currentPos < text.length) {
      const remainingText = text.substring(currentPos);
      if (remainingText) {
        richText.push({ text: { content: remainingText } });
      }
    }
    
    // Return at least one empty text object if no content
    return richText.length > 0 ? richText : [{ text: { content: text || '' } }];
  }

  /**
   * Validate and clean URL for Notion
   * @param {string} url - URL to validate
   * @returns {string|null} Clean URL or null if invalid
   */
  validateAndCleanUrl(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }
    
    // Trim whitespace
    url = url.trim();
    
    // Skip empty URLs
    if (!url) {
      return null;
    }
    
    // Skip anchor-only links (they don't work in Notion)
    if (url.startsWith('#')) {
      return null;
    }
    
    // Handle relative paths (convert to absolute if needed)
    if (url.startsWith('./') || url.startsWith('../')) {
      // For now, skip relative paths as they won't work in Notion
      return null;
    }
    
    // Handle absolute paths (like /docs/something)
    if (url.startsWith('/') && !url.startsWith('//')) {
      // For now, skip absolute paths as they need base URL
      return null;
    }
    
    // Validate HTTP/HTTPS URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        new URL(url);
        return url;
      } catch (error) {
        return null;
      }
    }
    
    // Handle mailto links
    if (url.startsWith('mailto:')) {
      return url;
    }
    
    // Handle file:// links (though they won't work in Notion)
    if (url.startsWith('file://')) {
      return null; // Skip file links
    }
    
    // If it looks like a URL without protocol, add https://
    if (url.includes('.') && !url.includes(' ')) {
      try {
        new URL(`https://${url}`);
        return `https://${url}`;
      } catch (error) {
        return null;
      }
    }
    
    // Skip everything else
    return null;
  }

  /**
   * Map programming language to Notion supported language
   * @param {string} lang - Language identifier
   * @returns {string} Notion language
   */
  mapLanguage(lang) {
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'md': 'markdown',
      'yml': 'yaml',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      // Diagram languages - map to plain text since Notion doesn't support them
      'd2': 'plain text',
      'mermaid': 'plain text',
      'plantuml': 'plain text',
      'dot': 'plain text',
      'graphviz': 'plain text'
    };
    
    // Get the mapped language or use the original (lowercased)
    const mapped = languageMap[lang?.toLowerCase()];
    if (mapped) {
      return mapped;
    }
    
    // Check if the language is in Notion's supported list
    const notionSupportedLanguages = [
      'abc', 'abap', 'agda', 'arduino', 'ascii art', 'assembly', 'bash', 'basic', 'bnf',
      'c', 'c#', 'c++', 'clojure', 'coffeescript', 'coq', 'css', 'dart', 'dhall', 'diff',
      'docker', 'ebnf', 'elixir', 'elm', 'erlang', 'f#', 'flow', 'fortran', 'gherkin',
      'glsl', 'go', 'graphql', 'groovy', 'haskell', 'hcl', 'html', 'idris', 'java',
      'javascript', 'json', 'julia', 'kotlin', 'latex', 'less', 'lisp', 'livescript',
      'llvm ir', 'lua', 'makefile', 'markdown', 'markup', 'matlab', 'mathematica',
      'mermaid', 'nix', 'notion formula', 'objective-c', 'ocaml', 'pascal', 'perl',
      'php', 'plain text', 'powershell', 'prolog', 'protobuf', 'purescript', 'python',
      'r', 'racket', 'reason', 'ruby', 'rust', 'sass', 'scala', 'scheme', 'scss',
      'shell', 'smalltalk', 'solidity', 'sql', 'swift', 'toml', 'typescript', 'vb.net',
      'verilog', 'vhdl', 'visual basic', 'webassembly', 'xml', 'yaml', 'java/c/c++/c#',
      'notionscript'
    ];
    
    const langLower = lang?.toLowerCase() || '';
    return notionSupportedLanguages.includes(langLower) ? langLower : 'plain text';
  }

  /**
   * Validate blocks before sending to Notion
   * @param {Array} blocks - Array of blocks
   * @returns {Array} Validated blocks
   */
  validateBlocks(blocks) {
    return blocks.filter(block => {
      // Check required properties
      if (!block.type) {
        console.warn(chalk.yellow('⚠️ Block missing type property'));
        return false;
      }
      
      // Check block-specific properties
      if (!block[block.type]) {
        console.warn(chalk.yellow(`⚠️ Block missing ${block.type} property`));
        return false;
      }
      
      return true;
    });
  }

  /**
   * Split blocks into chunks for API limits
   * @param {Array} blocks - Array of blocks
   * @param {number} maxBlocks - Maximum blocks per chunk
   * @returns {Array} Array of block chunks
   */
  chunkBlocks(blocks, maxBlocks = 100) {
    const chunks = [];
    for (let i = 0; i < blocks.length; i += maxBlocks) {
      chunks.push(blocks.slice(i, i + maxBlocks));
    }
    return chunks;
  }
}

module.exports = MarkdownToBlocksConverter; 