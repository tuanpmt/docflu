const chalk = require('chalk');
const path = require('path');
const fs = require('fs').promises;

/**
 * Debug Helper for Google Docs Sync
 * Saves debug information to files instead of console logging
 */
class GoogleDocsSyncDebugger {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.debugDir = path.join(projectRoot, '.docusaurus', 'debug', 'gdocs-sync');
    this.isEnabled = process.env.DEBUG_GDOCS_CONVERTER === 'true';
  }

  async ensureDebugDir() {
    if (!this.isEnabled) return;
    
    try {
      await fs.mkdir(this.debugDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create debug directory:', error.message);
    }
  }

  async logDocumentStructure(document, stepName, additionalData = {}) {
    if (!this.isEnabled) return;

    await this.ensureDebugDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `document-structure-${stepName}-${timestamp}.json`;
    const filepath = path.join(this.debugDir, filename);
    
    const debugData = {
      timestamp: new Date().toISOString(),
      step: stepName,
      documentId: document.documentId,
      documentStructure: this.extractDocumentStructure(document),
      ...additionalData,
      metadata: {
        converterVersion: "1.0.0",
        nodeVersion: process.version,
        debugEnabled: this.isEnabled,
        debugDir: this.debugDir,
        filename: filename
      }
    };

    try {
      await fs.writeFile(filepath, JSON.stringify(debugData, null, 2));
      console.log(chalk.gray(`📄 Debug: Document structure saved to ${filename}`));
    } catch (error) {
      console.error('Failed to save debug file:', error.message);
    }
  }

  extractDocumentStructure(document) {
    const structure = {
      totalElements: 0,
      elements: []
    };

    if (!document.body || !document.body.content) {
      return structure;
    }

    document.body.content.forEach((element, index) => {
      const elementInfo = {
        index: index,
        startIndex: element.startIndex,
        endIndex: element.endIndex,
        type: null,
        details: {}
      };

      if (element.table) {
        elementInfo.type = 'table';
        elementInfo.details = {
          rows: element.table.rows,
          columns: element.table.columns,
          tableRows: element.table.tableRows ? element.table.tableRows.length : 0
        };

        // Extract table cell structure
        if (element.table.tableRows) {
          elementInfo.details.cellStructure = element.table.tableRows.map((row, rowIndex) => ({
            rowIndex: rowIndex,
            cells: row.tableCells ? row.tableCells.map((cell, cellIndex) => ({
              cellIndex: cellIndex,
              startIndex: cell.startIndex,
              endIndex: cell.endIndex,
              contentElements: cell.content ? cell.content.length : 0
            })) : []
          }));
        }
      } else if (element.paragraph) {
        elementInfo.type = 'paragraph';
        const text = this.extractTextFromParagraph(element.paragraph);
        elementInfo.details = {
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          textLength: text.length,
          elements: element.paragraph.elements ? element.paragraph.elements.length : 0
        };
      } else if (element.sectionBreak) {
        elementInfo.type = 'sectionBreak';
      }

      structure.elements.push(elementInfo);
      structure.totalElements++;
    });

    return structure;
  }

  extractTextFromParagraph(paragraph) {
    if (!paragraph.elements) return '';
    
    return paragraph.elements
      .filter(element => element.textRun)
      .map(element => element.textRun.content)
      .join('');
  }

  async logRequestBatch(requests, batchName, additionalData = {}) {
    if (!this.isEnabled) return;

    await this.ensureDebugDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `request-batch-${batchName}-${timestamp}.json`;
    const filepath = path.join(this.debugDir, filename);
    
    const debugData = {
      timestamp: new Date().toISOString(),
      batchName: batchName,
      requestCount: requests.length,
      requests: requests.map((request, index) => ({
        index: index,
        type: Object.keys(request)[0],
        request: request
      })),
      ...additionalData,
      metadata: {
        converterVersion: "1.0.0",
        nodeVersion: process.version,
        debugEnabled: this.isEnabled,
        debugDir: this.debugDir,
        filename: filename
      }
    };

    try {
      await fs.writeFile(filepath, JSON.stringify(debugData, null, 2));
      console.log(chalk.gray(`📄 Debug: Request batch saved to ${filename}`));
    } catch (error) {
      console.error('Failed to save debug file:', error.message);
    }
  }

  async logSummary(summary) {
    if (!this.isEnabled) return;

    await this.ensureDebugDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sync-summary-${timestamp}.json`;
    const filepath = path.join(this.debugDir, filename);
    
    try {
      await fs.writeFile(filepath, JSON.stringify(summary, null, 2));
      console.log(chalk.gray(`📄 Debug: Sync summary saved to ${filename}`));
    } catch (error) {
      console.error('Failed to save debug file:', error.message);
    }
  }
}

module.exports = GoogleDocsSyncDebugger; 