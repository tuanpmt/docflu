# Google Docs Sync Debug Guide

> Debug functionality for troubleshooting Google Docs sync issues with document structure and image processing

## 🐛 Enable Debug Mode

Set the environment variable to enable detailed debug logging:

```bash
export DEBUG_GDOCS_CONVERTER=true
# or
DEBUG_GDOCS_CONVERTER=true docflu sync --gdocs
```

## 📁 Debug Output Location

Debug files are saved to:
```
.docusaurus/debug/gdocs-sync/
├── document-structure-step1-after-table-creation-append-2024-01-27T10-30-45-123Z.json
├── document-structure-step1-after-table-creation-replace-2024-01-27T10-30-45-123Z.json
├── request-batch-cell-population-append-2024-01-27T10-30-45-123Z.json
├── request-batch-cell-population-replace-2024-01-27T10-30-45-123Z.json
├── sync-summary-2024-01-27T10-30-45-123Z.json
└── ...
```

## 📄 Debug File Structure

### Document Structure Debug (`document-structure-*.json`)

```json
{
  "timestamp": "2024-01-27T10:30:45.123Z",
  "step": "step1-after-table-creation-append",
  "documentId": "1ABC123xyz...",
  "documentStructure": {
    "totalElements": 15,
    "elements": [
      {
        "index": 0,
        "startIndex": 1,
        "endIndex": 25,
        "type": "paragraph",
        "details": {
          "text": "Introduction to DocFlu...",
          "textLength": 24,
          "elements": 1
        }
      },
      {
        "index": 1,
        "startIndex": 25,
        "endIndex": 150,
        "type": "table",
        "details": {
          "rows": 3,
          "columns": 2,
          "tableRows": 3,
          "cellStructure": [
            {
              "rowIndex": 0,
              "cells": [
                {
                  "cellIndex": 0,
                  "startIndex": 26,
                  "endIndex": 35,
                  "contentElements": 1
                },
                {
                  "cellIndex": 1,
                  "startIndex": 36,
                  "endIndex": 45,
                  "contentElements": 1
                }
              ]
            }
          ]
        }
      }
    ]
  },
  "existingTablesCount": 2,
  "newTablesCount": 1,
  "contentStartIndex": 500,
  "metadata": {
    "converterVersion": "1.0.0",
    "nodeVersion": "v18.17.0",
    "debugEnabled": true,
    "debugDir": ".docusaurus/debug/gdocs-sync",
    "filename": "document-structure-step1-after-table-creation-append-2024-01-27T10-30-45-123Z.json"
  }
}
```

### Request Batch Debug (`request-batch-*.json`)

```json
{
  "timestamp": "2024-01-27T10:30:45.123Z",
  "batchName": "cell-population-append",
  "requestCount": 6,
  "requests": [
    {
      "index": 0,
      "type": "insertText",
      "request": {
        "insertText": {
          "text": "Feature",
          "location": { "index": 26 }
        }
      }
    },
    {
      "index": 1,
      "type": "insertText",
      "request": {
        "insertText": {
          "text": "Status",
          "location": { "index": 36 }
        }
      }
    }
  ],
  "tableCount": 1,
  "existingTablesCount": 0,
  "metadata": {
    "converterVersion": "1.0.0",
    "nodeVersion": "v18.17.0",
    "debugEnabled": true,
    "debugDir": ".docusaurus/debug/gdocs-sync",
    "filename": "request-batch-cell-population-append-2024-01-27T10-30-45-123Z.json"
  }
}
```

### Sync Summary Debug (`sync-summary-*.json`)

```json
{
  "timestamp": "2024-01-27T10:30:45.123Z",
  "success": true,
  "stats": {
    "created": 0,
    "updated": 3,
    "skipped": 0,
    "failed": 0,
    "totalProcessed": 3
  },
  "summary": {
    "rootDocument": {
      "title": "DocFlu Documentation",
      "documentId": "1ABC123xyz...",
      "documentUrl": "https://docs.google.com/document/d/1ABC123xyz..."
    },
    "totalDocuments": 3,
    "totalTabs": 0,
    "lastSync": "2024-01-27T10:30:45.123Z"
  },
  "url": "https://docs.google.com/document/d/1ABC123xyz...",
  "metadata": {
    "converterVersion": "1.0.0",
    "nodeVersion": "v18.17.0",
    "debugEnabled": true,
    "debugDir": ".docusaurus/debug/gdocs-sync",
    "filename": "sync-summary-2024-01-27T10-30-45-123Z.json"
  }
}
```

## 🔍 Debug Steps and File Types

### 1. **Document Structure Logging**
- **File Pattern**: `document-structure-{step}-{timestamp}.json`
- **Steps**:
  - `step1-after-table-creation-append`: After creating tables in append mode
  - `step1-after-table-creation-replace`: After creating tables in replace mode
- **Purpose**: Track document structure changes, table creation, and index positions

