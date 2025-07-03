const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const { convertForeignObject } = require('../svgo');

class NotionMermaidProcessor {
  constructor(notionClient, tempDir = '.docflu/temp/notion-mermaid') {
    this.notionClient = notionClient;
    this.tempDir = tempDir;
    this.processedDiagrams = new Map(); // Cache processed diagrams
    
    // Ensure temp directory exists
    fs.ensureDirSync(this.tempDir);
  }

  /**
   * Extract Mermaid diagrams from markdown content
   * @param {string} markdownContent - Raw markdown content
   * @returns {Array} - Array of mermaid diagram objects
   */
  extractMermaidDiagrams(markdownContent) {
    const diagrams = [];
    const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g;
    
    let match;
    while ((match = mermaidRegex.exec(markdownContent)) !== null) {
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
    return `mermaid-${hash.substring(0, 8)}`;
  }

  /**
   * Detect the specific type of Mermaid diagram for optimized rendering
   */
  detectMermaidDiagramType(code) {
    const trimmedCode = code.trim().toLowerCase();
    
    if (trimmedCode.startsWith('gantt')) return 'gantt';
    if (trimmedCode.startsWith('gitgraph')) return 'gitGraph';
    if (trimmedCode.startsWith('xychart')) return 'xyChart';
    if (trimmedCode.startsWith('flowchart') || trimmedCode.startsWith('graph')) return 'flowchart';
    if (trimmedCode.startsWith('sequencediagram')) return 'sequence';
    if (trimmedCode.startsWith('classdiagram')) return 'class';
    if (trimmedCode.startsWith('statediagram')) return 'state';
    if (trimmedCode.startsWith('erdiagram')) return 'er';
    if (trimmedCode.startsWith('journey')) return 'journey';
    if (trimmedCode.startsWith('pie')) return 'pie';
    if (trimmedCode.startsWith('mindmap')) return 'mindmap';
    if (trimmedCode.startsWith('quadrantchart')) return 'quadrant';
    if (trimmedCode.startsWith('timeline')) return 'timeline';
    if (trimmedCode.startsWith('requirement')) return 'requirement';
    if (trimmedCode.startsWith('c4')) return 'c4';
    if (trimmedCode.startsWith('block')) return 'block';
    if (trimmedCode.startsWith('packet')) return 'packet';
    
    return 'unknown';
  }

  /**
   * Check if Mermaid CLI is available
   */
  async checkMermaidCLI() {
    try {
      execSync('mmdc --version', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Install Mermaid CLI if not available
   */
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

  /**
   * Generate SVG from Mermaid diagram code (optimized for Notion)
   * @param {Object} diagram - Diagram object with code and id
   * @returns {string} - Path to generated SVG file
   */
  async generateDiagramImage(diagram) {
    // Ensure temp directory exists
    await fs.ensureDir(this.tempDir);
    
    const inputFile = path.join(this.tempDir, `${diagram.id}.mmd`);
    const outputFile = path.join(this.tempDir, `${diagram.id}.svg`);
    const configFile = path.join(this.tempDir, `mermaid-config.json`);

    try {
      // Create Mermaid config optimized for Notion
      const mermaidConfig = {
        "theme": "default",
        "securityLevel": "antiscript",
        "htmlLabels": false,
        "suppressErrorRendering": false,
        "deterministicIds": true,
        "deterministicIDSeed": "docflu-notion",
        "maxTextSize": 50000,
        "maxEdges": 500,
        "wrap": true,
        "fontSize": 16,
        "useMaxWidth": true,
        "logLevel": "error",
        "securityLevel": "strict",
        
        // Theme colors optimized for Notion
        "themeVariables": {
          "primaryColor": "#ffffff",
          "primaryTextColor": "#000000",
          "primaryBorderColor": "#333333",
          "lineColor": "#333333",
          "secondaryColor": "#f8f9fa",
          "tertiaryColor": "#e9ecef",
          "background": "#ffffff",
          "mainBkg": "#ffffff",
          "secondBkg": "#f8f9fa",
          "tertiaryBkg": "#e9ecef",
          
          // Sequence diagram
          "actorBkg": "#ffffff",
          "actorBorder": "#333333",
          "actorTextColor": "#000000",
          "activationBkgColor": "#f8f9fa",
          "activationBorderColor": "#333333",
          "sequenceNumberColor": "#000000",
          "sectionBkgColor": "#f8f9fa",
          "altSectionBkgColor": "#ffffff",
          "gridColor": "#333333",
          "gridTextColor": "#000000",
          "taskBkgColor": "#ffffff",
          "taskTextColor": "#000000",
          "taskTextLightColor": "#000000",
          "taskTextOutsideColor": "#000000",
          "taskTextClickableColor": "#000000",
          "activeTaskBkgColor": "#f8f9fa",
          "activeTaskBorderColor": "#333333",
          "gridTextColor": "#000000",
          "section0": "#ffffff",
          "section1": "#f8f9fa",
          "section2": "#e9ecef",
          "section3": "#dee2e6"
        },
        
        "flowchart": {
          "curve": "linear",
          "htmlLabels": false,
          "useMaxWidth": true,
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
          "useMaxWidth": true,
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

      // Generate SVG with enhanced settings based on diagram type
      const diagramType = this.detectMermaidDiagramType(diagram.code);
      let command;
      
      if (diagramType === 'gantt') {
        // Gantt charts need specific dimensions and background handling
        command = `mmdc -i "${inputFile}" -o "${outputFile}" -c "${configFile}" --backgroundColor white --width 1400 --height 600 --scale 1`;
      } else if (diagramType === 'gitGraph') {
        // Git graphs benefit from wider canvas
        command = `mmdc -i "${inputFile}" -o "${outputFile}" -c "${configFile}" --backgroundColor white --width 1000 --height 800 --scale 1`;
      } else if (diagramType === 'xyChart') {
        // XY charts need proper aspect ratio
        command = `mmdc -i "${inputFile}" -o "${outputFile}" -c "${configFile}" --backgroundColor white --width 900 --height 600 --scale 1`;
      } else if (diagramType === 'sequence') {
        // Sequence diagrams need more height for interactions
        command = `mmdc -i "${inputFile}" -o "${outputFile}" -c "${configFile}" --backgroundColor white --width 1000 --height 700 --scale 1`;
      } else {
        // Default settings for other diagram types
        command = `mmdc -i "${inputFile}" -o "${outputFile}" -c "${configFile}" --backgroundColor white --width 800 --height 600 --scale 1`;
      }
      
      console.log(chalk.blue(`📊 Generating Mermaid diagram for Notion: ${diagram.id}...`));
      
      try {
        const result = execSync(command, { stdio: 'pipe', encoding: 'utf8' });
        
        if (await fs.pathExists(outputFile)) {
          const stats = await fs.stat(outputFile);
          console.log(chalk.green(`✅ Generated Mermaid SVG for Notion: ${diagram.id}.svg (${stats.size} bytes)`));
          
          // Optimize SVG for Notion compatibility
          try {
            console.log(chalk.blue(`🔧 Optimizing SVG for Notion...`));
            await this.optimizeMermaidSVGForNotion(outputFile);
            
            const optimizedStats = await fs.stat(outputFile);
            const reduction = ((stats.size - optimizedStats.size) / stats.size * 100).toFixed(1);
            console.log(chalk.green(`✨ SVG optimized: ${optimizedStats.size} bytes (${reduction}% reduction)`));
          } catch (optimizeError) {
            console.warn(chalk.yellow(`⚠️ SVG optimization failed: ${optimizeError.message}`));
            // Continue with unoptimized SVG
          }
          
          return outputFile;
        } else {
          throw new Error('SVG file was not generated');
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️ Command output: ${error.stdout || error.message}`));
        console.log(chalk.yellow(`⚠️ Command error: ${error.stderr || 'No stderr'}`));
        console.warn(chalk.yellow(`⚠️ Failed to generate Mermaid diagram ${diagram.id}: ${error.message}`));
        
        // Try fallback generation with basic settings
        console.log(chalk.gray('Attempting fallback generation with basic settings...'));
        let fallbackCommand;
        
        if (diagramType === 'gantt') {
          fallbackCommand = `mmdc -i "${inputFile}" -o "${outputFile}" --backgroundColor white --width 1400 --height 600`;
        } else if (diagramType === 'gitGraph') {
          fallbackCommand = `mmdc -i "${inputFile}" -o "${outputFile}" --backgroundColor white --width 1000 --height 800`;
        } else if (diagramType === 'xyChart') {
          fallbackCommand = `mmdc -i "${inputFile}" -o "${outputFile}" --backgroundColor white --width 900 --height 600`;
        } else if (diagramType === 'sequence') {
          fallbackCommand = `mmdc -i "${inputFile}" -o "${outputFile}" --backgroundColor white --width 1000 --height 700`;
        } else {
          fallbackCommand = `mmdc -i "${inputFile}" -o "${outputFile}" --backgroundColor white --width 800 --height 600`;
        }
        
        try {
          execSync(fallbackCommand, { stdio: 'pipe' });
          
          if (await fs.pathExists(outputFile)) {
            console.log(chalk.yellow(`⚠️ Generated Mermaid diagram with fallback settings: ${diagram.id}.svg`));
            
            // Optimize fallback SVG for Notion compatibility
            try {
              console.log(chalk.blue(`🔧 Optimizing fallback SVG for Notion...`));
              await this.optimizeMermaidSVGForNotion(outputFile);
              
              const optimizedStats = await fs.stat(outputFile);
              console.log(chalk.green(`✨ Fallback SVG optimized: ${optimizedStats.size} bytes`));
            } catch (optimizeError) {
              console.warn(chalk.yellow(`⚠️ Fallback SVG optimization failed: ${optimizeError.message}`));
              // Continue with unoptimized SVG
            }
            
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
    }
  }

  /**
   * Optimize Mermaid SVG specifically for Notion compatibility
   * Fixes display issues by optimizing SVG structure and content
   */
  async optimizeMermaidSVGForNotion(svgPath) {
    try {
      let svgContent = await fs.readFile(svgPath, 'utf8');
      
      console.log(chalk.gray('🔧 Optimizing Mermaid SVG for Notion compatibility...'));
      
      // Apply foreignObject conversion first
      svgContent = convertForeignObject(svgContent);
      
      // Ensure proper SVG namespace and structure
      if (!svgContent.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      
      // Fix missing white background - critical for proper Notion display
      if (!svgContent.includes('fill="white"') && !svgContent.includes('class="background"')) {
        // Extract viewBox or use width/height to create background
        const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
        const widthMatch = svgContent.match(/width="([^"]+)"/);
        const heightMatch = svgContent.match(/height="([^"]+)"/);
        
        let backgroundRect = '';
        if (viewBoxMatch) {
          const [, viewBox] = viewBoxMatch;
          const [x, y, width, height] = viewBox.split(' ');
          backgroundRect = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white" stroke="none"/>`;
        } else if (widthMatch && heightMatch) {
          const width = widthMatch[1].replace(/[^\d.]/g, '');
          const height = heightMatch[1].replace(/[^\d.]/g, '');
          backgroundRect = `<rect x="0" y="0" width="${width}" height="${height}" fill="white" stroke="none"/>`;
        }
        
        if (backgroundRect) {
          // Insert background right after opening SVG tag
          svgContent = svgContent.replace(/(<svg[^>]*>)/, `$1${backgroundRect}`);
          console.log(chalk.gray('Added white background for Notion compatibility'));
        }
      }
      
      // Ensure explicit width and height attributes for better Notion rendering
      if (!svgContent.includes('width=') || !svgContent.includes('height=')) {
        const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
        if (viewBoxMatch) {
          const [, viewBox] = viewBoxMatch;
          const [x, y, width, height] = viewBox.split(' ');
          
          if (!svgContent.includes('width=')) {
            svgContent = svgContent.replace('<svg', `<svg width="${width}"`);
          }
          if (!svgContent.includes('height=')) {
            svgContent = svgContent.replace('<svg', `<svg height="${height}"`);
          }
        }
      }
      
      // Fix percentage-based dimensions that can cause issues in Notion
      svgContent = svgContent.replace(/width="100%"/g, (match) => {
        const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
        if (viewBoxMatch) {
          const [, viewBox] = viewBoxMatch;
          const [x, y, width, height] = viewBox.split(' ');
          return `width="${width}"`;
        }
        return 'width="800"'; // fallback
      });
      
      // Remove any problematic CSS or styles that might interfere with Notion
      svgContent = svgContent.replace(/style="[^"]*max-width:[^"]*"/g, '');
      svgContent = svgContent.replace(/style="[^"]*white-space:\s*nowrap[^"]*"/g, '');
      
      // Fix font family issues - ensure consistent fonts for Notion
      svgContent = svgContent.replace(/font-family="[^"]*trebuchet[^"]*"/g, 'font-family="Arial, Helvetica, sans-serif"');
      svgContent = svgContent.replace(/font-family="[^"]*"/g, 'font-family="Arial, Helvetica, sans-serif"');
      
      // Fix any potential encoding issues
      if (!svgContent.includes('encoding=')) {
        svgContent = svgContent.replace('<?xml version="1.0"', '<?xml version="1.0" encoding="UTF-8"');
      }
      
      // Remove problematic style blocks that might cause rendering issues
      svgContent = svgContent.replace(/<style[^>]*>[\s\S]*?font-family:[^;]*trebuchet[^;]*;[\s\S]*?<\/style>/gi, (match) => {
        return match.replace(/font-family:[^;]*trebuchet[^;]*;/gi, 'font-family:Arial, Helvetica, sans-serif;');
      });
      
      // Ensure proper aria attributes don't cause issues
      svgContent = svgContent.replace(/aria-roledescription="[^"]*"/g, '');
      svgContent = svgContent.replace(/role="graphics-document document"/g, 'role="img"');
      
      // Clean up extra whitespace for smaller file size
      svgContent = svgContent.replace(/>\s+</g, '><');
      svgContent = svgContent.replace(/\s+/g, ' ');
      svgContent = svgContent.trim();
      
      await fs.writeFile(svgPath, svgContent, 'utf8');
      
      console.log(chalk.green('✅ Mermaid SVG optimized for Notion compatibility'));
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to optimize Mermaid SVG for Notion: ${error.message}`));
      // Don't throw error, just log warning and continue
    }
  }

  /**
   * Generate SVG content directly (for use in NotionDiagramProcessor)
   * @param {string} diagramCode - Mermaid diagram code
   * @returns {string} SVG content
   */
  async generateSVGContent(diagramCode) {
    const diagram = {
      code: diagramCode,
      id: this.generateDiagramId(diagramCode)
    };
    
    const svgFile = await this.generateDiagramImage(diagram);
    if (!svgFile || !await fs.pathExists(svgFile)) {
      throw new Error('Failed to generate SVG file');
    }
    
    // Read SVG content
    const svgContent = await fs.readFile(svgFile, 'utf8');
    
    // Clean up temp file
    await fs.remove(svgFile);
    
    return svgContent;
  }

  /**
   * Process all Mermaid diagrams for Notion
   * @param {string} markdownContent - Original markdown content
   * @returns {Object} - {processedContent, stats}
   */
  async processMermaidDiagrams(markdownContent) {
    // Extract Mermaid diagrams
    const diagrams = this.extractMermaidDiagrams(markdownContent);
    
    if (diagrams.length === 0) {
      return {
        processedContent: markdownContent,
        stats: { total: 0, processed: 0, failed: 0 }
      };
    }

    console.log(chalk.blue(`🎨 Found ${diagrams.length} Mermaid diagram(s) to process for Notion`));

    // Check if Mermaid CLI is available
    const hasMermaidCLI = await this.checkMermaidCLI();
    if (!hasMermaidCLI) {
      console.log(chalk.yellow('⚠️ Mermaid CLI not found. Attempting to install...'));
      const installed = await this.installMermaidCLI();
      if (!installed) {
        console.log(chalk.red('❌ Cannot process Mermaid diagrams without CLI. Skipping...'));
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
            type: 'mermaid'
          });
          processedCount++;
        } else {
          failedCount++;
        }

      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Error processing Mermaid diagram ${diagram.id}: ${error.message}`));
        failedCount++;
      }
    }

    const stats = {
      total: diagrams.length,
      processed: processedCount,
      failed: failedCount
    };

    if (processedCount > 0) {
      console.log(chalk.green(`🎨 Processed ${processedCount}/${diagrams.length} Mermaid diagrams for Notion`));
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

module.exports = NotionMermaidProcessor; 