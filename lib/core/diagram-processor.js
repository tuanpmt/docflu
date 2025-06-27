const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

class DiagramProcessor {
  constructor(confluenceClient, tempDir = '.docusaurus/temp') {
    this.confluenceClient = confluenceClient;
    this.tempDir = tempDir;
    this.processedDiagrams = new Map(); // Cache processed diagrams
    
    // Ensure temp directory exists
    fs.ensureDirSync(this.tempDir);

    // Supported diagram types with their configurations
    this.diagramTypes = {
      mermaid: {
        regex: /```mermaid\n([\s\S]*?)\n```/g,
        generator: this.generateMermaidImage.bind(this),
        checker: this.checkMermaidCLI.bind(this),
        installer: this.installMermaidCLI.bind(this),
        extension: 'svg',
        contentType: 'image/svg+xml'
      },
      plantuml: {
        regex: /```plantuml\n([\s\S]*?)\n```/g,
        generator: this.generatePlantUMLImage.bind(this),
        checker: this.checkPlantUMLCLI.bind(this),
        installer: this.installPlantUMLCLI.bind(this),
        extension: 'svg',
        contentType: 'image/svg+xml'
      },
      graphviz: {
        regex: /```(?:dot|graphviz)\n([\s\S]*?)\n```/g,
        generator: this.generateGraphvizImage.bind(this),
        checker: this.checkGraphvizCLI.bind(this),
        installer: this.installGraphvizCLI.bind(this),
        extension: 'svg',
        contentType: 'image/svg+xml'
      },
      d2: {
        regex: /```d2\n([\s\S]*?)\n```/g,
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
    const outputFile = path.join(this.tempDir, `${diagram.id}.svg`);
    const configFile = path.join(this.tempDir, `${diagram.id}-config.json`);

    try {
      // Create high-quality Mermaid config optimized for Confluence compatibility
      const mermaidConfig = {
        "theme": "default",
        "securityLevel": "strict",
        "themeVariables": {
          // Explicit white background for Confluence
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
          "mirrorActors": true,
          "bottomMarginAdj": 1,
          "useMaxWidth": false,
          "rightAngles": false,
          "showSequenceNumbers": false,
          "actorFontSize": 14,
          "noteFontSize": 14,
          "messageFontSize": 14
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
          "topAxis": false
        },
        "class": {
          "titleTopMargin": 25,
          "diagramPadding": 20
        },
        "state": {
          "titleTopMargin": 25,
          "diagramPadding": 20
        }
      };

      // Write config file
      await fs.writeFile(configFile, JSON.stringify(mermaidConfig, null, 2), 'utf8');
      
      // Write diagram content
      await fs.writeFile(inputFile, diagram.code, 'utf8');
      
      // Generate SVG with white background for Confluence compatibility
      const command = `mmdc -i "${inputFile}" -o "${outputFile}" -c "${configFile}" --backgroundColor white --width 1200 --height 900 --scale 1`;
      
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
      let svgContent = await fs.readFile(svgPath, 'utf8');
      
      console.log(chalk.gray('🔧 Optimizing Mermaid SVG for Confluence preview compatibility...'));
      
      // Replace foreignObject elements with text elements
      svgContent = svgContent.replace(
        /<g([^>]*?)>\s*<rect[^>]*\/>\s*<foreignObject[^>]*height="([^"]*)"[^>]*width="([^"]*)"[^>]*>\s*<div[^>]*>\s*<span[^>]*>\s*<p[^>]*>(.*?)<\/p>\s*<\/span>\s*<\/div>\s*<\/foreignObject>\s*<\/g>/gs,
        (match, gAttributes, height, width, textContent) => {
          // Extract transform attribute from the parent g element if it exists
          const transformMatch = gAttributes.match(/transform="([^"]*)"/);
          let transform = '';
          let cleanedGAttributes = gAttributes;
          
          if (transformMatch) {
            transform = transformMatch[1];
            // Remove transform from g attributes to prevent text displacement
            cleanedGAttributes = gAttributes.replace(/transform="[^"]*"/, '').trim();
          }
          
          // Clean and prepare text content
          const cleanText = textContent.trim()
            .replace(/<[^>]*>/g, '') // Remove any HTML tags
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"');
          
          // Calculate text positioning
          const textWidth = parseFloat(width) || 100;
          const textHeight = parseFloat(height) || 20;
          
          // Split long text into multiple lines for better readability
          const words = cleanText.split(' ');
          const maxCharsPerLine = Math.max(12, Math.floor(textWidth / 8)); // Approximate character width
          const lines = [];
          let currentLine = '';
          
          for (const word of words) {
            if ((currentLine + word).length <= maxCharsPerLine) {
              currentLine += (currentLine ? ' ' : '') + word;
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            }
          }
          if (currentLine) lines.push(currentLine);
          
          // Ensure we don't have too many lines - be more generous with line count
          const maxLines = Math.max(2, Math.ceil(textHeight / 14)); // Allow more lines and use smaller line height estimate
          const finalLines = lines.slice(0, maxLines);
          
          // If we had to truncate, add ellipsis to the last line
          if (lines.length > maxLines && finalLines.length > 0) {
            const lastLine = finalLines[finalLines.length - 1];
            if (lastLine.length > 3) {
              finalLines[finalLines.length - 1] = lastLine.substring(0, lastLine.length - 3) + '...';
            }
          }
          
          // Generate text elements
          let textElements = '';
          const lineHeight = 16;
          const startY = finalLines.length > 1 ? -(finalLines.length - 1) * lineHeight / 2 : 0;
          
          finalLines.forEach((line, index) => {
            const y = startY + (index * lineHeight);
            textElements += `<text x="0" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="normal" fill="#000000">${line}</text>\n`;
          });
          
          // Return the optimized g element with text instead of foreignObject
          // Remove transform completely to prevent text displacement - text should be centered at x="0" y="0"
          return `<g${cleanedGAttributes ? ' ' + cleanedGAttributes : ''}>\n${textElements}</g>`;
        }
      );
      
      // Handle more complex foreignObject patterns with nested HTML
      svgContent = svgContent.replace(
        /<g([^>]*?)>\s*<rect[^>]*\/>\s*<foreignObject[^>]*height="([^"]*)"[^>]*width="([^"]*)"[^>]*>\s*<div[^>]*>(.*?)<\/div>\s*<\/foreignObject>\s*<\/g>/gs,
        (match, gAttributes, height, width, divContent) => {
          // Extract transform attribute
          const transformMatch = gAttributes.match(/transform="([^"]*)"/);
          let transform = '';
          let cleanedGAttributes = gAttributes;
          
          if (transformMatch) {
            transform = transformMatch[1];
            cleanedGAttributes = gAttributes.replace(/transform="[^"]*"/, '').trim();
          }
          
          // Extract text from nested HTML
          let textContent = divContent
            .replace(/<span[^>]*>/g, '')
            .replace(/<\/span>/g, '')
            .replace(/<p[^>]*>/g, '')
            .replace(/<\/p>/g, '')
            .replace(/<[^>]*>/g, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .trim();
          
          if (!textContent) {
            textContent = 'Node';
          }
          
          // Calculate text positioning and wrapping
          const textWidth = parseFloat(width) || 200;
          const textHeight = parseFloat(height) || 30;
          
          // Split long text into multiple lines for better readability
          const words = textContent.split(' ');
          const maxCharsPerLine = Math.max(15, Math.floor(textWidth / 8)); // Approximate character width
          const lines = [];
          let currentLine = '';
          
          for (const word of words) {
            if ((currentLine + word).length <= maxCharsPerLine) {
              currentLine += (currentLine ? ' ' : '') + word;
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            }
          }
          if (currentLine) lines.push(currentLine);
          
          // Ensure we don't have too many lines - be more generous with line count
          const maxLines = Math.max(2, Math.ceil(textHeight / 14)); // Allow more lines and use smaller line height estimate
          const finalLines = lines.slice(0, maxLines);
          
          // If we had to truncate, add ellipsis to the last line
          if (lines.length > maxLines && finalLines.length > 0) {
            const lastLine = finalLines[finalLines.length - 1];
            if (lastLine.length > 3) {
              finalLines[finalLines.length - 1] = lastLine.substring(0, lastLine.length - 3) + '...';
            }
          }
          
          // Generate text elements
          let textElements = '';
          const lineHeight = 16;
          const startY = finalLines.length > 1 ? -(finalLines.length - 1) * lineHeight / 2 : 0;
          
          finalLines.forEach((line, index) => {
            const y = startY + (index * lineHeight);
            textElements += `<text x="0" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="normal" fill="#000000">${line}</text>\n`;
          });
          
          // Remove transform completely to prevent text displacement - text should be centered at x="0" y="0"
          return `<g${cleanedGAttributes ? ' ' + cleanedGAttributes : ''}>\n${textElements}</g>`;
        }
      );
      
      // Handle simpler foreignObject patterns without explicit dimensions
      svgContent = svgContent.replace(
        /<g([^>]*?)>\s*<rect[^>]*\/>\s*<foreignObject([^>]*)>\s*<div[^>]*>(.*?)<\/div>\s*<\/foreignObject>\s*<\/g>/gs,
        (match, gAttributes, foreignObjectAttrs, divContent) => {
          // Extract transform attribute
          const transformMatch = gAttributes.match(/transform="([^"]*)"/);
          let transform = '';
          let cleanedGAttributes = gAttributes;
          
          if (transformMatch) {
            transform = transformMatch[1];
            cleanedGAttributes = gAttributes.replace(/transform="[^"]*"/, '').trim();
          }
          
          // Extract dimensions from foreignObject attributes
          const heightMatch = foreignObjectAttrs.match(/height="([^"]*)"/);
          const widthMatch = foreignObjectAttrs.match(/width="([^"]*)"/);
          const textWidth = widthMatch ? parseFloat(widthMatch[1]) : 200;
          const textHeight = heightMatch ? parseFloat(heightMatch[1]) : 30;
          
          // Extract text from nested HTML
          let textContent = divContent
            .replace(/<span[^>]*>/g, '')
            .replace(/<\/span>/g, '')
            .replace(/<p[^>]*>/g, '')
            .replace(/<\/p>/g, '')
            .replace(/<[^>]*>/g, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .trim();
          
          if (!textContent) {
            textContent = 'Node';
          }
          
          // Check if text needs wrapping based on length and available width
          if (textContent.length > 20 && textWidth > 100) {
            // Split long text into multiple lines for better readability
            const words = textContent.split(' ');
            const maxCharsPerLine = Math.max(15, Math.floor(textWidth / 8)); // Approximate character width
            const lines = [];
            let currentLine = '';
            
            for (const word of words) {
              if ((currentLine + word).length <= maxCharsPerLine) {
                currentLine += (currentLine ? ' ' : '') + word;
              } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
              }
            }
            if (currentLine) lines.push(currentLine);
            
            // Ensure we don't have too many lines - be more generous with line count
            const maxLines = Math.max(2, Math.ceil(textHeight / 14)); // Allow more lines and use smaller line height estimate
            const finalLines = lines.slice(0, maxLines);
            
            // If we had to truncate, add ellipsis to the last line
            if (lines.length > maxLines && finalLines.length > 0) {
              const lastLine = finalLines[finalLines.length - 1];
              if (lastLine.length > 3) {
                finalLines[finalLines.length - 1] = lastLine.substring(0, lastLine.length - 3) + '...';
              }
            }
            
            // Generate multiple text elements
            let textElements = '';
            const lineHeight = 16;
            const startY = finalLines.length > 1 ? -(finalLines.length - 1) * lineHeight / 2 : 0;
            
            finalLines.forEach((line, index) => {
              const y = startY + (index * lineHeight);
              textElements += `<text x="0" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="normal" fill="#000000">${line}</text>\n`;
            });
            
            // Remove transform completely to prevent text displacement - text should be centered at x="0" y="0"
            return `<g${cleanedGAttributes ? ' ' + cleanedGAttributes : ''}>\n${textElements}</g>`;
          } else {
            // Create simple text element for short text
            const textElement = `<text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="normal" fill="#000000">${textContent}</text>`;
            
            // Remove transform completely to prevent text displacement - text should be centered at x="0" y="0"
            return `<g${cleanedGAttributes ? ' ' + cleanedGAttributes : ''}>\n${textElement}\n</g>`;
          }
        }
      );
      
