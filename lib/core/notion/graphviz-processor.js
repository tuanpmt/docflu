/**
 * Notion Graphviz Processor
 * 
 * Handles Graphviz diagram processing for Notion integration.
 * 
 * IMPORTANT: Fixed content cropping issue by optimizing Graphviz command parameters:
 * - Increased margin from 0.3 to 1.2 (prevents edge cropping)
 * - Added pad=0.8 for additional padding around content
 * - Added nodesep=0.8 and ranksep=1.2 for better node spacing
 * - This ensures all diagram content is visible in Notion
 * 
 * @author DocFlu Team
 * @version 2.0.0 - Fixed content cropping
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

class NotionGraphvizProcessor {
  constructor(notionClient, tempDir = '.docflu/temp/notion-graphviz') {
    this.notionClient = notionClient;
    this.tempDir = tempDir;
    this.processedDiagrams = new Map(); // Cache processed diagrams
    
    // Ensure temp directory exists
    fs.ensureDirSync(this.tempDir);
  }

  /**
   * Extract Graphviz diagrams from markdown content
   * @param {string} markdownContent - Raw markdown content
   * @returns {Array} - Array of Graphviz diagram objects
   */
  extractGraphvizDiagrams(markdownContent) {
    const diagrams = [];
    const graphvizRegex = /```(?:dot|graphviz)\n([\s\S]*?)\n```/g;
    
    let match;
    while ((match = graphvizRegex.exec(markdownContent)) !== null) {
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
    return `graphviz-${hash.substring(0, 8)}`;
  }

  /**
   * Check if Graphviz CLI is available
   */
  async checkGraphvizCLI() {
    try {
      execSync('dot -V', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Install Graphviz CLI if not available
   */
  async installGraphvizCLI() {
    console.log(chalk.blue('📦 Installing Graphviz for Notion...'));
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

  /**
   * Generate SVG from Graphviz diagram code (optimized for Notion)
   * @param {Object} diagram - Diagram object with code and id
   * @returns {string} - Path to generated SVG file
   */
  async generateGraphvizImage(diagram) {
    // Ensure temp directory exists
    await fs.ensureDir(this.tempDir);
    
    const inputFile = path.join(this.tempDir, `${diagram.id}.dot`);
    const outputFile = path.join(this.tempDir, `${diagram.id}.svg`);

    try {
      // Write Graphviz content to file
      await fs.writeFile(inputFile, diagram.code);

      // Generate SVG using Graphviz with settings optimized for Notion (prevent content cropping)
      // ENHANCED: Increased margin and padding further to prevent any cropping
      const command = `dot -Tsvg "${inputFile}" -o "${outputFile}" -Gbgcolor=white -Gfontname="Arial" -Nfontname="Arial" -Efontname="Arial" -Gdpi=96 -Gmargin=2.0 -Gpad=1.5 -Gnodesep=1.0 -Granksep=1.5`;
      
      console.log(chalk.blue(`📊 Generating Graphviz diagram for Notion: ${diagram.id}...`));
      
      try {
        const result = execSync(command, { stdio: 'pipe', encoding: 'utf8' });
        
        if (await fs.pathExists(outputFile)) {
          const stats = await fs.stat(outputFile);
          console.log(chalk.green(`✅ Generated Graphviz SVG for Notion: ${diagram.id}.svg (${stats.size} bytes)`));
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
      console.error(chalk.red(`❌ Error generating Graphviz diagram ${diagram.id}:`, error.message));
      return null;
    }
  }

  /**
   * Post-process SVG content to optimize for Notion display
   * @param {string} svgContent - Raw SVG content
   * @returns {string} Optimized SVG content
   */
  optimizeSVGForNotion(svgContent) {
    try {
      // Extract viewBox and dimensions
      const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
      const widthMatch = svgContent.match(/width="([^"]+)"/);
      const heightMatch = svgContent.match(/height="([^"]+)"/);
      
      if (!viewBoxMatch) return svgContent;
      
      const [vbX, vbY, vbWidth, vbHeight] = viewBoxMatch[1].split(' ').map(Number);
      
      // Calculate better dimensions for Notion
      const aspectRatio = vbWidth / vbHeight;
      let newWidth, newHeight;
      
      // Set max width for Notion (800px is good for Notion pages)
      const maxWidth = 800;
      if (aspectRatio > 1) {
        // Landscape
        newWidth = Math.min(maxWidth, vbWidth);
        newHeight = newWidth / aspectRatio;
      } else {
        // Portrait or square
        newHeight = Math.min(maxWidth / aspectRatio, vbHeight);
        newWidth = newHeight * aspectRatio;
      }
      
      // Update SVG with optimized dimensions
      let optimizedSVG = svgContent;
      
      // Set explicit width and height in pixels (better for Notion)
      optimizedSVG = optimizedSVG.replace(
        /width="[^"]*"/,
        `width="${Math.round(newWidth)}px"`
      );
      optimizedSVG = optimizedSVG.replace(
        /height="[^"]*"/,
        `height="${Math.round(newHeight)}px"`
      );
      
      // ENHANCED: Much larger padding for safety - increase from 20pt to 50pt
      const padding = 50; // Increased padding for better content visibility
      const newViewBox = `${vbX - padding} ${vbY - padding} ${vbWidth + 2 * padding} ${vbHeight + 2 * padding}`;
      optimizedSVG = optimizedSVG.replace(
        /viewBox="[^"]*"/,
        `viewBox="${newViewBox}"`
      );
      
      // Add preserveAspectRatio for better scaling
      optimizedSVG = optimizedSVG.replace(
        /<svg([^>]*)>/,
        `<svg$1 preserveAspectRatio="xMidYMid meet">`
      );
      
      console.log(chalk.blue(`📐 Optimized SVG for Notion: ${Math.round(newWidth)}x${Math.round(newHeight)}px (padding: ${padding}pt)`));
      
      return optimizedSVG;
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ SVG optimization failed: ${error.message}`));
      return svgContent;
    }
  }

  /**
   * Generate SVG content directly (for use in NotionDiagramProcessor)
   * @param {string} diagramCode - Graphviz diagram code
   * @returns {string} SVG content
   */
  async generateSVGContent(diagramCode) {
    const diagram = {
      code: diagramCode,
      id: this.generateDiagramId(diagramCode)
    };
    
    const svgFile = await this.generateGraphvizImage(diagram);
    if (!svgFile || !await fs.pathExists(svgFile)) {
      throw new Error('Failed to generate SVG file');
    }
    
    // Read SVG content
    let svgContent = await fs.readFile(svgFile, 'utf8');
    
    // Optimize SVG for Notion
    svgContent = this.optimizeSVGForNotion(svgContent);
    
    // Clean up temp file
    await fs.remove(svgFile);
    
    return svgContent;
  }

  /**
   * Process all Graphviz diagrams for Notion
   * @param {string} markdownContent - Original markdown content
   * @returns {Object} - {processedContent, stats}
   */
  async processGraphvizDiagrams(markdownContent) {
    // Extract Graphviz diagrams
    const diagrams = this.extractGraphvizDiagrams(markdownContent);
    
    if (diagrams.length === 0) {
      return {
        processedContent: markdownContent,
        stats: { total: 0, processed: 0, failed: 0 }
      };
    }

    console.log(chalk.blue(`🎨 Found ${diagrams.length} Graphviz diagram(s) to process for Notion`));

    // Check if Graphviz CLI is available
    const hasGraphvizCLI = await this.checkGraphvizCLI();
    if (!hasGraphvizCLI) {
      console.log(chalk.yellow('⚠️ Graphviz CLI not found. Attempting to install...'));
      const installed = await this.installGraphvizCLI();
      if (!installed) {
        console.log(chalk.red('❌ Cannot process Graphviz diagrams without CLI. Skipping...'));
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
            type: 'graphviz'
          });
          processedCount++;
        } else {
          failedCount++;
        }

      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Error processing Graphviz diagram ${diagram.id}: ${error.message}`));
        failedCount++;
      }
    }

    const stats = {
      total: diagrams.length,
      processed: processedCount,
      failed: failedCount
    };

    if (processedCount > 0) {
      console.log(chalk.green(`🎨 Processed ${processedCount}/${diagrams.length} Graphviz diagrams for Notion`));
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

module.exports = NotionGraphvizProcessor; 