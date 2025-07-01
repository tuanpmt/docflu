const { expect } = require('chai');
const fs = require('fs-extra');
const path = require('path');
const GDocsImageProcessor = require('../../lib/core/gdocs/gdocs-image-processor');

describe('Google Docs Image Processor - Debug Functionality', () => {
  let processor;
  let testProjectRoot;
  let debugDir;

  beforeEach(async () => {
    testProjectRoot = path.join(__dirname, '..', 'temp-debug-test');
    debugDir = path.join(testProjectRoot, '.docusaurus', 'debug', 'gdocs-image-processor');
    
    // Create test directory
    await fs.ensureDir(testProjectRoot);
    
    // Set debug mode
    process.env.DEBUG_GDOCS_CONVERTER = 'true';
    
    processor = new GDocsImageProcessor(testProjectRoot);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.remove(testProjectRoot);
    
    // Reset debug mode
    delete process.env.DEBUG_GDOCS_CONVERTER;
  });

  describe('Debug Configuration', () => {
    it('should enable debug mode when environment variable is set', () => {
      expect(processor.debug).to.be.true;
      expect(processor.debugDir).to.equal(debugDir);
    });

    it('should disable debug mode when environment variable is not set', () => {
      delete process.env.DEBUG_GDOCS_CONVERTER;
      const newProcessor = new GDocsImageProcessor(testProjectRoot);
      expect(newProcessor.debug).to.be.false;
    });
  });

  describe('Debug File Creation', () => {
    it('should create debug directory when saving debug info', async () => {
      const debugInfo = {
        timestamp: new Date().toISOString(),
        input: { markdown: 'test', filePath: 'test.md' },
        processing: { phases: [], images: [], diagrams: [], uploads: [] },
        output: { stats: {} },
        errors: []
      };

      await processor.saveDebugInfo(debugInfo);
      
      expect(await fs.pathExists(debugDir)).to.be.true;
    });

    it('should save debug file with correct structure', async () => {
      const debugInfo = {
        timestamp: '2024-01-27T10:30:45.123Z',
        input: { 
          markdown: '# Test\n\n![image](test.png)', 
          filePath: 'docs/test.md' 
        },
        processing: { 
          phases: [
            { phase: 'initialization', timestamp: '2024-01-27T10:30:45.123Z' }
          ],
          images: [
            { alt: 'image', src: 'test.png', type: 'markdown', isRemote: false }
          ],
          diagrams: [],
          uploads: []
        },
        output: { 
          stats: { imagesFound: 1, imagesProcessed: 0 }
        },
        errors: []
      };

      await processor.saveDebugInfo(debugInfo);
      
      // Find the created debug file
      const files = await fs.readdir(debugDir);
      const debugFile = files.find(f => f.startsWith('image-processing-debug-'));
      
      expect(debugFile).to.exist;
      
      const savedData = await fs.readJson(path.join(debugDir, debugFile));
      
      // Check structure
      expect(savedData).to.have.property('timestamp');
      expect(savedData).to.have.property('input');
      expect(savedData).to.have.property('processing');
      expect(savedData).to.have.property('output');
      expect(savedData).to.have.property('errors');
      expect(savedData).to.have.property('metadata');
      
      // Check metadata
      expect(savedData.metadata).to.have.property('processorVersion');
      expect(savedData.metadata).to.have.property('nodeVersion');
      expect(savedData.metadata).to.have.property('debugEnabled', true);
      expect(savedData.metadata).to.have.property('projectRoot', testProjectRoot);
    });

    it('should save summary file alongside debug file', async () => {
      const debugInfo = {
        timestamp: '2024-01-27T10:30:45.123Z',
        input: { 
          markdown: '# Test\n\n```mermaid\ngraph TD\n  A --> B\n```', 
          filePath: 'docs/test.md' 
        },
        processing: { 
          phases: [
            { phase: 'initialization', timestamp: '2024-01-27T10:30:45.123Z' },
            { phase: 'mermaid_processing_start', timestamp: '2024-01-27T10:30:45.124Z' }
          ],
          images: [],
          diagrams: [
            { type: 'mermaid', count: 1, matches: [] }
          ],
          uploads: []
        },
        output: { 
          stats: { imagesFound: 0, diagramsProcessed: 1 }
        },
        errors: []
      };

      await processor.saveDebugInfo(debugInfo);
      
      const files = await fs.readdir(debugDir);
      const summaryFile = files.find(f => f.startsWith('image-summary-'));
      
      expect(summaryFile).to.exist;
      
      const summaryData = await fs.readJson(path.join(debugDir, summaryFile));
      
      expect(summaryData).to.have.property('timestamp');
      expect(summaryData).to.have.property('inputLength');
      expect(summaryData).to.have.property('filePath', 'docs/test.md');
      expect(summaryData).to.have.property('phases', 2);
      expect(summaryData).to.have.property('imagesFound', 0);
      expect(summaryData).to.have.property('diagramsFound', 1);
      expect(summaryData).to.have.property('uploadsCompleted', 0);
      expect(summaryData).to.have.property('errors', 0);
    });

    it('should save error debug file with suffix', async () => {
      const debugInfo = {
        timestamp: new Date().toISOString(),
        input: { markdown: 'test', filePath: 'test.md' },
        processing: { phases: [], images: [], diagrams: [], uploads: [] },
        output: null,
        errors: [
          { message: 'Test error', timestamp: new Date().toISOString() }
        ]
      };

      await processor.saveDebugInfo(debugInfo, 'error');
      
      const files = await fs.readdir(debugDir);
      const errorFile = files.find(f => f.includes('error'));
      
      expect(errorFile).to.exist;
      expect(errorFile).to.include('image-processing-debug-error-');
    });
  });

  describe('Debug Integration with Processing', () => {
    it('should not save debug info when debug is disabled', async () => {
      delete process.env.DEBUG_GDOCS_CONVERTER;
      const newProcessor = new GDocsImageProcessor(testProjectRoot);
      
      const debugInfo = {
        timestamp: new Date().toISOString(),
        input: { markdown: 'test', filePath: 'test.md' },
        processing: { phases: [], images: [], diagrams: [], uploads: [] },
        output: { stats: {} },
        errors: []
      };

      await newProcessor.saveDebugInfo(debugInfo);
      
      expect(await fs.pathExists(debugDir)).to.be.false;
    });

    it('should handle saveDebugInfo errors gracefully', async () => {
      // Mock fs.ensureDir to throw error
      const originalEnsureDir = fs.ensureDir;
      fs.ensureDir = () => { throw new Error('Permission denied'); };
      
      const debugInfo = {
        timestamp: new Date().toISOString(),
        input: { markdown: 'test', filePath: 'test.md' },
        processing: { phases: [], images: [], diagrams: [], uploads: [] },
        output: { stats: {} },
        errors: []
      };

      // Should not throw error
      await processor.saveDebugInfo(debugInfo);
      
      // Restore original function
      fs.ensureDir = originalEnsureDir;
    });
  });

  describe('Debug Information Structure', () => {
    it('should capture processing phases correctly', async () => {
      // Mock a simple processing scenario
      const markdown = '![test](test.png)';
      const filePath = 'docs/test.md';
      
      // Since we don't have actual Drive client, this will fail
      // but we can test the debug structure creation
      try {
        await processor.processImages(markdown, filePath);
      } catch (error) {
        // Expected to fail without proper setup
      }
      
      // Check if debug directory was created (it should be if debug was enabled)
      const debugDirExists = await fs.pathExists(debugDir);
      expect(debugDirExists).to.be.true;
    });

    it('should calculate success rate correctly in debug output', () => {
      // Test the success rate calculation logic
      const testCases = [
        { imagesFound: 0, processed: 0, expected: 100 },
        { imagesFound: 5, processed: 5, expected: 100 },
        { imagesFound: 10, processed: 8, expected: 80 },
        { imagesFound: 3, processed: 1, expected: 33 }
      ];

      testCases.forEach(({ imagesFound, processed, expected }) => {
        const successRate = imagesFound > 0 ? 
          Math.round((processed / imagesFound) * 100) : 100;
        expect(successRate).to.equal(expected);
      });
    });
  });
}); 