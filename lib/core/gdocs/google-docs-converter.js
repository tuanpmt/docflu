const MarkdownIt = require('markdown-it');
const fs = require('fs-extra');
const path = require('path');
const TableConverter = require('./table-converter');

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
    
    this.tableConverter = new TableConverter();
    
    // Debug configuration
    this.debug = process.env.DEBUG_GDOCS_CONVERTER === 'true';
    this.debugDir = path.join(process.cwd(), '.docusaurus', 'debug', 'gdocs-converter');
  }

  /**
   * Convert markdown content to Google Docs requests
   * @param {string} markdown - Markdown content
   * @param {Object} options - Conversion options
   * @returns {Object} - { requests, tablesForStep2 }
   */
  convertFromMarkdown(markdown, options = {}) {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      input: { markdown, options },
      processing: { lines: [], elements: [] },
      output: null,
      errors: []
    };

    try {
      const lines = markdown.split('\n');
      const requests = [];
      const tablesForStep2 = []; // Tables that need cell population
      
      // Process each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        debugInfo.processing.lines.push({
          lineNumber: i + 1,
          content: line,
          type: this.getLineType(trimmedLine)
        });

        if (trimmedLine === '') {
          // Empty line
          requests.push({
            insertText: {
              text: '\n',
              endOfSegmentLocation: { segmentId: '' }
            }
          });
          
          debugInfo.processing.elements.push({
            lineNumber: i + 1,
            type: 'paragraph_break'
          });
          
        } else if (trimmedLine.startsWith('#')) {
          // Heading - insert with basic formatting
          const level = (trimmedLine.match(/^#+/) || [''])[0].length;
          const text = trimmedLine.replace(/^#+\s*/, '');
          
          // Insert heading with simple bold formatting
          const headingText = level === 1 ? text.toUpperCase() : text;
          requests.push({
            insertText: {
              text: `${headingText}\n\n`,
              endOfSegmentLocation: { segmentId: '' }
            }
          });
          
          debugInfo.processing.elements.push({
            lineNumber: i + 1,
            type: 'heading',
            level: level,
            content: text
          });
          
        } else {
          // Check for table
          const tableResult = this.extractTable(lines, i);
          if (tableResult) {
            const tableData = this.tableConverter.parseTable(tableResult.content);
            if (tableData) {
              // Step 1: Create empty table structure only
              requests.push({
                insertTable: {
                  rows: tableData.rows.length + 1,
                  columns: tableData.headers.length,
                  endOfSegmentLocation: { segmentId: '' }
                }
              });
              
              // Store table data for step 2 population
              tablesForStep2.push({
                tableData: tableData,
                requestIndex: requests.length - 1
              });
              
              debugInfo.processing.elements.push({
                type: 'table',
                startLine: i,
                endLine: tableResult.endIndex,
                headers: tableData.headers,
                rowCount: tableData.rows.length,
                needsPopulation: true
              });
              
              i = tableResult.endIndex; // Skip processed lines
            } else {
              // Fallback to paragraph
              requests.push({
                insertText: {
                  text: line + '\n',
                  endOfSegmentLocation: { segmentId: '' }
                }
              });
              
              debugInfo.processing.elements.push({
                lineNumber: i + 1,
                type: 'paragraph',
                content: line
              });
            }
          } else {
            // Regular paragraph
            requests.push({
              insertText: {
                text: line + '\n',
                endOfSegmentLocation: { segmentId: '' }
              }
            });
            
            debugInfo.processing.elements.push({
              lineNumber: i + 1,
              type: 'paragraph',
              content: line
            });
          }
        }
      }

      const result = { requests, tablesForStep2 };
      
      debugInfo.output = {
        requestCount: requests.length,
        tablesForStep2Count: tablesForStep2.length,
        summary: {
          totalElements: debugInfo.processing.elements.length,
          elementTypes: this.countElementTypes(debugInfo.processing.elements)
        }
      };

      if (this.debug) {
        this.saveDebugInfo(debugInfo);
      }

      return result;
      
    } catch (error) {
      debugInfo.errors.push({
        message: error.message,
        stack: error.stack
      });
      
      if (this.debug) {
        this.saveDebugInfo(debugInfo);
      }
      
      throw error;
    }
  }

  /**
   * Count element types for debugging
   */
  countElementTypes(elements) {
    const counts = {};
    elements.forEach(element => {
      counts[element.type] = (counts[element.type] || 0) + 1;
    });
    return counts;
  }

  /**
   * Detect line type for debugging
   */
  getLineType(line) {
    if (!line) return 'empty';
    if (line.startsWith('#')) return 'heading';
    if (line.startsWith('|')) return 'table';
    if (line.startsWith('```')) return 'code_block_delimiter';
    if (line.match(/^[\*\-\+]\s/)) return 'unordered_list';
    if (line.match(/^\d+\.\s/)) return 'ordered_list';
    return 'paragraph';
  }

  /**
   * Summarize element types for debug summary
   */
  summarizeElementTypes(elements) {
    const summary = {};
    elements.forEach(element => {
      summary[element.type] = (summary[element.type] || 0) + 1;
    });
    return summary;
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
        ? `conversion-debug-${suffix}-${timestamp}.json`
        : `conversion-debug-${timestamp}.json`;
      
      const filepath = path.join(this.debugDir, filename);
      
      // Add additional debug metadata
      const debugOutput = {
        ...debugInfo,
        metadata: {
          converterVersion: '1.0.0',
          nodeVersion: process.version,
          debugEnabled: this.debug,
          debugDir: this.debugDir,
          filename: filename
        }
      };
      
      await fs.writeJson(filepath, debugOutput, { spaces: 2 });
      
      console.log(`🐛 Debug info saved: ${filepath}`);
      
      // Also save a simplified summary for quick overview
      const summaryPath = path.join(this.debugDir, `summary-${timestamp}.json`);
      const summary = {
        timestamp: debugInfo.timestamp,
        inputLength: debugInfo.input.markdown.length,
        outputRequests: debugInfo.output.requestCount,
        totalElements: debugInfo.output.summary.totalElements,
        elementTypes: debugInfo.output.summary.elementTypes,
        indexRange: debugInfo.output.summary.indexRange,
        errors: debugInfo.errors,
        filename: filename
      };
      
      await fs.writeJson(summaryPath, summary, { spaces: 2 });
      
    } catch (error) {
      console.warn('⚠️ Failed to save debug info:', error.message);
    }
  }

  /**
   * Extract table content from lines starting at startIndex
   * @param {string[]} lines - Array of markdown lines
   * @param {number} startIndex - Starting line index
   * @returns {Object|null} - Table extraction result or null if invalid
   */
  extractTable(lines, startIndex) {
    let tableLines = [];
    let currentIndex = startIndex;

    // Collect table lines
    while (currentIndex < lines.length && lines[currentIndex].trim().startsWith('|')) {
      tableLines.push(lines[currentIndex]);
      currentIndex++;
    }

    // Validate minimum table structure (header + separator + at least one row)
    if (tableLines.length < 3) return null;

    return {
      content: tableLines.join('\n'),
      endIndex: currentIndex - 1
    };
  }

  /**
   * Create table as formatted text (fallback approach)
   */
  createTableAsText(tableData) {
    const { headers, rows } = tableData;
    let tableText = '\n';
    
    // Add headers
    tableText += '| ' + headers.join(' | ') + ' |\n';
    
    // Add separator
    tableText += '|' + headers.map(() => '---').join('|') + '|\n';
    
    // Add rows
    rows.forEach(row => {
      tableText += '| ' + row.join(' | ') + ' |\n';
    });
    
    return tableText;
  }
}

module.exports = GoogleDocsConverter; 