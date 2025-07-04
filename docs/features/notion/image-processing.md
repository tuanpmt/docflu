# Image Processing Implementation

DocFlu's image processing system provides comprehensive support for handling both local and external images, with automatic upload to Notion using the File Upload API, intelligent caching, and robust error handling.

## Overview

The `NotionImageProcessor` class handles all aspects of image processing for Notion integration:

- **Local Image Processing**: Upload local images from project directories
- **External Image Processing**: Download and upload external images
- **HTML Image Support**: Process both markdown and HTML image syntax
- **Intelligent Caching**: SHA256-based caching with validation
- **Error Recovery**: Graceful fallback for failed uploads
- **Format Support**: All major image formats supported by Notion

## Class Structure

```javascript
const processor = new NotionImageProcessor(notionClient, state, config);
```

**Parameters:**
- `notionClient`: NotionClient instance for API calls
- `state`: State manager for caching
- `config`: Configuration object with project settings

## Supported Image Patterns

### Pattern Recognition

```javascript
this.patterns = {
  markdown: /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g,
  html: /<img[^>]+src=["']([^"']+)["'][^>]*>/g
};
```

**Supported Formats:**
- **Markdown**: `![alt text](image.png)`, `![alt text](image.png "title")`
- **HTML**: `<img src="image.png" alt="alt text">`, `<img src="image.png">`

### Supported Image Formats

```javascript
this.supportedFormats = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
  'image/svg+xml', 'image/webp', 'image/bmp'
];
```

## Core Processing Methods

### Main Processing Method

```javascript
async processImageMarkdown(imageUrl, altText = '', projectRoot = null, dryRun = false)
```

**Process Flow:**
1. **URL Analysis**: Determine if image is external or local
2. **Image Acquisition**: Download external or read local image
3. **Upload Processing**: Upload to Notion using File Upload API
4. **Block Creation**: Create proper Notion image block
5. **Error Handling**: Fallback to text representation if needed

### External Image Processing

