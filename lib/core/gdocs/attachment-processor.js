const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');

/**
 * Attachment Processor for Google Docs
 * Handles uploading local files to Google Drive and converting to download links
 */
class AttachmentProcessor {
  constructor(googleDriveClient, stateManager, projectRoot) {
    this.googleDriveClient = googleDriveClient;
    this.stateManager = stateManager;
    this.projectRoot = projectRoot || process.cwd();
    this.debug = process.env.DEBUG_GDOCS_CONVERTER === 'true';
    
    this.stats = {
      attachmentsFound: 0,
      attachmentsUploaded: 0,
      attachmentsCached: 0,
      errors: []
    };
  }

  /**
   * Upload attachment file to Google Drive (uses same folder as images)
   * @param {string} filePath - Path to the attachment file
   * @param {string} fileName - Optional custom filename
   * @returns {Object} Upload result with URL and file info
   */
  async uploadAttachment(filePath, fileName = null) {
    try {
      // Ensure we have the unified files folder (same as images)
      await this.googleDriveClient.ensureImageFolder();
      
      // Generate file hash for caching
      const fileBuffer = await fs.readFile(filePath);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      // Check session cache first (use uploadedImages map for both images and attachments)
      if (this.googleDriveClient.uploadedImages.has(fileHash)) {
        const cachedResult = this.googleDriveClient.uploadedImages.get(fileHash);
        this.stats.attachmentsCached++;
        return { ...cachedResult, cached: true };
      }
      
      // Check persistent cache for attachments
      const currentState = await this.stateManager.loadState();
      if (currentState.googleDrive?.uploadedAttachments?.[fileHash]) {
        const cachedResult = currentState.googleDrive.uploadedAttachments[fileHash];
        
        // Verify file still exists in Google Drive
        try {
          const file = await this.googleDriveClient.drive.files.get({
            fileId: cachedResult.fileId,
            fields: 'id,name,trashed'
          });
          
          if (!file.data.trashed) {
            // Update session cache
            this.googleDriveClient.uploadedImages.set(fileHash, cachedResult);
            this.stats.attachmentsCached++;
            return { ...cachedResult, cached: true };
          }
        } catch (verifyError) {
          // File no longer exists, continue with upload
        }
      }
      
      // Prepare file for upload
      let uploadFileName = fileName || path.basename(filePath);
      const fileStats = await fs.stat(filePath);
      const mimeType = this.getAttachmentMimeType(filePath);
      
      // Add hash prefix to filename to make it unique
      const hashPrefix = fileHash.substring(0, 8);
      const fileExt = path.extname(uploadFileName);
      const baseName = path.basename(uploadFileName, fileExt);
      uploadFileName = `${hashPrefix}-${baseName}${fileExt}`;
      
      const fileMetadata = {
        name: uploadFileName,
        parents: [this.googleDriveClient.imageFolderId] // Use same folder as images
      };

      const media = {
        mimeType: mimeType,
        body: fs.createReadStream(filePath)
      };

      // Upload file to Google Drive
      const file = await this.googleDriveClient.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,size,webViewLink,mimeType'
      });

      // Set public permissions for download access
      await this.googleDriveClient.drive.permissions.create({
        fileId: file.data.id,
        resource: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // Generate download URL
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.data.id}`;
      
      const uploadResult = {
        url: downloadUrl,
        fileId: file.data.id,
        fileName: uploadFileName,
        originalName: path.basename(filePath),
        mimeType: mimeType,
        size: file.data.size || fileStats.size,
        hash: fileHash,
        webViewLink: file.data.webViewLink,
        uploadedAt: new Date().toISOString()
      };

      // Cache in session (use same cache as images)
      this.googleDriveClient.uploadedImages.set(fileHash, uploadResult);
      
      // Save to persistent state (separate attachments cache)
      await this.stateManager.updateState({
        googleDrive: {
          ...currentState.googleDrive,
          imageFolderId: this.googleDriveClient.imageFolderId,
          filesFolderId: this.googleDriveClient.imageFolderId,
          uploadedAttachments: {
            ...currentState.googleDrive?.uploadedAttachments,
            [fileHash]: uploadResult
          }
        }
      });

      this.stats.attachmentsUploaded++;
      return { ...uploadResult, cached: false };
      
    } catch (error) {
      this.stats.errors.push(`Failed to upload ${filePath}: ${error.message}`);
      console.error(chalk.red(`❌ Failed to upload attachment ${filePath}:`), error.message);
      throw error;
    }
  }

  /**
   * Get MIME type for attachment files (no restrictions on file types)
   */
  getAttachmentMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
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
      
      // Images (for completeness)
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.webp': 'image/webp',
      
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
      '.log': 'text/plain',
      
      // Other common formats
      '.epub': 'application/epub+zip',
      '.mobi': 'application/x-mobipocket-ebook',
      '.iso': 'application/x-iso9660-image',
      '.dmg': 'application/x-apple-diskimage',
      '.exe': 'application/x-msdownload',
      '.msi': 'application/x-msi',
      '.deb': 'application/vnd.debian.binary-package',
      '.rpm': 'application/x-rpm',
      '.apk': 'application/vnd.android.package-archive'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Initialize the attachment processor
   */
  async initialize() {
    // AttachmentProcessor doesn't need to initialize GoogleDriveClient
    // GoogleDriveClient is already initialized by GoogleDocsSync
    // Just ensure we have the required dependencies
    if (!this.googleDriveClient) {
      throw new Error('GoogleDriveClient is required for AttachmentProcessor');
    }
    if (!this.stateManager) {
      throw new Error('StateManager is required for AttachmentProcessor');
    }
  }

  /**
   * Get MIME type for a file (alias for getAttachmentMimeType for test compatibility)
   */
  getMimeType(filePath) {
    return this.getAttachmentMimeType(filePath);
  }

  /**
   * Generate file hash for caching
   */
  generateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Get processing statistics (alias for getStats for test compatibility)
   */
  getStatistics() {
    return {
      uploaded: this.stats.attachmentsUploaded,
      cached: this.stats.attachmentsCached,
      errors: this.stats.errors.length,
      found: this.stats.attachmentsFound,
      successRate: this.stats.attachmentsFound > 0 ? 
        Math.round((this.stats.attachmentsUploaded / this.stats.attachmentsFound) * 100) : 100
    };
  }

  /**
   * Get processing statistics (original method)
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.attachmentsFound > 0 ? 
        Math.round((this.stats.attachmentsUploaded / this.stats.attachmentsFound) * 100) : 100
    };
  }
}

module.exports = AttachmentProcessor; 