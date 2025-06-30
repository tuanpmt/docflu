const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const GoogleDocsConverter = require('./google-docs-converter');
const GoogleDocsState = require('./google-docs-state');
const DocusaurusScanner = require('../docusaurus-scanner');
const ReferenceProcessor = require('../reference-processor');
const DiagramProcessor = require('../diagram-processor');
const ImageProcessor = require('../image-processor');

/**
 * Google Docs Sync Engine
 * Main orchestrator for syncing Docusaurus content to Google Docs
 */
class GoogleDocsSync {
  constructor(googleDocsClient, projectRoot = process.cwd()) {
    this.client = googleDocsClient;
    this.projectRoot = projectRoot;
    this.converter = new GoogleDocsConverter();
    this.state = new GoogleDocsState(projectRoot);
    this.scanner = new DocusaurusScanner(projectRoot);
    
    // Initialize processors (reuse from existing codebase)
    this.referenceProcessor = new ReferenceProcessor(projectRoot, this.state);
    this.diagramProcessor = null; // Will be initialized when needed
    this.imageProcessor = null; // Will be initialized when needed
  }

  /**
   * Initialize sync engine
   */
  async initialize() {
    console.log(chalk.blue('🚀 Initializing Google Docs sync engine...'));
    
    // Detect Docusaurus project
    await this.scanner.detectProject();
    
    // Initialize state manager
    await this.state.init();
    
    // Initialize Google Docs client
    await this.client.initialize();
    
    console.log(chalk.green('✅ Google Docs sync engine initialized'));
  }

  /**
   * Sync all docs to Google Docs
   */
  async syncDocs(options = {}) {
    const { dryRun = false, force = false } = options;
    
    console.log(chalk.blue('📚 Starting Google Docs sync...'));
    
    if (dryRun) {
      console.log(chalk.yellow('🔍 DRY RUN MODE - No actual changes will be made'));
    }

    const spinner = ora('Scanning Docusaurus project...').start();
    
    try {
      // Reset stats for this sync
      this.state.resetStats();
      
      // Scan Docusaurus project
      spinner.text = 'Scanning Docusaurus project...';
      const documents = await this.scanner.scanDocs();
      
      if (documents.length === 0) {
        spinner.fail('No documents found to sync');
        return { success: false, message: 'No documents found' };
      }

      spinner.succeed(`Found ${documents.length} documents to scan`);
      
      // Get or create root document
      spinner.start('Setting up root Google Docs document...');
      const rootDocument = await this.ensureRootDocument();
      spinner.succeed(`Root document ready: ${rootDocument.title}`);
      
      // Filter documents that need sync
      spinner.start('Checking which documents need sync...');
      const filesToSync = force ? documents : await this.state.getFilesToSync(documents);
      
      if (filesToSync.length === 0) {
        spinner.succeed('All documents are up to date');
        return this.generateSyncReport();
      }

      spinner.succeed(`${filesToSync.length} documents need sync`);
      
      if (dryRun) {
        console.log(chalk.yellow('\n📋 DRY RUN - Would sync these files:'));
        filesToSync.forEach(file => {
          console.log(chalk.gray(`   📄 ${file.relativePath} (${file.title})`));
        });
        return { success: true, dryRun: true, filesToSync };
      }

      // Process documents
      console.log(chalk.blue('\n📝 Processing documents...'));
      
      // Process all documents and append to the same document
      for (let i = 0; i < filesToSync.length; i++) {
        const doc = filesToSync[i];
        const progress = `(${i + 1}/${filesToSync.length})`;
        
        try {
          spinner.start(`${progress} Processing ${doc.title}...`);
          await this.syncDocumentAppend(doc, rootDocument.documentId);
          spinner.succeed(`${progress} ✅ ${doc.title}`);
          this.state.updateStats('updated');
        } catch (error) {
          spinner.fail(`${progress} ❌ ${doc.title}: ${error.message}`);
          this.state.updateStats('failed');
        }
      }

      // Save state
      await this.state.save();
      
      return this.generateSyncReport();
      
    } catch (error) {
      spinner.fail('Sync failed');
      console.error(chalk.red('❌ Sync error:', error.message));
      throw error;
    }
  }

