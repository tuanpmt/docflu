const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

class GDocsDiagramProcessor {
  constructor(googleDriveClient, tempDir = '.docusaurus/temp') {
    this.googleDriveClient = googleDriveClient;
    this.tempDir = tempDir;
    this.processedDiagrams = new Map(); // Cache processed diagrams
    
    // Ensure temp directory exists
    fs.ensureDirSync(this.tempDir);

    // Supported diagram types with their configurations
    // Note: Using PNG instead of SVG for Google Docs compatibility
    this.diagramTypes = {
      mermaid: {
        regex: /```mermaid\n([\s\S]*?)\n```/g,
        generator: this.generateMermaidImage.bind(this),
        checker: this.checkMermaidCLI.bind(this),
        installer: this.installMermaidCLI.bind(this),
        extension: 'png',
        contentType: 'image/png'
      },
      plantuml: {
        regex: /```plantuml\n([\s\S]*?)\n```/g,
        generator: this.generatePlantUMLImage.bind(this),
        checker: this.checkPlantUMLCLI.bind(this),
        installer: this.installPlantUMLCLI.bind(this),
        extension: 'png',
        contentType: 'image/png'
      },
      graphviz: {
        regex: /```(?:dot|graphviz)\n([\s\S]*?)\n```/g,
        generator: this.generateGraphvizImage.bind(this),
        checker: this.checkGraphvizCLI.bind(this),
        installer: this.installGraphvizCLI.bind(this),
        extension: 'png',
        contentType: 'image/png'
      },
      d2: {
        regex: /```d2\n([\s\S]*?)\n```/g,
        generator: this.generateD2Image.bind(this),
        checker: this.checkD2CLI.bind(this),
        installer: this.installD2CLI.bind(this),
        extension: 'png',
        contentType: 'image/png'
      }
    };
  }

  /**
   * Extract all types of diagrams from markdown content
   * @param {string} markdownContent - Raw markdown content
   * @returns {Array} - Array of diagram objects with type info
   */
  extractAllDiagrams(markdownContent) {
    const allDiagrams = [];
    
    for (const [type, config] of Object.entries(this.diagramTypes)) {
      const diagrams = this.extractDiagramsByType(markdownContent, type, config);
      allDiagrams.push(...diagrams);
    }

    // Sort by index to maintain order
    return allDiagrams.sort((a, b) => a.index - b.index);
  }

  /**
   * Extract diagrams of a specific type
   */
  extractDiagramsByType(markdownContent, type, config) {
    const diagrams = [];
    const regex = new RegExp(config.regex.source, config.regex.flags);
    
    let match;
    while ((match = regex.exec(markdownContent)) !== null) {
      const [fullMatch, diagramCode] = match;
      
      // Validate diagram content before processing
      if (!diagramCode || diagramCode.trim().length === 0) {
        console.warn(chalk.yellow(`⚠️ Empty ${type} diagram found, skipping...`));
        continue;
      }
      
      const diagram = {
        type,
        fullMatch,
        code: diagramCode.trim(),
        index: match.index,
        id: this.generateDiagramId(type, diagramCode),
        config
      };

      diagrams.push(diagram);
    }

    return diagrams;
  }

  /**
   * Generate unique ID for diagram based on type and content
   */
  generateDiagramId(type, code) {
    const hash = require('crypto').createHash('md5').update(code).digest('hex');
    return `${type}-${hash.substring(0, 8)}`;
  }

  // ===========================================
  // MERMAID SUPPORT
  // ===========================================
  