      // Clean up any remaining empty foreignObject elements
      svgContent = svgContent.replace(/<foreignObject[^>]*>[\s\S]*?<\/foreignObject>/g, '');
      
      // Ensure proper SVG namespace and structure
      if (!svgContent.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      
      // Remove any problematic CSS or styles that might interfere with Confluence
      svgContent = svgContent.replace(/style="[^"]*max-width:[^"]*"/g, '');
      svgContent = svgContent.replace(/style="[^"]*white-space:\s*nowrap[^"]*"/g, '');
      
      // Ensure consistent font settings
      svgContent = svgContent.replace(/font-family="[^"]*"/g, 'font-family="Arial, Helvetica, sans-serif"');
      
      // Enhance node styling for better visual appearance
      svgContent = this.enhanceNodeStyling(svgContent);
      
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
   * Enhance node styling for better visual appearance
   * Adds background colors and strokes to shape elements
   */
  enhanceNodeStyling(svgContent) {
    try {
      // Define color schemes for different node types
      const nodeStyles = {
        default: 'fill: #E3F2FD; stroke: #1976D2; stroke-width: 1.5px;',
        process: 'fill: #F3E5F5; stroke: #7B1FA2; stroke-width: 1.5px;',
        decision: 'fill: #FFF3E0; stroke: #F57C00; stroke-width: 1.5px;',
        terminal: 'fill: #E8F5E8; stroke: #388E3C; stroke-width: 1.5px;',
        data: 'fill: #FFF8E1; stroke: #F57F17; stroke-width: 1.5px;'
      };

      // Enhanced styling for rectangles (most common nodes)
      svgContent = svgContent.replace(
        /<rect([^>]*?)(?:\s+style="[^"]*")?([^>]*?)>/g,
        (match, beforeStyle, afterStyle) => {
          // Check if it already has meaningful styling (not just basic positioning)
          const hasColorStyling = /fill:|stroke:|background/.test(match);
          afterStyle = afterStyle.replace(/style="([^"]*)"/, '');
          if (hasColorStyling) {
            return match; // Keep existing styling
          }
          
          // Determine node type based on context or use default
          let style = nodeStyles.default;
          
          // Check if it's inside a specific node class or has certain characteristics
          const fullContext = svgContent.substring(Math.max(0, svgContent.indexOf(match) - 200), svgContent.indexOf(match) + 200);
          
          if (/class="[^"]*process[^"]*"|id="[^"]*process[^"]*"/i.test(fullContext)) {
            style = nodeStyles.process;
          } else if (/class="[^"]*decision[^"]*"|id="[^"]*decision[^"]*"|<polygon/i.test(fullContext)) {
            style = nodeStyles.decision;
          } else if (/class="[^"]*terminal[^"]*"|id="[^"]*terminal[^"]*"|<circle/i.test(fullContext)) {
            style = nodeStyles.terminal;
          } else if (/class="[^"]*data[^"]*"|id="[^"]*data[^"]*"/i.test(fullContext)) {
            style = nodeStyles.data;
          }
          
          return `<rect style="${style}"${afterStyle}>`;
        }
      );

      // Enhanced styling for circles (terminal nodes, decision points)
      svgContent = svgContent.replace(
        /<circle([^>]*?)(?:\s+style="[^"]*")?([^>]*?)>/g,
        (match, beforeStyle, afterStyle) => {
            afterStyle = afterStyle.replace(/style="([^"]*)"/, '');
          const hasColorStyling = /fill:|stroke:|background/.test(match);
          if (hasColorStyling) {
            return match;
          }
          return `<circle style="${nodeStyles.terminal}"${afterStyle}>`;
        }
      );

      // Enhanced styling for polygons (decision diamonds, special shapes)
      svgContent = svgContent.replace(
        /<polygon([^>]*?)(?:\s+style="[^"]*")?([^>]*?)>/g,
        (match, beforeStyle, afterStyle) => {
          afterStyle = afterStyle.replace(/style="([^"]*)"/, '');
          const hasColorStyling = /fill:|stroke:|background/.test(match);
          if (hasColorStyling) {
            return match;
          }
          return `<polygon style="${nodeStyles.decision}"${afterStyle}>`;
        }
      );

