const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');

/**
 * Notion Attachment Processor
 * Handles uploading local files to Notion using File Upload API
 */
class NotionAttachmentProcessor {
  constructor(notionClient, state, config) {
    this.client = notionClient;
    this.state = state;
    this.config = config;
    
    // Initialize file uploader
    this.fileUploader = new (require('./file-uploader'))(notionClient, config.notionApiToken);
    
    // File patterns for detection - only process /files/ paths for attachments
    this.patterns = {
      localFile: /\[([^\]]+)\]\(\/files\/([^)]+)\)/g,           // [text](/files/...) only
      // Remove relativePath pattern to avoid processing internal markdown links
    };
    
    // Supported file types (no restrictions)
    this.supportedTypes = [
      // Documents
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'json', 'xml', 'csv', 'rtf',
      // Archives
      'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
      // Media
      'mp3', 'wav', 'flac', 'aac', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm',
      // Development
      'js', 'ts', 'css', 'html', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs', 'sql', 'sh', 'bat', 'ps1',
      // Data
      'yaml', 'yml', 'toml', 'ini', 'conf', 'log',
      // Other
      'epub', 'mobi', 'iso', 'dmg', 'exe', 'msi', 'deb', 'rpm', 'apk'
    ];
    
    this.stats = {
      attachmentsFound: 0,
      attachmentsUploaded: 0,
      attachmentsCached: 0,
      errors: []
    };
  }

  /**
   * Process attachment links in markdown
   * @param {string} markdown - Markdown content
   * @param {string} filePath - Current file path
   * @param {string} projectRoot - Project root directory
   * @param {boolean} dryRun - Dry run flag
   * @returns {string} Processed markdown
   */
  async processAttachmentLinks(markdown, filePath, projectRoot, dryRun = false) {
    try {
      // Reset stats
      this.stats.attachmentsFound = 0;
      this.stats.attachmentsUploaded = 0;
      this.stats.attachmentsCached = 0;
      this.stats.errors = [];
      this.fileBlocksWithPositions = [];
      this.fileReferenceMarkers = new Map();
      
      // Pre-process markdown to mark file references
      let processedMarkdown = this.preprocessFileReferences(markdown);
      
      // Process each marked file reference
      for (const [markerId, markerInfo] of this.fileReferenceMarkers.entries()) {
        const { originalMatch, linkText } = markerInfo;
        const linkUrl = originalMatch.match(/\]\(([^\)]+)\)/)[1];
        
        if (this.isAttachmentFile(linkUrl)) {
          this.stats.attachmentsFound++;
          
          const lineNumber = this.getCurrentLineNumber(processedMarkdown, 0);
          
          if (dryRun) {
            // Replace marker with dry run text
            const markerPattern = `__FILEREF_MARKER_${markerId}__`;
            processedMarkdown = processedMarkdown.replace(markerPattern, '(DRY RUN)');
          } else {
            // Process the attachment and get file block
            const fileBlock = await this.createFileBlock(linkUrl, linkText, projectRoot, lineNumber);
            
            if (fileBlock) {
              // Store file block with marker info for later insertion
              this.fileBlocksWithPositions.push({
                fileBlock,
                filePath: linkUrl,
                lineNumber,
                fileName: path.basename(linkUrl),
                markerId: markerId
              });
              
              // Remove the marker from text (keep only linkText)
              const markerPattern = ` __FILEREF_MARKER_${markerId}__`;
              processedMarkdown = processedMarkdown.replace(markerPattern, '');
            }
          }
        }
      }
      
      if (this.stats.attachmentsFound > 0) {
        console.log(chalk.green(`✅ Processed ${this.stats.attachmentsFound} attachments`));
      }
      
      return processedMarkdown;
      
    } catch (error) {
      console.log(chalk.red(`❌ Attachment processing failed: ${error.message}`));
      console.log(chalk.red(`   Stack: ${error.stack}`));
      return markdown; // Return original on error
    }
  }

  /**
   * Pre-process markdown to mark file references for later processing
   * This approach keeps text content together and marks where file blocks should be inserted
   * @param {string} markdown - Original markdown
   * @returns {string} Pre-processed markdown with file reference markers
   */
  preprocessFileReferences(markdown) {
    // Instead of breaking lines, we'll mark file references with special markers
    // that will be processed after markdown-to-blocks conversion
    
    const fileReferenceRegex = /\[([^\]]*)\]\(\/files\/[^\)]+\)/g;
    
    let processedMarkdown = markdown.replace(fileReferenceRegex, (match, linkText) => {
      // Generate a unique marker for this file reference
      const markerId = `FILE_REF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store the mapping for later use
      if (!this.fileReferenceMarkers) {
        this.fileReferenceMarkers = new Map();
      }
      this.fileReferenceMarkers.set(markerId, {
        originalMatch: match,
        linkText: linkText
      });
      
      // Replace with linkText + marker
      return `${linkText} __FILEREF_MARKER_${markerId}__`;
    });
    
    return processedMarkdown;
  }

  /**
   * Create file block from attachment
   * @param {string} filePath - File path
   * @param {string} linkText - Link text
   * @param {string} projectRoot - Project root
   * @param {number} lineNumber - Line number
   * @returns {Object|null} File block or null
   */
  async createFileBlock(filePath, linkText, projectRoot, lineNumber) {
    try {
      // Resolve absolute path
      const absolutePath = this.resolveAttachmentPath(filePath, projectRoot);
      
      if (!await fs.pathExists(absolutePath)) {
        console.log(chalk.yellow(`⚠️ Attachment file not found: ${absolutePath}`));
        return null;
      }
      
      // Read file and calculate hash for caching
      const fileBuffer = await fs.readFile(absolutePath);
      const fileName = path.basename(absolutePath);
      const mimeType = this.getMimeType(fileName);
      
      // Generate file hash for caching
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      // Check cache first
      const cachedFileUrl = this.state.getUploadedFileUrl(fileHash);
      if (cachedFileUrl && cachedFileUrl.startsWith('notion://file_upload/')) {
        // Check if cache is still valid (10 minutes)
        const cacheData = this.state.getUploadedFileData(fileHash);
        if (cacheData && this.isCacheValid(cacheData.uploadedAt)) {
          console.log(chalk.gray(`📎 Using cached attachment: ${fileName}`));
          this.stats.attachmentsCached++;
          
          // Extract file upload ID from cached URL
          const fileUploadId = cachedFileUrl.replace('notion://file_upload/', '');
          
          // Create and return file block from cache
          return {
            object: 'block',
            type: 'file',
            file: {
              type: 'file_upload',
              file_upload: { 
                id: fileUploadId 
              },
              caption: []
            }
          };
        } else {
          console.log(chalk.yellow(`⏰ Cache expired for: ${fileName}, re-uploading...`));
          // Remove expired cache entry
          this.state.removeUploadedFile(fileHash);
        }
      }
      
      console.log(chalk.cyan(`📤 Uploading: ${fileName}`));
      
      // Upload using Notion File Upload API
      const uploadResult = await this.fileUploader.uploadFileToNotion(fileBuffer, fileName, mimeType);
      
      if (uploadResult && uploadResult.fileUploadId) {
        this.stats.attachmentsUploaded++;
        
        // Cache the upload result
        const fileUrl = `notion://file_upload/${uploadResult.fileUploadId}`;
        this.state.setUploadedFileUrl(fileHash, fileUrl, {
          type: 'attachment',
          fileName,
          mimeType,
          size: fileBuffer.length,
          filePath: filePath
        });
        
        // Create and return file block
        return {
          object: 'block',
          type: 'file',
          file: {
            type: 'file_upload',
            file_upload: { 
              id: uploadResult.fileUploadId 
            },
            caption: []
          }
        };
      } else {
        throw new Error('Upload failed - invalid result format');
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ Failed to process attachment ${filePath}: ${error.message}`));
      this.stats.errors.push(`${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Resolve attachment path
   * @param {string} filePath - File path from markdown (should start with /files/)
   * @param {string} projectRoot - Project root directory
   * @returns {string} Absolute file path
   */
  resolveAttachmentPath(filePath, projectRoot) {
    // Since we only process /files/ paths, resolve to static/files/
    if (filePath.startsWith('/files/')) {
      // /files/document.pdf -> {projectRoot}/static/files/document.pdf
      return path.resolve(projectRoot, 'static', filePath.substring(1));
    }
    
    // Fallback (should not happen with current logic)
    return path.resolve(projectRoot, 'static', 'files', path.basename(filePath));
  }

  /**
   * Check if file is an image (should be handled by image processor)
   * @param {string} filePath - File path
   * @returns {boolean} Is image file
   */
  isImageFile(filePath) {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.tiff'];
    const ext = path.extname(filePath).toLowerCase();
    return imageExtensions.includes(ext);
  }

  /**
   * Check if file is an attachment
   * @param {string} filePath - File path
   * @returns {boolean} Is attachment file
   */
  isAttachmentFile(filePath) {
    // Only process files in /files/ directory (Docusaurus static files)
    // This automatically excludes:
    // - Images (/img/ paths)
    // - Internal markdown links (./abc.md)
    // - Other internal links
    if (!filePath.startsWith('/files/')) {
      return false;
    }
    
    // Check if it's an image file in /files/ - should still be handled by image processor
    if (this.isImageFile(filePath)) {
      return false;
    }
    
    // Check if it's a markdown file - should not be processed as attachment
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.md' || ext === '.mdx') {
      return false;
    }
    
    // Accept any other file with extension in /files/ directory
    return ext.length > 1; // Must have extension (more than just the dot)
  }

  /**
   * Get MIME type for file
   * @param {string} fileName - File name
   * @returns {string} MIME type
   */
  getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      // Documents
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.rtf': 'application/rtf',
      
      // Archives
      '.zip': 'application/zip',
      '.rar': 'application/vnd.rar',
      '.7z': 'application/x-7z-compressed',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      '.bz2': 'application/x-bzip2',
      
      // Media
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.webm': 'video/webm',
      
      // Development files
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.py': 'text/x-python',
      '.java': 'text/x-java-source',
      '.cpp': 'text/x-c++src',
      '.c': 'text/x-csrc',
      '.php': 'text/x-php',
      '.rb': 'text/x-ruby',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.sql': 'text/x-sql',
      '.sh': 'text/x-shellscript',
      '.bat': 'text/x-msdos-batch',
      '.ps1': 'text/plain',
      
      // Data files
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.toml': 'text/plain',
      '.ini': 'text/plain',
      '.conf': 'text/plain',
      '.log': 'text/plain'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Check if cache is still valid (10 minutes)
   * @param {string} uploadedAt - ISO timestamp when file was uploaded
   * @returns {boolean} True if cache is still valid
   */
  isCacheValid(uploadedAt) {
    const CACHE_EXPIRY_MINUTES = 10;
    const now = new Date();
    const uploadTime = new Date(uploadedAt);
    const diffMinutes = (now - uploadTime) / (1000 * 60);
    
    return diffMinutes < CACHE_EXPIRY_MINUTES;
  }

  /**
   * Calculate line number for a given character position in markdown
   * @param {string} markdown - Markdown content
   * @param {number} position - Character position
   * @returns {number} Line number (1-based)
   */
  getCurrentLineNumber(markdown, position) {
    const beforePosition = markdown.substring(0, position);
    return beforePosition.split('\n').length;
  }

  /**
   * Get processing statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const totalProcessed = this.stats.attachmentsFound;
    const cacheHitRate = totalProcessed > 0 ? (this.stats.attachmentsCached / totalProcessed * 100).toFixed(1) : 0;
    
    return {
      attachmentsFound: this.stats.attachmentsFound,
      attachmentsUploaded: this.stats.attachmentsUploaded,
      attachmentsCached: this.stats.attachmentsCached,
      cacheHitRate: `${cacheHitRate}%`,
      errors: this.stats.errors.length,
      errorDetails: this.stats.errors,
      performance: {
        uploadsAvoided: this.stats.attachmentsCached,
        bandwidthSaved: this.calculateBandwidthSaved()
      }
    };
  }

  /**
   * Calculate estimated bandwidth saved by caching
   * @returns {string} Formatted bandwidth saved
   */
  calculateBandwidthSaved() {
    // Get cached files from state
    const uploadedFiles = this.state.getAllUploadedFiles();
    const attachments = Object.values(uploadedFiles).filter(file => file.type === 'attachment');
    
    let totalSaved = 0;
    for (const attachment of attachments) {
      // Each cache hit saves one upload of this file size
      totalSaved += (attachment.size || 0);
    }
    
    // Format bytes
    if (totalSaved === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(totalSaved) / Math.log(1024));
    return `${(totalSaved / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      await this.fileUploader.cleanup();
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Attachment processor cleanup failed: ${error.message}`));
    }
  }
}

module.exports = NotionAttachmentProcessor; 