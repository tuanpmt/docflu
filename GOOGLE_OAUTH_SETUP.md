# Google OAuth2 Setup Guide for docflu CLI

## 🎯 Overview

Để sử dụng tính năng sync Google Docs, bạn cần setup OAuth2 credentials trong Google Cloud Console. docflu sử dụng **OAuth2 with PKCE flow** - phương pháp bảo mật cho CLI applications.

**⚠️ Lưu ý quan trọng**: Mặc dù OAuth2 PKCE spec không yêu cầu `client_secret` cho Desktop applications, nhưng Google's implementation vẫn yêu cầu cả `client_id` và `client_secret` ngay cả cho Desktop apps.

## 📋 Prerequisites

- Google account
- Project cần sync (Docusaurus hoặc markdown files)
- docflu CLI đã được cài đặt

## 🔧 Step-by-Step Setup

### 1. Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Nhập project name: `docflu-sync` (hoặc tên bạn muốn)
4. Click **"Create"**

### 2. Enable Google Docs API

1. Trong project vừa tạo, vào **"APIs & Services"** → **"Library"**
2. Search **"Google Docs API"**
3. Click vào **"Google Docs API"**
4. Click **"Enable"**

### 3. Tạo OAuth2 Credentials

1. Vào **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Nếu chưa có OAuth consent screen:
   - Click **"CONFIGURE CONSENT SCREEN"**
   - Chọn **"External"** → **"Create"**
   - Điền thông tin cơ bản:
     - App name: `docflu CLI`
     - User support email: your-email@gmail.com
     - Developer contact: your-email@gmail.com
   - Click **"Save and Continue"** qua các bước
   - Quay lại **"Credentials"**

4. Tạo OAuth client ID:
   - Application type: **"Desktop application"**
   - Name: `docflu CLI Client`
   - Click **"Create"**

### 4. Lấy Credentials

**⚠️ QUAN TRỌNG**: Desktop application KHÔNG cần configure redirect URIs manually. Google tự động cho phép loopback addresses.

1. Trong danh sách credentials, click vào **"docflu CLI Client"**
2. Copy **Client ID**: Format `123456789-abc123.apps.googleusercontent.com`
3. Copy **Client Secret**: Format `GOCSPX-...` 
4. **Lưu ý**: Mặc dù là Desktop app, Google vẫn yêu cầu client secret

## 🔑 Configure docflu

### 1. Setup .env file

```bash
# Trong project directory
docflu init

# Hoặc tạo .env manually
cp env.example .env
```

### 2. Cập nhật Google OAuth2 Credentials

Edit `.env` file:

```bash
# Google Docs Configuration (OAuth2 with PKCE)
GOOGLE_CLIENT_ID=123456789-abc123.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_DOCUMENT_TITLE=Documentation
```

**🔒 Security Note**: Client secret cho Desktop apps không thực sự "secret" vì có thể được reverse engineer. Google vẫn yêu cầu để validate client identity.

### 3. Test Configuration

```bash
# Test client setup
npm run test:google-docs

# Test OAuth2 flow (dry-run)
docflu sync --gdocs --docs --dry-run
```

## 🚀 First Sync

```bash
# Sync to Google Docs
docflu sync --gdocs --docs
```

OAuth2 Flow sẽ:
1. 🔐 Mở browser để authenticate
2. ✅ User approve docflu CLI access
3. 🔄 Exchange authorization code + PKCE verifier
4. 🔑 Save tokens to `.docusaurus/google-tokens.json`
5. 📄 Tạo Google Docs document
6. 📝 Thêm dummy content với formatting
7. ✅ Hiển thị kết quả và URL

## 🔍 Troubleshooting

### Error: "OAuth client was not found"

- ✅ Kiểm tra GOOGLE_CLIENT_ID trong .env
- ✅ Verify client ID format: `*-*.apps.googleusercontent.com`
- ✅ Đảm bảo OAuth client type là "Desktop application"

### Error: "client_secret is missing"

- ✅ Thêm GOOGLE_CLIENT_SECRET vào .env file
- ✅ Verify client secret format: `GOCSPX-...`
- ✅ Copy chính xác từ Google Cloud Console

