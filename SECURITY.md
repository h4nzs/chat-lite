# Security Policy

## 🛡️ Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.2.x   | ✅ Latest release  |
| 1.1.x   | ❌ Not supported   |
| 1.0.x   | ❌ Not supported   |

## 🔍 Security Measures Implemented

### 1. Authentication Security
- **JWT-based Authentication**: Uses JSON Web Tokens with access token and refresh token stored in httpOnly cookies
- **Automatic Token Refresh**: Tokens automatically refreshed to maintain session without user intervention
- **Secure Cookie Handling**: Cookies configured with appropriate security flags (httpOnly, secure, sameSite)
- **Rate Limiting**: API rate limiting to prevent brute force attacks

### 2. Data Encryption
- **End-to-End Encryption**: Messages encrypted using libsodium before transmission
- **Session Keys**: Unique session keys generated for each conversation
- **Key Exchange**: Public key cryptography for secure key sharing
- **Forward Secrecy**: Session keys rotated for enhanced security

### 3. Input Validation
- **Zod Schema Validation**: Strong typing and validation for all API inputs
- **Content Sanitization**: XSS protection for message content using xss library
- **File Validation**: Type and size validation for uploads with path traversal protection

### 4. Network Security
- **Helmet.js**: Security headers to prevent common web vulnerabilities (XSS, clickjacking, etc.)
- **CORS Protection**: Controlled cross-origin resource sharing with strict origin policies
- **CSRF Protection**: Cross-site request forgery prevention with tokens (partially implemented)
- **HTTPS Enforcement**: Secure transport enforced in production environments

### 5. Access Control
- **Conversation Permissions**: Users can only access conversations they're part of
- **Message Ownership**: Users can only delete their own messages
- **Participant Validation**: Verification of conversation membership before message operations

## 🔐 Security Best Practices

### 1. Environment Variables
- Never commit secrets to version control
- Use strong, randomly generated secrets for JWT signing
- Rotate secrets periodically
- Use different secrets for different environments

### 2. Dependency Management
- Regularly update dependencies to patch known vulnerabilities
- Use npm audit or similar tools to identify security issues
- Pin dependency versions to prevent unexpected updates
- Review third-party packages for security track record

### 3. Database Security
- Use parameterized queries to prevent SQL injection
- Implement proper database user permissions
- Regularly backup and encrypt sensitive data
- Monitor database access logs

### 4. Frontend Security
- Implement proper Content Security Policy (CSP)
- Prevent XSS by sanitizing user input
- Use secure WebSocket connections (wss://)
- Implement proper error handling without exposing sensitive information

## ⚠️ Known Security Issues

### 1. Cookie Security Configuration - High Severity
- **Issue**: SameSite attribute not set to "strict" for authentication cookies
- **Impact**: Potential CSRF attacks in certain scenarios
- **Fix Needed**: Configure SameSite="strict" in `server/src/routes/auth.ts`
- **Workaround**: Application uses CSRF tokens where implemented

### 2. CSRF Protection - High Severity
- **Issue**: No CSRF tokens implemented for state-changing operations
- **Impact**: Application vulnerable to cross-site request forgery attacks
- **Fix Needed**: Add CSRF protection middleware and tokens
- **Workaround**: Limited by cookie security settings

### 3. Private Key Storage - Medium Severity
- **Issue**: Private keys stored in localStorage (accessible to XSS attacks)
- **Impact**: Potential key compromise through XSS attacks
- **Fix Needed**: Implement additional encryption layers for key storage
- **Workaround**: Application sanitizes message content to prevent XSS

### 4. File Upload Security - Critical Severity
- **Issue**: Path traversal vulnerability in upload functionality
- **Impact**: Attackers could upload files outside intended directory
- **Fix Needed**: Implement filename sanitization and path validation
- **Workaround**: File type validation prevents executable uploads

### 5. Cache Memory Leaks - Medium Severity
- **Issue**: Caching without size limits in crypto utilities
- **Impact**: Potential memory exhaustion in long-running sessions
- **Fix Needed**: Add cache size limits and proper cleanup routines
- **Workaround**: Periodic page refreshes clear cache

## 🛠️ Recommended Security Enhancements

### 1. Complete Cookie Security Configuration
```typescript
// In server/src/routes/auth.ts
res.cookie("at", access, {
  httpOnly: true,
  secure: isProd,
  sameSite: "strict",  // Always use strict
  path: "/",
  maxAge: 1000 * 60 * 15,
});
```

### 2. Full CSRF Protection Implementation
```typescript
// In server/src/app.ts
import csrf from 'csurf';

app.use(csrf({ 
  cookie: { 
    httpOnly: true, 
    secure: isProd, 
    sameSite: 'strict' 
  } 
}));

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

### 3. Enhanced Key Storage Security
```typescript
// In web/src/utils/keyManagement.ts
export async function storePrivateKey(privateKey: Uint8Array, password: string): Promise<string> {
  const sodium = await getSodium();
  
  // Create additional encryption key based on app secrets + user password
  const appSecret = import.meta.env.VITE_APP_SECRET || 'default-secret';
  const combinedKey = `${appSecret}-${password}`;
  
  // Derive a key from the combined secret
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    combinedKey,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );
  
  // Encrypt the private key
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const encryptedPrivateKey = sodium.crypto_secretbox_easy(privateKey, nonce, key);
  
  // Combine salt, nonce, and encrypted key
  const result = new Uint8Array(salt.length + nonce.length + encryptedPrivateKey.length);
  result.set(salt, 0);
  result.set(nonce, salt.length);
  result.set(encryptedPrivateKey, salt.length + nonce.length);
  
  return sodium.to_base64(result, sodium.base64_variants.ORIGINAL);
}
```

### 4. File Upload Path Traversal Protection
```typescript
// In server/src/routes/uploads.ts
import path from 'path';