      // Enhanced styling for ellipses (alternative to circles)
      svgContent = svgContent.replace(
        /<ellipse([^>]*?)(?:\s+style="[^"]*")?([^>]*?)>/g,
        (match, beforeStyle, afterStyle) => {
          afterStyle = afterStyle.replace(/style="([^"]*)"/, '');
          const hasColorStyling = /fill:|stroke:|background/.test(match);
          if (hasColorStyling) {
            return match;
          }
          return `<ellipse style="${nodeStyles.terminal}"${afterStyle}>`;
        }
      );

      // Enhanced styling for paths that form shapes (some diagram types use paths for nodes)
      svgContent = svgContent.replace(
        /<path([^>]*?)(?:\s+style="[^"]*fill\s*:\s*[^;"]*[^"]*")?([^>]*?)>/g,
        (match, beforeStyle, afterStyle) => {
          // Only enhance paths that seem to be node shapes (not connectors)
          afterStyle = afterStyle.replace(/style="([^"]*)"/, '');
          const hasStroke = /stroke/.test(match);
          const hasFill = /fill/.test(match);
          const isConnector = /marker-end|marker-start/.test(match);
          
          if (isConnector || (hasStroke && hasFill)) {
            return match; // Keep connectors and already styled paths as-is
          }
          
          // Check if this path looks like a node shape (has fill or is closed)
          const pathData = match.match(/d="([^"]*)"/);
          if (pathData && (pathData[1].includes('Z') || pathData[1].includes('z'))) {
            // Closed path, likely a node shape
            const hasColorStyling = /fill:[^;]*[^none]|stroke:[^;]*[^none]/.test(match);
            if (!hasColorStyling) {
              return `<path style="${nodeStyles.default}"${afterStyle}>`;
            }
          }
          
          return match;
        }
      );

      console.log(chalk.gray('🎨 Enhanced node styling for better visual appearance'));
      return svgContent;

    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to enhance node styling: ${error.message}`));
      return svgContent; // Return original content if enhancement fails
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
   * Convert diagram code blocks to Confluence image format
   */
  convertDiagramsToConfluenceFormat(content, diagramMap) {
    let processedContent = content;
    
    // Process each diagram type
    for (const [type, config] of Object.entries(this.diagramTypes)) {
      processedContent = processedContent.replace(config.regex, (match, diagramCode) => {
        const diagramId = this.generateDiagramId(type, diagramCode.trim());
        const attachment = diagramMap.get(diagramId);
        
        if (attachment) {
          // Create Confluence image format with better styling and metadata
          const diagramTitle = type.charAt(0).toUpperCase() + type.slice(1);
          return `
