const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

class NotionPlantUMLProcessor {
  constructor(notionClient, tempDir = '.docflu/temp/notion-plantuml') {
    this.notionClient = notionClient;
    this.tempDir = tempDir;
    this.processedDiagrams = new Map(); // Cache processed diagrams
    
    // Ensure temp directory exists
    fs.ensureDirSync(this.tempDir);
  }

  /**
   * Extract PlantUML diagrams from markdown content
   * @param {string} markdownContent - Raw markdown content
   * @returns {Array} - Array of PlantUML diagram objects
   */
  extractPlantUMLDiagrams(markdownContent) {
    const diagrams = [];
    const plantumlRegex = /```plantuml\n([\s\S]*?)\n```/g;
    
    let match;
    while ((match = plantumlRegex.exec(markdownContent)) !== null) {
      const [fullMatch, diagramCode] = match;
      
      const diagram = {
        fullMatch,
        code: diagramCode.trim(),
        index: match.index,
        id: this.generateDiagramId(diagramCode)
      };

      diagrams.push(diagram);
    }

    return diagrams;
  }

  /**
   * Generate unique ID for diagram based on content
   */
  generateDiagramId(code) {
    const hash = require('crypto').createHash('md5').update(code).digest('hex');
    return `plantuml-${hash.substring(0, 8)}`;
  }

  /**
   * Check PlantUML availability using Google Docs approach
   * @returns {boolean} PlantUML availability
   */
  async checkPlantUMLCLI() {
    try {
      // Try to load plantuml-encoder package (preferred method)
      require('plantuml-encoder');
      return true;
    } catch (error) {
      // Fallback: check if Java + PlantUML jar is available
      try {
        execSync('java -version', { stdio: 'ignore' });
        const plantUMLPath = path.join(process.env.HOME || process.env.USERPROFILE, 'plantuml.jar');
        return await fs.pathExists(plantUMLPath);
      } catch (javaError) {
        return false;
      }
    }
  }