```javascript
// External URL processing
if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
  console.log(chalk.cyan(`🔗 Processing external image: ${imageUrl}`));
  
  try {
    // Download external image and upload to Notion
    const imageData = await this.downloadExternalImage(imageUrl);
    if (imageData) {
      console.log(chalk.cyan(`📤 Uploading external image: ${imageData.fileName} (${imageData.buffer.length} bytes)`));
      
      // Upload using file upload API
      const uploadResult = await this.fileUploader.uploadFileToNotion(imageData.buffer, imageData.fileName, imageData.mimeType);
      
      if (uploadResult && uploadResult.fileUploadId) {
        console.log(chalk.green(`✅ Uploaded external image: ${imageData.fileName}`));
        
        // Create image block from upload result
        const imageBlock = {
          object: 'block',
          type: 'image',
          image: {
            type: 'file_upload',
            file_upload: { 
              id: uploadResult.fileUploadId 
            },
            caption: []
          }
        };
        
        return imageBlock;
      }
    }
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Failed to process external image ${imageUrl}: ${error.message}`));
    return {
      type: 'paragraph',
      paragraph: {
        rich_text: [{ 
          text: { content: altText ? `[External Image: ${altText}]` : '[External Image]' },
          annotations: { italic: true, color: 'gray' }
        }]
      }
    };
  }
}
```

**Features:**
- **Automatic Download**: Downloads external images to process locally
- **Upload to Notion**: Uses File Upload API for hosting
- **Error Fallback**: Converts to text if download/upload fails
- **Progress Tracking**: Logs download and upload progress

### Local Image Processing

```javascript
// Local absolute path processing
if (imageUrl.startsWith('/')) {
  console.log(chalk.cyan(`📁 Processing local image: ${imageUrl}`));
  
  const fs = require('fs-extra');
  const baseProjectRoot = projectRoot || this.config.projectRoot || process.cwd();
  const staticPath = path.resolve(baseProjectRoot, 'static', imageUrl.substring(1));
  
  if (await fs.pathExists(staticPath)) {
    // Upload local image using file uploader
    const imageBuffer = await fs.readFile(staticPath);
    const fileName = path.basename(staticPath);
    const mimeType = this.getMimeType(fileName);
    
    console.log(chalk.cyan(`📤 Uploading local image: ${fileName} (${imageBuffer.length} bytes)`));
    
    // Upload using file upload API
    const uploadResult = await this.fileUploader.uploadFileToNotion(imageBuffer, fileName, mimeType);
    
    if (uploadResult && uploadResult.fileUploadId) {
      console.log(chalk.green(`✅ Uploaded local image: ${fileName}`));
      
      // Create image block from upload result
      const imageBlock = {
        object: 'block',
        type: 'image',
        image: {
          type: 'file_upload',
          file_upload: { 
            id: uploadResult.fileUploadId 
          },
          caption: []
        }
      };
      
      return imageBlock;
    }
  } else {
    console.log(chalk.yellow(`⚠️ Local image not found: ${staticPath}`));
    return {
      type: 'paragraph',
      paragraph: {
        rich_text: [{ 
          text: { content: altText ? `[Image: ${altText}]` : '[Image]' },
          annotations: { italic: true, color: 'red' }
        }]
      }
    };
  }
}
```

**Features:**
- **Path Resolution**: Resolves paths relative to project root
- **Static Directory**: Looks for images in `static/` directory
- **File Validation**: Checks if file exists before processing
- **Size Reporting**: Logs file sizes for monitoring

## External Image Download

### Download Implementation

```javascript
async downloadExternalImage(imageUrl) {
  try {
    console.log(chalk.cyan(`🔽 Downloading external image: ${imageUrl}`));
    
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'DocFlu/1.0 (Image Processor)'
      }
    });
    
    if (response.status === 200) {
      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/png';
      
      // Generate filename from URL or use default
      const urlPath = new URL(imageUrl).pathname;
      const fileName = path.basename(urlPath) || `image-${Date.now()}.png`;
      
      console.log(chalk.green(`✅ Downloaded ${fileName} (${buffer.length} bytes)`));
      
      return {
        buffer: buffer,
        fileName: fileName,
        mimeType: contentType
      };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.log(chalk.red(`❌ Failed to download image: ${error.message}`));
    return null;
  }
}
```

**Features:**
- **Timeout Protection**: 30-second timeout for downloads
- **User Agent**: Proper user agent for external requests
- **Content Type Detection**: Automatic MIME type detection
- **Filename Generation**: Smart filename generation from URLs
- **Error Handling**: Comprehensive error handling and logging

## MIME Type Detection

```javascript
getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff'
  };
  
  return mimeTypes[ext] || 'image/png';
}
```

**Supported Extensions:**
- **JPEG**: `.jpg`, `.jpeg`
- **PNG**: `.png`
- **GIF**: `.gif`
- **SVG**: `.svg`
- **WebP**: `.webp`
- **BMP**: `.bmp`
- **ICO**: `.ico`
- **TIFF**: `.tiff`, `.tif`

## Image Block Creation

### Block Structure

```javascript
// Standard image block structure
const imageBlock = {
  object: 'block',
  type: 'image',
  image: {
    type: 'file_upload',
    file_upload: { 
      id: uploadResult.fileUploadId 
    },
    caption: []
  }
};
```

### Fallback Block Structure

```javascript
// Fallback for failed uploads
const fallbackBlock = {
  type: 'paragraph',
  paragraph: {
    rich_text: [{ 
      text: { content: altText ? `[Image: ${altText}]` : '[Image]' },
      annotations: { italic: true, color: 'gray' }
    }]
  }
};
```

## Error Handling and Fallbacks

### Error Categories

1. **Download Failures**: External images that can't be downloaded
2. **Upload Failures**: Images that can't be uploaded to Notion
3. **File Not Found**: Local images that don't exist
4. **Format Issues**: Unsupported image formats
5. **Network Issues**: Timeout or connectivity problems

### Fallback Strategy

```javascript
// Graceful degradation with color-coded text
const createFallbackBlock = (altText, errorType) => {
  const colorMap = {
    'download_failed': 'gray',
    'upload_failed': 'red',
    'not_found': 'red',
    'unsupported': 'yellow',
    'network_error': 'orange'
  };
  
  return {
    type: 'paragraph',
    paragraph: {
      rich_text: [{ 
        text: { content: altText ? `[Image: ${altText}]` : '[Image]' },
        annotations: { italic: true, color: colorMap[errorType] || 'gray' }
      }]
    }
  };
};
```

## HTML Image Support

### HTML Pattern Processing

```javascript
// Process HTML img tags
const htmlPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;

