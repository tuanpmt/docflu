const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const GoogleDocsConverter = require('./google-docs-converter');
const GoogleDocsState = require('./google-docs-state');
const DocusaurusScanner = require('../docusaurus-scanner');
const ReferenceProcessor = require('../reference-processor');

const GoogleDriveClient = require('./google-drive-client');
const GDocsImageProcessor = require('./gdocs-image-processor');

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
    
    // Initialize processors
    this.referenceProcessor = new ReferenceProcessor(projectRoot, this.state);
    
    // Google Drive integration for image upload
    this.driveClient = new GoogleDriveClient(projectRoot);
    this.gDocsImageProcessor = new GDocsImageProcessor(projectRoot);
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
    
    // Initialize Google Drive client with OAuth2 credentials
    try {
      await this.driveClient.initialize(this.client.oauth2Client, this.state);
      
      // Initialize Google Docs image processor
      await this.gDocsImageProcessor.initialize(this.driveClient, this.state);
      
    } catch (error) {
      if (this.client.isPermissionError(error)) {
        console.log(chalk.yellow('⚠️ Permission error detected. Clearing old tokens and re-authenticating...'));
        await this.client.clearTokens();
        
        // Re-authenticate with new scopes
        await this.client.authenticate();
        await this.client.initialize();
        
        // Retry initialization
        await this.driveClient.initialize(this.client.oauth2Client, this.state);
        await this.gDocsImageProcessor.initialize(this.driveClient, this.state);
      } else {
        throw error;
      }
    }
    
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
      
      // CLEAR existing content before batch sync (similar to --file option)
      console.log(chalk.gray('🧹 Clearing existing document content...'));
      const currentDoc = await this.client.getDocument(rootDocument.documentId);
      const content = currentDoc.body?.content || [];
      let currentContentLength = 1;
      
      if (content.length > 0) {
        const lastElement = content[content.length - 1];
        currentContentLength = lastElement.endIndex || 1;
      }
      
      // Clear content if document has content to clear
      if (currentContentLength > 2) {
        console.log(chalk.gray(`📄 Clearing ${currentContentLength - 1} characters from document...`));
        await this.client.docs.documents.batchUpdate({
          documentId: rootDocument.documentId,
          requestBody: {
            requests: [{
              deleteContentRange: {
                range: {
                  startIndex: 1,
                  endIndex: currentContentLength - 1
                }
              }
            }]
          }
        });
        console.log(chalk.green('✅ Document content cleared successfully'));
      } else {
        console.log(chalk.gray('📄 Document is empty, no content to clear'));
      }
      
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

      // Process images and diagrams using Google Docs image processor
      let imageRequests = [];
      if (this.containsImages(processedContent) || this.containsDiagrams(processedContent)) {
        console.log(chalk.blue('🖼️ Processing images and diagrams...'));
        const imageResult = await this.gDocsImageProcessor.processImages(processedContent, filePath);
        processedContent = imageResult.processedMarkdown;
        imageRequests = imageResult.imageRequests;
        
        const imageStats = imageResult.stats;
        console.log(chalk.green(`✅ Image processing complete: ${imageStats.imagesProcessed} images, ${imageStats.diagramsProcessed} diagrams`));
        
        if (imageStats.errors.length > 0) {
          console.log(chalk.yellow(`⚠️ ${imageStats.errors.length} image processing errors`));
          imageStats.errors.forEach(error => {
            console.log(chalk.gray(`   - ${error}`));
          });
        }
      }

      // Get document state for append positioning (document was cleared at batch start)
      const preAppendDoc = await this.client.getDocument(rootDocumentId);
      let contentStartIndex = 1;
      let existingTablesCount = 0;
      
      // Calculate where new content will start (append mode within cleared document)
      if (preAppendDoc.body && preAppendDoc.body.content && preAppendDoc.body.content.length > 0) {
        const lastElement = preAppendDoc.body.content[preAppendDoc.body.content.length - 1];
        contentStartIndex = lastElement.endIndex || 1;
        
        // Count existing tables (from previous documents in this batch)
        existingTablesCount = preAppendDoc.body.content.filter(element => element.table).length;
      }

      // Convert markdown to Google Docs requests
      const conversionResult = this.converter.convertFromMarkdown(processedContent, { 
        filePath: filePath,
        title: title
      });
      
      const { requests, tablesForStep2, formattingForStep2 } = conversionResult;

      // Step 1: Apply basic content and table structures (append mode)
      if (requests.length > 0) {
        console.log(chalk.gray(`📝 Applying ${requests.length} requests to document...`));
        
        await this.client.docs.documents.batchUpdate({
          documentId: rootDocumentId,
          requestBody: {
            requests: requests
          }
        });
      }

      // Step 1.5: Insert native images at their placeholder positions
      if (imageRequests.length > 0) {
        console.log(chalk.gray(`🖼️ Inserting ${imageRequests.length} native images...`));
        
        // Get updated document to find placeholder positions
        const updatedDocForImages = await this.client.getDocument(rootDocumentId);
        const imageInsertionRequests = await this.createImageInsertionRequests(imageRequests, updatedDocForImages);
        
        if (imageInsertionRequests.length > 0) {
          try {
            await this.client.docs.documents.batchUpdate({
              documentId: rootDocumentId,
              requestBody: {
                requests: imageInsertionRequests
              }
            });
            console.log(chalk.green(`✅ Successfully inserted ${imageRequests.length} native images`));
          } catch (error) {
            console.warn(chalk.yellow(`⚠️ Native image insertion failed: ${error.message}`));
            console.log(chalk.blue(`🔄 Falling back to markdown image format...`));
            
            // Fallback: Replace placeholders with markdown images
            const fallbackRequests = [];
            for (const imageRequest of imageRequests) {
              const placeholder = imageRequest.placeholder;
              const markdownImage = `![${imageRequest.altText}](${imageRequest.url})`;
              
              // Find placeholder position again
              const currentDoc = await this.client.getDocument(rootDocumentId);
              const textElements = this.extractTextElements(currentDoc);
              const placeholderPosition = this.findTextInDocument(placeholder, textElements);
              
              if (placeholderPosition) {
                fallbackRequests.push({
                  deleteContentRange: {
                    range: {
                      startIndex: placeholderPosition.startIndex,
                      endIndex: placeholderPosition.endIndex
                    }
                  }
                });
                
                fallbackRequests.push({
                  insertText: {
                    text: markdownImage,
                    location: {
                      index: placeholderPosition.startIndex
                    }
                  }
                });
              }
            }
            
            if (fallbackRequests.length > 0) {
              await this.client.docs.documents.batchUpdate({
                documentId: rootDocumentId,
                requestBody: {
                  requests: fallbackRequests
                }
              });
              console.log(chalk.green(`✅ Fallback: Inserted ${imageRequests.length} markdown images`));
            }
          }
        }
      }

      // Step 2: Populate table cells if there are tables
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
        
        // Find ALL tables in document structure
        const allTables = this.findTablesInDocument(updatedDoc);
        
        // CRITICAL: Only process newly created tables (skip existing ones)
        const newTables = allTables.slice(existingTablesCount);
        
        if (process.env.DEBUG_GDOCS_CONVERTER === 'true') {
          console.log(`📊 Total tables: ${allTables.length}, Existing: ${existingTablesCount}, New: ${newTables.length}`);
        }
        
        // Process NEW tables in reverse order to avoid index shifts
        for (let i = tablesForStep2.length - 1; i >= 0 && i < newTables.length; i--) {
          const { tableData } = tablesForStep2[i];
          const tableElement = newTables[i];
          
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

      // Step 3: Apply text formatting if any
      if (formattingForStep2 && formattingForStep2.length > 0) {
        console.log(chalk.gray(`🎨 Applying formatting to ${formattingForStep2.length} elements...`));
        
        // Get updated document structure to find actual text indices
        const finalDoc = await this.client.getDocument(rootDocumentId);
        
        // CRITICAL: For append mode, NO global reset to preserve previous formatting
        const resetColorRequests = [];
        
        // Apply specific formatting with scope limited to new content
        const formattingRequests = this.createFormattingRequestsWithScope(
          formattingForStep2, 
          finalDoc, 
          contentStartIndex
        );
        
        const allFormattingRequests = [...resetColorRequests, ...formattingRequests];
        
        if (allFormattingRequests.length > 0) {
          console.log(chalk.gray(`📝 Applying ${allFormattingRequests.length} formatting requests (${resetColorRequests.length} reset + ${formattingRequests.length} specific)...`));
          
          await this.client.docs.documents.batchUpdate({
            documentId: rootDocumentId,
            requestBody: {
              requests: allFormattingRequests
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

      // Process images and diagrams using Google Docs image processor
      let imageRequests = [];
      if (this.containsImages(processedContent) || this.containsDiagrams(processedContent)) {
        console.log(chalk.blue('🖼️ Processing images and diagrams...'));
        const imageResult = await this.gDocsImageProcessor.processImages(processedContent, filePath);
        processedContent = imageResult.processedMarkdown;
        imageRequests = imageResult.imageRequests;
        
        const imageStats = imageResult.stats;
        console.log(chalk.green(`✅ Image processing complete: ${imageStats.imagesProcessed} images, ${imageStats.diagramsProcessed} diagrams`));
        
        if (imageStats.errors.length > 0) {
          console.log(chalk.yellow(`⚠️ ${imageStats.errors.length} image processing errors`));
          imageStats.errors.forEach(error => {
            console.log(chalk.gray(`   - ${error}`));
          });
        }
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
      
      const { requests, tablesForStep2, formattingForStep2 } = conversionResult;

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

      // Step 1.5: Insert native images at their placeholder positions
      if (imageRequests.length > 0) {
        console.log(chalk.gray(`🖼️ Inserting ${imageRequests.length} native images...`));
        
        // Get updated document to find placeholder positions
        const updatedDocForImages = await this.client.getDocument(rootDocumentId);
        const imageInsertionRequests = await this.createImageInsertionRequests(imageRequests, updatedDocForImages);
        
        if (imageInsertionRequests.length > 0) {
          try {
            await this.client.docs.documents.batchUpdate({
              documentId: rootDocumentId,
              requestBody: {
                requests: imageInsertionRequests
              }
            });
            console.log(chalk.green(`✅ Successfully inserted ${imageRequests.length} native images`));
          } catch (error) {
            console.warn(chalk.yellow(`⚠️ Native image insertion failed: ${error.message}`));
            console.log(chalk.blue(`🔄 Falling back to markdown image format...`));
            
            // Fallback: Replace placeholders with markdown images
            const fallbackRequests = [];
            for (const imageRequest of imageRequests) {
              const placeholder = imageRequest.placeholder;
              const markdownImage = `![${imageRequest.altText}](${imageRequest.url})`;
              
              // Find placeholder position again
              const currentDoc = await this.client.getDocument(rootDocumentId);
              const textElements = this.extractTextElements(currentDoc);
              const placeholderPosition = this.findTextInDocument(placeholder, textElements);
              
              if (placeholderPosition) {
                fallbackRequests.push({
                  deleteContentRange: {
                    range: {
                      startIndex: placeholderPosition.startIndex,
                      endIndex: placeholderPosition.endIndex
                    }
                  }
                });
                
                fallbackRequests.push({
                  insertText: {
                    text: markdownImage,
                    location: {
                      index: placeholderPosition.startIndex
                    }
                  }
                });
              }
            }
            
            if (fallbackRequests.length > 0) {
              await this.client.docs.documents.batchUpdate({
                documentId: rootDocumentId,
                requestBody: {
                  requests: fallbackRequests
                }
              });
              console.log(chalk.green(`✅ Fallback: Inserted ${imageRequests.length} markdown images`));
            }
          }
        }
      }

      // Step 2: Populate table cells if there are tables
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

      // Step 3: Apply text formatting if any (MOVED OUTSIDE table processing block)
      if (formattingForStep2 && formattingForStep2.length > 0) {
        console.log(chalk.gray(`🎨 Applying formatting to ${formattingForStep2.length} elements...`));
        
        // Get updated document structure to find actual text indices
        const finalDoc = await this.client.getDocument(rootDocumentId);
        
        // First, reset document text color to black (fix gray text issue)
        const resetColorRequests = this.createResetColorRequests(finalDoc);
        
        // Then apply specific formatting
        const formattingRequests = this.createFormattingRequests(formattingForStep2, finalDoc);
        
        const allFormattingRequests = [...resetColorRequests, ...formattingRequests];
        
        if (allFormattingRequests.length > 0) {
          console.log(chalk.gray(`📝 Applying ${allFormattingRequests.length} formatting requests (${resetColorRequests.length} reset + ${formattingRequests.length} specific)...`));
          
          await this.client.docs.documents.batchUpdate({
            documentId: rootDocumentId,
            requestBody: {
              requests: allFormattingRequests
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
   * Check if content contains images or diagrams
   */
  containsImages(content) {
    // Regular images
    const hasImages = /!\[.*?\]\(.*?\)/.test(content) || /<img.*?src=/.test(content);
    
    // Mermaid diagrams
    const hasMermaid = /```mermaid\n/.test(content);
    
    // Other diagrams (existing detection from Confluence)
    const hasOtherDiagrams = this.containsDiagrams(content);
    
    return hasImages || hasMermaid || hasOtherDiagrams;
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
    
    // Cleanup handled by gDocsImageProcessor
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
   * Create formatting requests using actual document structure
   * @param {Array} formattingForStep2 - Formatting data from converter
   * @param {Object} document - Current document structure
   * @returns {Array} Array of formatting requests
   */
  createFormattingRequests(formattingForStep2, document) {
    const requests = [];
    
    // Extract text content from document to find actual text positions
    const textElements = this.extractTextElements(document);
    
    for (const formatItem of formattingForStep2) {
      const { type, text, textLength, level, language, content, formats } = formatItem;
      
      if (type === 'heading') {
        // Find heading text in document and apply formatting
        const textPosition = this.findTextInDocument(text, textElements);
        if (textPosition) {
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: textPosition.startIndex,
                endIndex: textPosition.startIndex + textLength
              },
              textStyle: {
                bold: true,
                fontSize: {
                  magnitude: this.getHeadingSize(level),
                  unit: 'PT'
                },
                foregroundColor: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } } // Ensure black text
              },
              fields: 'bold,fontSize,foregroundColor'
            }
          });
        }
      } else if (type === 'code_block') {
        // Find code block text and apply formatting
        if (language) {
                  // Format language label
        const labelText = `[${language}]`;
        const labelPosition = this.findTextInDocument(labelText, textElements);
        if (labelPosition) {
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: labelPosition.startIndex,
                endIndex: labelPosition.startIndex + labelText.length
              },
              textStyle: {
                bold: true,
                fontSize: { magnitude: 9, unit: 'PT' },
                foregroundColor: { color: { rgbColor: { red: 0.5, green: 0.5, blue: 0.5 } } },
                backgroundColor: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } } // White background
              },
              fields: 'bold,fontSize,foregroundColor,backgroundColor'
            }
          });
        }
        }
        
        // Format code content
        const codePosition = this.findTextInDocument(content, textElements);
        if (codePosition) {
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: codePosition.startIndex,
                endIndex: codePosition.startIndex + content.length
              },
              textStyle: {
                backgroundColor: { color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } } },
                foregroundColor: { color: { rgbColor: { red: 0.2, green: 0.2, blue: 0.2 } } }, // Dark gray for code blocks
                fontSize: { magnitude: 10, unit: 'PT' },
                bold: false,
                italic: false
              },
              fields: 'backgroundColor,foregroundColor,fontSize,bold,italic'
            }
          });
        }
      } else if (type === 'paragraph' && formats && formats.length > 0) {
        // Find paragraph text and apply inline formatting
        const paragraphPosition = this.findTextInDocument(formatItem.processedText, textElements);
        if (paragraphPosition) {
          // First, reset paragraph to default formatting
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: paragraphPosition.startIndex,
                endIndex: paragraphPosition.startIndex + formatItem.processedText.length
              },
              textStyle: {
                foregroundColor: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } }, // Black text
                bold: false,
                italic: false,
                fontSize: { magnitude: 11, unit: 'PT' }
              },
              fields: 'foregroundColor,bold,italic,fontSize'
            }
          });
          
          // Then apply specific inline formatting
          for (const format of formats) {
            requests.push({
              updateTextStyle: {
                range: {
                  startIndex: paragraphPosition.startIndex + format.start,
                  endIndex: paragraphPosition.startIndex + format.end
                },
                textStyle: format.style,
                fields: this.generateFieldsString(format.style)
              }
            });
          }
        }
      }
    }
    
    return requests;
  }

  /**
   * Create formatting requests with scope limited to new content only (for append mode)
   * @param {Array} formattingForStep2 - Formatting data from converter
   * @param {Object} document - Current document structure
   * @param {number} contentStartIndex - Start index of newly added content
   * @returns {Array} Array of formatting requests limited to new content
   */
  createFormattingRequestsWithScope(formattingForStep2, document, contentStartIndex) {
    const requests = [];
    
    // Extract text content from document to find actual text positions
    const allTextElements = this.extractTextElements(document);
    
    // CRITICAL: Filter text elements to only include new content
    const newTextElements = allTextElements.filter(element => 
      element.startIndex >= contentStartIndex
    );
    
    if (process.env.DEBUG_GDOCS_CONVERTER === 'true') {
      console.log(`🎯 Formatting scope: contentStartIndex=${contentStartIndex}, total elements=${allTextElements.length}, new elements=${newTextElements.length}`);
    }
    
    for (const formatItem of formattingForStep2) {
      const { type, text, textLength, level, language, content, formats } = formatItem;
      
      if (type === 'heading') {
        // Find heading text in NEW content only
        const textPosition = this.findTextInDocument(text, newTextElements);
        if (textPosition) {
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: textPosition.startIndex,
                endIndex: textPosition.startIndex + textLength
              },
              textStyle: {
                bold: true,
                fontSize: {
                  magnitude: this.getHeadingSize(level),
                  unit: 'PT'
                },
                foregroundColor: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } } // Ensure black text
              },
              fields: 'bold,fontSize,foregroundColor'
            }
          });
        }
      } else if (type === 'code_block') {
        // Find code block text in NEW content only
        if (language) {
          // Format language label
          const labelText = `[${language}]`;
          const labelPosition = this.findTextInDocument(labelText, newTextElements);
          if (labelPosition) {
            requests.push({
              updateTextStyle: {
                range: {
                  startIndex: labelPosition.startIndex,
                  endIndex: labelPosition.startIndex + labelText.length
                },
                textStyle: {
                  bold: true,
                  fontSize: { magnitude: 9, unit: 'PT' },
                  foregroundColor: { color: { rgbColor: { red: 0.5, green: 0.5, blue: 0.5 } } },
                  backgroundColor: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } } // White background
                },
                fields: 'bold,fontSize,foregroundColor,backgroundColor'
              }
            });
          }
        }
        
        // Format code content
        const codePosition = this.findTextInDocument(content, newTextElements);
        if (codePosition) {
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: codePosition.startIndex,
                endIndex: codePosition.startIndex + content.length
              },
              textStyle: {
                backgroundColor: { color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } } },
                foregroundColor: { color: { rgbColor: { red: 0.2, green: 0.2, blue: 0.2 } } }, // Dark gray for code blocks
                fontSize: { magnitude: 10, unit: 'PT' },
                bold: false,
                italic: false
              },
              fields: 'backgroundColor,foregroundColor,fontSize,bold,italic'
            }
          });
        }
      } else if (type === 'paragraph' && formats && formats.length > 0) {
        // Find paragraph text in NEW content only
        const paragraphPosition = this.findTextInDocument(formatItem.processedText, newTextElements);
        if (paragraphPosition) {
          // First, reset paragraph to default formatting
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: paragraphPosition.startIndex,
                endIndex: paragraphPosition.startIndex + formatItem.processedText.length
              },
              textStyle: {
                foregroundColor: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } }, // Black text
                bold: false,
                italic: false,
                fontSize: { magnitude: 11, unit: 'PT' }
              },
              fields: 'foregroundColor,bold,italic,fontSize'
            }
          });
          
          // Then apply specific inline formatting
          for (const format of formats) {
            requests.push({
              updateTextStyle: {
                range: {
                  startIndex: paragraphPosition.startIndex + format.start,
                  endIndex: paragraphPosition.startIndex + format.end
                },
                textStyle: format.style,
                fields: this.generateFieldsString(format.style)
              }
            });
          }
        }
      }
    }
    
    if (process.env.DEBUG_GDOCS_CONVERTER === 'true') {
      console.log(`🎨 Created ${requests.length} scoped formatting requests`);
    }
    
    return requests;
  }

  /**
   * Extract all text elements from document
   */
  extractTextElements(document) {
    const textElements = [];
    
    if (document.body && document.body.content) {
      for (const element of document.body.content) {
        if (element.paragraph && element.paragraph.elements) {
          for (const paragraphElement of element.paragraph.elements) {
            if (paragraphElement.textRun && paragraphElement.textRun.content) {
              textElements.push({
                text: paragraphElement.textRun.content,
                startIndex: paragraphElement.startIndex,
                endIndex: paragraphElement.endIndex
              });
            }
          }
        }
      }
    }
    
    return textElements;
  }

  /**
   * Find text position in document
   */
  findTextInDocument(searchText, textElements) {
    // Combine all text to search
    let fullText = '';
    const indexMap = [];
    
    for (const element of textElements) {
      const startPos = fullText.length;
      fullText += element.text;
      const endPos = fullText.length;
      
      indexMap.push({
        textStart: startPos,
        textEnd: endPos,
        docStart: element.startIndex,
        docEnd: element.endIndex
      });
    }
    
    // Find text position
    const textIndex = fullText.indexOf(searchText);
    if (textIndex === -1) return null;
    
    // Map back to document indices
    for (const mapping of indexMap) {
      if (textIndex >= mapping.textStart && textIndex < mapping.textEnd) {
        const offset = textIndex - mapping.textStart;
        return {
          startIndex: mapping.docStart + offset,
          endIndex: mapping.docStart + offset + searchText.length
        };
      }
    }
    
    return null;
  }

  /**
   * Create requests to reset text color to black for newly added content only
   * @param {Object} document - Current document structure
   * @param {number} contentStartIndex - Start index of newly added content (optional)
   * @returns {Array} Reset color requests for new content only
   */
  createResetColorRequests(document, contentStartIndex = null) {
    const requests = [];
    
    // Get document content length
    let documentLength = 1;
    if (document.body && document.body.content && document.body.content.length > 0) {
      const lastElement = document.body.content[document.body.content.length - 1];
      documentLength = lastElement.endIndex || 1;
    }
    
    // For append mode, only reset newly added content
    // For replace mode (single file), reset entire document
    let resetStartIndex = contentStartIndex || 1;
    
    // Reset text color to black (except last character which is always a newline)
    if (documentLength > resetStartIndex + 1) {
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: resetStartIndex,
            endIndex: documentLength - 1
          },
          textStyle: {
            foregroundColor: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } }, // Black text
            bold: false, // Reset bold
            italic: false, // Reset italic
            fontSize: { magnitude: 11, unit: 'PT' } // Default font size
          },
          fields: 'foregroundColor,bold,italic,fontSize'
        }
      });
    }
    
    return requests;
  }

  /**
   * Generate fields string for Google Docs API
   */
  generateFieldsString(style) {
    const fields = [];
    
    if (style.bold !== undefined) fields.push('bold');
    if (style.italic !== undefined) fields.push('italic');
    if (style.fontSize !== undefined) fields.push('fontSize');
    if (style.foregroundColor !== undefined) fields.push('foregroundColor');
    if (style.backgroundColor !== undefined) fields.push('backgroundColor');
    if (style.underline !== undefined) fields.push('underline');
    if (style.strikethrough !== undefined) fields.push('strikethrough');
    
    return fields.join(',');
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

  /**
   * Create native image insertion requests by finding and replacing placeholders
   * @param {Array} imageRequests - Array of image requests with placeholders
   * @param {Object} document - Google Docs document object
   * @returns {Array} - Array of Google Docs API requests for image insertion
   */
  async createImageInsertionRequests(imageRequests, document) {
    const requests = [];
    
    try {
      if (!imageRequests || imageRequests.length === 0) {
        return requests;
      }
      
      // Extract all text content from document
      const textElements = this.extractTextElements(document);
      const fullText = textElements.map(el => el.text).join('');
      
      if (this.debug) {
        console.log(chalk.gray('🐛 Document full text for placeholder search:'));
        console.log(chalk.gray(`🐛 Text length: ${fullText.length} chars`));
        console.log(chalk.gray(`🐛 First 300 chars: "${fullText.substring(0, 300)}"`));
        
        // Show all placeholders in the text
        const placeholderMatches = fullText.match(/\[IMAGEPLACEHOLDER\d+\]/g);
        console.log(chalk.gray(`🐛 Found placeholders in text: ${placeholderMatches ? placeholderMatches.length : 0}`));
        if (placeholderMatches) {
          placeholderMatches.forEach((placeholder, idx) => {
            const position = fullText.indexOf(placeholder);
            console.log(chalk.gray(`🐛   ${idx + 1}. "${placeholder}" at position ${position}`));
          });
        }
      }
      
      // Find all placeholder positions first, then process in reverse order
      const placeholderPositions = [];
      
      for (let i = 0; i < imageRequests.length; i++) {
        const imageRequest = imageRequests[i];
        const placeholder = imageRequest.placeholder;
        
        if (this.debug) {
          console.log(chalk.gray(`🐛 Finding position for image ${i}: ${imageRequest.altText}`));
          console.log(chalk.gray(`🐛 Looking for placeholder: "${placeholder}"`));
        }
        
        // Find placeholder position in document
        const placeholderPosition = this.findTextInDocument(placeholder, textElements);
        
        if (placeholderPosition) {
          placeholderPositions.push({
            imageRequest,
            placeholder,
            position: placeholderPosition,
            originalIndex: i
          });
          
          if (this.debug) {
            console.log(chalk.gray(`🐛 Found placeholder "${placeholder}" at indices ${placeholderPosition.startIndex}-${placeholderPosition.endIndex}`));
          }
        } else {
          console.warn(chalk.yellow(`⚠️ Placeholder not found for image: ${imageRequest.altText} (${placeholder})`));
          
          if (this.debug) {
            console.log(chalk.red(`🐛 DEBUG: Placeholder "${placeholder}" not found in document text`));
            console.log(chalk.red(`🐛 Available placeholders in text:`));
            const availablePlaceholders = fullText.match(/\[IMAGEPLACEHOLDER\d+\]/g);
            if (availablePlaceholders) {
              availablePlaceholders.forEach(p => console.log(chalk.red(`🐛   - "${p}"`)));
            } else {
              console.log(chalk.red(`🐛   - No placeholders found in document text`));
            }
          }
        }
      }
      
      // Sort by position (highest index first) to avoid index shifts
      placeholderPositions.sort((a, b) => b.position.startIndex - a.position.startIndex);
      
      if (this.debug) {
        console.log(chalk.gray(`🐛 Processing ${placeholderPositions.length} placeholders in reverse order:`));
        placeholderPositions.forEach((item, idx) => {
          console.log(chalk.gray(`🐛   ${idx + 1}. "${item.placeholder}" at ${item.position.startIndex}-${item.position.endIndex}`));
        });
      }
      
      // Process placeholders from highest index to lowest to avoid index shifts
      for (const item of placeholderPositions) {
        const { imageRequest, placeholder, position } = item;
        
        if (this.debug) {
          console.log(chalk.gray(`🐛 Processing placeholder "${placeholder}" at indices ${position.startIndex}-${position.endIndex}`));
        }
        
        // Delete placeholder text first
        requests.push({
          deleteContentRange: {
            range: {
              startIndex: position.startIndex,
              endIndex: position.endIndex
            }
          }
        });
        
        // Insert native image at the same position
        requests.push({
          insertInlineImage: {
            uri: imageRequest.url,
            location: {
              index: position.startIndex
            }
          }
        });
        
        console.log(chalk.gray(`   📸 Native image: ${imageRequest.altText} at index ${position.startIndex}`));
        
        if (this.debug) {
          console.log(chalk.gray(`🐛 Image URL: ${imageRequest.url}`));
          console.log(chalk.gray(`🐛 Image type: ${imageRequest.type}`));
        }
      }
      
      return requests;
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to create image insertion requests:'), error.message);
      if (this.debug) {
        console.error(chalk.red('🐛 Error details:'), error);
      }
      return [];
    }
  }
  
  /**
   * Map text position to document index
   */
  mapTextPositionToDocumentIndex(textPosition, textElements) {
    let currentTextPos = 0;
    
    for (const element of textElements) {
      const elementTextLength = element.text.length;
      
      if (textPosition >= currentTextPos && textPosition <= currentTextPos + elementTextLength) {
        const offset = textPosition - currentTextPos;
        return element.startIndex + offset;
      }
      
      currentTextPos += elementTextLength;
    }
    
    // Fallback to end of document
    return textElements.length > 0 ? textElements[textElements.length - 1].endIndex : 1;
  }
}

module.exports = GoogleDocsSync;