const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

// Import modules to test
const CONSTANTS = require('../lib/constants');
const ErrorHandler = require('../lib/utils/error-handler');
const Utils = require('../lib/utils');
const PerformanceMonitor = require('../lib/utils/performance-monitor');
const ConfigManager = require('../lib/core/config-manager');
const PlatformFactory = require('../lib/core/base/platform-factory');

console.log(chalk.blue('🧪 Testing improved architecture components...'));

async function testConstants() {
  console.log(chalk.gray('📋 Testing constants...'));
  
  assert(CONSTANTS.PLATFORMS.CONFLUENCE === 'confluence', 'Confluence platform constant');
  assert(CONSTANTS.PLATFORMS.GOOGLE_DOCS === 'gdocs', 'Google Docs platform constant');
  assert(CONSTANTS.PLATFORMS.NOTION === 'notion', 'Notion platform constant');
  
  assert(CONSTANTS.EXTENSIONS.MARKDOWN === '.md', 'Markdown extension constant');
  assert(CONSTANTS.ERROR_CODES.VALIDATION_ERROR === 'VALIDATION_ERROR', 'Error code constant');
  
  console.log(chalk.green('✅ Constants test passed'));
}

async function testErrorHandler() {
  console.log(chalk.gray('📋 Testing error handler...'));
  
  // Test error creation
  const validationError = ErrorHandler.createValidationError('test', 'invalid');
  assert(validationError.code === 'VALIDATION_ERROR', 'Validation error code');
  assert(validationError.message.includes('test'), 'Error message contains field');
  
  const configError = ErrorHandler.createConfigError('Config missing');
  assert(configError.code === 'CONFIG_ERROR', 'Config error code');
  
  // Test error formatting
  const mockError = {
    response: {
      data: {
        message: 'API Error'
      }
    }
  };
  
  const formatted = ErrorHandler.formatError(mockError);
  assert(formatted === 'API Error', 'Error formatting');
  
  console.log(chalk.green('✅ Error handler test passed'));
}

async function testUtils() {
  console.log(chalk.gray('📋 Testing utilities...'));
  
  // Test file type detection
  assert(Utils.isMarkdownFile('test.md'), 'Markdown file detection');
  assert(Utils.isMarkdownFile('test.mdx'), 'MDX file detection');
  assert(!Utils.isMarkdownFile('test.txt'), 'Non-markdown file detection');
  
  assert(Utils.isImageFile('test.png'), 'PNG image detection');
  assert(Utils.isImageFile('test.jpg'), 'JPG image detection');
  assert(!Utils.isImageFile('test.txt'), 'Non-image file detection');
  
  // Test path normalization
  const normalized = Utils.normalizePath('path\\to\\file');
  assert(normalized === 'path/to/file', 'Path normalization');
  
  // Test string utilities
  assert(Utils.isEmpty(''), 'Empty string detection');
  assert(Utils.isEmpty('   '), 'Whitespace string detection');
  assert(!Utils.isEmpty('text'), 'Non-empty string detection');
  
  const truncated = Utils.truncate('very long text', 5);
  assert(truncated === 'very ...', 'String truncation');
  
  // Test byte formatting
  const formatted = Utils.formatBytes(1024);
  assert(formatted === '1 KB', 'Byte formatting');
  
  console.log(chalk.green('✅ Utils test passed'));
}

async function testPerformanceMonitor() {
  console.log(chalk.gray('📋 Testing performance monitor...'));
  
  const monitor = new PerformanceMonitor();
  
  // Test basic functionality
  monitor.start();
  monitor.startOperation('test-op');
  
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 10));
  
  monitor.endOperation('test-op');
  monitor.stop();
  
  const metrics = monitor.getMetrics();
  assert(metrics.duration > 0, 'Duration recorded');
  assert(metrics.operations['test-op'], 'Operation recorded');
  assert(metrics.operations['test-op'].duration > 0, 'Operation duration recorded');
  
  // Test counters
  monitor.incrementApiCalls();
  monitor.incrementFilesProcessed();
  monitor.incrementErrors();
  
  const updatedMetrics = monitor.getMetrics();
  assert(updatedMetrics.apiCalls === 1, 'API calls counter');
  assert(updatedMetrics.filesProcessed === 1, 'Files processed counter');
  assert(updatedMetrics.errorsCount === 1, 'Errors counter');
  
  console.log(chalk.green('✅ Performance monitor test passed'));
}

async function testPlatformFactory() {
  console.log(chalk.gray('📋 Testing platform factory...'));
  
  // Test platform support
  const supportedPlatforms = PlatformFactory.getSupportedPlatforms();
  assert(supportedPlatforms.includes('confluence'), 'Confluence support');
  assert(supportedPlatforms.includes('gdocs'), 'Google Docs support');
  assert(supportedPlatforms.includes('notion'), 'Notion support');
  
  assert(PlatformFactory.isSupported('confluence'), 'Confluence supported');
  assert(!PlatformFactory.isSupported('invalid'), 'Invalid platform not supported');
  
  // Test default configurations
  const confluenceConfig = PlatformFactory.getDefaultConfig('confluence');
  assert(confluenceConfig.baseUrl === '', 'Default Confluence config');
  assert(confluenceConfig.hasOwnProperty('apiToken'), 'Confluence config has apiToken');
  
  const gdocsConfig = PlatformFactory.getDefaultConfig('gdocs');
  assert(gdocsConfig.hasOwnProperty('clientId'), 'Google Docs config has clientId');
  
  const notionConfig = PlatformFactory.getDefaultConfig('notion');
  assert(notionConfig.hasOwnProperty('apiToken'), 'Notion config has apiToken');
  
  console.log(chalk.green('✅ Platform factory test passed'));
}

async function testConfigManager() {
  console.log(chalk.gray('📋 Testing config manager...'));
  
  const tempDir = path.join(__dirname, 'temp-config-test');
  await fs.ensureDir(tempDir);
  
  try {
    const configManager = new ConfigManager(tempDir);
    
    // Test supported platforms
    const platforms = configManager.getSupportedPlatforms();
    assert(platforms.length > 0, 'Has supported platforms');
    
    // Test sample env creation
    await configManager.createSampleEnv();
    const sampleEnvPath = path.join(tempDir, 'env.example');
    assert(await fs.pathExists(sampleEnvPath), 'Sample env file created');
    
    const sampleContent = await fs.readFile(sampleEnvPath, 'utf8');
    assert(sampleContent.includes('CONFLUENCE_BASE_URL'), 'Sample env has Confluence config');
    assert(sampleContent.includes('GDOCS_CLIENT_ID'), 'Sample env has Google Docs config');
    assert(sampleContent.includes('NOTION_API_TOKEN'), 'Sample env has Notion config');
    
    console.log(chalk.green('✅ Config manager test passed'));
  } finally {
    // Clean up
    await fs.remove(tempDir);
  }
}

async function runAllTests() {
  try {
    await testConstants();
    await testErrorHandler();
    await testUtils();
    await testPerformanceMonitor();
    await testPlatformFactory();
    await testConfigManager();
    
    console.log(chalk.green('\n🎉 All architecture tests passed!'));
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests();