# Notion Client Implementation

DocFlu's Notion Client provides a comprehensive wrapper around the official Notion JavaScript SDK with enhanced features for rate limiting, error handling, and file upload support.

## Overview

The `NotionClient` class handles all interactions with the Notion API, ensuring reliable communication through:

- **Rate Limiting**: Automatic 3 requests/second rate limiting
- **Error Handling**: Comprehensive error formatting and recovery
- **Request Queue**: Queued request processing for optimal performance
- **File Upload Support**: Direct integration with Notion File Upload API

## Class Structure

```javascript
const NotionClient = require('./lib/core/notion/notion-client');

const client = new NotionClient({
  apiToken: 'secret_your-api-token'
});
```

## Core Features

### Rate Limiting

Automatic rate limiting ensures compliance with Notion's API limits:

```javascript
// Internal rate limiting configuration
this.minInterval = 334; // ~3 requests/second (Notion API limit)
this.requestQueue = [];
this.processing = false;
```

All API calls are automatically queued and processed with proper delays:

```javascript
// All methods use rate-limited requests
const page = await client.createPage(pageData);
const blocks = await client.appendBlocks(pageId, children);
```

### Error Handling

Comprehensive error handling with specific error code mapping:

```javascript
// Error codes handled:
- rate_limited: Rate limiting errors with retry guidance
- validation_error: Request validation issues
- object_not_found: Missing pages/blocks
- unauthorized: Authentication failures
- restricted_resource: Permission issues
```

### Request Queue Processing

Internal queue system ensures optimal API usage:

```javascript
async makeRequest(requestFn) {
  return new Promise((resolve, reject) => {
    this.requestQueue.push({ requestFn, resolve, reject });
    this.processQueue();
  });
}
```

## API Methods

### Connection Testing

```javascript
// Test API connection and authentication
async testConnection()
```

**Usage:**
```javascript
const connected = await client.testConnection();
if (connected) {
  console.log('✓ Connected to Notion workspace');
}
```

### Page Operations

#### Create Page
```javascript
async createPage(pageData)
```

**Example:**
```javascript
const page = await client.createPage({
  parent: { page_id: parentPageId },
  properties: {
    title: {
      title: [{ text: { content: "New Page" } }]
    }
  }
});
```

#### Retrieve Page
```javascript
async retrievePage(pageId)
```

#### Update Page
```javascript
async updatePage(pageId, updateData)
```

**Example:**
```javascript
await client.updatePage(pageId, {
  archived: true
});
```

### Block Operations

#### Append Blocks
```javascript
async appendBlocks(pageId, children)
```

**Features:**
- Automatic chunking (max 100 blocks per request)
- Parallel processing for large block sets
- Error recovery for individual chunks

**Example:**
```javascript
const blocks = [
  {
    type: 'paragraph',
    paragraph: {
      rich_text: [{ text: { content: 'Hello World' } }]
    }
  }
];

await client.appendBlocks(pageId, blocks);
```

#### Retrieve Block Children
```javascript
async retrieveBlockChildren(blockId, startCursor = null)
```

#### Update Block
```javascript
async updateBlock(blockId, updateData)
```

#### Delete Block
```javascript
async deleteBlock(blockId)
```

### File Upload Operations

#### Upload File
```javascript
async uploadFile(fileBuffer, fileName, mimeType)
```

**Features:**
- Direct Notion File Upload API integration
- Support for all file types
- Automatic MIME type detection
- Progress tracking for large files

**Example:**
```javascript
const fs = require('fs');
const buffer = await fs.readFile('image.png');

const uploadResult = await client.uploadFile(buffer, 'image.png', 'image/png');
// Returns: { id, url, expiry_time }
```

### Search Operations

```javascript
async search(searchParams)
```

### User Operations

```javascript
async listUsers()
async getBotUser()
```

## Utility Methods

### Page Property Extraction

```javascript
getPageProperties(page)    // Extract all page properties
getPageTitle(page)         // Extract page title
```

### Error Formatting

```javascript
formatError(error)         // Format error for display
handleError(error)         // Process and categorize errors
```

## Implementation Details

### Rate Limiting Algorithm

```javascript
async processQueue() {
  if (this.processing || this.requestQueue.length === 0) return;
  
  this.processing = true;
  
  while (this.requestQueue.length > 0) {
    const { requestFn, resolve, reject } = this.requestQueue.shift();
    
    // Ensure minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const delay = this.minInterval - timeSinceLastRequest;
      await this.sleep(delay);
    }
    
    try {
      const result = await requestFn();
      this.lastRequestTime = Date.now();
      resolve(result);
    } catch (error) {
      reject(this.handleError(error));
    }
  }
  
  this.processing = false;
}
```

### File Upload Integration

The client includes direct support for Notion's File Upload API:

```javascript
async uploadFile(fileBuffer, fileName, mimeType) {
  // Step 1: Create file upload object
  const fileUpload = await this.makeRequest(() => 
    this.client.request({
      method: 'POST',
      path: 'files',
      body: {
        name: fileName,
        type: 'file'
      }
    })
  );
  
  // Step 2: Upload file content
  const uploadResponse = await fetch(fileUpload.url, {
    method: 'POST',
    body: fileBuffer,
    headers: {
      'Content-Type': mimeType
    }
  });
  
  if (!uploadResponse.ok) {
    throw new Error(`File upload failed: ${uploadResponse.statusText}`);
  }
  
  return {
    id: fileUpload.id,
    url: fileUpload.url,
    expiry_time: fileUpload.expiry_time
  };
}
```

## Configuration

### Required Configuration

```javascript
const config = {
  apiToken: 'secret_your-notion-integration-token'
};
```

### Optional Configuration

The client uses sensible defaults but can be customized:

```javascript
// Rate limiting can be adjusted if needed
this.minInterval = 334; // Default: ~3 requests/second
```

## Error Handling Examples

```javascript
try {
  await client.createPage(pageData);
} catch (error) {
  if (error.message.includes('unauthorized')) {
    console.error('Check your API token and permissions');
  } else if (error.message.includes('rate_limited')) {
    console.error('Too many requests, waiting before retry');
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

## Performance Characteristics

- **Rate Limiting**: 3 requests/second (Notion API limit)
- **Batch Processing**: Up to 100 blocks per request
- **Queue Processing**: Automatic request queuing and processing
- **Error Recovery**: Automatic retry for transient errors
- **Memory Efficiency**: Streaming file uploads for large files

## Integration with Other Components

The NotionClient is used throughout the DocFlu Notion integration:

- **NotionSync**: Main orchestrator using all client methods
- **HierarchyManager**: Page creation and organization
- **FileUploader**: File upload operations
- **ImageProcessor**: Image upload and processing
- **DiagramProcessor**: SVG diagram uploads

## Testing and Validation

```javascript
// Test connection
const isConnected = await client.testConnection();

// Validate permissions
try {
  await client.listUsers();
  console.log('✓ API access confirmed');
} catch (error) {
  console.error('❌ Permission issues:', error.message);
}
``` 