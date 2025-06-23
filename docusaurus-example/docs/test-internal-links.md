# Test Internal Links

This document tests various types of internal references in Docusaurus.

## Basic Internal Links

### Relative Links
- Link to sibling: [Create a Page](./tutorial-basics/create-a-page.md)
- Link to parent: [Tutorial Intro](../intro.md)
- Link to nested: [Advanced Concepts](./advanced/concepts/deep-nested.md)

### Absolute Links (Docusaurus style)
- Link to docs root: [Tutorial Intro](/docs/intro)
- Link to category: [Tutorial Basics](/docs/tutorial-basics/create-a-page)
- Link to nested: [Advanced Concepts](/docs/advanced/concepts/deep-nested)

### Hash Links (Anchors)
- Link to section: [Error Handling](#error-handling)
- Link to external page section: [Create Page - Step 1](./tutorial-basics/create-a-page.md#step-1)
- Link to root page section: [Tutorial Intro - Getting Started](../intro.md#getting-started)

## Cross-References

### Document References
See the [deployment guide](./tutorial-basics/deploy-your-site.md) for more information.

You can also check out [blog post creation](./tutorial-basics/create-a-blog-post.md) and [congratulations page](./tutorial-basics/congratulations.md).

### Category References
For basic tutorials, see [Tutorial Basics](/docs/category/tutorial---basics) section.

For advanced topics, check [Tutorial Extras](/docs/category/tutorial---extras).

## Asset References

### Images with Relative Paths
![Local Image](/img/docusaurus.png)

### Static Asset References
![Static Image](/img/docusaurus.png)
![Version Dropdown](./tutorial-extras/img/docsVersionDropdown.png)

## Code References

Check the configuration in [`docusaurus.config.ts`](../docusaurus.config.ts).

See also [`package.json`](../package.json) for dependencies.

## Error Handling

This section demonstrates anchor linking within the same document.

### Common Issues
- Broken links
- Missing images
- Invalid references

### Solutions
1. Use relative paths when possible
2. Validate links before publishing
3. Use proper anchor syntax

## External vs Internal

### External Links (should not be processed)
- [GitHub](https://github.com)
- [Docusaurus](https://docusaurus.io)

### Internal Links (should be processed)
- [Home](/)
- [Docs](/docs/)
- [Blog](/blog/)

## Special Cases

### Links with Query Parameters
- [Search Results](/docs/intro?search=tutorial)
- [Filtered View](/docs/tutorial-basics/create-a-page?filter=basic)

### Links with Fragments
- [Quick Start](/docs/intro#quick-start)
- [Installation](/docs/tutorial-basics/create-a-page#installation)

### Markdown Reference Style
[tutorial-link]: ./tutorial-basics/create-a-page.md
[advanced-link]: ./advanced/concepts/deep-nested.md

This is a [reference to tutorial][tutorial-link] and [advanced topic][advanced-link]. 