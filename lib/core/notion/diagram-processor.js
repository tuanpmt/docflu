const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const crypto = require('crypto');

// Use Notion-specific processors (based on Google Docs approach)
const NotionMermaidProcessor = require('./mermaid-processor');
const NotionPlantUMLProcessor = require('./plantuml-processor');
const NotionGraphvizProcessor = require('./graphviz-processor');
const NotionD2Processor = require('./d2-processor');
const NotionFileUploader = require('./file-uploader');

/**
 * Notion Diagram Processor
 * Handles diagram processing for Notion using Notion-specific SVG processors
 * Based on Google Docs approach for optimal SVG generation
 */
class NotionDiagramProcessor {
  constructor(notionClient, state, config, authToken = null) {
    this.client = notionClient;
    this.state = state;
    this.config = config;
    this.authToken = authToken || process.env.NOTION_API_TOKEN;
    
    // Initialize Notion-specific processors
    this.mermaidProcessor = new NotionMermaidProcessor(notionClient);
    this.plantumlProcessor = new NotionPlantUMLProcessor(notionClient);
    this.graphvizProcessor = new NotionGraphvizProcessor(notionClient);
    this.d2Processor = new NotionD2Processor(notionClient);
    
    // Initialize file uploader for SVG uploads
    this.fileUploader = new NotionFileUploader(notionClient, this.authToken);
    
    // Initialize markdown converter for proper text processing
    this.markdownConverter = null; // Will be set later to avoid circular dependency
    
    // Diagram patterns
    this.patterns = {
      mermaid: /```mermaid\n([\s\S]*?)```/g,
      plantuml: /```plantuml\n([\s\S]*?)```/g,
      dot: /```dot\n([\s\S]*?)```/g,
      graphviz: /```graphviz\n([\s\S]*?)```/g,
      d2: /```d2\n([\s\S]*?)```/g
    };
    
    // Temporary directory for processing
    this.tempDir = path.join(process.cwd(), '.docflu', 'temp', 'notion-diagrams');
    fs.ensureDirSync(this.tempDir);
  }

  /**
   * Set markdown converter to avoid circular dependency
   * @param {MarkdownToBlocksConverter} converter - Markdown converter instance
   */
  setMarkdownConverter(converter) {
    this.markdownConverter = converter;
  }

  /**
   * Set image processor to avoid circular dependency
   * @param {NotionImageProcessor} imageProcessor - Image processor instance
   */
  setImageProcessor(imageProcessor) {
    this.imageProcessor = imageProcessor;
  }

