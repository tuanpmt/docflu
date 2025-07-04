const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

class NotionD2Processor {
  constructor(notionClient, tempDir = '.docflu/temp/notion-d2') {
    this.notionClient = notionClient;
    this.tempDir = tempDir;
    this.processedDiagrams = new Map(); // Cache processed diagrams
    
    // Ensure temp directory exists synchronously
    try {
      fs.ensureDirSync(this.tempDir);
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to create temp directory: ${error.message}`));
    }
  }

  /**
   * Extract D2 diagrams from markdown content
   * @param {string} markdownContent - Raw markdown content
   * @returns {Array} - Array of D2 diagram objects
   */
  extractD2Diagrams(markdownContent) {
    const diagrams = [];
    const d2Regex = /```d2\n([\s\S]*?)\n```/g;
    
    let match;
    while ((match = d2Regex.exec(markdownContent)) !== null) {
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
    return `d2-${hash.substring(0, 8)}`;
  }

  /**
   * Check if D2 CLI is available
   */
  async checkD2CLI() {
    try {
      execSync('d2 --version', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Install D2 CLI if not available
   */
  async installD2CLI() {
    console.log(chalk.blue('📦 Installing D2 for Notion...'));
    try {
      // Platform-specific installation
      const platform = process.platform;
      
      if (platform === 'darwin') {
        execSync('brew install d2', { stdio: 'inherit' });
      } else if (platform === 'linux') {
        execSync('curl -fsSL https://d2lang.com/install.sh | sh -', { stdio: 'inherit' });
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

  /**
   * Validate and fix D2 diagram syntax
   */
  validateAndFixD2Syntax(diagramCode) {
    let fixedCode = diagramCode;
    
    // Map of unsupported shapes to supported ones
    const shapeMapping = {
      'folder': 'rectangle',
      'file': 'rectangle', 
      'database': 'cylinder',
      'server': 'rectangle',
      'cloud': 'oval',
      'process': 'diamond',
      'stored_data': 'cylinder',
      'person': 'person', // This one is actually supported
      'hexagon': 'hexagon' // This one is supported too
    };
    
    // Fix unsupported shapes
    for (const [unsupported, supported] of Object.entries(shapeMapping)) {
      if (unsupported !== supported) { // Only replace if different
        const regex = new RegExp(`shape:\\s*${unsupported}`, 'g');
        fixedCode = fixedCode.replace(regex, `shape: ${supported}`);
      }
    }
    
    // Validate basic D2 syntax patterns
    const lines = fixedCode.split('\n');
    const fixedLines = lines.map(line => {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (trimmed.startsWith('#') || trimmed === '') {
        return line;
      }
      
      // Fix common syntax issues
      // Ensure proper connection syntax (A -> B)
      if (trimmed.includes('->') && !trimmed.includes(':')) {
        return line;
      }
      
      // Ensure proper property syntax (key: value)
      if (trimmed.includes(':') && !trimmed.includes('->')) {
        return line;
      }
      
      return line;
    });
    
    return fixedLines.join('\n');
  }

  /**
   * Generate SVG from D2 diagram code (optimized for Notion)
   * @param {Object} diagram - Diagram object with code and id
   * @returns {string} - Path to generated SVG file
   */
  async generateD2Image(diagram) {
    // Ensure temp directory exists
    await fs.ensureDir(this.tempDir);
    
    const inputFile = path.join(this.tempDir, `${diagram.id}.d2`);
    const outputFile = path.join(this.tempDir, `${diagram.id}.svg`);

    try {
      // Validate and fix D2 syntax
      const fixedCode = this.validateAndFixD2Syntax(diagram.code);
      
      // Write D2 content to file
      await fs.writeFile(inputFile, fixedCode);

      // Generate SVG using D2 with settings optimized for Notion (smaller scale)
      const command = `d2 "${inputFile}" "${outputFile}" --theme=0 --dark-theme=0 --layout=dagre --pad=15 --scale=1`;
      
      console.log(chalk.blue(`📊 Generating D2 diagram for Notion: ${diagram.id}...`));
      
      try {
        const result = execSync(command, { stdio: 'pipe', encoding: 'utf8' });
        
        if (await fs.pathExists(outputFile)) {
          const stats = await fs.stat(outputFile);
          console.log(chalk.green(`✅ Generated D2 SVG for Notion: ${diagram.id}.svg (${stats.size} bytes)`));
          return outputFile;
        } else {
          throw new Error('SVG file was not generated');
        }
      } catch (cmdError) {
        console.log(chalk.yellow(`⚠️ Command output: ${cmdError.stdout || cmdError.message}`));
        console.log(chalk.yellow(`⚠️ Command error: ${cmdError.stderr || 'No stderr'}`));
        throw cmdError;
      }

      
    } catch (error) {
      // Provide more helpful error messages for D2
      let errorMessage = error.message;
      if (errorMessage.includes('unknown shape')) {
        const shapeMatch = errorMessage.match(/unknown shape "([^"]+)"/);
        if (shapeMatch) {
          const unknownShape = shapeMatch[1];
          errorMessage += `\n💡 Tip: D2 shape "${unknownShape}" is not supported. Try using: rectangle, circle, oval, diamond, cylinder, or person instead.`;
        }
      }
      
      console.error(chalk.red(`❌ Error generating D2 diagram ${diagram.id}: ${errorMessage}`));
      return null;
    }
    // Note: Keep input file for debugging, cleanup happens in cleanup() method
  }

  /**
   * Generate SVG content directly (for use in NotionDiagramProcessor)
   * @param {string} diagramCode - D2 diagram code
   * @returns {string} SVG content
   */
  async generateSVGContent(diagramCode) {
    const diagram = {
      code: diagramCode,
      id: this.generateDiagramId(diagramCode)
    };
    
    const svgFile = await this.generateD2Image(diagram);
    if (!svgFile || !await fs.pathExists(svgFile)) {
      throw new Error('Failed to generate SVG file');
    }
    
    // Read SVG content
    const svgContent = await fs.readFile(svgFile, 'utf8');
    
    // Note: Keep SVG file for potential reuse, cleanup happens in cleanup() method
    
    return svgContent;
  }

  /**
   * Process all D2 diagrams for Notion
   * @param {string} markdownContent - Original markdown content
   * @returns {Object} - {processedContent, stats}
   */
  async processD2Diagrams(markdownContent) {
    // Extract D2 diagrams
    const diagrams = this.extractD2Diagrams(markdownContent);
    
    if (diagrams.length === 0) {
      return {
        processedContent: markdownContent,
        stats: { total: 0, processed: 0, failed: 0 }
      };
    }

    console.log(chalk.blue(`🎨 Found ${diagrams.length} D2 diagram(s) to process for Notion`));

    // Check if D2 CLI is available
    const hasD2CLI = await this.checkD2CLI();
    if (!hasD2CLI) {
      console.log(chalk.yellow('⚠️ D2 CLI not found. Attempting to install...'));
      const installed = await this.installD2CLI();
      if (!installed) {
        console.log(chalk.red('❌ Cannot process D2 diagrams without CLI. Skipping...'));
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
            type: 'd2'
          });
          processedCount++;
        } else {
          failedCount++;
        }

      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Error processing D2 diagram ${diagram.id}: ${error.message}`));
        failedCount++;
      }
    }

    const stats = {
      total: diagrams.length,
      processed: processedCount,
      failed: failedCount
    };

    if (processedCount > 0) {
      console.log(chalk.green(`🎨 Processed ${processedCount}/${diagrams.length} D2 diagrams for Notion`));
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

module.exports = NotionD2Processor; 