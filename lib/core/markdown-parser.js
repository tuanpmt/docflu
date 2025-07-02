const MarkdownIt = require('markdown-it');
const matter = require('gray-matter');
const fs = require('fs-extra');
const ReferenceProcessor = require('./reference-processor');
const DiagramProcessor = require('./diagram-processor');

class MarkdownParser {
  constructor(projectRoot = null, stateManager = null, confluenceClient = null) {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });
    
    // Initialize reference processor if dependencies provided
    this.referenceProcessor = null;
    if (projectRoot && stateManager) {
      this.referenceProcessor = new ReferenceProcessor(projectRoot, stateManager);
    }

    // Initialize diagram processor if confluence client provided
    this.diagramProcessor = null;
    if (confluenceClient) {
      this.diagramProcessor = new DiagramProcessor(confluenceClient);
    }
  }

  /**
   * Parse markdown file and convert to Confluence Storage Format
   * @param {string} filePath - markdown file path
   * @param {string} baseUrl - Confluence base URL for reference processing
   * @returns {Object} - {title, content, frontmatter, originalMarkdown, htmlContent, linkStats}
   */
  async parseFile(filePath, baseUrl = null) {
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const fileContent = await fs.readFile(filePath, 'utf8');
    const { data: frontmatter, content: markdown } = matter(fileContent);

    return this.parseMarkdown(markdown, frontmatter, filePath, baseUrl);
  }

  /**
   * Parse markdown content directly (not from file)
   * @param {string} markdown - markdown content
   * @param {Object} frontmatter - frontmatter data 
   * @param {string} currentFilePath - current file path for reference resolution
   * @param {string} baseUrl - Confluence base URL for reference processing
   * @param {string} pageId - Confluence page ID for diagram processing
   * @returns {Object} - {title, content, frontmatter, originalMarkdown, htmlContent, linkStats, diagramStats}
   */
  async parseMarkdown(markdown, frontmatter = {}, currentFilePath = null, baseUrl = null, pageId = null) {
    let processedMarkdown = markdown;
    let linkStats = null;
    let diagramStats = null;

    // Process internal references if reference processor is available
    if (this.referenceProcessor && currentFilePath && baseUrl) {
      linkStats = this.referenceProcessor.getStats(markdown);
      processedMarkdown = this.referenceProcessor.processReferences(
        markdown, 
        currentFilePath, 
        baseUrl
      );
    }

    // Extract title from frontmatter or first heading
    const title = this.extractTitle(frontmatter, processedMarkdown);
    
    // Convert markdown to HTML first
    const html = this.md.render(processedMarkdown);
    
    // Convert HTML to Confluence Storage Format (basic, without images)
    let confluenceContent = this.convertToConfluenceFormat(html);

    // Process all diagrams AFTER HTML conversion if diagram processor is available and pageId provided
    if (this.diagramProcessor && pageId) {
      const diagramResult = await this.diagramProcessor.processAllDiagrams(pageId, processedMarkdown);
      
      // Apply diagram processing to the Confluence content
      if (diagramResult) {
        // Convert Confluence code blocks to image format
        confluenceContent = this.replaceDiagramCodeBlocksInConfluence(confluenceContent, diagramResult.diagramMap);
      }
      
      diagramStats = diagramResult.stats;
    }

    return {
      title,
      content: confluenceContent,
      frontmatter,
      originalMarkdown: markdown,
      processedMarkdown,
      htmlContent: confluenceContent, // Keep raw HTML for image processing
      linkStats,
      diagramStats
    };
  }

  /**
   * Extract title from frontmatter or markdown content
   */
  extractTitle(frontmatter, markdown) {
    // Priority: frontmatter title > first h1 > file name
    if (frontmatter.title) {
      return frontmatter.title;
    }

    // Find first heading
    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }

    return 'Untitled';
  }

  /**
   * Convert HTML to Confluence Storage Format (basic implementation)
   */
  convertToConfluenceFormat(html) {
    // Basic conversion - will improve later
    let confluenceXML = html;

    // Convert headings
    confluenceXML = confluenceXML.replace(/<h([1-6])>(.*?)<\/h[1-6]>/g, (match, level, text) => {
      return `<h${level}>${text}</h${level}>`;
    });

    // Convert code blocks
    confluenceXML = confluenceXML.replace(
      /<pre><code class="language-(\w+)">(.*?)<\/code><\/pre>/gs,
      (match, lang, code) => {
        return `<ac:structured-macro ac:name="code">
          <ac:parameter ac:name="language">${lang}</ac:parameter>
          <ac:plain-text-body><![CDATA[${code}]]></ac:plain-text-body>
        </ac:structured-macro>`;
      }
    );

    // Convert simple code blocks without language
    confluenceXML = confluenceXML.replace(
      /<pre><code>(.*?)<\/code><\/pre>/gs,
      (match, code) => {
        return `<ac:structured-macro ac:name="code">
          <ac:plain-text-body><![CDATA[${code}]]></ac:plain-text-body>
        </ac:structured-macro>`;
      }
    );

    return confluenceXML;
  }

  /**
   * Replace diagram code blocks in Confluence content with image format
   */
  replaceDiagramCodeBlocksInConfluence(confluenceContent, diagramMap) {
    let processedContent = confluenceContent;
    
    // Define diagram types and their patterns (updated to handle flexible whitespace)
    const diagramTypes = {
      mermaid: /```mermaid\s*\n([\s\S]*?)\n\s*```/g,
      plantuml: /```plantuml\s*\n([\s\S]*?)\n\s*```/g,
      graphviz: /```(?:dot|graphviz)\s*\n([\s\S]*?)\n\s*```/g,
      d2: /```d2\s*\n([\s\S]*?)\n\s*```/g
    };

    // Also handle Confluence code blocks (improved patterns for better flexibility)
    const confluenceCodePatterns = {
      mermaid: /<ac:structured-macro[^>]*ac:name="code"[^>]*>[\s\S]*?<ac:parameter[^>]*ac:name="language"[^>]*>mermaid<\/ac:parameter>[\s\S]*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>[\s\S]*?<\/ac:structured-macro>/g,
      plantuml: /<ac:structured-macro[^>]*ac:name="code"[^>]*>[\s\S]*?<ac:parameter[^>]*ac:name="language"[^>]*>plantuml<\/ac:parameter>[\s\S]*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>[\s\S]*?<\/ac:structured-macro>/g,
      graphviz: /<ac:structured-macro[^>]*ac:name="code"[^>]*>[\s\S]*?<ac:parameter[^>]*ac:name="language"[^>]*>(?:dot|graphviz)<\/ac:parameter>[\s\S]*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>[\s\S]*?<\/ac:structured-macro>/g,
      d2: /<ac:structured-macro[^>]*ac:name="code"[^>]*>[\s\S]*?<ac:parameter[^>]*ac:name="language"[^>]*>d2<\/ac:parameter>[\s\S]*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>[\s\S]*?<\/ac:structured-macro>/g
    };

    // Process markdown-style code blocks first
    for (const [type, regex] of Object.entries(diagramTypes)) {
      processedContent = processedContent.replace(regex, (match, diagramCode) => {
        const diagramId = this.generateDiagramId(type, diagramCode);
        const attachment = diagramMap.get(diagramId);
        
        if (attachment) {
          const cleanCode = diagramCode.trim();
          const diagramTitle = type.charAt(0).toUpperCase() + type.slice(1);
          return `
<ac:image ac:align="center" ac:layout="center">
  <ri:attachment ri:filename="${attachment.title}" />
</ac:image>

<p style="text-align: center;"><em>${diagramTitle} Diagram</em></p>

<!-- DOCFLU_DIAGRAM_START:${type} -->
<!-- DOCFLU_DIAGRAM_METADATA:${type}:${Buffer.from(cleanCode).toString('base64')} -->
<!-- DOCFLU_DIAGRAM_END:${type} -->
`;
        }
        
        return match; // Keep original if no attachment found
      });
    }

    // Process Confluence code blocks
    for (const [type, regex] of Object.entries(confluenceCodePatterns)) {
      processedContent = processedContent.replace(regex, (match, diagramCode) => {
        // Unescape HTML entities
        const unescapedCode = diagramCode
          .replace(/&gt;/g, '>')
          .replace(/&lt;/g, '<')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
          
        const diagramId = this.generateDiagramId(type, unescapedCode);
        const attachment = diagramMap.get(diagramId);
        
        if (attachment) {
          const cleanCode = unescapedCode.trim();
          const diagramTitle = type.charAt(0).toUpperCase() + type.slice(1);
          return `
<ac:image ac:align="center" ac:layout="center">
  <ri:attachment ri:filename="${attachment.title}" />
</ac:image>

<p style="text-align: center;"><em>${diagramTitle} Diagram</em></p>

<!-- DOCFLU_DIAGRAM_START:${type} -->
<!-- DOCFLU_DIAGRAM_METADATA:${type}:${Buffer.from(cleanCode).toString('base64')} -->
<!-- DOCFLU_DIAGRAM_END:${type} -->
`;
        }
        
        return match
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      });
    }
    
    return processedContent;
  }

  /**
   * Generate diagram ID (same logic as DiagramProcessor)
   * Normalize by removing all spaces and newlines for consistent ID generation
   */
  generateDiagramId(type, code) {
    const normalizedCode = code.replace(/\s+/g, '');
    const hash = require('crypto').createHash('md5').update(normalizedCode).digest('hex');
    return `${type}-${hash.substring(0, 8)}`;
  }

  /**
   * Clean up temporary resources
   */
  async cleanup() {
    if (this.diagramProcessor) {
      await this.diagramProcessor.cleanup();
    }
  }
}

module.exports = MarkdownParser; 