### 2. **Request Batch Logging**
- **File Pattern**: `request-batch-{batchName}-{timestamp}.json`
- **Batch Types**:
  - `cell-population-append`: Table cell content requests in append mode
  - `cell-population-replace`: Table cell content requests in replace mode
- **Purpose**: Debug API request batches sent to Google Docs

### 3. **Sync Summary Logging**
- **File Pattern**: `sync-summary-{timestamp}.json`
- **Purpose**: Overall sync operation results and statistics

## 🛠️ Debug Analysis Tools

### Quick Analysis Script

```javascript
// analyze-debug.js
const fs = require('fs');
const path = require('path');

function analyzeLatestDebugFiles(debugDir = '.docusaurus/debug/gdocs-sync') {
  if (!fs.existsSync(debugDir)) {
    console.log('❌ Debug directory not found. Enable debug mode first.');
    return;
  }
  
  const files = fs.readdirSync(debugDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse(); // Latest first
  
  console.log('=== LATEST DEBUG FILES ===');
  
  // Find latest document structure
  const latestStructure = files.find(f => f.startsWith('document-structure-'));
  if (latestStructure) {
    const data = JSON.parse(fs.readFileSync(path.join(debugDir, latestStructure)));
    console.log(`\n📊 Document Structure (${data.step}):`);
    console.log(`   Total Elements: ${data.documentStructure.totalElements}`);
    console.log(`   Tables: ${data.documentStructure.elements.filter(e => e.type === 'table').length}`);
    console.log(`   Paragraphs: ${data.documentStructure.elements.filter(e => e.type === 'paragraph').length}`);
  }
  
  // Find latest request batch
  const latestRequests = files.find(f => f.startsWith('request-batch-'));
  if (latestRequests) {
    const data = JSON.parse(fs.readFileSync(path.join(debugDir, latestRequests)));
    console.log(`\n📝 Request Batch (${data.batchName}):`);
    console.log(`   Total Requests: ${data.requestCount}`);
    console.log(`   Request Types: ${[...new Set(data.requests.map(r => r.type))].join(', ')}`);
  }
  
  // Find latest summary
  const latestSummary = files.find(f => f.startsWith('sync-summary-'));
  if (latestSummary) {
    const data = JSON.parse(fs.readFileSync(path.join(debugDir, latestSummary)));
    console.log(`\n✅ Sync Summary:`);
    console.log(`   Success: ${data.success}`);
    console.log(`   Updated: ${data.stats.updated}`);
    console.log(`   Failed: ${data.stats.failed}`);
  }
}

// Usage: node analyze-debug.js
analyzeLatestDebugFiles();
```

### Index Validation

```javascript
function validateDocumentIndices(structureFile) {
  const data = JSON.parse(fs.readFileSync(structureFile));
  const elements = data.documentStructure.elements;
  
  console.log('=== INDEX VALIDATION ===');
  let expectedIndex = 1;
  
  for (const element of elements) {
    if (element.startIndex !== expectedIndex) {
      console.error(`❌ Index gap at element ${element.index}: expected ${expectedIndex}, got ${element.startIndex}`);
    } else {
      console.log(`✅ Element ${element.index} (${element.type}): ${element.startIndex} → ${element.endIndex}`);
    }
    expectedIndex = element.endIndex;
  }
  
  console.log(`Final index: ${expectedIndex}`);
}
```

## 🔧 Debugging Common Issues

### 1. **Image Processing Errors**

**Problem**: `Invalid requests[19].insertInlineImage: There was a problem retrieving the image`

**Debug Steps**:
1. Check request batch files for image insertion requests
2. Look for URL validation issues in image requests
3. Check if batch size exceeds Google Docs limits (24+ images)

**Solution**: Implement batch size limiting or URL accessibility testing

### 2. **Table Cell Index Errors**

**Problem**: Table cell content appears in wrong positions

**Debug Steps**:
1. Check document structure after table creation
2. Compare `cellStructure` in debug file with expected positions
3. Verify `startIndex`/`endIndex` values for table cells

### 3. **Document Structure Inconsistencies**

**Problem**: Content appears in wrong order or positions

**Debug Steps**:
1. Compare document structure between append vs replace modes
2. Check for index gaps or overlaps
3. Verify `existingTablesCount` and `contentStartIndex` values

## 📊 Performance Analysis

Debug files help analyze sync performance:

- **Large documents**: Check element count vs processing time
- **Complex tables**: Count table cell requests vs table complexity
- **Request optimization**: Analyze request count vs content length

## 🧹 Cleanup Debug Files

```bash
# Remove old debug files (older than 7 days)
find .docusaurus/debug/gdocs-sync -name "*.json" -mtime +7 -delete

# Remove all debug files
rm -rf .docusaurus/debug/gdocs-sync
```

## 💡 Tips

1. **Enable debug for specific operations**: Use single file sync to debug specific documents
2. **Compare modes**: Save debug files for both append and replace modes
3. **Check timestamps**: Ensure debug files correspond to your test runs
4. **Validate structure**: Use document structure files to verify Google Docs API responses
5. **Monitor batch sizes**: Large request batches may hit API limits 