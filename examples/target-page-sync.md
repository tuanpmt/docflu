---
title: Target Page Sync Example
confluence_target: 123456
---

# Target Page Sync Example

This document demonstrates the target page sync feature that allows syncing markdown files directly to specific Confluence pages.

## How it Works

### CLI Flag Method
```bash
# Sync to specific page ID
docflu sync --file docs/my-doc.md --target 123456

# Sync to specific page URL
docflu sync --file docs/my-doc.md --target "https://domain.atlassian.net/wiki/spaces/DOC/pages/123456/Page+Title"
```

### Frontmatter Method
```markdown
---
title: My Document
confluence_target: 123456
---

# My Document
Content here will sync to page ID 123456.
```

## Supported URL Formats

- **Page ID**: `123456`
- **Modern URL**: `https://domain.atlassian.net/wiki/spaces/DOC/pages/123456/Page+Title`
- **Legacy URL**: `https://domain.atlassian.net/pages/viewpage.action?pageId=123456`
- **Display URL**: `https://domain.atlassian.net/display/DOC/Page+Title?pageId=123456`
- **Edit URL**: `https://domain.atlassian.net/pages/editpage.action?pageId=123456`

## Priority

CLI flag `--target` takes precedence over frontmatter configuration.

## Benefits

- **Direct Updates**: Updates existing pages without creating new ones
- **Exact Control**: Specify exactly which page to update
- **Flexible Input**: Supports both page IDs and various URL formats
- **Validation**: Ensures target page exists and is in the correct space
- **Error Handling**: Clear error messages for invalid targets

## Use Cases

1. **Maintenance Pages**: Update specific maintenance or status pages
2. **Documentation Updates**: Keep specific documentation pages synchronized
3. **Report Generation**: Update report pages with latest data
4. **Template Updates**: Update template pages with new content