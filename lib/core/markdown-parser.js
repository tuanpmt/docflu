const MarkdownIt = require('markdown-it');
const matter = require('gray-matter');
const fs = require('fs-extra');

class MarkdownParser {
  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });
  }

  /**
   * Parse markdown file và convert sang Confluence Storage Format
   * @param {string} filePath - đường dẫn file markdown
   * @returns {Object} - {title, content, frontmatter, originalMarkdown, htmlContent}
   */
  async parseFile(filePath) {
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File không tồn tại: ${filePath}`);
    }

    const fileContent = await fs.readFile(filePath, 'utf8');
    const { data: frontmatter, content: markdown } = matter(fileContent);

    // Extract title từ frontmatter hoặc first heading
    const title = this.extractTitle(frontmatter, markdown);
    
    // Convert markdown to HTML
    const html = this.md.render(markdown);
    
    // Convert HTML to Confluence Storage Format (basic, without images)
    const confluenceContent = this.convertToConfluenceFormat(html);

    return {
      title,
      content: confluenceContent,
      frontmatter,
      originalMarkdown: markdown,
      htmlContent: html // Keep raw HTML for image processing
    };
  }

  /**
   * Parse markdown content directly (not from file)
   * @param {string} markdown - markdown content
   * @param {Object} frontmatter - frontmatter data 
   * @returns {Object} - {title, content, frontmatter, originalMarkdown, htmlContent}
   */
  async parseMarkdown(markdown, frontmatter = {}) {
    // Extract title từ frontmatter hoặc first heading
    const title = this.extractTitle(frontmatter, markdown);
    
    // Convert markdown to HTML
    const html = this.md.render(markdown);
    
    // Convert HTML to Confluence Storage Format (basic, without images)
    const confluenceContent = this.convertToConfluenceFormat(html);

    return {
      title,
      content: confluenceContent,
      frontmatter,
      originalMarkdown: markdown,
      htmlContent: html // Keep raw HTML for image processing
    };
  }

  /**
   * Extract title từ frontmatter hoặc markdown content
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
    // Basic conversion - sẽ cải thiện sau
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
}

module.exports = MarkdownParser; 