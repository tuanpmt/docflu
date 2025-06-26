# PLAN 2: docflu CLI - Docusaurus to Google Docs Sync

> **🎯 STATUS**: ❌ Phase 0 PLANNING - Google Docs sync feature  
> **📅 Updated**: 2025-01-27  
> **🚀 Next**: Phase 1 - OAuth2 authentication, Google Docs API integration

## 1. Specific Requirements Analysis

### 1.1 Goals

- **CLI Tool**: `docflu` - command line interface (extend existing)
- **Command**: `docflu sync --gdocs` - sync Docusaurus to Google Docs
- **Direction**: 1-way sync (Markdown → Google Docs), can extend to 2-way later
- **Auth**: OAuth2 Desktop App flow with browser approval for Google Docs API
- **Config**: `.env` file in project root for Google OAuth credentials
- **State**: `.docusaurus/` folder to store sync information (compatible with existing)
- **Auto-detect**: Automatically detect Docusaurus project structure (reuse existing)
- **Tab Structure**: Each directory = Tab, each file = Child Tab or Document content

### 1.2 Input/Output

- **Input**: Docusaurus project (`docs/` folder only, `docusaurus.config.ts`)
- **Output**: Google Docs document with tabs hierarchy according to Google Docs API
- **State Management**: Track sync status, timestamps, document IDs, tab IDs in `.docusaurus/`
- **Tab Mapping**:
  - `docs/` → Root document with main tabs
  - `docs/tutorial-basics/` → Tab "Tutorial Basics"
  - `docs/tutorial-basics/create-a-page.md` → Child tab "Create a Page"
  - `docs/intro.md` → Root-level tab "Introduction"
- **Note**: Blog sync (`blog/` folder) will be implemented in future phases

### 1.3 Google Docs Tabs Structure

