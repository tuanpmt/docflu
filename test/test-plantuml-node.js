const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

async function testPlantUMLNode() {
  console.log(chalk.blue('🧪 Testing PlantUML with node-plantuml...'));
  
  try {
    // Try to require plantuml-encoder
    const plantumlEncoder = require('plantuml-encoder');
    const axios = require('axios');
    console.log(chalk.green('✅ plantuml-encoder package loaded successfully'));
    
    // Simple PlantUML diagram code
    const diagramCode = `@startuml
Alice -> Bob: Hello
Bob -> Alice: Hi there
@enduml`;
    
    console.log(chalk.blue('📊 Generating test PlantUML diagram...'));
    
    // Encode PlantUML diagram
    const encoded = plantumlEncoder.encode(diagramCode);
    console.log(chalk.gray(`🔗 Encoded: ${encoded.substring(0, 50)}...`));
    
    // Generate PNG using PlantUML server
    const plantUMLServerUrl = `http://www.plantuml.com/plantuml/png/${encoded}`;
    console.log(chalk.gray(`🌐 URL: ${plantUMLServerUrl}`));
    
    console.log(chalk.blue(`📊 Downloading PlantUML diagram from server...`));
    
    const response = await axios({
      method: 'GET',
      url: plantUMLServerUrl,
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'docflu-plantuml-client/1.0'
      }
    });
    
    console.log(chalk.gray(`📡 Response status: ${response.status}`));
    console.log(chalk.gray(`📦 Response size: ${response.data.byteLength} bytes`));
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const pngBuffer = Buffer.from(response.data);
    console.log(chalk.gray(`💾 Buffer size: ${pngBuffer.length} bytes`));
    
    if (pngBuffer.length === 0) {
      throw new Error('Empty PNG buffer received from server');
    }
    
    const outputFile = path.join(__dirname, 'test-plantuml-output.png');
    await fs.writeFile(outputFile, pngBuffer);
    
    if (await fs.pathExists(outputFile)) {
      const stats = await fs.stat(outputFile);
      console.log(chalk.green(`✅ PlantUML diagram generated successfully!`));
      console.log(chalk.gray(`   File: ${outputFile}`));
      console.log(chalk.gray(`   Size: ${stats.size} bytes`));
      
      if (stats.size === 0) {
        throw new Error('Generated PNG file is empty');
      }
      
      // Clean up test file
      await fs.remove(outputFile);
      console.log(chalk.gray('🧹 Test file cleaned up'));
      
      return true;
    } else {
      throw new Error('PNG file was not generated');
    }
    
  } catch (error) {
    console.error(chalk.red('❌ PlantUML test failed:'), error.message);
    
    if (error.message.includes("Cannot find module 'plantuml-encoder'")) {
      console.log(chalk.yellow('💡 Try running: npm install plantuml-encoder'));
    }
    
    return false;
  }
}

// Run test
testPlantUMLNode()
  .then(success => {
    if (success) {
      console.log(chalk.green('\n🎉 PlantUML Node.js test completed successfully!'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n❌ PlantUML Node.js test failed!'));
      process.exit(1);
    }
  })
  .catch(error => {
    console.error(chalk.red('\n💥 Test error:'), error);
    process.exit(1);
  }); 