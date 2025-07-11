/**
 * TypeScript type definitions for docflu
 */

export interface PlatformConfig {
  baseUrl: string;
  apiToken: string;
  spaceKey?: string;
  username?: string;
  clientId?: string;
  clientSecret?: string;
  folderId?: string;
  databaseId?: string;
  rootPageTitle?: string;
}

export interface SyncOptions {
  dryRun?: boolean;
  force?: boolean;
  file?: string;
  docs?: boolean;
  blog?: boolean;
  dir?: string;
  platform?: 'confluence' | 'gdocs' | 'notion';
}

export interface ProcessingContext {
  platform: string;
  projectRoot: string;
  config: PlatformConfig;
  options: SyncOptions;
  filePath?: string;
}

export interface MarkdownContent {
  title: string;
  content: string;
  frontmatter: Record<string, any>;
  filePath: string;
  relativePath: string;
}

export interface DiagramInfo {
  type: 'mermaid' | 'plantuml' | 'graphviz' | 'dot' | 'd2';
  content: string;
  startLine: number;
  endLine: number;
}

export interface ImageInfo {
  src: string;
  alt: string;
  title?: string;
  isLocal: boolean;
  filePath?: string;
}

export interface SyncResult {
  success: boolean;
  pageId?: string;
  url?: string;
  error?: string;
  stats?: {
    filesProcessed: number;
    imagesUploaded: number;
    diagramsProcessed: number;
    linksProcessed: number;
  };
}

export interface PageHierarchy {
  title: string;
  pageId?: string;
  url?: string;
  children: PageHierarchy[];
  filePath?: string;
  parentId?: string;
}

export interface StateData {
  platform: string;
  projectRoot: string;
  pages: Record<string, {
    pageId: string;
    title: string;
    url: string;
    lastModified: string;
    checksum: string;
  }>;
  hierarchy: PageHierarchy[];
  stats: {
    totalFiles: number;
    processedFiles: number;
    errors: number;
    lastSync: string;
  };
}

export interface ProcessorOptions {
  projectRoot: string;
  config: PlatformConfig;
  dryRun?: boolean;
}

export interface FileUploadResult {
  success: boolean;
  url?: string;
  attachmentId?: string;
  error?: string;
}

export interface ErrorInfo {
  code: string;
  message: string;
  context?: string;
  stack?: string;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  maxConcurrent: number;
  retryAttempts: number;
  backoffFactor: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum number of cache entries
}

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  timestamp: boolean;
}

export interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  apiCalls: number;
  filesProcessed: number;
  errorsCount: number;
}