Based on [Google Docs Tabs API](https://developers.google.com/workspace/docs/api/how-tos/tabs):

- **Document**: Single Google Docs document containing all content
- **Tabs**: Top-level tabs for directories and root files
- **Child Tabs**: Nested tabs for files within directories
- **Tab Properties**: Each tab has ID, title, and positioning
- **Content Access**: `document.tabs[index].documentTab.body` for content

## 2. Architecture and Design

### 2.1 Extended CLI Structure

```
docflu/                        # Global CLI package (extend existing)
├── bin/
│   └── docflu.js             # CLI entry point (extend with --gdocs)
├── lib/
│   ├── commands/
│   │   ├── sync.js            # docflu sync command (extend with Google Docs)
│   │   ├── init.js            # docflu init command (extend with Google OAuth)
│   │   └── status.js          # docflu status command (extend)
│   ├── core/
│   │   ├── confluence-client.js    # Existing Confluence API wrapper
│   │   ├── google-docs-client.js   # ❌ NEW: Google Docs API wrapper
│   │   ├── google-auth.js          # ❌ NEW: OAuth2 authentication handler
│   │   ├── google-tabs-manager.js  # ❌ NEW: Google Docs tabs management
│   │   ├── markdown-parser.js      # Extend for Google Docs format
│   │   ├── docusaurus-scanner.js   # Reuse existing
│   │   ├── state-manager.js        # Extend for Google Docs state
│   │   └── config.js              # Extend for Google OAuth config
│   └── utils/
│       ├── logger.js          # Reuse existing
│       └── validators.js      # Extend for Google Docs validation
└── package.json               # Add Google APIs dependencies
```

### 2.2 Project Structure (User's Docusaurus)

```
my-docusaurus-site/
├── .env                       # Extended config (Google + Confluence)
├── .docusaurus/               # Docusaurus build & sync state directory
│   ├── sync-state.json       # Extended: Confluence + Google Docs state
│   ├── google-tokens.json    # ❌ NEW: OAuth2 tokens storage
│   ├── cache/                # Cached data (Docusaurus build cache)
│   └── logs/                 # Sync logs (extend for Google Docs)
├── docs/                     # Docusaurus docs
├── blog/                     # Docusaurus blog
├── docusaurus.config.ts      # Docusaurus config
└── package.json
```

### 2.3 Data Flow

```
docflu sync --gdocs → Load .env → OAuth2 Auth → Scan Docusaurus → Parse Markdown → Google Docs API → Update .docusaurus/
```

### 2.4 Google Docs Tab Hierarchy Mapping

```
Docusaurus Structure:
docs/
├── intro.md
├── tutorial-basics/
│   ├── create-a-page.md
│   ├── create-a-document.md
│   └── deploy-your-site.md
└── tutorial-extras/
    ├── manage-docs-versions.md
    └── translate-your-site.md

Google Docs Structure:
📄 Documentation (Root Document)
├── 📑 Introduction (Tab for intro.md)
├── 📑 Tutorial Basics (Tab for tutorial-basics/)
│   ├── 📑 Create a Page (Child Tab)
│   ├── 📑 Create a Document (Child Tab)
│   └── 📑 Deploy your site (Child Tab)
└── 📑 Tutorial Extras (Tab for tutorial-extras/)
    ├── 📑 Manage Docs Versions (Child Tab)
    └── 📑 Translate your site (Child Tab)
```

## 3. Technical Implementation

### 3.1 Extended Dependencies ❌ NOT IMPLEMENTED

```json
{
  "name": "docflu",
  "version": "0.2.0",
  "dependencies": {
    // Existing dependencies
    "axios": "^1.6.0",
    "markdown-it": "^13.0.1",
    "gray-matter": "^4.0.3",
    "fs-extra": "^11.1.1",
    "commander": "^9.4.1",
    "chalk": "^4.1.2",
    "dotenv": "^16.3.1",
    "ora": "^5.4.1",
    "form-data": "^4.0.0",
    "mime-types": "^2.1.35",

    // NEW: Google APIs dependencies
    "googleapis": "^128.0.0", // ❌ Google APIs client library
    "google-auth-library": "^9.4.0", // ❌ OAuth2 with PKCE authentication
    "open": "^8.4.0", // ❌ Open browser for OAuth2 flow
    "crypto": "^1.0.1" // ❌ For PKCE code verifier/challenge generation
  }
}
```

### 3.2 Core Features ❌ 0/25 IMPLEMENTED

#### 3.2.1 Extended CLI Commands

- ❌ `docflu init --gdocs` - Setup Google OAuth credentials (NOT IMPLEMENTED)
- ❌ `docflu sync --gdocs` - Sync to Google Docs (NOT IMPLEMENTED)
- ❌ `docflu sync --gdocs --docs` - Only sync docs/ to Google Docs (NOT IMPLEMENTED)
- ❌ `docflu sync --gdocs --blog` - Only sync blog/ to Google Docs (NOT IMPLEMENTED)
- ❌ `docflu sync --gdocs --file <path>` - Sync 1 specific file to Google Docs (NOT IMPLEMENTED)
- ❌ `docflu auth --gdocs` - Re-authenticate Google OAuth (NOT IMPLEMENTED)
- ❌ `docflu status --gdocs` - View Google Docs sync status (NOT IMPLEMENTED)

#### 3.2.2 Google OAuth2 with PKCE Authentication ❌ NOT IMPLEMENTED

- ❌ OAuth2 Authorization Code flow with PKCE implementation
- ❌ Code verifier and code challenge generation (SHA256)
- ❌ Browser-based user consent flow with localhost callback
- ❌ Token exchange without client_secret (PKCE flow)
- ❌ Token storage and refresh mechanism
- ❌ Credential validation and error handling
- ❌ Scope management for Google Docs API
- ❌ **PKCE Flow**: Secure OAuth2 for CLI apps without client_secret
- ❌ **Client ID Only**: Only require OAuth2 client ID (public client)
- ❌ **Token Storage**: Secure storage in `.docusaurus/google-tokens.json`
- ❌ **Auto-refresh**: Automatic token refresh on expiry
- ❌ **Localhost Server**: Temporary HTTP server for OAuth callback

#### 3.2.3 Google Docs API Client ❌ NOT IMPLEMENTED

- ❌ Google Docs API wrapper with tabs support
- ❌ **Auto Document Creation**: Create new document if GOOGLE_DOCUMENT_ID not provided
- ❌ Document creation and management
- ❌ Tab creation and hierarchy management
- ❌ Content insertion with Google Docs format
- ❌ Batch operations for performance
- ❌ **Tab Management**: Create, update, delete tabs
- ❌ **Content Management**: Insert text, images, formatting
- ❌ **Hierarchy Support**: Parent-child tab relationships
- ❌ **State Persistence**: Save document ID to state for future syncs

#### 3.2.4 Google Docs Tabs Manager ❌ NOT IMPLEMENTED

- ❌ Tab structure planning from Docusaurus hierarchy
- ❌ Tab creation with proper ordering
- ❌ Child tab management and nesting
- ❌ Tab content population
- ❌ Tab metadata and properties management
- ❌ **includeTabsContent**: Set to true for full tab access
- ❌ **Tab Traversal**: Navigate through tab hierarchy
- ❌ **Content Access**: Access `tab.documentTab.body` for content

#### 3.2.5 Markdown to Google Docs Converter ❌ NOT IMPLEMENTED

- ❌ Convert markdown to Google Docs format
- ❌ Handle headings, paragraphs, lists, code blocks
- ❌ Process images and upload to Google Drive
- ❌ Handle internal links and references
- ❌ Process Mermaid diagrams (convert to images)
- ❌ **Google Docs Format**: Convert to Document Resource format
- ❌ **Batch Updates**: Use batchUpdate API for efficiency
- ❌ **Rich Text**: Support bold, italic, code formatting

#### 3.2.6 Extended State Management ❌ NOT IMPLEMENTED

- ❌ Track Google Docs document ID and tab IDs
- ❌ Store tab hierarchy and relationships
- ❌ Change detection for incremental sync
- ❌ Sync statistics and reporting
- ❌ Error tracking and recovery
- ❌ **Multi-platform State**: Support both Confluence and Google Docs
- ❌ **Tab State**: Track tab IDs, titles, and content hashes
- ❌ **Conflict Resolution**: Handle concurrent modifications

### 3.3 Configuration

#### 3.3.1 Extended .env File (User's Project Root)

```bash
# Existing Confluence Configuration
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@domain.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=DOC
CONFLUENCE_ROOT_PAGE_TITLE=Documentation

# NEW: Google Docs Configuration ❌ NOT IMPLEMENTED
GOOGLE_CLIENT_ID=your-oauth2-client-id.googleusercontent.com
# Note: No GOOGLE_CLIENT_SECRET needed for PKCE flow
# GOOGLE_DOCUMENT_ID=your-google-docs-document-id (Optional - will auto-create if not provided)
GOOGLE_DOCUMENT_TITLE=Documentation

# Optional Settings
docflu_EXCLUDE_PATTERNS=*.draft.md,private/**
docflu_CONCURRENT_UPLOADS=5
docflu_RETRY_COUNT=3
docflu_GOOGLE_SCOPES=https://www.googleapis.com/auth/documents
```

#### 3.3.2 Extended .docusaurus/sync-state.json ❌ NOT IMPLEMENTED

```json
{
  "lastSync": "2025-01-27T10:30:00Z",
  "confluence": {
    "pages": {
      "docs/intro.md": {
        "confluenceId": "123456789",
        "lastModified": "2025-01-27T10:25:00Z",
        "title": "Introduction",
        "parentId": "987654321"
      }
    }
  },
  "googleDocs": {
    "documentId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "documentTitle": "Documentation",
    "documentUrl": "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "autoCreated": true,
    "tabs": {
      "docs/intro.md": {
        "tabId": "tab-intro-123",
        "lastModified": "2025-01-27T10:25:00Z",
        "title": "Introduction",
        "parentTabId": null
      },
      "docs/tutorial-basics/": {
        "tabId": "tab-tutorial-basics-456",
        "lastModified": "2025-01-27T10:20:00Z",
        "title": "Tutorial Basics",
        "parentTabId": null,
        "isDirectory": true
      },
      "docs/tutorial-basics/create-a-page.md": {
        "tabId": "tab-create-page-789",
        "lastModified": "2025-01-27T10:25:00Z",
        "title": "Create a Page",
        "parentTabId": "tab-tutorial-basics-456"
      }
    }
  }
}
```

#### 3.3.3 .docusaurus/google-tokens.json ❌ NOT IMPLEMENTED

```json
{
  "access_token": "ya29.a0AfH6SMC...",
  "refresh_token": "1//04...",
  "scope": "https://www.googleapis.com/auth/documents",
  "token_type": "Bearer",
  "expiry_date": 1643284800000,
  "client_id": "123456789-abc.apps.googleusercontent.com",
  "pkce_used": true
}
```

## 4. Implementation Steps (AI-Assisted)

### Phase 1: Google OAuth2 with PKCE Authentication ❌ NOT STARTED

1. ❌ Setup Google APIs client library and crypto for PKCE
2. ❌ Implement PKCE code verifier and challenge generation
3. ❌ Create localhost HTTP server for OAuth callback
4. ❌ Implement OAuth2 Authorization Code flow with PKCE
5. ❌ Create browser-based consent flow (no client_secret)
6. ❌ Implement token exchange and storage
7. ❌ Add OAuth2 validation and error handling
8. ❌ Extend `docflu init` command for Google setup
9. ❌ Create `docflu auth --gdocs` command

### Phase 2: Google Docs API Integration ❌ NOT STARTED

1. ❌ Implement Google Docs API client wrapper
2. ❌ **Auto-create document**: Check if GOOGLE_DOCUMENT_ID exists, create new if not
3. ❌ Create document management functions
4. ❌ Implement tab creation and management
5. ❌ Add content insertion capabilities
6. ❌ **Save document ID**: Store created document ID in state for future syncs
7. ❌ Implement batch operations for performance

### Phase 3: Tabs Hierarchy Management ❌ NOT STARTED

1. ❌ Implement tabs structure planning
2. ❌ Create tab hierarchy from Docusaurus structure
3. ❌ Implement parent-child tab relationships
4. ❌ Add tab ordering and positioning
5. ❌ Implement tab content population
6. ❌ Add tab metadata management

### Phase 4: Content Conversion ❌ NOT STARTED

1. ❌ Extend markdown parser for Google Docs format
2. ❌ Implement rich text formatting conversion
3. ❌ Add image processing and Google Drive upload
4. ❌ Implement internal link conversion
5. ❌ Add Mermaid diagram processing (image conversion)
6. ❌ Implement code block formatting

### Phase 5: State Management Extension ❌ NOT STARTED

1. ❌ Extend state manager for Google Docs
2. ❌ Implement multi-platform state tracking
3. ❌ Add change detection for Google Docs
4. ❌ Implement sync statistics for Google Docs
5. ❌ Add error tracking and recovery
6. ❌ Implement conflict resolution

### Phase 6: CLI Commands Implementation ❌ NOT STARTED

1. ❌ Extend `docflu sync` with `--gdocs` option
2. ❌ Implement selective sync (--docs, --blog, --file)
3. ❌ Add dry-run support for Google Docs
4. ❌ Implement `docflu status --gdocs` command
5. ❌ Add comprehensive error messages
6. ❌ Implement progress indicators and logging

### Phase 7: Testing & Polish ❌ NOT STARTED

1. ❌ Test OAuth2 flow with real Google account
2. ❌ Test document creation and tab management
3. ❌ Test content conversion accuracy
4. ❌ Test incremental sync functionality
5. ❌ Test error handling and recovery
6. ❌ Performance optimization and concurrent operations

## 5. Usage Examples

### 5.1 Initial Setup ❌ NOT IMPLEMENTED

```bash
# Setup Google OAuth credentials
node bin/docflu.js init --gdocs
# This will:
# 1. Prompt for Google OAuth Client ID/Secret
# 2. Open browser for OAuth consent
# 3. Store tokens in .docusaurus/google-tokens.json
# 4. Create/update .env with Google configuration

# Or setup both platforms
node bin/docflu.js init --gdocs --confluence
```

### 5.2 OAuth2 PKCE Flow ❌ NOT IMPLEMENTED

```bash
# First time authentication with PKCE
$ node bin/docflu.js auth --gdocs
🔐 Starting Google OAuth2 PKCE authentication...
🔑 Generated code verifier and challenge (SHA256)
🌐 Opening browser for consent...
🖥️  Started localhost server on http://127.0.0.1:8080
✅ Please approve the application in your browser
⏳ Waiting for authorization callback...
🔄 Exchanging authorization code for tokens (PKCE)...
✅ Authentication successful!
🔑 Tokens saved to .docusaurus/google-tokens.json
🛑 Localhost server stopped

# Re-authentication if needed
$ node bin/docflu.js auth --gdocs --refresh
🔄 Refreshing Google OAuth2 tokens...
✅ Tokens refreshed successfully!
```

### 5.3 Configuration (.env) ❌ NOT IMPLEMENTED

```bash
# .env file after docflu init --gdocs
# Google Docs Configuration (PKCE - No client secret needed)
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
# Note: GOOGLE_CLIENT_SECRET not required for PKCE flow
# GOOGLE_DOCUMENT_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms (Optional - auto-created if not provided)
GOOGLE_DOCUMENT_TITLE=Documentation
GOOGLE_REDIRECT_PORT=8080

# Existing Confluence Configuration
CONFLUENCE_BASE_URL=https://mycompany.atlassian.net
CONFLUENCE_USERNAME=john.doe@company.com
CONFLUENCE_API_TOKEN=ATxxxxxxxxxxxxxx
CONFLUENCE_SPACE_KEY=DOC
CONFLUENCE_ROOT_PAGE_TITLE=Documentation
```

### 5.4 CLI Commands ❌ NOT IMPLEMENTED

```bash
# Sync to Google Docs only
node bin/docflu.js sync --gdocs --docs
node bin/docflu.js sync --gdocs --docs --dry-run

# Sync to both platforms
node bin/docflu.js sync --docs  # Default: both Confluence and Google Docs
node bin/docflu.js sync --gdocs --confluence --docs

# Sync single file to Google Docs
node bin/docflu.js sync --gdocs --file docs/intro.md

# Check Google Docs sync status
node bin/docflu.js status --gdocs

# Help for Google Docs options
node bin/docflu.js sync --help
```

### 5.5 Expected Output Examples ❌ NOT IMPLEMENTED

#### 5.5.1 Multi-file Google Docs Sync

```bash
$ node bin/docflu.js sync --gdocs --docs
🚀 Syncing all docs/ to Google Docs
✓ Detected Docusaurus project
🔐 Authenticating with Google...
📄 No existing document found, creating new Google Doc: "Documentation"
✅ Created new document: https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
💾 Saved document ID to .docusaurus/sync-state.json
📁 Found 8 documents in docs/
📑 Creating tab: Introduction
📑 Creating tab: Tutorial Basics
📑 Creating child tab: Create a Page
📑 Creating child tab: Create a Document
📑 Creating child tab: Deploy your site
📑 Creating tab: Tutorial Extras
📑 Creating child tab: Manage Docs Versions
📑 Creating child tab: Translate your site
✔ Google Docs sync completed

Document: https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
```

#### 5.5.2 Incremental Sync

```bash
$ node bin/docflu.js sync --gdocs --docs
🚀 Syncing all docs/ to Google Docs
✓ Detected Docusaurus project
🔐 Authenticating with Google...
✓ Using existing document: Documentation
📁 Found 8 documents in docs/
✔ Google Docs sync completed
```

## 6. Google Docs API Integration Details

### 6.1 Auto Document Creation Implementation ❌ NOT IMPLEMENTED

```javascript
// Example: Auto-create Google Docs document if not exists
async function ensureGoogleDocsDocument(docsService, config, stateManager) {
  let documentId = config.GOOGLE_DOCUMENT_ID;

  // Check if document ID exists in state
  if (!documentId) {
    const state = stateManager.getState();
    documentId = state.googleDocs?.documentId;
  }

  // If still no document ID, create new document
  if (!documentId) {
    console.log("📄 No existing document found, creating new Google Doc...");

    const document = await docsService.documents.create({
      requestBody: {
        title: config.GOOGLE_DOCUMENT_TITLE || "Documentation",
      },
    });

    documentId = document.data.documentId;
    const documentUrl = `https://docs.google.com/document/d/${documentId}`;

    console.log(`✅ Created new document: ${documentUrl}`);

    // Save to state
    stateManager.updateGoogleDocsState({
      documentId: documentId,
      documentTitle: config.GOOGLE_DOCUMENT_TITLE || "Documentation",
      documentUrl: documentUrl,
      autoCreated: true,
      createdAt: new Date().toISOString(),
    });

    console.log("💾 Saved document ID to .docusaurus/sync-state.json");
  } else {
    console.log("✓ Using existing document");
  }

  return documentId;
}
```

### 6.2 Tab Management Implementation ❌ NOT IMPLEMENTED

```javascript
// Example: Create tab hierarchy
async function createTabHierarchy(docsService, documentId, hierarchy) {
  const requests = [];

  // Create parent tabs first
  for (const item of hierarchy) {
    if (item.type === "directory") {
      requests.push({
        createNamedRange: {
          name: `tab-${item.name}`,
          range: {
            startIndex: 1,
            endIndex: 1,
          },
        },
      });
    }
  }

  // Create child tabs
  for (const item of hierarchy) {
    if (item.type === "file" && item.parentId) {
      requests.push({
        insertText: {
          location: {
            tabId: item.parentId,
            index: 1,
          },
          text: item.content,
        },
      });
    }
  }

  const response = await docsService.documents.batchUpdate({
    documentId: documentId,
    requestBody: {
      requests: requests,
    },
  });

  return response;
}
```

### 6.3 Content Conversion Examples ❌ NOT IMPLEMENTED

```javascript
// Convert markdown to Google Docs format
function convertMarkdownToGoogleDocs(markdown) {
  const requests = [];

  // Convert headings
  const headings = markdown.match(/^#{1,6}\s+(.+)$/gm);
  headings?.forEach((heading) => {
    const level = heading.match(/^#{1,6}/)[0].length;
    const text = heading.replace(/^#{1,6}\s+/, "");

    requests.push({
      insertText: {
        text: text + "\n",
        location: { index: 1 },
      },
    });

    requests.push({
      updateTextStyle: {
        range: {
          startIndex: 1,
          endIndex: text.length + 1,
        },
        textStyle: {
          fontSize: { magnitude: 18 - level * 2, unit: "PT" },
          bold: true,
        },
        fields: "fontSize,bold",
      },
    });
  });

  return requests;
}
```

## 7. Performance & Optimization

### 7.1 Batch Operations ❌ NOT IMPLEMENTED

- Batch tab creation requests
- Bulk content insertion
- Concurrent API calls with rate limiting
- Request deduplication
- Efficient change detection

### 7.2 Caching Strategy ❌ NOT IMPLEMENTED

- Document structure caching
- Content hash comparison
- Tab metadata caching
- Token caching with expiry
- API response caching

## 8. Testing Strategy

### 8.1 Unit Tests ❌ NOT IMPLEMENTED

- OAuth2 flow testing
- Google Docs API client testing
- Markdown conversion testing
- Tab hierarchy testing
- State management testing

### 8.2 Integration Tests ❌ NOT IMPLEMENTED

- End-to-end sync testing
- Multi-platform sync testing
- Real Google Docs API testing

## 9. Success Criteria

### 9.1 Functional Requirements ✅

- ❌ OAuth2 authentication working with browser flow
- ❌ **Auto-create Google Docs**: Create new document if not provided
- ❌ Google Docs document creation and management
- ❌ Tab hierarchy creation matching Docusaurus structure
- ❌ Markdown to Google Docs conversion with formatting
- ❌ **State persistence**: Save document ID for future syncs
- ❌ Multi-platform sync (Confluence + Google Docs)

### 9.2 Performance Requirements

- ❌ Sync 50+ documents within 2 minutes
- ❌ Memory usage under 200MB during sync
- ❌ Successful OAuth2 flow within 30 seconds
- ❌ API rate limiting compliance
- ❌ Concurrent operations support

### 9.3 User Experience Requirements

- ❌ Intuitive CLI commands and options
- ❌ Seamless OAuth2 authentication flow
- ❌ Consistent behavior with Confluence sync

## 10. Future Enhancements (Phase 8+)

### 10.1 Advanced Features

- ❌ Bi-directional sync (Google Docs → Markdown)
- ❌ Real-time collaboration support
- ❌ Comment and suggestion handling
- ❌ Version history integration
- ❌ Multiple document support
- ❌ Template-based document creation

### 10.2 Integration Features

- ❌ Google Drive integration for assets
- ❌ Google Sheets integration for data
- ❌ CI/CD pipeline integration
- ❌ Webhook support for real-time sync
- ❌ API for third-party integrations

**🎯 GOAL**: Comprehensive Docusaurus → Google Docs sync tool with OAuth2 authentication, full tabs hierarchy support, rich content conversion, and seamless multi-platform synchronization alongside existing Confluence functionality!

## 13. OAuth2 PKCE Feasibility Analysis ✅ HIGHLY RECOMMENDED

### 13.1 Why PKCE is Perfect for CLI Apps

OAuth2 với PKCE (Proof Key for Code Exchange) là **phương pháp được Google chính thức khuyến nghị** cho CLI/Desktop applications vì những lý do sau:

#### ✅ **Security Advantages**

- **No Client Secret**: Không cần lưu trữ client_secret trong code (public client)
- **Dynamic Security**: Mỗi lần auth tạo code_verifier và code_challenge mới
- **MITM Protection**: Code challenge bảo vệ khỏi man-in-the-middle attacks
- **Replay Attack Prevention**: Code verifier chỉ dùng được 1 lần

#### ✅ **CLI-Friendly Features**

- **Localhost Redirect**: Dùng http://127.0.0.1:port cho callback
- **Browser Integration**: Tự động mở browser để user consent
- **No Manual Copy/Paste**: Không cần user copy/paste authorization code
- **Cross-Platform**: Hoạt động trên Windows, macOS, Linux

### 13.2 Technical Implementation Details

#### 13.2.1 PKCE Flow cho CLI App

```javascript
// 1. Generate code verifier (43-128 characters)
const codeVerifier = generateRandomString(128);

// 2. Create code challenge (SHA256 hash)
const codeChallenge = base64URLEncode(sha256(codeVerifier));

// 3. Start localhost server
const server = http.createServer();
server.listen(8080);

// 4. Build authorization URL
const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${clientId}&` +
  `response_type=code&` +
  `scope=${scopes}&` +
  `redirect_uri=http://127.0.0.1:8080&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256&` +
  `state=${randomState}`;

// 5. Open browser
open(authUrl);

// 6. Handle callback and exchange code
const tokenResponse = await exchangeCodeForTokens({
  code: authorizationCode,
  code_verifier: codeVerifier, // No client_secret needed!
  client_id: clientId,
  redirect_uri: "http://127.0.0.1:8080",
});
```

#### 13.2.2 Google's Official Support

Theo [Google's OAuth 2.0 for Mobile & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app):

- ✅ **Supported**: "Google supports the Proof Key for Code Exchange (PKCE) protocol"
- ✅ **Recommended**: "We recommend using the latest version of Google Identity Services"
- ✅ **Localhost**: "Loopback IP address http://127.0.0.1:port" officially supported
- ✅ **No Client Secret**: "The client secret is obviously not treated as a secret"

### 13.3 Real-World Examples

#### 13.3.1 Existing CLI Tools sử dụng PKCE

- **[oktadev/pkce-cli](https://github.com/oktadev/pkce-cli)**: Production-ready PKCE CLI implementation
- **[x-color/google-oauth-cli](https://github.com/x-color/google-oauth-cli)**: Google-specific PKCE CLI tool
- **[aneshas/oauth](https://github.com/aneshas/oauth)**: Generic OAuth2 PKCE CLI authenticator

#### 13.3.2 Success Stories

- **Google Cloud SDK**: Sử dụng PKCE cho `gcloud auth login`
- **GitHub CLI**: Sử dụng OAuth2 với device flow tương tự
- **AWS CLI**: Sử dụng OAuth2 cho SSO authentication
- **Azure CLI**: Sử dụng OAuth2 cho `az login`

### 13.4 Implementation Advantages for docflu

#### ✅ **User Experience**

```bash
$ docflu auth --gdocs
🔐 Starting Google OAuth2 PKCE authentication...
🌐 Opening browser for consent...
# Browser tự động mở → User click Allow → Tự động quay về CLI
✅ Authentication successful!
```

#### ✅ **Security Best Practices**

- **No Secrets in Code**: Client ID công khai, không có client_secret
- **Temporary Server**: Localhost server chỉ chạy trong quá trình auth
- **Token Storage**: Secure storage trong `.docusaurus/google-tokens.json`
- **Auto Refresh**: Tự động refresh tokens khi hết hạn

#### ✅ **Cross-Platform Compatibility**

- **Windows**: `start` command để mở browser
- **macOS**: `open` command để mở browser
- **Linux**: `xdg-open` command để mở browser
- **Universal**: `open` npm package handle tất cả platforms

### 13.5 Dependencies và Libraries

#### 13.5.1 Required Dependencies

```json
{
  "googleapis": "^128.0.0", // Google APIs client
  "google-auth-library": "^9.4.0", // OAuth2 + PKCE support
  "open": "^8.4.0", // Cross-platform browser opener
  "http": "built-in", // Node.js built-in HTTP server
  "crypto": "built-in" // Node.js built-in crypto for PKCE
}
```

#### 13.5.2 No Additional Setup Required

- ❌ **No SSL certificates** needed (unlike custom URI schemes)
- ❌ **No app registration** in OS (unlike deep links)
- ❌ **No manual copy/paste** (unlike out-of-band flow)
- ❌ **No client_secret management** (unlike confidential clients)

### 13.6 Potential Challenges & Solutions

#### 🔧 **Challenge 1**: Port Conflicts

**Solution**: Dynamic port allocation với fallback ports

```javascript
const availablePorts = [8080, 8081, 8082, 3000, 5000];
const port = await findAvailablePort(availablePorts);
```

#### 🔧 **Challenge 2**: Firewall Issues

**Solution**: Sử dụng loopback IP (127.0.0.1) thay vì localhost

```javascript
const redirectUri = `http://127.0.0.1:${port}/callback`;
```

#### 🔧 **Challenge 3**: Browser Not Available

**Solution**: Fallback to manual URL với clear instructions

```javascript
if (!browserAvailable) {
  console.log("Please open this URL in your browser:");
  console.log(authUrl);
}
```