  async checkMermaidCLI() {
    try {
      execSync('mmdc --version', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async installMermaidCLI() {
    console.log(chalk.blue('📦 Installing Mermaid CLI...'));
    try {
      execSync('npm install -g @mermaid-js/mermaid-cli', { stdio: 'inherit' });
      console.log(chalk.green('✅ Mermaid CLI installed successfully'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to install Mermaid CLI:', error.message));
      return false;
    }
  }

  async generateMermaidImage(diagram) {
    const inputFile = path.join(this.tempDir, `${diagram.id}.mmd`);
    const outputFile = path.join(this.tempDir, `${diagram.id}.png`);
    const configFile = path.join(this.tempDir, `${diagram.id}-config.json`);

    try {
      // Create high-quality Mermaid config optimized for Google Docs compatibility
      const mermaidConfig = {
        "theme": "default",
        "securityLevel": "strict",
        "themeVariables": {
          // Explicit white background for Google Docs
          "primaryColor": "#ffffff",
          "primaryTextColor": "#000000",
          "primaryBorderColor": "#333333",
          "lineColor": "#333333",
          "secondaryColor": "#f8f9fa",
          "tertiaryColor": "#ffffff",
          "background": "#ffffff",
          "mainBkg": "#ffffff",
          "secondBkg": "#f8f9fa",
          "tertiaryBkg": "#ffffff",
          
          // Font settings for maximum visibility
          "fontFamily": "Arial, Helvetica, sans-serif",
          "fontSize": "14px",
          "fontWeight": "bold",
          
          // Node specific colors
          "nodeBkg": "#ffffff",
          "nodeTextColor": "#000000",
          "nodeBorder": "#333333",
          
          // Flowchart specific
          "clusterBkg": "#f8f9fa",
          "clusterTextColor": "#000000",
          "edgeLabelBackground": "#ffffff",
          "activeTaskBkgColor": "#ffffff",
          "activeTaskBorderColor": "#333333",
          
          // Sequence diagram
          "actorBkg": "#ffffff",
          "actorTextColor": "#000000",
          "actorLineColor": "#333333",
          "signalColor": "#333333",
          "signalTextColor": "#000000",
          "labelBoxBkgColor": "#ffffff",
          "labelBoxBorderColor": "#333333",
          "labelTextColor": "#000000",
          "loopTextColor": "#000000",
          "noteBkgColor": "#fff3cd",
          "noteTextColor": "#000000",
          "noteBorderColor": "#ffc107",
          
          // Class diagram
          "classText": "#000000",
          "classTitleColor": "#000000",
          "c0": "#ffffff",
          "c1": "#f8f9fa",
          "c2": "#e9ecef",
          "c3": "#dee2e6"
        },
        "flowchart": {
          "curve": "linear",
          "htmlLabels": false,
          "useMaxWidth": false,
          "diagramPadding": 20,
          "nodeSpacing": 50,
          "rankSpacing": 60
        },
        "sequence": {
          "diagramMarginX": 50,
          "diagramMarginY": 20,
          "actorMargin": 50,
          "width": 150,
          "height": 65,
          "boxMargin": 10,
          "boxTextMargin": 5,
          "noteMargin": 10,
          "messageMargin": 35,
          "mirrorActors": false,
          "bottomMarginAdj": 1,
          "useMaxWidth": false,
          "rightAngles": false,
          "showSequenceNumbers": false
        },
        "gantt": {
          "titleTopMargin": 25,
          "barHeight": 20,
          "barGap": 4,
          "topPadding": 50,
          "leftPadding": 75,
          "gridLineStartPadding": 35,
          "fontSize": 11,
          "fontFamily": "Arial, sans-serif",
          "sectionFontSize": 24,
          "numberSectionStyles": 4
        }
      };

      // Write diagram content to file
      await fs.writeFile(inputFile, diagram.code);
      
      // Write config to file
      await fs.writeFile(configFile, JSON.stringify(mermaidConfig, null, 2));

      // Generate SVG with high quality settings for Google Docs
      const command = `mmdc -i "${inputFile}" -o "${outputFile}" -c "${configFile}" --backgroundColor white --width 1200 --height 900 --scale 1`;
      
      console.log(chalk.blue(`📊 Generating Mermaid diagram: ${diagram.id}...`));
      
      try {
        execSync(command, { stdio: 'pipe' });
        
        if (await fs.pathExists(outputFile)) {
          console.log(chalk.green(`✅ Generated high-quality Mermaid diagram: ${diagram.id}.png`));
          return outputFile;
        } else {
          throw new Error('PNG file was not generated');
        }
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Failed to generate Mermaid diagram ${diagram.id}: ${error.message}`));
        
        // Try fallback generation with basic settings
        console.log(chalk.gray('Attempting fallback generation with basic settings...'));
        const fallbackCommand = `mmdc -i "${inputFile}" -o "${outputFile}" --backgroundColor white --width 800 --height 600`;
        
        try {
          execSync(fallbackCommand, { stdio: 'pipe' });
          
          if (await fs.pathExists(outputFile)) {
            console.log(chalk.yellow(`⚠️ Generated Mermaid diagram with fallback settings: ${diagram.id}.png`));
            return outputFile;
          }
        } catch (fallbackError) {
          console.error(chalk.red(`⚠️ Fallback generation also failed: ${fallbackError.message}`));
        }
        
        return null;
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error generating Mermaid diagram ${diagram.id}:`, error.message));
      return null;
    } finally {
      // Clean up temp files
      try {
        if (await fs.pathExists(inputFile)) await fs.remove(inputFile);
        if (await fs.pathExists(configFile)) await fs.remove(configFile);
      } catch (cleanupError) {
        console.warn(chalk.gray(`⚠️ Cleanup warning: ${cleanupError.message}`));
      }
    }
  }

  /**
   * Optimize SVG for Google Docs compatibility
   * Note: This method is deprecated since we now use PNG format for Google Docs compatibility
   */
  async optimizeSVGForGoogleDocs(svgPath) {
    // This method is no longer used since we switched to PNG format
    // Kept for potential future use or backward compatibility
    console.warn(chalk.yellow('⚠️ SVG optimization is deprecated - using PNG format instead'));
  }

  // ===========================================
  // PLANTUML SUPPORT
  // ===========================================
  
  async checkPlantUMLCLI() {
    try {
      // Check if Java is available
      execSync('java -version', { stdio: 'ignore' });
      
      // Check if PlantUML jar exists
      const plantUMLPath = path.join(process.env.HOME || process.env.USERPROFILE, 'plantuml.jar');
      return await fs.pathExists(plantUMLPath);
    } catch (error) {
      return false;
    }
  }

  async installPlantUMLCLI() {
    console.log(chalk.blue('📦 Installing PlantUML...'));
    try {
      const plantUMLPath = path.join(process.env.HOME || process.env.USERPROFILE, 'plantuml.jar');
      
      if (!(await fs.pathExists(plantUMLPath))) {
        console.log(chalk.blue('📥 Downloading PlantUML jar...'));
        // Note: In a real implementation, you'd download the jar file here
        console.log(chalk.yellow('⚠️ Please download plantuml.jar manually and place it in your home directory'));
        return false;
      }
      
      console.log(chalk.green('✅ PlantUML is available'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to setup PlantUML:', error.message));
      return false;
    }
  }

  async generatePlantUMLImage(diagram) {
    const inputFile = path.join(this.tempDir, `${diagram.id}.puml`);
    const outputFile = path.join(this.tempDir, `${diagram.id}.png`);
    const plantUMLPath = path.join(process.env.HOME || process.env.USERPROFILE, 'plantuml.jar');

    try {
      // Write PlantUML content to file
      await fs.writeFile(inputFile, diagram.code);

      // Generate PNG using PlantUML
      const command = `java -jar "${plantUMLPath}" -tpng "${inputFile}"`;
      
      console.log(chalk.blue(`📊 Generating PlantUML diagram: ${diagram.id}...`));
      execSync(command, { stdio: 'pipe' });

      if (await fs.pathExists(outputFile)) {
        console.log(chalk.green(`✅ Generated PlantUML diagram: ${diagram.id}.png`));
        return outputFile;
      } else {
        throw new Error('PNG file was not generated');
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error generating PlantUML diagram ${diagram.id}:`, error.message));
      return null;
    } finally {
      // Clean up temp files
      try {
        if (await fs.pathExists(inputFile)) await fs.remove(inputFile);
      } catch (cleanupError) {
        console.warn(chalk.gray(`⚠️ Cleanup warning: ${cleanupError.message}`));
      }
    }
  }

  // ===========================================
  // GRAPHVIZ SUPPORT
  // ===========================================
  
  async checkGraphvizCLI() {
    try {
      execSync('dot -V', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async installGraphvizCLI() {
    console.log(chalk.blue('📦 Installing Graphviz...'));
    try {
      // Platform-specific installation
      const platform = process.platform;
      
      if (platform === 'darwin') {
        execSync('brew install graphviz', { stdio: 'inherit' });
      } else if (platform === 'linux') {
        execSync('sudo apt-get install -y graphviz', { stdio: 'inherit' });
      } else if (platform === 'win32') {
        console.log(chalk.yellow('⚠️ Please install Graphviz manually on Windows from https://graphviz.org/download/'));
        return false;
      }
      
      console.log(chalk.green('✅ Graphviz installed successfully'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to install Graphviz:', error.message));
      return false;
    }
  }

  async generateGraphvizImage(diagram) {
    const inputFile = path.join(this.tempDir, `${diagram.id}.dot`);
    const outputFile = path.join(this.tempDir, `${diagram.id}.png`);

    try {
      // Write Graphviz content to file
      await fs.writeFile(inputFile, diagram.code);

      // Generate PNG using Graphviz
      const command = `dot -Tpng "${inputFile}" -o "${outputFile}"`;
      
      console.log(chalk.blue(`📊 Generating Graphviz diagram: ${diagram.id}...`));
      execSync(command, { stdio: 'pipe' });

      if (await fs.pathExists(outputFile)) {
        console.log(chalk.green(`✅ Generated Graphviz diagram: ${diagram.id}.png`));
        return outputFile;
      } else {
        throw new Error('PNG file was not generated');
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error generating Graphviz diagram ${diagram.id}:`, error.message));
      return null;
    } finally {
      // Clean up temp files
      try {
        if (await fs.pathExists(inputFile)) await fs.remove(inputFile);
      } catch (cleanupError) {
        console.warn(chalk.gray(`⚠️ Cleanup warning: ${cleanupError.message}`));
      }
    }
  }

  // ===========================================
  // D2 SUPPORT
  // ===========================================
  
  async checkD2CLI() {
    try {
      execSync('d2 --version', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async installD2CLI() {
    console.log(chalk.blue('📦 Installing D2...'));
    try {
      // Platform-specific installation
      const platform = process.platform;
      
      if (platform === 'darwin') {
        execSync('brew install d2', { stdio: 'inherit' });
      } else if (platform === 'linux') {
        execSync('curl -fsSL https://d2lang.com/install.sh | sh -s --', { stdio: 'inherit' });
      } else if (platform === 'win32') {
        console.log(chalk.yellow('⚠️ Please install D2 manually on Windows from https://d2lang.com/tour/install'));
        return false;
      }
      
      console.log(chalk.green('✅ D2 installed successfully'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to install D2:', error.message));
      return false;
    }
  }

  async generateD2Image(diagram) {
    const inputFile = path.join(this.tempDir, `${diagram.id}.d2`);
    const outputFile = path.join(this.tempDir, `${diagram.id}.png`);

    try {
      // Validate and fix D2 syntax
      const validatedCode = this.validateAndFixD2Syntax(diagram.code);
      
      // Write D2 content to file
      await fs.writeFile(inputFile, validatedCode);

      // Generate PNG using D2
      const command = `d2 "${inputFile}" "${outputFile}" --theme=0 --dark-theme=0 --layout=dagre --pad=20`;
      
      console.log(chalk.blue(`📊 Generating D2 diagram: ${diagram.id}...`));
      execSync(command, { stdio: 'pipe' });

      if (await fs.pathExists(outputFile)) {
        console.log(chalk.green(`✅ Generated D2 diagram: ${diagram.id}.png`));
        return outputFile;
      } else {
        throw new Error('PNG file was not generated');
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error generating D2 diagram ${diagram.id}:`, error.message));
      return null;
    } finally {
      // Clean up temp files
      try {
        if (await fs.pathExists(inputFile)) await fs.remove(inputFile);
      } catch (cleanupError) {
        console.warn(chalk.gray(`⚠️ Cleanup warning: ${cleanupError.message}`));
      }
    }
  }

  /**
   * Optimize D2 SVG for Google Docs compatibility
   * Note: This method is deprecated since we now use PNG format for Google Docs compatibility
   */
  async optimizeD2SVGForGoogleDocs(svgPath) {
    // This method is no longer used since we switched to PNG format
    // Kept for potential future use or backward compatibility
    console.warn(chalk.yellow('⚠️ D2 SVG optimization is deprecated - using PNG format instead'));
  }

  /**
   * Validate and fix common D2 syntax issues
   */
  validateAndFixD2Syntax(diagramCode) {
    let fixedCode = diagramCode;
    
    // Fix common D2 syntax issues
    fixedCode = fixedCode
      // Ensure proper connection syntax
      .replace(/-->/g, '->')
      .replace(/\s*->\s*/g, ' -> ')
      // Fix label syntax
      .replace(/:\s*([^{}\n]+)(?=\s*\{)/g, ': $1')
      // Ensure proper shape syntax
      .replace(/\.shape\s*=\s*([^\s\n]+)/g, '.shape: $1')
      // Fix style syntax
      .replace(/\.style\s*=\s*([^\s\n]+)/g, '.style: $1');

    return fixedCode;
  }

  /**
   * Upload diagram image to Google Drive
   * @param {string} imagePath - Path to generated diagram image
   * @param {Object} diagram - Diagram object with metadata
   * @returns {Object} - Upload result with Google Drive URL
   */
  async uploadDiagramImage(imagePath, diagram) {
    try {
      console.log(chalk.blue(`📤 Uploading ${diagram.type} diagram: ${path.basename(imagePath)}`));
      
      // Upload to Google Drive
      const uploadResult = await this.googleDriveClient.uploadImage(imagePath);
      
      console.log(chalk.green(`✅ Uploaded ${diagram.type} diagram: ${uploadResult.fileName} (${uploadResult.cached ? 'cached' : 'new'})`));
      
      return {
        ...uploadResult,
        diagramType: diagram.type,
        diagramId: diagram.id,
        originalContent: diagram.fullMatch
      };
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to upload ${diagram.type} diagram ${path.basename(imagePath)}: ${error.message}`));
      throw error;
    }
  }

  /**
   * Process all diagrams and upload to Google Drive
   * @param {string} markdownContent - Raw markdown content
   * @returns {Object} - { processedMarkdown, diagramMap, stats }
   */
  async processAllDiagrams(markdownContent) {
    const stats = {
      diagramsFound: 0,
      diagramsProcessed: 0,
      diagramsUploaded: 0,
      diagramsSkipped: 0,
      errors: []
    };

    try {
      // Extract all diagrams
      const allDiagrams = this.extractAllDiagrams(markdownContent);
      stats.diagramsFound = allDiagrams.length;

      if (allDiagrams.length === 0) {
        return {
          processedMarkdown: markdownContent,
          diagramMap: new Map(),
          stats
        };
      }

      console.log(chalk.blue(`📊 Processing ${allDiagrams.length} diagram(s)...`));

      const diagramMap = new Map();
      let processedMarkdown = markdownContent;

      // Process each diagram
      for (const diagram of allDiagrams) {
        try {
          // Check if CLI tool is available
          const isToolAvailable = await diagram.config.checker();
          if (!isToolAvailable) {
            console.warn(chalk.yellow(`⚠️ ${diagram.type} CLI not available, keeping original text for: ${diagram.id}`));
            stats.diagramsSkipped++;
            stats.errors.push(`${diagram.type} CLI not available for diagram: ${diagram.id}`);
            continue; // Keep original diagram text
          }

          // Generate diagram image
          const imagePath = await diagram.config.generator(diagram);
          
          if (imagePath && await fs.pathExists(imagePath)) {
            // Upload to Google Drive
            const uploadResult = await this.uploadDiagramImage(imagePath, diagram);
            
            // Store mapping for replacement
            diagramMap.set(diagram.fullMatch, {
              url: uploadResult.url,
              alt: `${diagram.type.charAt(0).toUpperCase() + diagram.type.slice(1)} Diagram`,
              type: diagram.type,
              id: diagram.id
            });

            stats.diagramsProcessed++;
            stats.diagramsUploaded++;

            // Clean up temp file
            await fs.remove(imagePath);
            
          } else {
            console.warn(chalk.yellow(`⚠️ Failed to generate ${diagram.type} diagram, keeping original text: ${diagram.id}`));
            stats.diagramsSkipped++;
            stats.errors.push(`Failed to generate ${diagram.type} diagram: ${diagram.id}`);
            // Keep original diagram text by not adding to diagramMap
          }
          
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Error processing ${diagram.type} diagram ${diagram.id}, keeping original text: ${error.message}`));
          stats.diagramsSkipped++;
          stats.errors.push(`${diagram.type} ${diagram.id}: ${error.message}`);
          // Keep original diagram text by not adding to diagramMap
        }
      }

      // Replace diagrams in markdown with Google Drive image links
      // Only replace diagrams that were successfully processed
      for (const [originalContent, replacement] of diagramMap) {
        processedMarkdown = processedMarkdown.replace(
          originalContent,
          `![${replacement.alt}](${replacement.url})`
        );
      }

      const successfulCount = stats.diagramsProcessed;
      const skippedCount = stats.diagramsSkipped;
      const totalCount = stats.diagramsFound;
      
      if (skippedCount > 0) {
        console.log(chalk.yellow(`⚠️ Diagram processing: ${successfulCount}/${totalCount} processed, ${skippedCount} kept as original text`));
      } else {
        console.log(chalk.green(`✅ Diagram processing complete: ${successfulCount}/${totalCount} processed`));
      }

      return {
        processedMarkdown,
        diagramMap,
        stats
      };

    } catch (error) {
      console.error(chalk.red('❌ Diagram processing failed:'), error.message);
      stats.errors.push(`General error: ${error.message}`);
      
      return {
        processedMarkdown: markdownContent,
        diagramMap: new Map(),
        stats
      };
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup() {
    try {
      if (await fs.pathExists(this.tempDir)) {
        const files = await fs.readdir(this.tempDir);
        const diagramFiles = files.filter(file => 
          file.includes('mermaid-') || 
          file.includes('plantuml-') || 
          file.includes('graphviz-') || 
          file.includes('d2-')
        );
        
        for (const file of diagramFiles) {
          await fs.remove(path.join(this.tempDir, file));
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Cleanup warning: ${error.message}`));
    }
  }
}

module.exports = GDocsDiagramProcessor; 