### Error: "invalid_request"

- ✅ Kiểm tra Google Docs API đã enabled
- ✅ Port 8080 không bị block
- ✅ Verify cả client_id và client_secret đều đúng

### Error: "access_denied"

- ✅ Approve application trong browser
- ✅ Kiểm tra Google account permissions
- ✅ Thử authenticate lại

### Error: "redirect_uri_mismatch"

- ✅ Desktop apps không cần configure redirect URIs
- ✅ Google tự động accept `http://127.0.0.1:8080/callback`
- ✅ Đảm bảo port 8080 available

## 📊 Expected Results

Khi thành công, bạn sẽ thấy:

```bash
🚀 Syncing all docs/ to google-docs
📂 Project root: /Users/your-user/project
🔐 Starting Google OAuth2 PKCE authentication...
🔑 Generated code verifier and challenge (SHA256)
🖥️ Started localhost server on http://127.0.0.1:8080
🌐 Opening browser for consent...
✅ Please approve the application in your browser
⏳ Waiting for authorization callback...
🔍 Callback received:
   Code: 4/0AVMBsJj7zSrC4B5Lt...
   State: 5c2b6d1f6c...
   Error: null
🔄 Exchanging authorization code for tokens (PKCE)...
✅ Authentication successful!
🔑 Tokens saved to .docusaurus/google-tokens.json
✅ Google Docs client initialized successfully
📄 Creating new Google Docs document: "docflu API Test"
✅ Document created successfully!
📄 Document ID: 1znjTFaguiVUSCZx8h56X5kac4Q5Jin3qRGfFTHNZdck
🔗 URL: https://docs.google.com/document/d/1znjTFaguiVUSCZx8h56X5kac4Q5Jin3qRGfFTHNZdck
📝 Adding dummy content...
✅ Dummy content added successfully!
📊 Applied 3 formatting requests
✅ Google Docs sync completed successfully!
```

## 🔒 Security Notes

- **PKCE + Client Secret**: Google yêu cầu cả hai cho Desktop apps
- **Local Tokens**: Tokens được lưu trong `.docusaurus/google-tokens.json`
- **Auto Refresh**: Tokens tự động refresh khi hết hạn
- **Localhost Only**: OAuth callback chỉ hoạt động trên localhost:8080
- **No Redirect URI Config**: Desktop apps không cần manual redirect URI setup

## 🎯 Implementation Details

### OAuth2 Flow với Google

1. **Authorization Request**: Tạo PKCE code_verifier + code_challenge
2. **User Consent**: Mở browser cho user approve
3. **Authorization Code**: Nhận code từ Google callback
4. **Token Exchange**: Gửi code + code_verifier + client_secret
5. **Access Token**: Nhận tokens và save local
6. **API Calls**: Sử dụng access token cho Google Docs API

### File Structure

```
your-project/
├── .env                              # OAuth2 credentials
├── .docusaurus/
│   ├── google-tokens.json           # OAuth2 tokens (auto-generated)
│   └── sync-state.json              # Sync state (future)
└── docs/                            # Markdown files to sync
```

## 🆘 Support

Nếu gặp vấn đề:

1. **Kiểm tra Credentials**:
   ```bash
   grep GOOGLE_ .env
   # Phải có cả CLIENT_ID và CLIENT_SECRET
   ```

2. **Test Client Setup**:
   ```bash
   npm run test:google-docs
   ```

3. **Check Google Cloud Console**:
   - Google Docs API enabled
   - OAuth client type = Desktop application
   - Credentials chính xác

4. **Network Issues**:
   - Port 8080 available
   - Firewall không block localhost
   - Internet connection stable

5. **Resources**:
   - [Google OAuth2 Documentation](https://developers.google.com/identity/protocols/oauth2/native-app)
   - [Google Docs API Reference](https://developers.google.com/docs/api)
   - [OAuth2 PKCE RFC](https://tools.ietf.org/html/rfc7636)

---

**🎯 Status**: ✅ OAuth2 authentication thành công → ✅ Google Docs API hoạt động → 🚀 Ready cho markdown parsing!

**Next Phase**: Implement markdown parsing, tab hierarchy, và content conversion cho Google Docs format. 