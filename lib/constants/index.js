/**
 * Application constants
 */
const CONSTANTS = {
  // File extensions
  EXTENSIONS: {
    MARKDOWN: '.md',
    MDX: '.mdx',
    SVG: '.svg',
    PNG: '.png',
    JPG: '.jpg',
    JPEG: '.jpeg',
    GIF: '.gif',
    WEBP: '.webp'
  },

  // Directory names
  DIRECTORIES: {
    DOCS: 'docs',
    BLOG: 'blog',
    DOCUSAURUS: '.docusaurus',
    STATIC: 'static'
  },

  // Configuration files
  CONFIG_FILES: {
    ENV: '.env',
    DOCUSAURUS_CONFIG_JS: 'docusaurus.config.js',
    DOCUSAURUS_CONFIG_TS: 'docusaurus.config.ts',
    PACKAGE_JSON: 'package.json'
  },

  // Supported platforms
  PLATFORMS: {
    CONFLUENCE: 'confluence',
    GOOGLE_DOCS: 'gdocs',
    NOTION: 'notion'
  },

  // Diagram types
  DIAGRAM_TYPES: {
    MERMAID: 'mermaid',
    PLANTUML: 'plantuml',
    GRAPHVIZ: 'graphviz',
    DOT: 'dot',
    D2: 'd2'
  },

  // Error codes
  ERROR_CODES: {
    GENERAL_ERROR: 'GENERAL_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    CONFIG_ERROR: 'CONFIG_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    PLATFORM_ERROR: 'PLATFORM_ERROR'
  },

  // Rate limiting
  RATE_LIMITS: {
    NOTION_REQUESTS_PER_SECOND: 3,
    CONFLUENCE_REQUESTS_PER_SECOND: 10,
    GDOCS_REQUESTS_PER_SECOND: 100
  },

  // File size limits (in bytes)
  FILE_SIZE_LIMITS: {
    IMAGE_MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ATTACHMENT_MAX_SIZE: 100 * 1024 * 1024, // 100MB
    SVG_MAX_SIZE: 5 * 1024 * 1024 // 5MB
  },

  // Timeout values (in milliseconds)
  TIMEOUTS: {
    HTTP_REQUEST: 30000, // 30 seconds
    OAUTH_SERVER: 120000, // 2 minutes
    DIAGRAM_PROCESSING: 60000 // 1 minute
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF_FACTOR: 2,
    INITIAL_DELAY: 1000 // 1 second
  },

  // CLI colors and symbols
  CLI: {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    PROGRESS: '🚀',
    FILE: '📄',
    FOLDER: '📂',
    SYNC: '🔄',
    UPLOAD: '📤',
    DOWNLOAD: '📥',
    SEARCH: '🔍',
    DIAGRAM: '📊',
    IMAGE: '🖼️',
    LINK: '🔗'
  },

  // Default values
  DEFAULTS: {
    NOTION_VERSION: '2022-06-28',
    CONFLUENCE_API_VERSION: 'v2',
    GDOCS_API_VERSION: 'v1',
    SYNC_BATCH_SIZE: 10,
    MAX_CONCURRENT_UPLOADS: 5
  }
};

module.exports = CONSTANTS;