const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const svgo = require('./svgo');

class DiagramProcessor {
  constructor(confluenceClient, tempDir = '.docusaurus/temp', options = {}) {
    this.confluenceClient = confluenceClient;
    this.tempDir = tempDir;
    this.processedDiagrams = new Map(); // Cache processed diagrams
    
    // Configuration options
    this.options = {
      useMermaidPlugin: options.useMermaidPlugin || false, // Use Mermaid Cloud plugin instead of SVG conversion
      mermaidPluginName: options.mermaidPluginName || 'mermaid-cloud', // Plugin macro name
      ...options
    };
    
    // Ensure temp directory exists
    fs.ensureDirSync(this.tempDir);

    // Supported diagram types with their configurations
    this.diagramTypes = {
      mermaid: {
        regex: /```mermaid\s*\n([\s\S]*?)\n\s*```/g,
        generator: this.options.useMermaidPlugin ? null : this.generateMermaidImage.bind(this),
        checker: this.options.useMermaidPlugin ? null : this.checkMermaidCLI.bind(this),
        installer: this.options.useMermaidPlugin ? null : this.installMermaidCLI.bind(this),
        extension: this.options.useMermaidPlugin ? null : 'svg',
        contentType: this.options.useMermaidPlugin ? null : 'image/svg+xml',
        usePlugin: this.options.useMermaidPlugin
      },
      plantuml: {
        regex: /```plantuml\s*\n([\s\S]*?)\n\s*```/g,
        generator: this.generatePlantUMLImage.bind(this),
        checker: this.checkPlantUMLCLI.bind(this),
        installer: this.installPlantUMLCLI.bind(this),
        extension: 'svg',
        contentType: 'image/svg+xml'
      },
      graphviz: {
        regex: /```(?:dot|graphviz)\s*\n([\s\S]*?)\n\s*```/g,
        generator: this.generateGraphvizImage.bind(this),
        checker: this.checkGraphvizCLI.bind(this),
        installer: this.installGraphvizCLI.bind(this),
        extension: 'svg',
        contentType: 'image/svg+xml'
      },
      d2: {
        regex: /```d2\s*\n([\s\S]*?)\n\s*```/g,
        generator: this.generateD2Image.bind(this),
        checker: this.checkD2CLI.bind(this),
        installer: this.installD2CLI.bind(this),
        extension: 'svg',
        contentType: 'image/svg+xml'
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
   * Normalize by removing all spaces and newlines for consistent ID generation
   */
  generateDiagramId(type, code) {
    const normalizedCode = code.replace(/\s+/g, '');
    const hash = require('crypto').createHash('md5').update(normalizedCode).digest('hex');
    return `${type}-${hash.substring(0, 8)}`;
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
    if (trimmedCode.startsWith('classDiagram')) return 'class';
    if (trimmedCode.startsWith('stateDiagram')) return 'state';
    if (trimmedCode.startsWith('erDiagram')) return 'er';
    if (trimmedCode.startsWith('journey')) return 'journey';
    if (trimmedCode.startsWith('pie')) return 'pie';
    if (trimmedCode.startsWith('mindmap')) return 'mindmap';
    if (trimmedCode.startsWith('quadrantChart')) return 'quadrant';
    if (trimmedCode.startsWith('timeline')) return 'timeline';
    if (trimmedCode.startsWith('requirement')) return 'requirement';
    if (trimmedCode.startsWith('c4')) return 'c4';
    if (trimmedCode.startsWith('block')) return 'block';
    if (trimmedCode.startsWith('packet')) return 'packet';
    
    return 'unknown';
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
    const outputFile = path.join(this.tempDir, `${diagram.id}.svg`);
    const configFile = path.join(this.tempDir, `mermaid-config.json`);

    try {
      // Create high-quality Mermaid config optimized for Confluence compatibility
      const mermaidConfig = {
        "theme": "default",
        "securityLevel": "antiscript",
        "htmlLabels": false,
        "suppressErrorRendering": false,
        "deterministicIds": true,
        "deterministicIDSeed": "docflu",
        "maxTextSize": 50000,
        "maxEdges": 500,
        "wrap": true,
        "fontSize": 16,
        "useMaxWidth": false,
        "logLevel": "error",
        "securityLevel": "strict",
        "flowchart": {
          "curve": "linear",
          "htmlLabels": false,
          "useMaxWidth": false,
          "diagramPadding": 20,
          "nodeSpacing": 50,
          "rankSpacing": 60,
          "padding": 15,
          "wrapping": true
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
          "mirrorActors": true,
          "bottomMarginAdj": 1,
          "useMaxWidth": false,
          "rightAngles": false,
          "showSequenceNumbers": false,
          "actorFontSize": 14,
          "noteFontSize": 14,
          "messageFontSize": 14,
          "wrap": true,
          "wrapPadding": 10,
          "labelBoxWidth": 50,
          "labelBoxHeight": 20,
          "textPlacement": "svg"
        },
        "gantt": {
          "titleTopMargin": 25,
          "barHeight": 20,
          "fontFamily": "Arial, Helvetica, sans-serif",
          "fontSize": 14,
          "fontWeight": "bold",
          "gridLineStartPadding": 35,
          "bottomPadding": 25,
          "leftPadding": 75,
          "topPadding": 50,
          "topAxis": false,
          "rightPadding": 75,
          "numberSectionStyles": 4,
          "useMaxWidth": false,
          "displayMode": "standard"
        },
        "class": {
          "titleTopMargin": 25,
          "diagramPadding": 20,
          "useMaxWidth": false,
          "defaultRenderer": "dagre-wrapper",
          "htmlLabels": false
        },
        "state": {
          "titleTopMargin": 25,
          "diagramPadding": 20,
          "useMaxWidth": false,
          "defaultRenderer": "dagre-wrapper",
          "dividerMargin": 10,
          "sizeUnit": 5,
          "stateLabelColor": "#000000"
        },
        "er": {
          "diagramPadding": 20,
          "layoutDirection": "TB",
          "minEntityWidth": 100,
          "minEntityHeight": 75,
          "entityPadding": 15,
          "stroke": "#333333",
          "fill": "#ECECFF",
          "fontSize": 12,
          "useMaxWidth": false
        },
        "journey": {
          "diagramMarginX": 50,
          "diagramMarginY": 20,
          "leftMargin": 150,
          "width": 150,
          "height": 50,
          "boxMargin": 10,
          "boxTextMargin": 5,
          "noteMargin": 10,
          "messageMargin": 35,
          "bottomMarginAdj": 1,
          "useMaxWidth": false,
          "rightAngles": false,
          "htmlLabels": false
        },
        "gitGraph": {
          "titleTopMargin": 25,
          "diagramPadding": 20,
          "nodeLabel": {
            "width": 75,
            "height": 100,
            "x": -25,
            "y": -8
          },
          "mainBranchName": "main",
          "showBranches": true,
          "showCommitLabel": true,
          "rotateCommitLabel": false,
          "theme": "base",
          "useMaxWidth": false,
          "arrowMarkerAbsolute": false
        },
        "pie": {
          "useWidth": 984,
          "useMaxWidth": false,
          "textPosition": 0.75,
          "outerStrokeWidth": 2,
          "innerStrokeColor": "#AAAA33",
          "outerStrokeColor": "#AAAA33",
          "legendPosition": "right"
        },
        "mindmap": {
          "padding": 10,
          "useMaxWidth": false,
          "maxNodeWidth": 200
        },
        "quadrantChart": {
          "chartWidth": 500,
          "chartHeight": 500,
          "titleFontSize": 20,
          "titlePadding": 10,
          "quadrantPadding": 5,
          "quadrantTextTopPadding": 5,
          "quadrantLabelFontSize": 16,
          "quadrantInternalBorderStrokeWidth": 1,
          "quadrantExternalBorderStrokeWidth": 2,
          "xAxisLabelPadding": 5,
          "xAxisLabelFontSize": 16,
          "yAxisLabelPadding": 5,
          "yAxisLabelFontSize": 16,
          "pointTextPadding": 5,
          "pointLabelFontSize": 12,
          "pointRadius": 5,
          "useMaxWidth": false
        },
        "xyChart": {
          "chartOrientation": "vertical",
          "width": 700,
          "height": 500,
          "titleFontSize": 20,
          "titlePadding": 10,
          "showTitle": true,
          "axisTextFontSize": 14,
          "axisNameFontSize": 16,
          "axisNamePadding": 5,
          "disableMultiColor": false,
          "xAxis": {
            "showLabel": true,
            "labelFontSize": 14,
            "labelPadding": 5,
            "showTitle": true,
            "titleFontSize": 16,
            "titlePadding": 5,
            "showTick": true,
            "tickLength": 5,
            "tickWidth": 2,
            "showAxisLine": true,
            "axisLineWidth": 1
          },
          "yAxis": {
            "showLabel": true,
            "labelFontSize": 14,
            "labelPadding": 5,
            "showTitle": true,
            "titleFontSize": 16,
            "titlePadding": 5,
            "showTick": true,
            "tickLength": 5,
            "tickWidth": 2,
            "showAxisLine": true,
            "axisLineWidth": 1
          },
          "useMaxWidth": false
        },
        "block": {
          "diagramPadding": 8,
          "useMaxWidth": false
        },
        "packet": {
          "diagramPadding": 8,
          "useMaxWidth": false,
          "showBits": false
        },
        "timeline": {
          "diagramMarginX": 50,
          "diagramMarginY": 20,
          "leftMargin": 150,
          "width": 150,
          "height": 50,
          "padding": 5,
          "useMaxWidth": false
        },
        "requirement": {
          "useMaxWidth": false,
          "rect_fill": "#f9f9f9",
          "text_color": "#333",
          "rect_border_size": "0.5px",
          "rect_border_color": "#bbb",
          "rect_min_width": 200,
          "rect_min_height": 200,
          "fontSize": 14,
          "rect_padding": 10,
          "line_height": 20
        },
        "c4": {
          "diagramMarginX": 50,
          "diagramMarginY": 10,
          "c4ShapeMargin": 50,
          "c4ShapePadding": 20,
          "width": 216,
          "height": 60,
          "boxMargin": 10,
          "useMaxWidth": false,
          "c4ShapeInRow": 4,
          "nextLinePaddingX": 0,
          "c4BoundaryInRow": 2,
          "personFontSize": 14,
          "personFontFamily": "Arial",
          "personFontWeight": "normal",
          "external_personFontSize": 14,
          "external_personFontFamily": "Arial",
          "external_personFontWeight": "normal",
          "systemFontSize": 14,
          "systemFontFamily": "Arial",
          "systemFontWeight": "normal",
          "external_systemFontSize": 14,
          "external_systemFontFamily": "Arial",
          "external_systemFontWeight": "normal"
        }
      };
      if (!fs.pathExistsSync(configFile)) {
        await fs.writeFile(configFile, JSON.stringify(mermaidConfig, null, 2), 'utf8');
      }
      
      // Write diagram content
      await fs.writeFile(inputFile, diagram.code, 'utf8');
      
      // Generate SVG with enhanced settings for Confluence compatibility
      // Use different settings based on diagram type for better results
      const diagramType = this.detectMermaidDiagramType(diagram.code);
      let command;
      
      if (diagramType === 'gantt') {
        // Gantt charts need specific dimensions and background handling
        command = `mmdc -i "${inputFile}" -o "${outputFile}" -c "${configFile}" --backgroundColor white --width 1400 --height 600 --scale 1 --cssFile /dev/null`;
      } else if (diagramType === 'gitGraph') {
        // Git graphs benefit from wider canvas
        command = `mmdc -i "${inputFile}" -o "${outputFile}" -c "${configFile}" --backgroundColor white --width 1000 --height 800 --scale 1 --cssFile /dev/null`;
      } else if (diagramType === 'xyChart') {
        // XY charts need proper aspect ratio
        command = `mmdc -i "${inputFile}" -o "${outputFile}" -c "${configFile}" --backgroundColor white --width 900 --height 600 --scale 1 --cssFile /dev/null`;
      } else {
        // Default settings for other diagram types
        command = `mmdc -i "${inputFile}" -o "${outputFile}" -c "${configFile}" --backgroundColor white --width 1200 --height 900 --scale 1`;
      }
      
      execSync(command, { stdio: 'pipe' });

      if (await fs.pathExists(outputFile)) {
        
        // Verify the SVG quality
        const svgContent = await fs.readFile(outputFile, 'utf8');
        const fileSize = Buffer.byteLength(svgContent, 'utf8');
        
        // Validate SVG has proper content
        if (!svgContent.includes('<text') && !svgContent.includes('<foreignObject')) {
          throw new Error('Generated SVG appears to have no text content');
        }
        
        // Apply Confluence-specific optimizations for Mermaid SVGs
        await this.optimizeMermaidSVGForConfluence(outputFile);
        
        // Apply additional fixes for specific diagram types
        const diagramType = this.detectMermaidDiagramType(diagram.code);
        if (diagramType === 'xyChart') {
          await this.fixXYChartSVGIssues(outputFile);
        }
        
        if (fileSize > 8 * 1024 * 1024) { // 8MB limit
          console.warn(chalk.yellow(`⚠️ Large SVG file (${fileSize} bytes), applying optimization...`));
          await this.optimizeLargeSVG(outputFile);
        }
        
        console.log(chalk.green(`✅ Generated high-quality Mermaid diagram: ${diagram.id}.svg`));
        return outputFile;
      }
      throw new Error('Output file not created');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to generate Mermaid diagram ${diagram.id}: ${error.message}`));
      
      // Try fallback generation with basic settings
      try {
        console.log(chalk.gray('Attempting fallback generation with basic settings...'));
        const fallbackCommand = `mmdc -i "${inputFile}" -o "${outputFile}" --backgroundColor white --width 800 --height 600`;
        execSync(fallbackCommand, { stdio: 'pipe' });
        
        if (await fs.pathExists(outputFile)) {
          // Apply Confluence-specific optimizations for fallback generation too
          await this.optimizeMermaidSVGForConfluence(outputFile);
          
          // Apply additional fixes for specific diagram types
          const diagramType = this.detectMermaidDiagramType(diagram.code);
          if (diagramType === 'xyChart') {
            await this.fixXYChartSVGIssues(outputFile);
          }
          
          console.log(chalk.green(`✅ Generated fallback Mermaid diagram: ${diagram.id}.svg`));
          return outputFile;
        }
      } catch (fallbackError) {
        console.warn(chalk.yellow(`⚠️ Fallback generation also failed: ${fallbackError.message}`));
      }
      
      return null;
    } finally {
      // Cleanup temp files
      const tempFiles = [inputFile, configFile];
      for (const tempFile of tempFiles) {
        if (await fs.pathExists(tempFile)) {
        //   await fs.remove(tempFile);
        }
      }
    }
  }

  /**
   * Optimize Mermaid SVG specifically for Confluence compatibility
   * Fixes the preview issue by replacing foreignObject elements with text elements
   */
  async optimizeMermaidSVGForConfluence(svgPath) {
    try {
      let svgContent = svgo.convertForeignObject(await fs.readFile(svgPath, 'utf8'));
      
      console.log(chalk.gray('🔧 Optimizing Mermaid SVG for Confluence preview compatibility...'));
      
      // Ensure proper SVG namespace and structure
      if (!svgContent.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      
      // Fix missing white background - critical for Gantt, GitFlow, and other diagrams
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
          console.log(chalk.gray('Added white background for Confluence compatibility'));
        }
      }
      
      // Ensure explicit width and height attributes for better Confluence rendering
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
      
      // Fix percentage-based dimensions that can cause issues in Confluence
      svgContent = svgContent.replace(/width="100%"/g, (match) => {
        const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
        if (viewBoxMatch) {
          const [, viewBox] = viewBoxMatch;
          const [x, y, width, height] = viewBox.split(' ');
          return `width="${width}"`;
        }
        return 'width="800"'; // fallback
      });
      
      // Remove any problematic CSS or styles that might interfere with Confluence
      svgContent = svgContent.replace(/style="[^"]*max-width:[^"]*"/g, '');
      svgContent = svgContent.replace(/style="[^"]*white-space:\s*nowrap[^"]*"/g, '');
      
      // Fix font family issues - ensure consistent Arial fonts
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
      
      // Clean up extra whitespace
      svgContent = svgContent.replace(/>\s+</g, '><');
      svgContent = svgContent.replace(/\s+/g, ' ');
      svgContent = svgContent.trim();
      
      await fs.writeFile(svgPath, svgContent, 'utf8');
      
      console.log(chalk.green('✅ Mermaid SVG optimized for Confluence preview compatibility'));
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to optimize Mermaid SVG for Confluence: ${error.message}`));
      // Don't throw error, just log warning and continue
    }
  }

  /**
   * Fix specific issues with XY Chart SVGs that prevent proper display in Confluence
   */
  async fixXYChartSVGIssues(svgPath) {
    try {
      let svgContent = await fs.readFile(svgPath, 'utf8');
      
      console.log(chalk.gray('🔧 Applying XY Chart specific fixes for Confluence...'));
      
      // XY Charts sometimes have issues with coordinate precision causing rendering problems
      // Round coordinates to reduce precision issues
      svgContent = svgContent.replace(/(\d+\.\d{3,})/g, (match) => {
        return parseFloat(match).toFixed(2);
      });
      
      // Fix potential issues with transform attributes
      svgContent = svgContent.replace(/transform="translate\(([^)]+)\)"/g, (match, coords) => {
        const cleanCoords = coords.split(',').map(coord => {
          const num = parseFloat(coord.trim());
          return isNaN(num) ? coord.trim() : num.toFixed(2);
        }).join(', ');
        return `transform="translate(${cleanCoords})"`;
      });
      
      // Ensure text elements have proper encoding for special characters like $
      svgContent = svgContent.replace(/&#x24;/g, '$');
      svgContent = svgContent.replace(/&amp;/g, '&');
      
      // Fix any issues with axis labels that might contain problematic characters
      svgContent = svgContent.replace(/<text[^>]*>([^<]*[&<>][^<]*)<\/text>/g, (match, textContent) => {
        const cleanText = textContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return match.replace(textContent, cleanText);
      });
      
      // Ensure proper viewBox and dimensions alignment
      const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
      const widthMatch = svgContent.match(/width="([^"]+)"/);
      const heightMatch = svgContent.match(/height="([^"]+)"/);
      
      if (viewBoxMatch && widthMatch && heightMatch) {
        const [, viewBox] = viewBoxMatch;
        const [vx, vy, vw, vh] = viewBox.split(' ');
        const width = widthMatch[1];
        const height = heightMatch[1];
        
        // Ensure dimensions match viewBox for consistent rendering
        if (width !== vw || height !== vh) {
          svgContent = svgContent.replace(/width="[^"]*"/, `width="${vw}"`);
          svgContent = svgContent.replace(/height="[^"]*"/, `height="${vh}"`);
          console.log(chalk.gray('Fixed dimension mismatch in XY Chart'));
        }
      }
      
      await fs.writeFile(svgPath, svgContent, 'utf8');
      
      console.log(chalk.green('✅ XY Chart SVG issues fixed'));
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to fix XY Chart SVG issues: ${error.message}`));
    }
  }

  /**
   * Optimize large SVG files
   */
  async optimizeLargeSVG(svgPath) {
    try {
      let svgContent = await fs.readFile(svgPath, 'utf8');
      
      // Remove precision from numbers to reduce file size
      svgContent = svgContent.replace(/(\d+\.\d{4,})/g, (match) => {
        return parseFloat(match).toFixed(2);
      });
      
      // Remove unnecessary whitespace
      svgContent = svgContent.replace(/\s+/g, ' ');
      svgContent = svgContent.replace(/>\s+</g, '><');
      
      // Remove empty groups
      svgContent = svgContent.replace(/<g>\s*<\/g>/g, '');
      svgContent = svgContent.replace(/<g[^>]*>\s*<\/g>/g, '');
      
      await fs.writeFile(svgPath, svgContent, 'utf8');
      
      const newSize = Buffer.byteLength(svgContent, 'utf8');
      console.log(chalk.gray(`SVG optimized to ${newSize} bytes`));
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to optimize large SVG: ${error.message}`));
    }
  }

  /**
   * Optimize SVG for Confluence compatibility (for non-Mermaid diagrams)
   */
  async optimizeSVGForConfluence(svgPath) {
    try {
      let svgContent = await fs.readFile(svgPath, 'utf8');
      
      // Ensure proper SVG structure for Confluence
      if (!svgContent.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      
      // Add explicit background for transparency issues
      if (!svgContent.includes('<rect') && !svgContent.includes('background')) {
        const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
        if (viewBoxMatch) {
          const [, viewBox] = viewBoxMatch;
          const [x, y, width, height] = viewBox.split(' ');
          const backgroundRect = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white" stroke="none"/>`;
          svgContent = svgContent.replace(/(<svg[^>]*>)/, `$1\n${backgroundRect}`);
        }
      }
      
      // Ensure proper font fallbacks
      svgContent = svgContent.replace(/font-family="[^"]*"/g, 'font-family="Arial, Helvetica, sans-serif"');
      
      // Remove any problematic CSS that might cause rendering issues
      svgContent = svgContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      
      // Remove problematic classes and styles that might cause issues
      svgContent = svgContent.replace(/class="[^"]*"/g, '');
      svgContent = svgContent.replace(/style="[^"]*max-width:[^"]*"/g, '');
      
      // Ensure proper encoding
      svgContent = svgContent.replace(/encoding="[^"]*"/g, 'encoding="UTF-8"');
      
      // Remove empty groups and optimize structure
      svgContent = svgContent.replace(/<g>\s*<\/g>/g, '');
      svgContent = svgContent.replace(/<g[^>]*>\s*<\/g>/g, '');
      
      // Minify the SVG to reduce file size
      svgContent = svgContent.replace(/>\s+</g, '><');
      svgContent = svgContent.replace(/\s+/g, ' ');
      svgContent = svgContent.trim();
      
      // Ensure the SVG has reasonable dimensions
      if (!svgContent.includes('width=') && !svgContent.includes('height=')) {
        svgContent = svgContent.replace('<svg', '<svg width="800" height="600"');
      }
      
      await fs.writeFile(svgPath, svgContent, 'utf8');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to optimize SVG: ${error.message}`));
    }
  }

  // ===========================================
  // PLANTUML SUPPORT
  // ===========================================

  async checkPlantUMLCLI() {
    try {
      // Check if plantuml.jar exists or plantuml command is available
      try {
        execSync('plantuml -version', { stdio: 'ignore' });
        return true;
      } catch {
        // Check for Java and plantuml.jar
        execSync('java -version', { stdio: 'ignore' });
        const plantumlPath = path.join(process.env.HOME || process.env.USERPROFILE, 'plantuml.jar');
        return await fs.pathExists(plantumlPath);
      }
    } catch (error) {
      return false;
    }
  }

  async installPlantUMLCLI() {
    console.log(chalk.blue('📦 Installing PlantUML...'));
    try {
      // Download plantuml.jar to user home directory
      const plantumlUrl = 'https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar';
      const plantumlPath = path.join(process.env.HOME || process.env.USERPROFILE, 'plantuml.jar');
      
      console.log(chalk.gray('Downloading PlantUML JAR file...'));
      execSync(`curl -L "${plantumlUrl}" -o "${plantumlPath}"`, { stdio: 'inherit' });
      
      console.log(chalk.green('✅ PlantUML installed successfully'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to install PlantUML:', error.message));
      return false;
    }
  }

  async generatePlantUMLImage(diagram) {
    const inputFile = path.join(this.tempDir, `${diagram.id}.puml`);
    const outputFile = path.join(this.tempDir, `${diagram.id}.svg`);

    try {
      await fs.writeFile(inputFile, diagram.code, 'utf8');
      
      // Try plantuml command first, then java -jar
      let command;
      try {
        execSync('plantuml -version', { stdio: 'ignore' });
        command = `plantuml -tsvg "${inputFile}"`;
      } catch {
        const plantumlPath = path.join(process.env.HOME || process.env.USERPROFILE, 'plantuml.jar');
        command = `java -jar "${plantumlPath}" -tsvg "${inputFile}"`;
      }
      
      execSync(command, { stdio: 'pipe' });

      if (await fs.pathExists(outputFile)) {
        // Post-process SVG for Confluence compatibility
        await this.optimizeSVGForConfluence(outputFile);
        console.log(chalk.green(`✅ Generated PlantUML diagram: ${diagram.id}.svg`));
        return outputFile;
      }
      throw new Error('Output file not created');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to generate PlantUML diagram ${diagram.id}: ${error.message}`));
      return null;
    } finally {
      if (await fs.pathExists(inputFile)) {
        // await fs.remove(inputFile);
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
      const platform = process.platform;
      let command;
      
      if (platform === 'darwin') {
        command = 'brew install graphviz';
      } else if (platform === 'linux') {
        command = 'sudo apt-get install -y graphviz || sudo yum install -y graphviz';
      } else if (platform === 'win32') {
        console.log(chalk.yellow('Please install Graphviz manually from: https://graphviz.org/download/'));
        return false;
      }
      
      execSync(command, { stdio: 'inherit' });
      console.log(chalk.green('✅ Graphviz installed successfully'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to install Graphviz:', error.message));
      return false;
    }
  }

  async generateGraphvizImage(diagram) {
    const inputFile = path.join(this.tempDir, `${diagram.id}.dot`);
    const outputFile = path.join(this.tempDir, `${diagram.id}.svg`);

    try {
      await fs.writeFile(inputFile, diagram.code, 'utf8');
      const command = `dot -Tsvg "${inputFile}" -o "${outputFile}" -Gbgcolor=white -Gfontname="Arial" -Nfontname="Arial" -Efontname="Arial"`;
      execSync(command, { stdio: 'pipe' });

      if (await fs.pathExists(outputFile)) {
        // Post-process SVG for Confluence compatibility
        await this.optimizeSVGForConfluence(outputFile);
        console.log(chalk.green(`✅ Generated Graphviz diagram: ${diagram.id}.svg`));
        return outputFile;
      }
      throw new Error('Output file not created');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to generate Graphviz diagram ${diagram.id}: ${error.message}`));
      return null;
    } finally {
      if (await fs.pathExists(inputFile)) {
        // await fs.remove(inputFile);
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
      const platform = process.platform;
      let command;
      
      if (platform === 'darwin') {
        command = 'brew install d2';
      } else if (platform === 'linux') {
        command = 'curl -fsSL https://d2lang.com/install.sh | sh -';
      } else if (platform === 'win32') {
        console.log(chalk.yellow('Please install D2 manually from: https://d2lang.com/tour/install'));
        return false;
      }
      
      execSync(command, { stdio: 'inherit' });
      console.log(chalk.green('✅ D2 installed successfully'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to install D2:', error.message));
      return false;
    }
  }

  /**
   * Optimize D2 SVG specifically for Confluence compatibility
   * D2 generates nested SVG structures that need special handling
   */
  async optimizeD2SVGForConfluence(svgPath) {
    try {
      let svgContent = await fs.readFile(svgPath, 'utf8');
      
      // D2 creates nested SVG structures - we need to flatten them
      // The outer SVG often has proper dimensions, inner SVG may have issues
      
      // Extract dimensions from the outer SVG
      const outerSVGMatch = svgContent.match(/<svg[^>]*>/);
      if (outerSVGMatch) {
        const outerSVG = outerSVGMatch[0];
        const viewBoxMatch = outerSVG.match(/viewBox="([^"]+)"/);
        
        if (viewBoxMatch) {
          const [, viewBox] = viewBoxMatch;
          const [x, y, width, height] = viewBox.split(' ').map(Number);
          
          // Ensure we have valid dimensions
          if (width > 0 && height > 0) {
            // Fix any nested SVG that might have zero dimensions
            svgContent = svgContent.replace(/<svg[^>]*width="0"[^>]*>/g, (match) => {
              return match.replace(/width="0"/, `width="${width}"`);
            });
            
            svgContent = svgContent.replace(/<svg[^>]*height="0"[^>]*>/g, (match) => {
              return match.replace(/height="0"/, `height="${height}"`);
            });
            
            // Ensure the main SVG has explicit width and height
            if (!outerSVG.includes('width=')) {
              svgContent = svgContent.replace('<svg', `<svg width="${width}" height="${height}"`);
            }
          }
        }
      }
      
      // Ensure proper SVG namespace
      if (!svgContent.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      
      // D2 usually generates proper backgrounds, but ensure white background
      if (!svgContent.includes('fill="#FFFFFF"') && !svgContent.includes('fill="white"')) {
        const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
        if (viewBoxMatch) {
          const [, viewBox] = viewBoxMatch;
          const [x, y, width, height] = viewBox.split(' ');
          const backgroundRect = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white" stroke="none"/>`;
          svgContent = svgContent.replace(/(<svg[^>]*>)/, `$1\n${backgroundRect}`);
        }
      }
      
      // Ensure proper font fallbacks for D2 text elements
      svgContent = svgContent.replace(/font-family="[^"]*"/g, 'font-family="Arial, Helvetica, sans-serif"');
      
      // Fix any potential CSS issues
      svgContent = svgContent.replace(/style="[^"]*max-width:[^"]*"/g, '');
      
      // Ensure proper encoding
      if (!svgContent.includes('encoding=')) {
        svgContent = svgContent.replace('<?xml version="1.0"', '<?xml version="1.0" encoding="UTF-8"');
      }
      
      // Minify while preserving structure
      svgContent = svgContent.replace(/>\s+</g, '><');
      svgContent = svgContent.replace(/\s+/g, ' ');
      svgContent = svgContent.trim();
      
      await fs.writeFile(svgPath, svgContent, 'utf8');
      
      console.log(chalk.gray(`🔧 Optimized D2 SVG for Confluence compatibility`));
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to optimize D2 SVG: ${error.message}`));
      // Fallback to general optimization
      await this.optimizeSVGForConfluence(svgPath);
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

  async generateD2Image(diagram) {
    const inputFile = path.join(this.tempDir, `${diagram.id}.d2`);
    const outputFile = path.join(this.tempDir, `${diagram.id}.svg`);

    try {
      // Validate and fix D2 syntax
      const fixedCode = this.validateAndFixD2Syntax(diagram.code);
      
      await fs.writeFile(inputFile, fixedCode, 'utf8');
      
      // Generate with optimized settings for Confluence
      const command = `d2 "${inputFile}" "${outputFile}" --theme=0 --layout=dagre --pad=20`;
      execSync(command, { stdio: 'pipe' });

      if (await fs.pathExists(outputFile)) {
        // Post-process SVG for Confluence compatibility - D2 specific optimization
        await this.optimizeD2SVGForConfluence(outputFile);
        console.log(chalk.green(`✅ Generated D2 diagram: ${diagram.id}.svg`));
        return outputFile;
      }
      throw new Error('Output file not created');
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
      
      console.warn(chalk.yellow(`⚠️ Failed to generate D2 diagram ${diagram.id}: ${errorMessage}`));
      return null;
    } finally {
      if (await fs.pathExists(inputFile)) {
        // await fs.remove(inputFile);
      }
    }
  }

  // ===========================================
  // UNIVERSAL PROCESSING METHODS
  // ===========================================

  /**
   * Upload diagram image to Confluence page
   */
  async uploadDiagramImage(pageId, imagePath, diagram) {
    const fileName = `${diagram.id}.${diagram.config.extension}`;
    
    // Check if already uploaded
    const cacheKey = `${pageId}:${fileName}`;
    if (this.processedDiagrams.has(cacheKey)) {
      return this.processedDiagrams.get(cacheKey);
    }

    try {
      console.log(chalk.blue(`📤 Uploading ${diagram.type} diagram: ${fileName}`));

      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', fs.createReadStream(imagePath), {
        filename: fileName,
        contentType: diagram.config.contentType
      });
      
      form.append('comment', `${diagram.type.charAt(0).toUpperCase() + diagram.type.slice(1)} diagram generated by DocFlu CLI`);
      form.append('minorEdit', 'true');

      // Check if attachment already exists and delete it first
      try {
        const existingAttachments = await this.confluenceClient.api({
          method: 'GET',
          url: `/wiki/rest/api/content/${pageId}/child/attachment?filename=${fileName}`
        });

        if (existingAttachments.data.results.length > 0) {
          console.log(chalk.gray(`🔄 Deleting existing attachment: ${fileName}`));
          const existingId = existingAttachments.data.results[0].id;
          await this.confluenceClient.api({
            method: 'DELETE',
            url: `/wiki/rest/api/content/${existingId}`
          });
        }
      } catch (error) {
        // Don't fail upload if we can't check/delete existing attachments
        console.log(chalk.gray(`Note: Could not check existing attachments: ${error.message}`));
      }

      // Upload to Confluence
      const response = await this.confluenceClient.api({
        method: 'POST',
        url: `/wiki/rest/api/content/${pageId}/child/attachment`,
        data: form,
        headers: {
          ...form.getHeaders(),
          'X-Atlassian-Token': 'no-check'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      const attachmentInfo = {
        id: response.data.results[0].id,
        title: response.data.results[0].title,
        downloadUrl: response.data.results[0]._links.download,
        webUrl: response.data.results[0]._links.webui,
        type: diagram.type,
        originalCode: diagram.code
      };

      console.log(`upload diagram ${attachmentInfo.id} webUrl: ${this.confluenceClient.config.baseUrl + "/wiki" + attachmentInfo.webUrl}`);

      // Cache the result
      this.processedDiagrams.set(cacheKey, attachmentInfo);
      
      // Get file size for logging
      const fileStats = await fs.stat(imagePath);
      console.log(chalk.green(`✅ Uploaded ${diagram.type} diagram: ${fileName} (${(fileStats.size / 1024).toFixed(2)} KB)`));
      return attachmentInfo;

    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to upload ${diagram.type} diagram ${fileName}: ${error.message}`));
      return null;
    }
  }

  /**
   * Upload Mermaid source file (.mmd) to Confluence for plugin integration
   */
  async uploadMermaidSourceFile(pageId, diagram) {
    const fileName = `${diagram.id}.mmd`;
    
    // Check if already uploaded
    const cacheKey = `${pageId}:${fileName}`;
    if (this.processedDiagrams.has(cacheKey)) {
      return this.processedDiagrams.get(cacheKey);
    }

    try {
      console.log(chalk.blue(`📤 Uploading Mermaid source file: ${fileName}`));

      const FormData = require('form-data');
      const form = new FormData();
      
      // Create the .mmd file content
      const mmdContent = diagram.code.trim();
      
      // Create a buffer from the content
      const fileBuffer = Buffer.from(mmdContent, 'utf8');
      
      form.append('file', fileBuffer, {
        filename: fileName,
        contentType: 'text/plain'
      });
      
      form.append('comment', `Mermaid diagram source file generated by DocFlu CLI`);
      form.append('minorEdit', 'true');

      // Check if attachment already exists and delete it first
      try {
        const existingAttachments = await this.confluenceClient.api({
          method: 'GET',
          url: `/wiki/rest/api/content/${pageId}/child/attachment?filename=${fileName}`
        });

        if (existingAttachments.data.results.length > 0) {
          console.log(chalk.gray(`🔄 Deleting existing Mermaid source: ${fileName}`));
          const existingId = existingAttachments.data.results[0].id;
          await this.confluenceClient.api({
            method: 'DELETE',
            url: `/wiki/rest/api/content/${existingId}`
          });
        }
      } catch (error) {
        // Don't fail upload if we can't check/delete existing attachments
        console.log(chalk.gray(`Note: Could not check existing attachments: ${error.message}`));
      }

      // Upload to Confluence
      const response = await this.confluenceClient.api({
        method: 'POST',
        url: `/wiki/rest/api/content/${pageId}/child/attachment`,
        data: form,
        headers: {
          ...form.getHeaders(),
          'X-Atlassian-Token': 'no-check'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      const attachmentInfo = {
        id: response.data.results[0].id,
        title: response.data.results[0].title,
        filename: fileName,
        downloadUrl: response.data.results[0]._links.download,
        webUrl: response.data.results[0]._links.webui,
        type: 'mermaid-attachment',
        originalCode: diagram.code,
        pluginName: this.options.mermaidPluginName
      };

      console.log(`upload mermaid source ${attachmentInfo.id} webUrl: ${this.confluenceClient.config.baseUrl + "/wiki" + attachmentInfo.webUrl}`);

      // Cache the result
      this.processedDiagrams.set(cacheKey, attachmentInfo);
      
      console.log(chalk.green(`✅ Uploaded Mermaid source file: ${fileName} (${fileBuffer.length} bytes)`));
      return attachmentInfo;

    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to upload Mermaid source file ${fileName}: ${error.message}`));
      return null;
    }
  }

  /**
   * Convert Confluence diagram images back to code blocks for bidirectional sync
   */
  convertConfluenceDiagramsToMarkdown(confluenceContent) {
    let processedContent = confluenceContent;
    
    // Handle mermaid attachment plugin macros first (support multiple plugin names)
    const mermaidPluginNames = ['mermaid', 'mermaid-cloud', 'mermaid-diagram', 'mermaid-chart'];
    
    for (const pluginName of mermaidPluginNames) {
      const escapedPluginName = pluginName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const mermaidAttachmentRegex = new RegExp(
        `<ac:structured-macro ac:name="${escapedPluginName}">\\s*<ac:parameter ac:name="attachment">([^<]*)</ac:parameter>\\s*</ac:structured-macro>\\s*<!-- DOCFLU_DIAGRAM_START:mermaid -->\\s*<!-- DOCFLU_DIAGRAM_METADATA:mermaid:([^>]+) -->\\s*<!-- DOCFLU_DIAGRAM_END:mermaid -->`,
        'g'
      );
      
      processedContent = processedContent.replace(mermaidAttachmentRegex, (match, attachmentFilename, encodedCode) => {
        try {
          const decodedCode = Buffer.from(encodedCode, 'base64').toString('utf8');
          return `\n\`\`\`mermaid\n${decodedCode}\n\`\`\`\n`;
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Failed to decode mermaid attachment metadata for ${pluginName}: ${error.message}`));
          // For attachment-based macros, we can't fallback to content since it's in the .mmd file
          // We'll need to preserve the macro for manual handling
          return match;
        }
      });
    }
    
    // Look for diagram metadata comments and convert back to code blocks (for image-based diagrams)
    const diagramMetadataRegex = /<!-- DOCFLU_DIAGRAM_START:([^>]+) -->\s*<!-- DOCFLU_DIAGRAM_METADATA:([^:]+):([^>]+) -->\s*<!-- DOCFLU_DIAGRAM_END:[^>]+ -->/g;
    
    let match;
    
    while ((match = diagramMetadataRegex.exec(processedContent)) !== null) {
      const [fullMatch, startType, type, encodedCode] = match;
      
      try {
        const decodedCode = Buffer.from(encodedCode, 'base64').toString('utf8');
        
        // Find the preceding image block and replace with code block
        // Updated pattern to match the new format with start/end markers
        const diagramTitle = type.charAt(0).toUpperCase() + type.slice(1);
        const imageRegexPattern = `<ac:image ac:align="center" ac:layout="center">\\s*<ri:attachment ri:filename="[^"]*" />\\s*</ac:image>\\s*<p style="text-align: center;"><em>${diagramTitle} Diagram</em></p>\\s*${fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
        const imageRegex = new RegExp(imageRegexPattern, 'gi');
        
        // Replace with markdown code block
        processedContent = processedContent.replace(imageRegex, `\n\`\`\`${type}\n${decodedCode}\n\`\`\`\n`);
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Failed to decode diagram metadata: ${error.message}`));
      }
    }
    
    return processedContent;
  }

  /**
   * Process all diagrams for a page
   */
  async processAllDiagrams(pageId, markdownContent) {
    // Extract all diagrams
    const diagrams = this.extractAllDiagrams(markdownContent);
    
    if (diagrams.length === 0) {
      return {
        stats: { total: 0, processed: 0, failed: 0, byType: {} }
      };
    }

    console.log(chalk.blue(`🎨 Found ${diagrams.length} diagram(s) to process (${Object.keys(this.diagramTypes).join(', ')})`));

    const diagramMap = new Map();
    let processedCount = 0;
    let failedCount = 0;
    const statsByType = {};

    // Initialize stats by type
    for (const type of Object.keys(this.diagramTypes)) {
      statsByType[type] = { total: 0, processed: 0, failed: 0 };
    }

    // Group diagrams by type for better processing
    const diagramsByType = {};
    for (const diagram of diagrams) {
      if (!diagramsByType[diagram.type]) {
        diagramsByType[diagram.type] = [];
      }
      diagramsByType[diagram.type].push(diagram);
      statsByType[diagram.type].total++;
    }

    // Process each type
    for (const [type, typeDiagrams] of Object.entries(diagramsByType)) {
      const config = this.diagramTypes[type];
      
      // Special handling for Mermaid when using plugin
      if (type === 'mermaid' && config.usePlugin) {
        console.log(chalk.blue(`🔌 Processing Mermaid diagrams using Confluence plugin integration`));
        
        // For plugin mode, we need to upload .mmd files as attachments
        for (const diagram of typeDiagrams) {
          try {
            // Upload .mmd source file to Confluence
            const attachmentInfo = await this.uploadMermaidSourceFile(pageId, diagram);
            if (attachmentInfo) {
              diagramMap.set(diagram.id, {
                ...attachmentInfo,
                type: 'mermaid-attachment',
                usePlugin: true
              });
              processedCount++;
              statsByType[type].processed++;
            } else {
              failedCount++;
              statsByType[type].failed++;
            }
          } catch (error) {
            console.warn(chalk.yellow(`⚠️ Error uploading Mermaid source ${diagram.id}: ${error.message}`));
            failedCount++;
            statsByType[type].failed++;
          }
        }
        
        console.log(chalk.green(`🔌 Processed ${typeDiagrams.length} Mermaid diagrams for plugin integration`));
        continue;
      }
      
      // Standard processing for other diagram types or Mermaid in SVG mode
      if (!config.checker || !config.generator) {
        console.log(chalk.yellow(`⚠️ ${type.charAt(0).toUpperCase() + type.slice(1)} processor not configured. Skipping...`));
        failedCount += typeDiagrams.length;
        statsByType[type].failed = typeDiagrams.length;
        continue;
      }
      
      // Check if CLI is available
      const hasCLI = await config.checker();
      if (!hasCLI) {
        console.log(chalk.yellow(`⚠️ ${type.charAt(0).toUpperCase() + type.slice(1)} CLI not found. Attempting to install...`));
        const installed = await config.installer();
        if (!installed) {
          console.log(chalk.red(`❌ Cannot process ${type} diagrams without CLI. Skipping...`));
          failedCount += typeDiagrams.length;
          statsByType[type].failed = typeDiagrams.length;
          continue;
        }
      }

      // Process diagrams of this type
      for (const diagram of typeDiagrams) {
        try {
          // Generate image
          const imagePath = await config.generator(diagram);
          if (!imagePath) {
            failedCount++;
            statsByType[type].failed++;
            continue;
          }

          // Upload to Confluence
          const attachmentInfo = await this.uploadDiagramImage(pageId, imagePath, diagram);
          if (attachmentInfo) {
            diagramMap.set(diagram.id, attachmentInfo);
            processedCount++;
            statsByType[type].processed++;
          } else {
            failedCount++;
            statsByType[type].failed++;
          }

          // Clean up temp image file
          if (await fs.pathExists(imagePath)) {
            // await fs.remove(imagePath);
          }

        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Error processing ${type} diagram ${diagram.id}: ${error.message}`));
          failedCount++;
          statsByType[type].failed++;
        }
      }
    }

    const stats = {
      total: diagrams.length,
      processed: processedCount,
      failed: failedCount,
      byType: statsByType
    };

    if (processedCount > 0) {
      console.log(chalk.green(`🎨 Processed ${processedCount}/${diagrams.length} diagrams`));
      for (const [type, typeStats] of Object.entries(statsByType)) {
        if (typeStats.total > 0) {
          console.log(chalk.gray(`  ${type}: ${typeStats.processed}/${typeStats.total} processed`));
        }
      }
    }

    return { stats, diagramMap };
  }

  /**
   * Clean up temp directory
   */
  async cleanup() {
    try {
      if (await fs.pathExists(this.tempDir)) {
        // await fs.remove(this.tempDir);
        console.log(chalk.gray('🧹 Cleaned up diagram temp directory'));
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to cleanup diagram temp directory: ${error.message}`));
    }
  }
}

module.exports = DiagramProcessor; 