  /**
   * Install PlantUML using Google Docs approach
   */
  async installPlantUMLCLI() {
    console.log(chalk.blue('📦 Setting up PlantUML for Notion...'));
    try {
      // Try to use plantuml-encoder package (preferred)
      try {
        require('plantuml-encoder');
        console.log(chalk.green('✅ PlantUML encoder package available'));
        return true;
      } catch (nodeError) {
        console.log(chalk.yellow('⚠️ plantuml-encoder package not found, trying alternative...'));
        
        // Fallback: try to install plantuml-encoder
        try {
          console.log(chalk.blue('📦 Installing plantuml-encoder package...'));
          execSync('npm install plantuml-encoder', { stdio: 'inherit', cwd: process.cwd() });
          console.log(chalk.green('✅ plantuml-encoder installed successfully'));
          return true;
        } catch (installError) {
          console.log(chalk.yellow('⚠️ Failed to install plantuml-encoder, checking Java fallback...'));
          
          // Final fallback: Java + PlantUML jar
          try {
            execSync('java -version', { stdio: 'ignore' });
            const plantUMLPath = path.join(process.env.HOME || process.env.USERPROFILE, 'plantuml.jar');
            
            if (await fs.pathExists(plantUMLPath)) {
              console.log(chalk.green('✅ PlantUML Java fallback available'));
              return true;
            } else {
              console.log(chalk.yellow('⚠️ PlantUML jar not found. PlantUML diagrams will be skipped.'));
              console.log(chalk.gray('   To enable PlantUML: npm install plantuml-encoder'));
              return false;
            }
          } catch (javaError) {
            console.log(chalk.yellow('⚠️ Neither Node.js nor Java PlantUML available. Skipping PlantUML support.'));
            return false;
          }
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to setup PlantUML:', error.message));
      return false;
    }
  }

  /**
   * Generate SVG content directly (main method for NotionDiagramProcessor)
   * @param {string} diagramCode - PlantUML diagram code
   * @returns {string} SVG content
   */
  async generateSVGContent(diagramCode) {
    // Ensure temp directory exists
    await fs.ensureDir(this.tempDir);
    
    const diagramId = this.generateDiagramId(diagramCode);

    try {
      console.log(chalk.blue(`📊 Generating PlantUML diagram for Notion: ${diagramId}...`));
      
      // Try plantuml-encoder package first (preferred method - same as Google Docs)
      try {
        const plantumlEncoder = require('plantuml-encoder');
        const axios = require('axios');
        
        // Encode PlantUML diagram
        const encoded = plantumlEncoder.encode(diagramCode);
        
        // Generate SVG using PlantUML server (SVG instead of PNG)
        const plantUMLServerUrl = `http://www.plantuml.com/plantuml/svg/${encoded}`;
        
        console.log(chalk.blue(`📊 Downloading PlantUML SVG from server...`));
        
        const response = await axios({
          method: 'GET',
          url: plantUMLServerUrl,
          timeout: 30000,
          headers: {
            'User-Agent': 'docflu-plantuml-notion-client/1.0'
          }
        });
        
        if (response.status !== 200) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const svgContent = response.data;
        if (!svgContent || svgContent.length === 0) {
          throw new Error('Empty SVG content received from server');
        }
        
        // Validate SVG content
        if (!svgContent.includes('<svg') || !svgContent.includes('</svg>')) {
          throw new Error('Invalid SVG content received from server');
        }
        
        console.log(chalk.green(`✅ Generated PlantUML SVG for Notion: ${diagramId}.svg (${svgContent.length} chars, Server)`));
        return svgContent;
        
      } catch (nodeError) {
        console.log(chalk.yellow(`⚠️ PlantUML server method failed, trying Java fallback...`));
        
        // Fallback to Java + PlantUML jar (same as Google Docs approach)
        const inputFile = path.join(this.tempDir, `${diagramId}.puml`);
        const outputFile = path.join(this.tempDir, `${diagramId}.svg`);
        const plantUMLPath = path.join(process.env.HOME || process.env.USERPROFILE, 'plantuml.jar');
        
        try {
          // Check Java and jar availability
          execSync('java -version', { stdio: 'ignore' });
          
          if (!(await fs.pathExists(plantUMLPath))) {
            throw new Error('PlantUML jar not found');
          }
          
          // Write PlantUML content to file
          await fs.writeFile(inputFile, diagramCode);

          // Generate SVG using Java PlantUML (SVG instead of PNG)
          const command = `java -jar "${plantUMLPath}" -tsvg "${inputFile}"`;
          execSync(command, { stdio: 'pipe' });

          if (await fs.pathExists(outputFile)) {
            // Read SVG content
            const svgContent = await fs.readFile(outputFile, 'utf8');
            console.log(chalk.green(`✅ Generated PlantUML SVG for Notion: ${diagramId}.svg (${svgContent.length} chars, Java)`));
            return svgContent;
          } else {
            throw new Error('SVG file was not generated');
          }
          
        } catch (javaError) {
          throw new Error(`Both server and Java methods failed: ${nodeError.message}, ${javaError.message}`);
        } finally {
          // Clean up temp files
          try {
            if (await fs.pathExists(inputFile)) await fs.remove(inputFile);
            if (await fs.pathExists(outputFile)) await fs.remove(outputFile);
          } catch (cleanupError) {
            console.warn(chalk.gray(`⚠️ Cleanup warning: ${cleanupError.message}`));
          }
        }
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error generating PlantUML diagram ${diagramId}:`, error.message));
      throw new Error(`PlantUML SVG generation failed: ${error.message}`);
    }
  }

  /**
   * Generate SVG file (legacy method for backward compatibility)
   * @param {Object} diagram - Diagram object with code and id
   * @returns {string} - Path to generated SVG file
   */
  async generatePlantUMLImage(diagram) {
    try {
      const svgContent = await this.generateSVGContent(diagram.code);
      const outputFile = path.join(this.tempDir, `${diagram.id}.svg`);
      await fs.writeFile(outputFile, svgContent, 'utf8');
      return outputFile;
    } catch (error) {
      console.error(chalk.red(`❌ Error generating PlantUML image ${diagram.id}:`, error.message));
      return null;
    }
  }

  /**
   * Process all PlantUML diagrams for Notion
   * @param {string} markdownContent - Original markdown content
   * @returns {Object} - {processedContent, stats}
   */
  async processPlantUMLDiagrams(markdownContent) {
    // Extract PlantUML diagrams
    const diagrams = this.extractPlantUMLDiagrams(markdownContent);
    
    if (diagrams.length === 0) {
      return {
        processedContent: markdownContent,
        stats: { total: 0, processed: 0, failed: 0 }
      };
    }

    console.log(chalk.blue(`🎨 Found ${diagrams.length} PlantUML diagram(s) to process for Notion`));

    // Check if PlantUML is available
    const hasPlantUMLCLI = await this.checkPlantUMLCLI();
    if (!hasPlantUMLCLI) {
      console.log(chalk.yellow('⚠️ PlantUML not found. Attempting to install...'));
      const installed = await this.installPlantUMLCLI();
      if (!installed) {
        console.log(chalk.red('❌ Cannot process PlantUML diagrams without setup. Skipping...'));
        return {
          processedContent: markdownContent,
          stats: { total: diagrams.length, processed: 0, failed: diagrams.length }
        };
      }
    }

    const diagramMap = new Map();
    let processedCount = 0;
    let failedCount = 0;

    // Process each diagram
    for (const diagram of diagrams) {
      try {
        // Generate SVG
        const svgContent = await this.generateSVGContent(diagram.code);
        if (svgContent) {
          diagramMap.set(diagram.id, {
            svgContent,
            originalCode: diagram.code,
            type: 'plantuml'
          });
          processedCount++;
        } else {
          failedCount++;
        }

      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Error processing PlantUML diagram ${diagram.id}: ${error.message}`));
        failedCount++;
      }
    }

    const stats = {
      total: diagrams.length,
      processed: processedCount,
      failed: failedCount
    };

    if (processedCount > 0) {
      console.log(chalk.green(`🎨 Processed ${processedCount}/${diagrams.length} PlantUML diagrams for Notion`));
    }

    return { processedContent: markdownContent, stats, diagramMap };
  }

  /**
   * Clean up temp directory
   */
  async cleanup() {
    try {
      if (await fs.pathExists(this.tempDir)) {
        await fs.remove(this.tempDir);
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to cleanup temp directory: ${error.message}`));
    }
  }
}

module.exports = NotionPlantUMLProcessor; 