# TASK: Apply full security hardening for Chat-Lite based on security audit

Context:
The attached audit report (app-guide.md) lists multiple critical and medium security issues in the Chat-Lite project.
Goal is to fix ALL vulnerabilities described, following each recommendation, while keeping application behavior identical.

Priority order:
1. Critical → file upload path traversal, socket cookie parsing
2. High → cookie security config, CSRF protection, message content sanitization
3. Medium → secure key storage, cache management

Steps:

### Backend Changes
1. In `server/src/routes/auth.ts`
   - Set authentication cookies `at` and `rt` with:
     ```ts
     sameSite: 'strict', httpOnly: true, secure: env.nodeEnv === 'production'
     ```
   - Remove conditional SameSite logic.

2. In `server/src/socket.ts`
   - Import `parse` from `'cookie'`.
   - Replace any manual cookie string splitting with safe:
     ```ts
     const cookies = parse(socket.handshake.headers.cookie || '');
     const token = cookies['at'];
     ```
   - Serialize Prisma results before broadcast:
     ```ts
     io.to(roomId).emit('message:new', JSON.parse(JSON.stringify(newMessage)));
     ```

3. In `server/src/routes/uploads.ts`
   - Prevent path traversal by sanitizing filenames:
     ```ts
     const sanitized = path.basename(file.filename);
     const uploadsDir = path.resolve(process.cwd(), env.uploadDir);
     const resolved = path.resolve(path.join(uploadsDir, sanitized));
     if (!resolved.startsWith(uploadsDir)) throw new ApiError(400, 'Invalid file path');
     return { url: `/uploads/${sanitized}` };
     ```

4. In `server/src/app.ts`
   - Add CSRF protection middleware using `csurf`:
     ```ts
     app.use(csrf({
       cookie: { httpOnly: true, sameSite: 'strict', secure: env.nodeEnv === 'production' }
     }));
     app.get('/api/csrf-token', (req, res) => res.json({ csrfToken: req.csrfToken() }));
     ```

5. In `server/src/socket.ts` (message handler)
   - Import `xss` and sanitize message content before saving:
     ```ts
     const sanitizedContent = data.content ? xss(data.content) : null;
     ```

### Frontend Changes
6. In `web/src/utils/keyManagement.ts`
   - Replace plain localStorage storage with encrypted Base64 string using libsodium as described:
     - Derive encryption key from (APP_SECRET + password)
     - Encrypt private key using `crypto_secretbox_easy`
     - Return combined salt + nonce + ciphertext.

7. In `web/src/utils/crypto.ts`
   - Implement cache size limit:
     ```ts
     const MAX_CACHE_SIZE = 1000;
     function cleanupCacheIfNeeded() {
       if (keyCache.size > MAX_CACHE_SIZE) {
         const firstKey = keyCache.keys().next().value;
         keyCache.delete(firstKey);
       }
     }
     ```
   - Call cleanup before adding new key to cache.

### Verification
- Run dev server and confirm:
  - Cookies use `SameSite=strict` and `secure` flags in production.
  - Socket connections authenticate correctly with parsed cookies.
  - Uploads reject filenames containing `../`.
  - XSS payloads in messages are sanitized.
  - CSRF token endpoint `/api/csrf-token` works.
  - Private key encrypted before storing.
  - Cache size limited and cleans oldest entries.

Output:
- Show updated code snippets for each changed file with minimal diff.
- Do not change unrelated business logic or styling.