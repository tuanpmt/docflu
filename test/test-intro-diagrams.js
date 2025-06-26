#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const DiagramProcessor = require('../lib/core/diagram-processor');

// Mock Confluence Client
class MockConfluenceClient {
  constructor() {
    this.uploadCounter = 0;
  }

  async api(config) {
    // Mock successful upload response
    this.uploadCounter++;
    return {
      data: {
        results: [{
          id: `attachment-${this.uploadCounter}`,
          title: `diagram-${Date.now()}.svg`,
          _links: {
            download: '/download/attachment',
            webui: '/pages/viewpage.action'
          }
        }]
      }
    };
  }
}

async function testIntroDiagrams() {
  console.log(chalk.blue('🧪 Testing Intro.md Diagram Processing'));
  console.log('='.repeat(50));

  try {
    // Read intro.md
    const introPath = path.join(__dirname, 'sample-docs', 'intro.md');
    const introContent = await fs.readFile(introPath, 'utf8');
    
    console.log(chalk.gray('📄 Loaded intro.md'));
    
    // Initialize diagram processor
    const mockClient = new MockConfluenceClient();
    const processor = new DiagramProcessor(mockClient);
    
    // Extract all diagrams
    const diagrams = processor.extractAllDiagrams(introContent);
    console.log(chalk.blue(`🎨 Found ${diagrams.length} diagrams:`));
    
    diagrams.forEach((diagram, index) => {
      console.log(chalk.gray(`   ${index + 1}. ${diagram.type}: ${diagram.id}`));
    });
    
    // Process all diagrams
    const mockPageId = '123456789';
    const result = await processor.processAllDiagrams(mockPageId, introContent);
    
    console.log(chalk.green('\n📊 Processing Results:'));
    console.log(chalk.gray(`   Total: ${result.stats.total}`));
    console.log(chalk.gray(`   Processed: ${result.stats.processed}`));
    console.log(chalk.gray(`   Failed: ${result.stats.failed}`));
    
    console.log(chalk.blue('\n📋 By Type:'));
    for (const [type, stats] of Object.entries(result.stats.byType)) {
      if (stats.total > 0) {
        const status = stats.processed === stats.total ? '✅' : stats.failed > 0 ? '⚠️' : '❌';
        console.log(chalk.gray(`   ${status} ${type}: ${stats.processed}/${stats.total} processed`));
      }
    }
    
    // Check if content was converted
    const hasCodeBlocks = result.processedContent.includes('```');
    const hasImages = result.processedContent.includes('<ac:image');
    const hasMetadata = result.processedContent.includes('DOCFLU_DIAGRAM_METADATA');
    
    console.log(chalk.blue('\n🔍 Content Analysis:'));
    console.log(chalk.gray(`   Code blocks remaining: ${hasCodeBlocks ? 'Yes' : 'No'}`));
    console.log(chalk.gray(`   Images generated: ${hasImages ? 'Yes' : 'No'}`));
    console.log(chalk.gray(`   Metadata preserved: ${hasMetadata ? 'Yes' : 'No'}`));
    
    // Show a sample of processed content
    console.log(chalk.blue('\n📖 Sample Processed Content:'));
    const sampleContent = result.processedContent.substring(0, 500) + '...';
    console.log(chalk.gray(sampleContent));
    
    // Cleanup
    await processor.cleanup();
    
    if (result.stats.processed > 0) {
      console.log(chalk.green('\n✅ SUCCESS: All diagrams processed successfully!'));
    } else {
      console.log(chalk.red('\n❌ FAILED: No diagrams were processed'));
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testIntroDiagrams(); 