  /**
   * Process markdown with diagrams and return Notion blocks directly
   * @param {string} markdown - Markdown content
   * @param {boolean} dryRun - Whether this is a dry run
   * @param {string} projectRoot - Project root directory
   * @returns {Array} Array of Notion blocks
   */
  async processMarkdownWithDiagrams(markdown, dryRun = false, projectRoot = null) {
    console.log(chalk.blue('🔄 Processing diagrams for Notion with direct SVG upload...'));
    
    const blocks = [];
    let diagramsProcessed = 0;
    
    // Safety measures to prevent infinite loops
    const MAX_ITERATIONS = 10000;
    const MAX_MARKDOWN_LENGTH = 1000000; // 1MB limit
    
    // Check markdown length
    if (markdown.length > MAX_MARKDOWN_LENGTH) {
      console.warn(chalk.yellow(`⚠️ Markdown too long (${markdown.length} chars), truncating for safety`));
      markdown = markdown.substring(0, MAX_MARKDOWN_LENGTH) + '\n\n[Content truncated for safety]';
    }
    
    // Split markdown into lines for processing
    const lines = markdown.split('\n');
    let i = 0;
    let currentTextBlock = [];
    let iterationCount = 0;
    
    while (i < lines.length && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      
      // Safety check for infinite loop
      if (iterationCount >= MAX_ITERATIONS) {
        console.error(chalk.red(`❌ Maximum iterations reached (${MAX_ITERATIONS}), breaking to prevent infinite loop`));
        break;
      }
      
      const line = lines[i];
      
      // Check if this line starts a code block
      const codeBlockMatch = line.match(/^```(\w+)$/);
      if (codeBlockMatch) {
        const language = codeBlockMatch[1];
        
        // If we have accumulated text, convert it to blocks first
        if (currentTextBlock.length > 0) {
          const textContent = currentTextBlock.join('\n').trim();
          if (textContent) {
            try {
              const textBlocks = await this.convertTextToBlocks(textContent, projectRoot);
              blocks.push(...textBlocks);
            } catch (error) {
              console.warn(chalk.yellow(`⚠️ Failed to convert text to blocks: ${error.message}`));
              // Add as simple paragraph
              blocks.push({
                type: 'paragraph',
                paragraph: {
                  rich_text: [{ text: { content: textContent } }]
                }
              });
            }
          }
          currentTextBlock = [];
        }
        
        // Find the end of the code block
        let j = i + 1;
        const codeLines = [];
        const MAX_CODE_LINES = 1000; // Safety limit
        
        while (j < lines.length && !lines[j].startsWith('```') && codeLines.length < MAX_CODE_LINES) {
          codeLines.push(lines[j]);
          j++;
        }
        
        if (j < lines.length) { // Found closing ```
          const codeContent = codeLines.join('\n').trim();
          
          // Check if this is a diagram language
          if (this.isDiagramLanguage(language)) {
            if (dryRun) {
              // Dry run: just analyze without generating
              console.log(chalk.cyan(`📊 DRY RUN: Found ${language.charAt(0).toUpperCase() + language.slice(1)} diagram (${codeContent.length} chars)`));
              blocks.push({
                type: 'paragraph',
                paragraph: {
                  rich_text: [{ 
                    text: { content: `[DRY RUN - ${language.toUpperCase()} Diagram]` },
                    annotations: { italic: true, color: 'blue' }
                  }]
                }
              });
              i = j + 1; // Skip past the closing ```
              continue;
            }
            
            // Process diagram code block
            const diagramId = `${language}-${crypto.createHash('md5').update(codeContent).digest('hex').substring(0, 8)}`;
            const diagram = {
              id: diagramId,
              code: codeContent,
              language: language
            };
            
            try {
              // Process diagram based on type
              let svgContent = null;
              let processingTime = Date.now();
              
              if (language === 'mermaid') {
                const mermaidFile = await this.mermaidProcessor.generateDiagramImage(diagram);
                if (mermaidFile) {
                  svgContent = await fs.readFile(mermaidFile, 'utf8');
                  // Upload SVG to Notion
                  const imageBlock = await this.fileUploader.uploadSvgToNotion(svgContent, `mermaid-diagram-${crypto.createHash('md5').update(svgContent).digest('hex').substring(0, 8)}.svg`);
                  if (imageBlock) {
                    blocks.push(imageBlock);
                    diagramsProcessed++;
                  }
                }
              } else if (language === 'plantuml') {
                const plantUMLFile = await this.plantumlProcessor.generatePlantUMLImage(diagram);
                if (plantUMLFile) {
                  svgContent = await fs.readFile(plantUMLFile, 'utf8');
                  // Upload SVG to Notion
                  const imageBlock = await this.fileUploader.uploadSvgToNotion(svgContent, `plantuml-diagram-${crypto.createHash('md5').update(svgContent).digest('hex').substring(0, 8)}.svg`);
                  if (imageBlock) {
                    blocks.push(imageBlock);
                    diagramsProcessed++;
                  }
                }
              } else if (language === 'dot' || language === 'graphviz') {
                const graphvizFile = await this.graphvizProcessor.generateGraphvizImage(diagram);
                if (graphvizFile) {
                  svgContent = await fs.readFile(graphvizFile, 'utf8');
                  // Upload SVG to Notion
                  const imageBlock = await this.fileUploader.uploadSvgToNotion(svgContent, `dot-diagram-${crypto.createHash('md5').update(svgContent).digest('hex').substring(0, 8)}.svg`);
                  if (imageBlock) {
                    blocks.push(imageBlock);
                    diagramsProcessed++;
                  }
                }
              } else if (language === 'd2') {
                const d2File = await this.d2Processor.generateD2Image(diagram);
                if (d2File) {
                  svgContent = await fs.readFile(d2File, 'utf8');
                  // Upload SVG to Notion
                  const imageBlock = await this.fileUploader.uploadSvgToNotion(svgContent, `d2-diagram-${crypto.createHash('md5').update(svgContent).digest('hex').substring(0, 8)}.svg`);
                  if (imageBlock) {
                    blocks.push(imageBlock);
                    diagramsProcessed++;
                  }
                }
              }
              
              processingTime = Date.now() - processingTime;
              
              if (svgContent) {
                console.log(chalk.green(`✅ Processed ${language} diagram and uploaded`));
              } else {
                console.log(chalk.yellow(`⚠️ Failed to process ${language} diagram`));
              }
              
            } catch (error) {
              console.log(chalk.red(`❌ Error processing ${language} diagram: ${error.message}`));
              // Add error block instead of failing completely
              blocks.push({
                type: 'callout',
                callout: {
                  rich_text: [{ 
                    text: { content: `Error processing ${language} diagram: ${error.message}` },
                    annotations: { color: 'red' }
                  }],
                  icon: { emoji: '⚠️' },
                  color: 'red'
                }
              });
            }
            
            i = j + 1; // Skip past the closing ```
            continue;
          }
        }
        
        // Not a diagram, treat as regular code block
        if (j < lines.length) {
          const codeContent = codeLines.join('\n');
          blocks.push({
            type: 'code',
            code: {
              rich_text: [{ text: { content: codeContent } }],
              language: this.mapLanguageToNotion(language) || 'plain text'
            }
          });
          i = j + 1; // Skip past the closing ```
        } else {
          // No closing ```, treat as paragraph
          blocks.push({
            type: 'paragraph',
            paragraph: {
              rich_text: [{ text: { content: lines[i] } }]
            }
          });
          i++;
        }
      } else {
        // Regular line - accumulate in text block for proper markdown processing
        currentTextBlock.push(lines[i]);
        i++;
      }
    }
    