// Extract src and alt attributes
const extractHtmlImageData = (htmlMatch) => {
  const srcMatch = htmlMatch.match(/src=["']([^"']+)["']/);
  const altMatch = htmlMatch.match(/alt=["']([^"']*)["']/);
  
  return {
    src: srcMatch ? srcMatch[1] : '',
    alt: altMatch ? altMatch[1] : ''
  };
};
```

**Supported HTML Formats:**
- `<img src="image.png" alt="alt text">`
- `<img src="image.png">`
- `<img src="image.png" alt="alt text" title="title">`
- `<img src="image.png" width="100" height="100">`

## Caching System

### Cache Implementation

```javascript
// SHA256-based caching for images
const generateImageHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

// Cache validation (10-minute expiry)
isCacheValid(uploadedAt) {
  const now = Date.now();
  const uploadTime = new Date(uploadedAt).getTime();
  const tenMinutes = 10 * 60 * 1000;
  
  return (now - uploadTime) < tenMinutes;
}
```

### Cache Benefits

- **Bandwidth Savings**: Avoids re-downloading identical images
- **Upload Optimization**: Reuses uploaded images
- **Performance**: Faster processing for repeated images
- **Storage Efficiency**: Reduces duplicate uploads

## Dry Run Mode

### Dry Run Implementation

```javascript
if (dryRun) {
  return {
    type: 'paragraph',
    paragraph: {
      rich_text: [{ 
        text: { content: altText ? `[DRY RUN - Image: ${altText}]` : '[DRY RUN - Image]' },
        annotations: { italic: true, color: 'blue' }
      }]
    }
  };
}
```

**Features:**
- **No Network Calls**: Skips downloads and uploads
- **Visual Indication**: Clear dry run markers
- **Structure Preservation**: Maintains block structure
- **Testing Support**: Enables testing without API calls

## Statistics and Monitoring

### Statistics Tracking

```javascript
getStatistics() {
  return {
    imagesProcessed: this.stats.imagesProcessed,
    imagesUploaded: this.stats.imagesUploaded,
    imagesCached: this.stats.imagesCached,
    downloadsFailed: this.stats.downloadsFailed,
    uploadsFailed: this.stats.uploadsFailed,
    cacheHitRate: this.stats.imagesProcessed > 0 
      ? (this.stats.imagesCached / this.stats.imagesProcessed * 100).toFixed(1) + '%'
      : '0%',
    bandwidthSaved: this.calculateBandwidthSaved()
  };
}
```

### Performance Metrics

```javascript
getCacheStatistics() {
  const cacheSize = this.state.getUploadedFileCount();
  const cacheHits = this.stats.imagesCached;
  const totalProcessed = this.stats.imagesProcessed;
  
  return {
    cacheSize: cacheSize,
    cacheHits: cacheHits,
    hitRate: totalProcessed > 0 ? (cacheHits / totalProcessed * 100).toFixed(1) + '%' : '0%',
    bandwidthSaved: this.calculateBandwidthSaved()
  };
}
```

## Integration with NotionSync

### Block Processing Integration

```javascript
// In notion-sync.js
async processMediaInBlocks(blocks) {
  const processedBlocks = [];
  
  for (const block of blocks) {
    if (block.type === 'paragraph' && block.paragraph.rich_text) {
      // Check for image markdown in paragraph
      const content = block.paragraph.rich_text.map(rt => rt.text.content).join('');
      const imageMatch = content.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      
      if (imageMatch) {
        const [fullMatch, altText, imageUrl] = imageMatch;
        
        // Process image and create image block
        const imageBlock = await this.imageProcessor.processImageMarkdown(
          imageUrl, 
          altText, 
          this.config.projectRoot
        );
        
        if (imageBlock) {
          processedBlocks.push(imageBlock);
        }
      }
    } else {
      processedBlocks.push(block);
    }
  }
  
  return processedBlocks;
}
```

## Usage Examples

### Basic Image Processing

```javascript
const processor = new NotionImageProcessor(client, state, config);

// Process markdown image
const imageBlock = await processor.processImageMarkdown(
  '/img/diagram.png',
  'System Architecture',
  '/path/to/project'
);

