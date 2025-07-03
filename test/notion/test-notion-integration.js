const chalk = require('chalk');
const path = require('path');

// Import all NEW test modules
const testNotionConversion = require('./test-notion-conversion');
const testDiagramConversion = require('./test-diagram-conversion');
const testAllMdConversion = require('./test-all-md-conversion');

// Import NEW Notion processors for direct testing
const NotionMermaidProcessor = require('../../lib/core/notion/mermaid-processor');
const NotionPlantUMLProcessor = require('../../lib/core/notion/plantuml-processor');
const NotionGraphvizProcessor = require('../../lib/core/notion/graphviz-processor');
const NotionD2Processor = require('../../lib/core/notion/d2-processor');
const NotionDiagramProcessor = require('../../lib/core/notion/diagram-processor');

/**
 * Comprehensive Notion Integration Test
 * Tests all NEW processors and conversion capabilities
 */
async function testNotionIntegration() {
  console.log(chalk.blue('🚀 Starting Comprehensive Notion Integration Test with NEW Processors\n'));
  
  const startTime = Date.now();
  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };

  try {
    // Test 1: NEW Individual Processors
    console.log(chalk.yellow('🔧 Phase 1: Testing NEW Individual Processors\n'));
    
    const processors = [
      { name: 'Mermaid', processor: new NotionMermaidProcessor(), testContent: 'graph TD\n  A --> B\n  B --> C' },
      { name: 'PlantUML', processor: new NotionPlantUMLProcessor(), testContent: '@startuml\nA -> B: request\nB -> A: response\n@enduml' },
      { name: 'Graphviz', processor: new NotionGraphvizProcessor(), testContent: 'digraph G {\n  A -> B;\n  B -> C;\n}' },
      { name: 'D2', processor: new NotionD2Processor(), testContent: 'A -> B: "connection"\nB -> C: "process"' }
    ];

    for (const { name, processor, testContent } of processors) {
      testResults.total++;
      
      try {
        console.log(chalk.blue(`🔍 Testing ${name} processor...`));
        const processorStartTime = Date.now();
        
        // Test SVG generation
        const svgResult = await processor.generateSVGContent(testContent);
        const processorEndTime = Date.now();
        
        if (svgResult && svgResult.includes('<svg')) {
          testResults.passed++;
          console.log(chalk.green(`  ✅ ${name}: SVG generated successfully (${processorEndTime - processorStartTime}ms)`));
          console.log(chalk.gray(`     SVG size: ${svgResult.length} characters`));
          
          testResults.details.push({
            test: `${name} Processor`,
            status: 'passed',
            time: processorEndTime - processorStartTime,
            details: `SVG generated: ${svgResult.length} chars`
          });
        } else {
          testResults.failed++;
          console.log(chalk.yellow(`  ⚠️ ${name}: No SVG output (CLI tool may be needed)`));
          
          testResults.details.push({
            test: `${name} Processor`,
            status: 'warning',
            time: processorEndTime - processorStartTime,
            details: 'No SVG output - CLI tool needed'
          });
        }
      } catch (error) {
        testResults.failed++;
        console.log(chalk.red(`  ❌ ${name}: Error - ${error.message}`));
        
        testResults.details.push({
          test: `${name} Processor`,
          status: 'failed',
          error: error.message
        });
      }
    }

    // Test 2: Diagram Processor Integration
    console.log(chalk.yellow('\n🎯 Phase 2: Testing Diagram Processor Integration\n'));
    
    testResults.total++;
    try {
      const diagramProcessor = new NotionDiagramProcessor(null, null, {});
      
      // Test language detection
      const testLanguages = ['mermaid', 'plantuml', 'dot', 'graphviz', 'd2'];
      let supportedCount = 0;
      
      console.log(chalk.blue('Testing language detection:'));
      testLanguages.forEach(lang => {
        const isSupported = diagramProcessor.isDiagramLanguage(lang);
        if (isSupported) supportedCount++;
        console.log(chalk.gray(`  ${lang}: ${isSupported ? '✅' : '❌'}`));
      });
      
      // Test processor availability
      console.log(chalk.blue('\nTesting processor availability:'));
      const availability = await diagramProcessor.checkProcessorAvailability();
      let availableCount = 0;
      
      for (const [processor, available] of Object.entries(availability)) {
        if (available) availableCount++;
        console.log(chalk.gray(`  ${processor}: ${available ? '✅' : '❌'}`));
      }
      
      if (supportedCount === testLanguages.length) {
        testResults.passed++;
        console.log(chalk.green(`✅ Diagram processor integration: All ${supportedCount} languages supported`));
        
        testResults.details.push({
          test: 'Diagram Processor Integration',
          status: 'passed',
          details: `${supportedCount}/${testLanguages.length} languages supported, ${availableCount}/${Object.keys(availability).length} processors available`
        });
      } else {
        testResults.failed++;
        console.log(chalk.red(`❌ Diagram processor integration: Only ${supportedCount}/${testLanguages.length} languages supported`));
        
        testResults.details.push({
          test: 'Diagram Processor Integration',
          status: 'failed',
          details: `Only ${supportedCount}/${testLanguages.length} languages supported`
        });
      }
      
    } catch (error) {
      testResults.failed++;
      console.log(chalk.red(`❌ Diagram processor integration failed: ${error.message}`));
      
      testResults.details.push({
        test: 'Diagram Processor Integration',
        status: 'failed',
        error: error.message
      });
    }

    // Test 3: Basic Notion Conversion
    console.log(chalk.yellow('\n📝 Phase 3: Testing Basic Notion Conversion\n'));
    
    testResults.total++;
    try {
      console.log(chalk.blue('Running basic notion conversion test...'));
      await testNotionConversion();
      testResults.passed++;
      console.log(chalk.green('✅ Basic notion conversion test passed'));
      
      testResults.details.push({
        test: 'Basic Notion Conversion',
        status: 'passed',
        details: 'All basic conversion features working'
      });
    } catch (error) {
      testResults.failed++;
      console.log(chalk.red(`❌ Basic notion conversion test failed: ${error.message}`));
      
      testResults.details.push({
        test: 'Basic Notion Conversion',
        status: 'failed',
        error: error.message
      });
    }

    // Test 4: Diagram Conversion
    console.log(chalk.yellow('\n🎨 Phase 4: Testing Diagram Conversion\n'));
    
    testResults.total++;
    try {
      console.log(chalk.blue('Running diagram conversion test...'));
      await testDiagramConversion();
      testResults.passed++;
      console.log(chalk.green('✅ Diagram conversion test passed'));
      
      testResults.details.push({
        test: 'Diagram Conversion',
        status: 'passed',
        details: 'All diagram types processed successfully'
      });
    } catch (error) {
      testResults.failed++;
      console.log(chalk.red(`❌ Diagram conversion test failed: ${error.message}`));
      
      testResults.details.push({
        test: 'Diagram Conversion',
        status: 'failed',
        error: error.message
      });
    }

    // Test 5: Complete all.md Conversion
    console.log(chalk.yellow('\n📄 Phase 5: Testing Complete all.md Conversion\n'));
    
    testResults.total++;
    try {
      console.log(chalk.blue('Running complete all.md conversion test...'));
      await testAllMdConversion();
      testResults.passed++;
      console.log(chalk.green('✅ Complete all.md conversion test passed'));
      
      testResults.details.push({
        test: 'Complete all.md Conversion',
        status: 'passed',
        details: 'All markdown features including diagrams processed'
      });
    } catch (error) {
      testResults.failed++;
      console.log(chalk.red(`❌ Complete all.md conversion test failed: ${error.message}`));
      
      testResults.details.push({
        test: 'Complete all.md Conversion',
        status: 'failed',
        error: error.message
      });
    }

    // Test 6: Performance and Load Testing
    console.log(chalk.yellow('\n⚡ Phase 6: Performance and Load Testing\n'));
    
    testResults.total++;
    try {
      console.log(chalk.blue('Running performance tests...'));
      
      const performanceTests = [
        { name: 'Small Mermaid', content: 'graph TD\nA-->B', processor: new NotionMermaidProcessor() },
        { name: 'Medium PlantUML', content: '@startuml\n!define RECTANGLE class\nRECTANGLE A\nRECTANGLE B\nA -> B\n@enduml', processor: new NotionPlantUMLProcessor() },
        { name: 'Large Graphviz', content: 'digraph G {\nrankdir=TB;\nnode [shape=box];\nA -> B -> C -> D -> E -> F -> G -> H -> I -> J;\n}', processor: new NotionGraphvizProcessor() }
      ];
      
      let performancePassed = 0;
      const performanceResults = [];
      
      for (const { name, content, processor } of performanceTests) {
        const perfStart = Date.now();
        try {
          const result = await processor.generateSVGContent(content);
          const perfEnd = Date.now();
          const perfTime = perfEnd - perfStart;
          
          if (result && result.includes('<svg') && perfTime < 5000) { // 5 second limit
            performancePassed++;
            console.log(chalk.green(`  ✅ ${name}: ${perfTime}ms`));
          } else {
            console.log(chalk.yellow(`  ⚠️ ${name}: ${perfTime}ms (slow or no output)`));
          }
          
          performanceResults.push({ name, time: perfTime, success: result && result.includes('<svg') });
        } catch (error) {
          console.log(chalk.red(`  ❌ ${name}: Error`));
          performanceResults.push({ name, time: 0, success: false, error: error.message });
        }
      }
      
      if (performancePassed >= performanceTests.length * 0.6) { // 60% pass rate
        testResults.passed++;
        console.log(chalk.green(`✅ Performance test passed: ${performancePassed}/${performanceTests.length} tests passed`));
        
        testResults.details.push({
          test: 'Performance Testing',
          status: 'passed',
          details: `${performancePassed}/${performanceTests.length} performance tests passed`
        });
      } else {
        testResults.failed++;
        console.log(chalk.red(`❌ Performance test failed: Only ${performancePassed}/${performanceTests.length} tests passed`));
        
        testResults.details.push({
          test: 'Performance Testing',
          status: 'failed',
          details: `Only ${performancePassed}/${performanceTests.length} performance tests passed`
        });
      }
      
    } catch (error) {
      testResults.failed++;
      console.log(chalk.red(`❌ Performance testing failed: ${error.message}`));
      
      testResults.details.push({
        test: 'Performance Testing',
        status: 'failed',
        error: error.message
      });
    }

  } catch (error) {
    console.log(chalk.red(`❌ Integration test suite failed: ${error.message}`));
    console.error(error);
  }

  // Final Results
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const successRate = Math.round((testResults.passed / testResults.total) * 100);
  
  console.log(chalk.yellow('\n' + '='.repeat(60)));
  console.log(chalk.blue('📊 COMPREHENSIVE INTEGRATION TEST RESULTS'));
  console.log(chalk.yellow('='.repeat(60)));
  
  console.log(chalk.white(`\n📈 Summary:`));
  console.log(chalk.white(`  Total Tests: ${testResults.total}`));
  console.log(chalk.green(`  Passed: ${testResults.passed}`));
  console.log(chalk.red(`  Failed: ${testResults.failed}`));
  console.log(chalk.blue(`  Success Rate: ${successRate}%`));
  console.log(chalk.gray(`  Total Time: ${totalTime}ms`));
  
  console.log(chalk.cyan('\n🔍 Detailed Results:'));
  testResults.details.forEach((detail, index) => {
    const statusIcon = detail.status === 'passed' ? chalk.green('✅') : 
                      detail.status === 'warning' ? chalk.yellow('⚠️') : chalk.red('❌');
    
    console.log(`${statusIcon} ${index + 1}. ${detail.test}`);
    
    if (detail.details) {
      console.log(chalk.gray(`     ${detail.details}`));
    }
    
    if (detail.time) {
      console.log(chalk.gray(`     Time: ${detail.time}ms`));
    }
    
    if (detail.error) {
      console.log(chalk.red(`     Error: ${detail.error}`));
    }
  });
  
  // Quality Assessment
  console.log(chalk.cyan('\n🏆 Quality Assessment:'));
  
  const qualityMetrics = {
    'Individual Processors': testResults.details.slice(0, 4).filter(d => d.status === 'passed').length / 4,
    'Integration': testResults.details.find(d => d.test === 'Diagram Processor Integration')?.status === 'passed' ? 1 : 0,
    'Basic Conversion': testResults.details.find(d => d.test === 'Basic Notion Conversion')?.status === 'passed' ? 1 : 0,
    'Diagram Conversion': testResults.details.find(d => d.test === 'Diagram Conversion')?.status === 'passed' ? 1 : 0,
    'Complete Conversion': testResults.details.find(d => d.test === 'Complete all.md Conversion')?.status === 'passed' ? 1 : 0,
    'Performance': testResults.details.find(d => d.test === 'Performance Testing')?.status === 'passed' ? 1 : 0
  };
  
  Object.entries(qualityMetrics).forEach(([metric, score]) => {
    const percentage = Math.round(score * 100);
    const color = percentage >= 80 ? chalk.green : percentage >= 60 ? chalk.yellow : chalk.red;
    console.log(color(`  ${metric}: ${percentage}%`));
  });
  
  // Overall Assessment
  console.log(chalk.cyan('\n🎯 Overall Assessment:'));
  
  if (successRate >= 90) {
    console.log(chalk.green('🎉 EXCELLENT: NEW Notion processors are working excellently!'));
    console.log(chalk.green('🚀 System is fully ready for production Notion API integration!'));
  } else if (successRate >= 75) {
    console.log(chalk.yellow('✅ GOOD: NEW Notion processors are working well with minor issues.'));
    console.log(chalk.yellow('🔧 System is mostly ready for Notion API integration.'));
  } else if (successRate >= 50) {
    console.log(chalk.yellow('⚠️ FAIR: NEW Notion processors have some issues that need attention.'));
    console.log(chalk.yellow('🛠️ System needs improvements before production use.'));
  } else {
    console.log(chalk.red('❌ POOR: NEW Notion processors have significant issues.'));
    console.log(chalk.red('🚨 System needs major improvements before Notion API integration.'));
  }
  
  // Recommendations
  console.log(chalk.cyan('\n💡 Recommendations:'));
  
  const recommendations = [];
  
  if (testResults.details.some(d => d.details && d.details.includes('CLI tool needed'))) {
    recommendations.push('Install CLI tools (plantuml, graphviz, d2) for full diagram support');
  }
  
  if (testResults.details.some(d => d.status === 'failed')) {
    recommendations.push('Fix failed tests before production deployment');
  }
  
  if (successRate < 90) {
    recommendations.push('Improve error handling and fallback mechanisms');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System is ready for production use!');
  }
  
  recommendations.forEach(rec => {
    console.log(chalk.gray(`  • ${rec}`));
  });
  
  console.log(chalk.yellow('\n' + '='.repeat(60)));
  console.log(chalk.blue('🏁 INTEGRATION TEST COMPLETE'));
  console.log(chalk.yellow('='.repeat(60) + '\n'));
  
  return {
    success: successRate >= 75,
    successRate,
    totalTests: testResults.total,
    passedTests: testResults.passed,
    failedTests: testResults.failed,
    totalTime,
    details: testResults.details
  };
}

// Export for use in other files
module.exports = testNotionIntegration;

// Run if called directly
if (require.main === module) {
  testNotionIntegration()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red('Fatal error:'), error);
      process.exit(1);
    });
} 