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
      
      // Clear document once at the beginning for batch sync
      const currentDoc = await this.client.getDocument(rootDocument.documentId);
      const content = currentDoc.body?.content || [];
      let currentContentLength = 1;
      
      if (content.length > 0) {
        const lastElement = content[content.length - 1];
        currentContentLength = lastElement.endIndex || 1;
      }
      
      console.log(chalk.gray(`📄 Current document length: ${currentContentLength} characters`));
      
      // Clear existing content once for all files
      const startIndex = 1;
      const endIndex = currentContentLength - 1;
      if (currentContentLength > 1 && endIndex > startIndex) {
        console.log(chalk.gray(`🧹 Clearing existing content (${endIndex - startIndex} characters)...`));
        await this.client.docs.documents.batchUpdate({
          documentId: rootDocument.documentId,
          requestBody: {
            requests: [{
              deleteContentRange: {
                range: {
                  startIndex,
                  endIndex
                }
              }
            }]
          }
        });
      } else {
        console.log(chalk.gray('📝 Batch clear: No valid range to clear or document is empty'));
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

      // Convert to Google Docs format
      const requests = this.converter.convertFromMarkdown(processedContent, {
        filePath,
        title
      });

      // Apply content to document (append mode - no clearing)
      if (requests.length > 0) {
        console.log(chalk.gray(`📝 Appending ${requests.length} requests for ${title}...`));
        await this.client.docs.documents.batchUpdate({
          documentId: rootDocumentId,
          requestBody: {
            requests: requests
          }
        });
      }

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
      
      // Convert to Google Docs format
      const requests = this.converter.convertFromMarkdown(processedContent, {
        filePath,
        title
      });

      // Apply content to document
      if (requests.length > 0) {
        const allRequests = [];
        
        // First, clear existing content if document has content (keep index 1)
        // Only clear if the document is not new and there is actual content to delete
        const isNewDocument = content.length <= 1 && currentContentLength <= 1;
        const canClear = !isNewDocument && currentContentLength > 2;
        if (canClear) {
          const startIndex = 1;
          const endIndex = currentContentLength - 1;
          if (endIndex > startIndex) {
            console.log(chalk.yellow(`🧹 Clearing existing content (${endIndex - startIndex} characters)...`));
            allRequests.push({
              deleteContentRange: {
                range: {
                  startIndex,
                  endIndex
                }
              }
            });
          } else {
            console.log(chalk.gray('📝 Document has no valid range to clear'));
          }
        } else {
          console.log(chalk.gray('📝 Document is empty or newly created, no content to clear'));
        }
        
        // Then add new content
        allRequests.push(...requests);
        
        console.log(chalk.gray(`📝 Applying ${allRequests.length} requests to document...`));
        
        await this.client.docs.documents.batchUpdate({
          documentId: rootDocumentId,
          requestBody: {
            requests: allRequests
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
}

module.exports = GoogleDocsSync; 