  /**
   * Sync single file to Google Docs
   */
  async syncFile(filePath, options = {}) {
    const { dryRun = false } = options;
    
    console.log(chalk.blue(`📄 Syncing file: ${filePath}`));
    
    if (dryRun) {
      console.log(chalk.yellow('🔍 DRY RUN MODE - No actual changes will be made'));
    }

    try {
      // Initialize if not already done
      if (!this.state.state.lastSync) {
        await this.initialize();
      }

      // Parse file with scanner
      // Convert relative path to absolute path for scanner
      const absoluteFilePath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath);
      const document = await this.scanner.parseFile(absoluteFilePath);
      
      if (!document) {
        throw new Error(`Failed to parse file: ${filePath}. File may not exist or is not a valid markdown file.`);
      }
      
      if (dryRun) {
        console.log(chalk.yellow('📋 DRY RUN - Would sync:'));
        console.log(chalk.gray(`   📄 ${document.title}`));
        console.log(chalk.gray(`   📁 ${document.relativePath}`));
        return { success: true, dryRun: true, document };
      }

      // Get or create root document
      const rootDocument = await this.ensureRootDocument();
      
      // Sync the document
      await this.syncDocument(document, rootDocument.documentId);
      
      // Save state
      await this.state.save();
      
      console.log(chalk.green(`✅ Successfully synced: ${document.title}`));
      
      return { 
        success: true, 
        document: document.title,
        url: rootDocument.url 
      };
      
    } catch (error) {
      console.error(chalk.red('❌ File sync error:', error.message));
      throw error;
    }
  }

  /**
   * Ensure root document exists
   */
  async ensureRootDocument() {
    const existingRoot = this.state.getRootDocument();
    
    if (existingRoot.documentId) {
      try {
        // Verify document still exists
        await this.client.getDocument(existingRoot.documentId);
        return existingRoot;
      } catch (error) {
        console.log(chalk.yellow('⚠️ Root document not found, creating new one...'));
      }
    }

    // Create new root document
    const rootDoc = await this.client.createDocument('Documentation');
    this.state.setRootDocument(rootDoc.documentId, rootDoc.url, 'Documentation');
    await this.state.save();
    
    return rootDoc;
  }

  /**
   * Sync single document (append mode for batch sync)
   */
  async syncDocumentAppend(document, rootDocumentId) {
    const { filePath, title, content: markdownContent } = document;
    
    try {
      // Process content with processors
      let processedContent = markdownContent;
      
      // Skip internal reference processing for Google Docs
      // Google Docs doesn't support complex linking like Confluence
      // Keep original markdown text instead of converting to links
      // Internal references will remain as plain text (e.g., "Create a page")

      // Process diagrams (if any)
      if (this.containsDiagrams(processedContent)) {
        await this.initializeDiagramProcessor(rootDocumentId);
        const diagramResult = await this.diagramProcessor.processAllDiagrams(
          rootDocumentId, 
          processedContent
        );
        if (diagramResult) {
          processedContent = diagramResult.processedMarkdown;
        }
      }

      // Process images (if any)
      if (this.containsImages(processedContent)) {
        await this.initializeImageProcessor(rootDocumentId);
        // For Google Docs, we'll skip image processing for now
        // TODO: Implement Google Drive API integration for image upload
        console.log(chalk.yellow('⚠️ Image processing not yet implemented for Google Docs'));
      }

      // Convert markdown to Google Docs requests
      const conversionResult = this.converter.convertFromMarkdown(processedContent, { 
        filePath: filePath,
        title: title
      });
      
      const { requests } = conversionResult;

      // Apply content to document
      if (requests.length > 0) {
        console.log(chalk.gray(`📝 Applying ${requests.length} requests to document...`));
        
        await this.client.docs.documents.batchUpdate({
          documentId: rootDocumentId,
          requestBody: {
            requests: requests
          }
        });
      }

      // Update state
      await this.state.updateDocument(filePath, {
        documentId: rootDocumentId,
        title,
        tabId: null, // Will be implemented in hierarchy phase
        parentTabId: null
      });

      return { success: true, title };
      
    } catch (error) {
      console.error(chalk.red(`❌ Error syncing document ${title}:`, error.message));
      throw error;
    }
  }

  /**
   * Sync single document (replace mode for single file sync)
   */
  async syncDocument(document, rootDocumentId) {
    const { filePath, title, content: markdownContent } = document;
    
    try {
      // Process content with processors
      let processedContent = markdownContent;
      
      // Skip internal reference processing for Google Docs
      // Google Docs doesn't support complex linking like Confluence
      // Keep original markdown text instead of converting to links
      // Internal references will remain as plain text (e.g., "Create a page")

      // Process diagrams (if any)
      if (this.containsDiagrams(processedContent)) {
        await this.initializeDiagramProcessor(rootDocumentId);
        const diagramResult = await this.diagramProcessor.processAllDiagrams(
          rootDocumentId, 
          processedContent
        );
        if (diagramResult) {
          processedContent = diagramResult.processedMarkdown;
        }
      }

      // Process images (if any)
      if (this.containsImages(processedContent)) {
        await this.initializeImageProcessor(rootDocumentId);
        // For Google Docs, we'll skip image processing for now
        // TODO: Implement Google Drive API integration for image upload
        console.log(chalk.yellow('⚠️ Image processing not yet implemented for Google Docs'));
        // const imageResult = await this.imageProcessor.processImages(
        //   rootDocumentId, 
        //   processedContent, 
        //   processedContent, // Use same content for both markdown and html
        //   filePath,
        //   'https://docs.google.com'
        // );
        // if (imageResult) {
        //   processedContent = imageResult;
        // }
      }

      // Always sync - clear and replace content each time
      
      // Get current document to check if it has content to clear
      const currentDoc = await this.client.getDocument(rootDocumentId);
      
      // Find the last content element to get the actual document length
      const content = currentDoc.body?.content || [];
      let currentContentLength = 1;
      
      if (content.length > 0) {
        // Get the endIndex of the last content element
        const lastElement = content[content.length - 1];
        currentContentLength = lastElement.endIndex || 1;
      }
      
      console.log(chalk.gray(`📄 Current document length: ${currentContentLength} characters`));
      
      // Convert markdown to Google Docs requests
      const conversionResult = this.converter.convertFromMarkdown(processedContent, { 
        filePath: filePath,
        title: title
      });
      
      const { requests, tablesForStep2 } = conversionResult;

      // Step 1: Clear content and apply basic content and table structures
      const allRequests = [];
      
      // Add clear content request if document has content to clear
      if (currentContentLength > 2) { // Need at least 3 characters to have clearable content
        allRequests.push({
          deleteContentRange: {
            range: {
              startIndex: 1,
              endIndex: currentContentLength - 1
            }
          }
        });
      }
      
      // Add conversion requests
      allRequests.push(...requests);
      
      if (allRequests.length > 0) {
        console.log(chalk.gray(`📝 Applying ${allRequests.length} requests to document...`));
        
        await this.client.docs.documents.batchUpdate({
          documentId: rootDocumentId,
          requestBody: {
            requests: allRequests
          }
        });
      }

      // Step 2 & 3: Populate table cells if there are tables
      if (tablesForStep2 && tablesForStep2.length > 0) {
        console.log(chalk.gray(`🔄 Processing ${tablesForStep2.length} tables for cell population...`));
        
        // Get updated document to find actual table positions
        const updatedDoc = await this.client.getDocument(rootDocumentId);
        
        // Debug: Log document structure
        if (process.env.DEBUG_GDOCS_CONVERTER === 'true') {
          console.log('📊 Document structure after step 1:');
          updatedDoc.body.content.forEach((element, index) => {
            if (element.table) {
              console.log(`  Table ${index}: startIndex=${element.startIndex}, endIndex=${element.endIndex}`);
              // Debug table structure in detail
              console.log(`    Table rows: ${element.table.rows}`);
              console.log(`    Table columns: ${element.table.columns}`);
              if (element.table.tableRows && element.table.tableRows.length > 0) {
                element.table.tableRows.forEach((row, rowIndex) => {
                  console.log(`    Row ${rowIndex}:`);
                  if (row.tableCells) {
                    row.tableCells.forEach((cell, cellIndex) => {
                      console.log(`      Cell [${rowIndex}][${cellIndex}]: startIndex=${cell.startIndex}, endIndex=${cell.endIndex}`);
                      if (cell.content && cell.content.length > 0) {
                        cell.content.forEach((content, contentIndex) => {
                          if (content.paragraph) {
                            console.log(`        Paragraph ${contentIndex}: startIndex=${content.startIndex}, endIndex=${content.endIndex}`);
                          }
                        });
                      }
                    });
                  }
                });
              }
            } else if (element.paragraph) {
              const text = this.extractTextFromParagraph(element.paragraph);
              console.log(`  Paragraph ${index}: startIndex=${element.startIndex}, endIndex=${element.endIndex}, text="${text.substring(0, 50)}..."`);
            }
          });
        }
        
        // Create cell content requests using tableCellLocation
        const cellRequests = [];
        
        // Find tables in document structure
        const tables = this.findTablesInDocument(updatedDoc);
        
        // Process tables in reverse order to avoid index shifts
        for (let i = tablesForStep2.length - 1; i >= 0 && i < tables.length; i--) {
          const { tableData } = tablesForStep2[i];
          const tableElement = tables[i];
          
          // Create cell content requests using actual table structure
          const tableCellRequests = this.createTableCellStructureRequests(tableData, tableElement);
          cellRequests.push(...tableCellRequests);
        }
        
        // Execute cell population requests
        if (cellRequests.length > 0) {
          console.log(chalk.gray(`📝 Applying ${cellRequests.length} cell content requests...`));
          
          // Debug: Log problematic requests
          if (process.env.DEBUG_GDOCS_CONVERTER === 'true') {
            cellRequests.forEach((request, index) => {
              console.log(`Request ${index}: text="${request.insertText.text}", index=${request.insertText.location.index}`);
            });
          }
          
          await this.client.docs.documents.batchUpdate({
            documentId: rootDocumentId,
            requestBody: {
              requests: cellRequests
            }
          });
        }
      }

      // Update state
      await this.state.updateDocument(filePath, {
        documentId: rootDocumentId,
        title,
        tabId: null, // Will be implemented in hierarchy phase
        parentTabId: null
      });

      return { success: true, title };
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to sync document ${title}:`, error.message));
      throw error;
    }
  }

  /**
   * Check if content contains diagrams
   */
  containsDiagrams(content) {
    const diagramPatterns = [
      /```mermaid/,
      /```plantuml/,
      /```dot/,
      /```graphviz/,
      /```d2/
    ];
    
    return diagramPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if content contains images
   */
  containsImages(content) {
    return /!\[.*?\]\(.*?\)/.test(content) || /<img.*?src=/.test(content);
  }

  /**
   * Initialize diagram processor when needed
   */
  async initializeDiagramProcessor(documentId) {
    if (!this.diagramProcessor) {
      // Create a mock client for Google Docs diagram processing
      const mockClient = {
        uploadAttachment: async (docId, filePath, fileName) => {
          // For now, we'll skip actual image upload to Google Docs
          // This would need Google Drive API integration
          console.log(chalk.yellow(`⚠️ Diagram upload not yet implemented: ${fileName}`));
          return { title: fileName };
        }
      };
      
      this.diagramProcessor = new DiagramProcessor(mockClient);
    }
  }

  /**
   * Initialize image processor when needed
   */
  async initializeImageProcessor(documentId) {
    if (!this.imageProcessor) {
      // Create a mock client for Google Docs image processing
      const mockClient = {
        uploadAttachment: async (docId, filePath, fileName) => {
          // For now, we'll skip actual image upload to Google Docs
          // This would need Google Drive API integration
          console.log(chalk.yellow(`⚠️ Image upload not yet implemented: ${fileName}`));
          return { title: fileName };
        }
      };
      
      this.imageProcessor = new ImageProcessor(mockClient, this.projectRoot);
    }
  }

  /**
   * Generate sync report
   */
  generateSyncReport() {
    const stats = this.state.getStats();
    const summary = this.state.getSummary();
    
    console.log(chalk.blue('\n📊 Sync Report'));
    console.log(chalk.gray('=================='));
    console.log(chalk.green(`✅ Created: ${stats.created}`));
    console.log(chalk.blue(`📝 Updated: ${stats.updated}`));
    console.log(chalk.gray(`⏭️ Skipped: ${stats.skipped}`));
    console.log(chalk.red(`❌ Failed: ${stats.failed}`));
    console.log(chalk.cyan(`📄 Total: ${stats.totalProcessed}`));
    
    if (summary.rootDocument.documentUrl) {
      console.log(chalk.cyan(`\n🔗 Google Docs: ${summary.rootDocument.documentUrl}`));
    }
    
    return {
      success: stats.failed === 0,
      stats,
      summary,
      url: summary.rootDocument.documentUrl
    };
  }

  /**
   * Get sync status
   */
  async getStatus() {
    await this.state.init();
    const summary = this.state.getSummary();
    
    console.log(chalk.blue('📊 Google Docs Sync Status'));
    console.log(chalk.gray('============================'));
    console.log(chalk.cyan(`Root Document: ${summary.rootDocument.title || 'Not created'}`));
    console.log(chalk.cyan(`Total Documents: ${summary.totalDocuments}`));
    console.log(chalk.cyan(`Total Tabs: ${summary.totalTabs}`));
    console.log(chalk.cyan(`Last Sync: ${summary.lastSync || 'Never'}`));
    
    if (summary.rootDocument.documentUrl) {
      console.log(chalk.cyan(`URL: ${summary.rootDocument.documentUrl}`));
    }
    
    return summary;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    await this.state.cleanup();
    await this.state.save();
    
    if (this.diagramProcessor) {
      await this.diagramProcessor.cleanup();
    }
    
    // ImageProcessor doesn't have cleanup method, so skip it
    // if (this.imageProcessor) {
    //   await this.imageProcessor.cleanup();
    // }
  }

  /**
   * Find all tables in document structure
   * @param {Object} document - Google Docs document object
   * @returns {Array} Array of table elements with startIndex
   */
  findTablesInDocument(document) {
    const tables = [];
    const content = document.body?.content || [];
    
    content.forEach(element => {
      if (element.table) {
        tables.push({
          startIndex: element.startIndex,
          endIndex: element.endIndex,
          table: element.table
        });
      }
    });
    
    return tables;
  }



  /**
   * Create table cell content requests using actual table structure
   * Uses the real paragraph indices from Google Docs table structure
   * @param {Object} tableData - Table data with headers and rows
   * @param {Object} tableElement - Table element from document structure
   * @returns {Array} Array of insertText requests with actual paragraph indices
   */
  createTableCellStructureRequests(tableData, tableElement) {
    const requests = [];
    const { headers, rows } = tableData;
    
    // Combine headers and rows into all rows
    const allRows = [headers, ...rows];
    
    // Extract paragraph indices from actual table structure
    if (tableElement.table && tableElement.table.tableRows) {
      allRows.forEach((row, rowIndex) => {
        if (tableElement.table.tableRows[rowIndex] && tableElement.table.tableRows[rowIndex].tableCells) {
          row.forEach((cellText, columnIndex) => {
            const tableCell = tableElement.table.tableRows[rowIndex].tableCells[columnIndex];
            if (tableCell && tableCell.content && tableCell.content.length > 0) {
              // Find the first paragraph in this cell
              const paragraph = tableCell.content.find(content => content.paragraph);
              if (paragraph && cellText && cellText.trim()) {
                // Insert text at the start of the paragraph (startIndex)
                requests.push({
                  insertText: {
                    text: cellText,
                    location: {
                      index: paragraph.startIndex
                    }
                  }
                });
              }
            }
          });
        }
      });
    }
    
    // Debug: Log actual indices
    if (process.env.DEBUG_GDOCS_CONVERTER === 'true') {
      console.log(`🎯 Table ${tableElement.startIndex} actual paragraph indices:`, 
        requests.map(r => `${r.insertText.text}=${r.insertText.location.index}`).join(', '));
    }
    
    // CRITICAL: Reverse order within table to avoid index shifts (GitHub Gist approach)
    return requests.reverse();
  }

  /**
   * Create table cell content requests using GitHub Gist pattern (fallback)
   * Based on @tanaikech's research: https://gist.github.com/tanaikech/3b5ac06747c8771f70afd3496278b04b
   * @param {Object} tableData - Table data with headers and rows
   * @param {number} tableStartIndex - Starting index of the table
   * @returns {Array} Array of insertText requests with calculated indices
   */
  createTableCellGistRequests(tableData, tableStartIndex) {
    const { headers, rows } = tableData;
    
    // Combine headers and rows into all rows
    const allRows = [headers, ...rows];
    const maxColumns = Math.max(...allRows.map(row => row.length));
    
    // Calculate cell positions using GitHub Gist pattern
    // Pattern: Table start +5, then +2 for each column, +3 for each row
    let index = tableStartIndex + 5; // Start position after table structure
    const cellValues = [];
    
    allRows.forEach((row, rowIndex) => {
      const rowStartIndex = index + (rowIndex === 0 ? 0 : 3) - 1;
      
      row.forEach((cellText, columnIndex) => {
        const cellIndex = rowStartIndex + columnIndex * 2;
        cellValues.push({
          text: cellText || '',
          index: cellIndex
        });
        index = cellIndex + 1;
      });
      
      // Adjust for missing cells in row
      if (row.length < maxColumns) {
        index += (maxColumns - row.length) * 2;
      }
    });
    
    // Debug: Log calculated indices
    if (process.env.DEBUG_GDOCS_CONVERTER === 'true') {
      console.log(`🔢 Table ${tableStartIndex} calculated indices:`, 
        cellValues.map(cv => `${cv.text}=${cv.index}`).join(', '));
    }
    
    // CRITICAL: Insert in reverse order to avoid index shifts (GitHub Gist approach)
    const requests = [];
    cellValues.reverse().forEach(({ text, index }) => {
      if (text && text.trim()) {
        requests.push({
          insertText: {
            text: text,
            location: {
              index: index
            }
          }
        });
      }
    });
    
    return requests;
  }

  /**
   * Create table cell content requests using tableCellLocation approach (not working)
   * @param {Object} tableData - Table data with headers and rows
   * @param {number} tableStartIndex - Starting index of the table
   * @returns {Array} Array of insertText requests with tableCellLocation
   */
  createTableCellLocationRequests(tableData, tableStartIndex) {
    const requests = [];
    const { headers, rows } = tableData;
    
    // Combine headers and rows into all rows
    const allRows = [headers, ...rows];
    
    // Create requests for each cell using tableCellLocation
    allRows.forEach((row, rowIndex) => {
      row.forEach((cellText, columnIndex) => {
        if (cellText && cellText.trim()) {
          requests.push({
            insertText: {
              text: cellText,
              location: {
                tableCellLocation: {
                  tableStartLocation: {
                    index: tableStartIndex
                  },
                  rowIndex: rowIndex,
                  columnIndex: columnIndex
                }
              }
            }
          });
        }
      });
    });
    
    return requests;
  }

  /**
   * Create table cell content requests using GitHub Gist approach (fallback)
   * @param {Object} tableData - Table data with headers and rows
   * @param {number} tableStartIndex - Starting index of the table
   * @returns {Array} Array of insertText requests
   */
  createTableCellRequests(tableData, tableStartIndex) {
    const requests = [];
    const { headers, rows } = tableData;
    
    // Combine headers and rows into all rows (GitHub Gist approach)
    const allRows = [headers, ...rows];
    const maxColumns = Math.max(...allRows.map(row => row.length));
    
    // Calculate cell positions using GitHub Gist pattern
    let index = tableStartIndex + 5; // Start position after table structure
    const cellValues = [];
    
    allRows.forEach((row, rowIndex) => {
      const rowIndexAdjustment = rowIndex === 0 ? 0 : 3; // First row no adjustment, others +3
      const rowStartIndex = index + rowIndexAdjustment - 1;
      
      row.forEach((cellText, columnIndex) => {
        const cellIndex = rowStartIndex + columnIndex * 2;
        cellValues.push({
          text: cellText || '',
          index: cellIndex
        });
        index = cellIndex + 1;
      });
      
      // Adjust for missing cells in row
      if (row.length < maxColumns) {
        index += (maxColumns - row.length) * 2;
      }
    });
    
    // Insert in reverse order to maintain correct indices (GitHub Gist approach)
    cellValues.reverse().forEach(({ text, index }) => {
      requests.push({
        insertText: {
          text: text,
          location: {
            index: index
          }
        }
      });
    });
    
    return requests;
  }

  /**
   * Generate step 3 requests based on step 2 actions and document content
   * @param {Array} step2Actions - Actions from step 2
   * @param {Array} documentContent - Current document content
   * @returns {Array} Step 3 requests
   */
  generateStep3Requests(step2Actions, documentContent) {
    const requests = [];
    
    // Track position in document content for matching
    let textElementIndex = 0;
    let tableElementIndex = 0;
    
    for (const action of step2Actions) {
      if (action.type === 'style_heading') {
        // Find the corresponding text element for this heading
        const headingElement = this.findTextElementByContent(documentContent, action.text, textElementIndex);
        if (headingElement) {
          const fontSize = action.level === 1 ? 20 : (action.level === 2 ? 18 : 16);
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: headingElement.startIndex,
                endIndex: headingElement.endIndex - 1 // Exclude newline
              },
              textStyle: {
                bold: true,
                fontSize: {
                  magnitude: fontSize,
                  unit: 'PT'
                }
              },
              fields: 'bold,fontSize'
            }
          });
          textElementIndex++;
        }
        
      } else if (action.type === 'populate_table') {
        // Find the corresponding table element
        const tableElement = this.findTableElementByIndex(documentContent, tableElementIndex);
        if (tableElement) {
          const cellRequests = this.createTableCellRequests(action.tableData, tableElement.startIndex);
          requests.push(...cellRequests);
          tableElementIndex++;
        }
      }
    }
    
    return requests;
  }

  /**
   * Find text element in document content by content and order
   */
  findTextElementByContent(documentContent, targetText, elementIndex) {
    let textElementCount = 0;
    
    for (const element of documentContent) {
      if (element.paragraph) {
        if (textElementCount === elementIndex) {
          const text = this.extractTextFromParagraph(element.paragraph);
          if (text.trim() === targetText.trim()) {
            return element;
          }
        }
        textElementCount++;
      }
    }
    return null;
  }

  /**
   * Find table element by index
   */
  findTableElementByIndex(documentContent, tableIndex) {
    let tableCount = 0;
    
    for (const element of documentContent) {
      if (element.table) {
        if (tableCount === tableIndex) {
          return element;
        }
        tableCount++;
      }
    }
    return null;
  }

  /**
   * Extract text from paragraph element
   */
  extractTextFromParagraph(paragraph) {
    let text = '';
    if (paragraph.elements) {
      for (const element of paragraph.elements) {
        if (element.textRun) {
          text += element.textRun.content || '';
        }
      }
    }
    return text;
  }
}

module.exports = GoogleDocsSync;