    // Process any remaining text block
    if (currentTextBlock.length > 0) {
      const textContent = currentTextBlock.join('\n').trim();
      if (textContent) {
        try {
          const textBlocks = await this.convertTextToBlocks(textContent, projectRoot);
          blocks.push(...textBlocks);
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Failed to convert final text to blocks: ${error.message}`));
          // Add as simple paragraph
          blocks.push({
            type: 'paragraph',
            paragraph: {
              rich_text: [{ text: { content: textContent } }]
            }
          });
        }
      }
    }
    
    if (diagramsProcessed > 0) {
      console.log(chalk.green(`✅ Processed ${diagramsProcessed} diagrams with direct SVG upload for Notion`));
    }
    
    return blocks;
  }

  /**
   * Convert text content to basic Notion blocks
   * @param {string} text - Text content
   * @param {string} projectRoot - Project root directory
   * @returns {Array} Array of Notion blocks
   */
  async convertTextToBlocks(text, projectRoot = null) {
    // Use proper markdown converter if available
    if (this.markdownConverter) {
      try {
        let blocks = await this.markdownConverter.convertToBlocks(text);
        // Process HTML images in blocks
        blocks = await this.processHtmlImagesInBlocks(blocks, projectRoot);
        return blocks;
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Markdown converter failed, using fallback: ${error.message}`));
        // Fall back to simple conversion
      }
    }
    
    // Fallback: simple text to blocks conversion
    const blocks = [];
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    
    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (trimmed) {
        // Check for headings
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = Math.min(headingMatch[1].length, 3); // Notion supports h1, h2, h3
          const headingType = `heading_${level}`;
          
          blocks.push({
            type: headingType,
            [headingType]: {
              rich_text: [{ text: { content: headingMatch[2] } }]
            }
          });
        } else {
          // Regular paragraph
          blocks.push({
            type: 'paragraph',
            paragraph: {
              rich_text: [{ text: { content: trimmed } }]
            }
          });
        }
      }
    }
    
    return blocks;
  }

  /**
   * Process HTML images in blocks (similar to notion-sync.js processMediaInBlocks)
   * @param {Array} blocks - Array of blocks
   * @param {string} projectRoot - Project root directory
   * @returns {Array} Processed blocks with HTML images converted to image blocks
   */
  async processHtmlImagesInBlocks(blocks, projectRoot = null) {
    const processedBlocks = [];
    
    // Add safety limits to prevent infinite loops
    const MAX_BLOCKS = 1000;
    const MAX_IMAGES_PER_BLOCK = 10; // Reduced from 50 for safety
    const MAX_CONTENT_LENGTH = 50000; // Reduced from 100000
    
    if (blocks.length > MAX_BLOCKS) {
      console.warn(chalk.yellow(`⚠️ Too many blocks (${blocks.length}), limiting to ${MAX_BLOCKS} for safety`));
      blocks = blocks.slice(0, MAX_BLOCKS);
    }

    for (const block of blocks) {
      if (block.type === 'paragraph' && block.paragraph.rich_text) {
        const richText = block.paragraph.rich_text;
        const newRichText = [];
        
        for (const textObj of richText) {
          let content = textObj.text.content;
          
          // Safety check for content length
          if (content.length > MAX_CONTENT_LENGTH) {
            console.warn(chalk.yellow(`⚠️ Content too long (${content.length} chars), truncating for safety`));
            content = content.substring(0, MAX_CONTENT_LENGTH) + '...';
          }
          
          // Quick check - if no image patterns, keep original text
          if (!content.includes('<img') && !content.includes('![')) {
            newRichText.push(textObj);
            continue;
          }
          
          let processedContent = false;
          let lastIndex = 0;
          
          // Process all images in this text content
          const allMatches = [];
          
          // Find all markdown images
          const markdownMatches = [...content.matchAll(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g)];
          for (const match of markdownMatches) {
            allMatches.push({
              type: 'markdown',
              match: match,
              index: match.index,
              fullMatch: match[0],
              altText: match[1],
              imageUrl: match[2],
              title: match[3]
            });
          }
          
          // Find all HTML img tags
          const htmlMatches = [...content.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/g)];
          for (const match of htmlMatches) {
            const altMatch = match[0].match(/alt=["']([^"']+)["']/);
            allMatches.push({
              type: 'html',
              match: match,
              index: match.index,
              fullMatch: match[0],
              imageUrl: match[1],
              altText: altMatch ? altMatch[1] : ''
            });
          }
          
          // Sort matches by index to process in order
          allMatches.sort((a, b) => a.index - b.index);
          
          // Safety limit for images per block
          if (allMatches.length > MAX_IMAGES_PER_BLOCK) {
            console.warn(chalk.yellow(`⚠️ Too many images (${allMatches.length}), limiting to ${MAX_IMAGES_PER_BLOCK} for safety`));
            allMatches.length = MAX_IMAGES_PER_BLOCK;
          }
          
          // Process each image match with enhanced safety
          for (const imageMatch of allMatches) {
            // Add text before image
            const beforeText = content.substring(lastIndex, imageMatch.index);
            if (beforeText.trim()) {
              newRichText.push({ text: { content: beforeText } });
            }
            
            // Process image with timeout protection and fallback
            try {
              // Check if we already have an image processor instance to avoid circular dependency
              if (!this.imageProcessor) {
                // Create a simple fallback instead of full ImageProcessor to avoid circular dependency
                console.log(chalk.yellow(`⚠️ No image processor available, skipping image processing: ${imageMatch.imageUrl}`));
                const prefix = imageMatch.type === 'html' ? 'HTML Image' : 'Image';
                newRichText.push({ 
                  text: { content: imageMatch.altText ? `[${prefix}: ${imageMatch.altText}]` : `[${prefix}: ${imageMatch.imageUrl}]` },
                  annotations: { italic: true, color: 'gray' }
                });
              } else {
                // Use the existing image processor with timeout
                const actualProjectRoot = projectRoot || this.config.projectRoot || process.cwd();
                
                // Call the existing processImageMarkdown method with timeout
                const imageBlock = await Promise.race([
                  this.imageProcessor.processImageMarkdown(imageMatch.imageUrl, imageMatch.altText, actualProjectRoot, false),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Image processing timeout')), 15000)) // Reduced timeout
                ]);
                
                if (imageBlock) {
                  processedBlocks.push(imageBlock);
                } else {
                  // Fallback to text if processing failed
                  const prefix = imageMatch.type === 'html' ? 'HTML Image' : 'Image';
                  newRichText.push({ 
                    text: { content: imageMatch.altText ? `[${prefix}: ${imageMatch.altText}]` : `[${prefix}]` },
                    annotations: { italic: true, color: 'gray' }
                  });
                }
              }
              
            } catch (error) {
              console.log(chalk.yellow(`⚠️ Failed to process ${imageMatch.type} image ${imageMatch.imageUrl}: ${error.message}`));
              // Fallback to text
              const prefix = imageMatch.type === 'html' ? 'HTML Image' : 'Image';
              newRichText.push({ 
                text: { content: imageMatch.altText ? `[${prefix}: ${imageMatch.altText} - Processing failed]` : `[${prefix} - Processing failed]` },
                annotations: { italic: true, color: 'yellow' }
              });
            }
            
            // Update last processed index
            lastIndex = imageMatch.index + imageMatch.fullMatch.length;
            processedContent = true;
          }
          
          // Add any remaining text after all images
          const remainingText = content.substring(lastIndex);
          if (remainingText.trim()) {
            newRichText.push({ text: { content: remainingText } });
          } else if (!processedContent) {
            // No images found, keep original text object
            newRichText.push(textObj);
          }
        }
        
        // Add paragraph if it has content
        if (newRichText.length > 0) {
          processedBlocks.push({
            type: 'paragraph',
            paragraph: { rich_text: newRichText }
          });
        }
      } else {
        processedBlocks.push(block);
      }
    }
    
    return processedBlocks;
  }

  /**
   * Map diagram language to Notion code language
   * @param {string} language - Original language
   * @returns {string} Notion compatible language
   */
  mapLanguageToNotion(language) {
    const mapping = {
      'mermaid': 'plain text',
      'plantuml': 'plain text',
      'dot': 'plain text',
      'graphviz': 'plain text',
      'd2': 'plain text',
      'js': 'javascript',
      'javascript': 'javascript',
      'typescript': 'typescript',
      'python': 'python',
      'java': 'java',
      'json': 'json',
      'yaml': 'yaml',
      'xml': 'markup',
      'html': 'markup',
      'css': 'css',
      'sql': 'sql',
      'bash': 'shell',
      'shell': 'shell'
    };
    
    return mapping[language?.toLowerCase()] || 'plain text';
  }

  /**
   * Upload diagram SVG to Notion as file
   * @param {string} svgContent - SVG content
   * @param {string} type - Diagram type
   * @param {string} diagramId - Diagram ID
   * @returns {string} File URL
   */
  async uploadDiagramToNotion(svgContent, type, diagramId) {
    try {
      const fileName = `${type}-diagram-${diagramId.substring(0, 8)}.svg`;
      const svgBuffer = Buffer.from(svgContent, 'utf8');
      
      // Use Notion File Upload API (available since Oct 2024)
      const uploadResult = await this.client.uploadFile(svgBuffer, fileName, 'image/svg+xml');
      
      console.log(chalk.green(`✅ Uploaded diagram to Notion: ${fileName}`));
      return uploadResult.url;
      
    } catch (error) {
      // Fallback to local temp file if upload fails
      console.warn(chalk.yellow(`⚠️ Notion upload failed, saving locally: ${error.message}`));
      
      const tempFile = path.join(this.tempDir, fileName);
      await fs.writeFile(tempFile, svgContent, 'utf8');
      
      return `file://${tempFile}`;
    }
  }

  /**
   * Process diagram code blocks directly in Notion blocks
   * @param {Array} blocks - Array of Notion blocks
   * @returns {Array} Processed blocks with annotated code blocks
   */
  processCodeBlocks(blocks) {
    const processedBlocks = [];
    
    for (const block of blocks) {
      if (block.type === 'code' && this.isDiagramLanguage(block.code.language)) {
        // Convert diagram code blocks to annotated text blocks
        const annotatedBlock = {
          type: 'code',
          code: {
            language: block.code.language,
            rich_text: [
              {
                type: 'text',
                text: { content: block.code.rich_text[0].text.content },
                annotations: {
                  color: 'blue_background'
                }
              }
            ]
          }
        };
        processedBlocks.push(annotatedBlock);
      } else {
        processedBlocks.push(block);
      }
    }
    
    return processedBlocks;
  }

  /**
   * Check if language is a supported diagram type
   * @param {string} language - Code block language
   * @returns {boolean} Is diagram language
   */
  isDiagramLanguage(language) {
    return ['mermaid', 'plantuml', 'dot', 'graphviz', 'd2'].includes(language);
  }

  /**
   * Generate diagram ID from content
   * @param {string} content - Diagram content
   * @returns {string} Diagram ID
   */
  generateDiagramId(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if diagram processors are available
   * @returns {Object} Availability status
   */
  async checkProcessorAvailability() {
    try {
      return {
        mermaid: await this.mermaidProcessor.checkMermaidCLI(),
        plantuml: await this.plantumlProcessor.checkPlantUMLCLI(),
        graphviz: await this.graphvizProcessor.checkGraphvizCLI(),
        d2: await this.d2Processor.checkD2CLI()
      };
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Error checking processor availability: ${error.message}`));
      return {
        mermaid: false,
        plantuml: false,
        graphviz: false,
        d2: false
      };
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup() {
    try {
      // Clean up main temp directory
      if (await fs.pathExists(this.tempDir)) {
        await fs.remove(this.tempDir);
      }
      
      // Clean up individual processor temp directories
      await Promise.all([
        this.mermaidProcessor.cleanup(),
        this.plantumlProcessor.cleanup(),
        this.graphvizProcessor.cleanup(),
        this.d2Processor.cleanup()
      ]);
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to clean up temp directories: ${error.message}`));
    }
  }

  /**
   * Get diagram statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const uploadedFiles = this.state.getAllUploadedFiles();
    const diagrams = Object.values(uploadedFiles).filter(file => file.type === 'diagram');
    
    const stats = {
      total: diagrams.length,
      byType: {}
    };
    
    for (const diagram of diagrams) {
      const type = diagram.diagramType || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }
    
    return stats;
  }
}

module.exports = NotionDiagramProcessor;