// Process external image
const externalBlock = await processor.processImageMarkdown(
  'https://example.com/image.png',
  'External Image'
);
```

### Batch Processing

```javascript
const images = [
  { url: '/img/logo.png', alt: 'Logo' },
  { url: 'https://example.com/banner.jpg', alt: 'Banner' },
  { url: '/img/screenshot.png', alt: 'Screenshot' }
];

const imageBlocks = [];
for (const image of images) {
  const block = await processor.processImageMarkdown(
    image.url,
    image.alt,
    projectRoot
  );
  
  if (block) {
    imageBlocks.push(block);
  }
}
```

### With Statistics

```javascript
// Process images and get statistics
const blocks = await processor.processImageBlocks(originalBlocks);
const stats = processor.getStatistics();

console.log(`Image Processing Statistics:
- Images processed: ${stats.imagesProcessed}
- Images uploaded: ${stats.imagesUploaded}
- Images cached: ${stats.imagesCached}
- Cache hit rate: ${stats.cacheHitRate}
- Downloads failed: ${stats.downloadsFailed}
- Uploads failed: ${stats.uploadsFailed}
- Bandwidth saved: ${stats.bandwidthSaved}
`);
```

## Configuration

### Project Structure

```
project/
├── static/
│   ├── img/
│   │   ├── logo.png
│   │   ├── diagram.svg
│   │   └── screenshot.jpg
│   └── files/
└── docs/
    └── intro.md
```

### Path Resolution

```javascript
// Image path resolution
const resolveImagePath = (imageUrl, projectRoot) => {
  if (imageUrl.startsWith('/')) {
    // Absolute path from static directory
    return path.resolve(projectRoot, 'static', imageUrl.substring(1));
  } else if (imageUrl.startsWith('./')) {
    // Relative path from current file
    return path.resolve(path.dirname(currentFile), imageUrl);
  } else {
    // External URL
    return imageUrl;
  }
};
```

## Best Practices

### Image Organization

1. **Static Directory**: Store images in `static/img/` directory
2. **Descriptive Names**: Use clear, descriptive filenames
3. **Optimal Formats**: Use appropriate formats (PNG for screenshots, JPEG for photos)
4. **Size Optimization**: Optimize images before upload

### Performance Optimization

1. **Enable Caching**: Use state management for caching
2. **Batch Processing**: Process multiple images efficiently
3. **Monitor Statistics**: Track processing metrics
4. **Handle Errors**: Implement proper error recovery

### Error Prevention

1. **Validate Paths**: Check file existence before processing
2. **Test URLs**: Verify external URLs are accessible
3. **Handle Timeouts**: Set appropriate timeout values
4. **Fallback Strategy**: Provide meaningful fallbacks

## Troubleshooting

### Common Issues

1. **Images Not Found**: Check file paths and project structure
2. **Download Failures**: Verify external URLs and network connectivity
3. **Upload Failures**: Check API token and permissions
4. **Cache Issues**: Clear cache if images not updating

### Debug Information

```javascript
// Enable detailed logging
console.log(chalk.cyan(`🖼️ Processing image: ${imageUrl}`));
console.log(chalk.cyan(`📤 Uploading image: ${fileName} (${buffer.length} bytes)`));
console.log(chalk.green(`✅ Uploaded image: ${fileName}`));
console.log(chalk.yellow(`⚠️ Failed to process image: ${error.message}`));
```

### Performance Monitoring

```javascript
const startTime = Date.now();
const processedBlocks = await processor.processImageBlocks(blocks);
const endTime = Date.now();

console.log(`Image processing completed in ${endTime - startTime}ms`);
console.log(`Processed ${processedBlocks.length} blocks`);
console.log(`Average: ${((endTime - startTime) / processedBlocks.length).toFixed(2)}ms per block`);
```

## Security Considerations

### External Image Safety

1. **URL Validation**: Validate external URLs before download
2. **Content Type Checking**: Verify image content types
3. **Size Limits**: Enforce reasonable file size limits
4. **Timeout Protection**: Use timeouts to prevent hanging

### Local File Access

1. **Path Validation**: Validate file paths to prevent directory traversal
2. **Permission Checking**: Verify file read permissions
3. **Sandboxing**: Restrict access to project directories only
4. **Error Handling**: Don't expose sensitive path information in errors 