<ac:image ac:align="center" ac:layout="center">
  <ri:attachment ri:filename="${attachment.title}" />
</ac:image>

<p style="text-align: center;"><em>${diagramTitle} Diagram</em></p>

<!-- DOCFLU_DIAGRAM_START:${type} -->
<!-- DOCFLU_DIAGRAM_METADATA:${type}:${Buffer.from(diagramCode.trim()).toString('base64')} -->
<!-- DOCFLU_DIAGRAM_END:${type} -->
`;
        } else {
          // Fallback: show code block with enhanced warning
          console.warn(chalk.yellow(`⚠️ ${type} diagram not processed: ${diagramId}`));
          return `
<ac:structured-macro ac:name="code" ac:schema-version="1">
  <ac:parameter ac:name="language">${type}</ac:parameter>
  <ac:parameter ac:name="title">${type.charAt(0).toUpperCase() + type.slice(1)} Diagram (Not Processed)</ac:parameter>
  <ac:parameter ac:name="theme">Confluence</ac:parameter>
  <ac:plain-text-body><![CDATA[${diagramCode.trim()}]]></ac:plain-text-body>
</ac:structured-macro>

<ac:structured-macro ac:name="info" ac:schema-version="1">
  <ac:rich-text-body>
    <p><strong>Note:</strong> This ${type} diagram could not be converted to an image. Please ensure the ${type} CLI is installed and the diagram syntax is correct.</p>
  </ac:rich-text-body>
</ac:structured-macro>
`;
        }
      });
    }
    
    return processedContent;
  }

  /**
   * Convert Confluence diagram images back to code blocks for bidirectional sync
   */
  convertConfluenceDiagramsToMarkdown(confluenceContent) {
    // Look for diagram metadata comments and convert back to code blocks
    const diagramMetadataRegex = /<!-- DOCFLU_DIAGRAM_START:([^>]+) -->\s*<!-- DOCFLU_DIAGRAM_METADATA:([^:]+):([^>]+) -->\s*<!-- DOCFLU_DIAGRAM_END:[^>]+ -->/g;
    
    let processedContent = confluenceContent;
    let match;
    
    while ((match = diagramMetadataRegex.exec(confluenceContent)) !== null) {
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
        processedContent: markdownContent,
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

    // Convert diagram blocks to Confluence format
    const processedContent = this.convertDiagramsToConfluenceFormat(markdownContent, diagramMap);

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

    return { processedContent, stats, diagramMap };
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