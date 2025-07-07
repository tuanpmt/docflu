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
   * Extract frontmatter from markdown content
   * @param {string} markdownContent - Raw markdown content
   * @returns {Object} Frontmatter data
   */
  extractFrontmatter(markdownContent) {
    const { data } = matter(markdownContent);
    return data || {};
  }

  /**
   * Extract title from frontmatter or markdown content
   * @param {Object|string} frontmatterOrMarkdown - Frontmatter object or markdown content
   * @param {string} markdown - Markdown content (if first param is frontmatter)
   * @returns {string} Extracted title
   */
  extractTitle(frontmatterOrMarkdown, markdown = null) {
    // Handle both signatures:
    // extractTitle(frontmatter, markdown) - legacy
    // extractTitle(markdownContent) - new single param
    
    let frontmatter = {};
    let markdownContent = '';
    
    if (typeof frontmatterOrMarkdown === 'string' && markdown === null) {
      // Single parameter: extract both frontmatter and content
      const parsed = matter(frontmatterOrMarkdown);
      frontmatter = parsed.data || {};
      markdownContent = parsed.content;
    } else {
      // Two parameters: legacy signature
      frontmatter = frontmatterOrMarkdown || {};
      markdownContent = markdown || '';
    }

    // Priority: frontmatter title > first h1 > file name
    if (frontmatter && frontmatter.title) {
      return frontmatter.title;
    }

    // Find first heading
    const headingMatch = markdownContent.match(/^#\s+(.+)$/m);
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

    // Process Confluence code blocks - use a more robust approach to avoid greedy matching
    processedContent = this.processConfluenceDiagramBlocks(processedContent, diagramMap);
    
    return processedContent;
  }

  /**
   * Process Confluence diagram blocks more robustly to avoid greedy matching
   */
  processConfluenceDiagramBlocks(content, diagramMap) {
    const diagramTypes = ['mermaid', 'plantuml', 'dot', 'graphviz', 'd2'];
    
    // Find all structured-macro code blocks
    const codeBlockRegex = /<ac:structured-macro\s+ac:name="code"[^>]*>([\s\S]*?)<\/ac:structured-macro>/g;
    
    return content.replace(codeBlockRegex, (match, innerContent) => {
      // Extract language parameter
      const languageMatch = innerContent.match(/<ac:parameter\s+ac:name="language"[^>]*>([^<]+)<\/ac:parameter>/);
      if (!languageMatch) {
        return match; // No language parameter, keep original
      }
      
      const language = languageMatch[1].trim().toLowerCase();
      
      // Check if this is a diagram type
      let diagramType = null;
      if (diagramTypes.includes(language)) {
        diagramType = language;
      } else if (language === 'dot') {
        diagramType = 'graphviz';
      }
      
      if (!diagramType) {
        return match
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      }
      
      // Extract the code content
      const codeMatch = innerContent.match(/<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>/);
      if (!codeMatch) {
        return match; // No code content, keep original
      }
      
      const diagramCode = codeMatch[1];
      
      // Unescape HTML entities for diagram code blocks
      const unescapedCode = diagramCode
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
        
      const diagramId = this.generateDiagramId(diagramType, unescapedCode);
      const attachment = diagramMap.get(diagramId);
      
      if (attachment) {
        const cleanCode = unescapedCode.trim();
        const diagramTitle = diagramType.charAt(0).toUpperCase() + diagramType.slice(1);
        return `
<ac:image ac:align="center" ac:layout="center">
  <ri:attachment ri:filename="${attachment.title}" />
</ac:image>

<p style="text-align: center;"><em>${diagramTitle} Diagram</em></p>

<!-- DOCFLU_DIAGRAM_START:${diagramType} -->
<!-- DOCFLU_DIAGRAM_METADATA:${diagramType}:${Buffer.from(cleanCode).toString('base64')} -->
<!-- DOCFLU_DIAGRAM_END:${diagramType} -->
`;
      }
      
      // If no attachment found, return original match (no HTML entity unescaping)
      return match;
    });
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