async function saveUpload(file: Express.Multer.File) {
  // Sanitize filename to prevent path traversal
  const sanitizedFilename = path.basename(file.filename);
  const safePath = path.join(process.cwd(), env.uploadDir, sanitizedFilename);
  
  // Verify the file is actually in the uploads directory
  const uploadsDir = path.resolve(process.cwd(), env.uploadDir);
  const resolvedPath = path.resolve(safePath);
  
  if (!resolvedPath.startsWith(uploadsDir)) {
    throw new ApiError(400, "Invalid file path");
  }
  
  return { url: `/uploads/${sanitizedFilename}` };
}
```

### 5. Cache Management Improvements
```typescript
// In web/src/utils/crypto.ts
const MAX_CACHE_SIZE = 1000;

function cleanupCacheIfNeeded(): void {
  if (messageCache.size > MAX_CACHE_SIZE) {
    // Remove oldest entries (first-in-first-out)
    const firstKey = messageCache.keys().next().value;
    if (firstKey) {
      messageCache.delete(firstKey);
    }
  }
}
```

## 🐛 Reporting a Vulnerability

If you discover a security vulnerability in Chat-Lite, please follow these steps:

1. **Do not** create a public GitHub issue
2. **Email** the security team at security@chatlite.app
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Security Response Process

1. **Acknowledgment**: We will acknowledge receipt of your report within 24 hours
2. **Investigation**: Our security team will investigate the issue within 72 hours
3. **Resolution**: We will work on a fix and provide a timeline for resolution
4. **Disclosure**: We will coordinate disclosure with you once the fix is deployed
5. **Credit**: We will credit you for the discovery (unless you prefer anonymity)

### Bug Bounty Program

We offer bug bounties for security researchers who responsibly disclose vulnerabilities:

| Vulnerability Class | Bounty Range |
|-------------------|--------------|
| Critical          | $500 - $1000 |
| High              | $200 - $500  |
| Medium            | $50 - $200   |
| Low               | $10 - $50    |

## 🔒 Compliance

### GDPR Compliance
- User data minimization
- Right to erasure implementation
- Data portability support
- Privacy by design principles

### HIPAA Considerations
- End-to-end encryption for PHI
- Audit logging capabilities
- Access controls
- Data integrity measures

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Security Best Practices](https://curity.io/resources/architecture/jwt-security-best-practices/)
- [Socket.IO Security Guide](https://socket.io/docs/v4/security/)
- [React Security Guidelines](https://reactjs.org/docs/security.html)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

*Last updated: October 2025*