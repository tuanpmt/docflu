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

    try {
      await fs.writeFile(inputFile, diagram.code, 'utf8');
      const command = `mmdc -i "${inputFile}" -o "${outputFile}" -t neutral -b white --width 1600 --height 1200`;
      execSync(command, { stdio: 'pipe' });

      if (await fs.pathExists(outputFile)) {
        console.log(chalk.green(`✅ Generated Mermaid diagram: ${diagram.id}.svg`));
        return outputFile;
      }
      throw new Error('Output file not created');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to generate Mermaid diagram ${diagram.id}: ${error.message}`));
      return null;
    } finally {
      if (await fs.pathExists(inputFile)) {
        await fs.remove(inputFile);
      }
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
        console.log(chalk.green(`✅ Generated PlantUML diagram: ${diagram.id}.svg`));
        return outputFile;
      }
      throw new Error('Output file not created');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to generate PlantUML diagram ${diagram.id}: ${error.message}`));
      return null;
    } finally {
      if (await fs.pathExists(inputFile)) {
        await fs.remove(inputFile);
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
      const command = `dot -Tsvg "${inputFile}" -o "${outputFile}"`;
      execSync(command, { stdio: 'pipe' });

      if (await fs.pathExists(outputFile)) {
        console.log(chalk.green(`✅ Generated Graphviz diagram: ${diagram.id}.svg`));
        return outputFile;
      }
      throw new Error('Output file not created');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to generate Graphviz diagram ${diagram.id}: ${error.message}`));
      return null;
    } finally {
      if (await fs.pathExists(inputFile)) {
        await fs.remove(inputFile);
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

  async generateD2Image(diagram) {
    const inputFile = path.join(this.tempDir, `${diagram.id}.d2`);
    const outputFile = path.join(this.tempDir, `${diagram.id}.svg`);

    try {
      await fs.writeFile(inputFile, diagram.code, 'utf8');
      const command = `d2 "${inputFile}" "${outputFile}"`;
      execSync(command, { stdio: 'pipe' });

      if (await fs.pathExists(outputFile)) {
        console.log(chalk.green(`✅ Generated D2 diagram: ${diagram.id}.svg`));
        return outputFile;
      }
      throw new Error('Output file not created');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to generate D2 diagram ${diagram.id}: ${error.message}`));
      return null;
    } finally {
      if (await fs.pathExists(inputFile)) {
        await fs.remove(inputFile);
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
      
      console.log(chalk.green(`✅ Uploaded ${diagram.type} diagram: ${fileName}`));
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
            await fs.remove(imagePath);
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
        await fs.remove(this.tempDir);
        console.log(chalk.gray('🧹 Cleaned up diagram temp directory'));
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to cleanup diagram temp directory: ${error.message}`));
    }
  }
}

module.exports = DiagramProcessor; 