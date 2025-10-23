## ⚙️ **Prompt Gemini CLI – Fix & Enhance File Upload System (Full Audit + Security + 10MB Limit)**

You are a senior fullstack engineer specializing in secure real-time chat applications.
Your task is to perform a **complete audit and rebuild** of the file upload system in the ChatLite project, ensuring it is fully functional, secure, and supports multiple file types.

---

### 🎯 GOAL

Fix the current file upload feature which currently fails to store files on the server and does not display uploaded files in chat.  
Then, enhance it to handle **image, document, video, and general file uploads** securely, with a **maximum size limit of 10MB**.

The final implementation must work smoothly with existing chat message flow (both encrypted and unencrypted modes).

---

### 1️⃣ Investigate Current Issue

**Symptoms:**
- Uploading files via chat UI does nothing.
- No files are stored in the `/uploads` directory on the server.
- No error message appears in frontend or backend logs.

**Your tasks:**
- Audit all upload-related code:
  - Frontend: likely `MessageInput.tsx`, `api.ts`, `chat.ts` or any upload component.
  - Backend: `server/src/routes`, `server/src/socket.ts`, `server/src/index.ts`, or `server/src/upload.ts`.
- Identify missing or misconfigured handlers (e.g., missing `multer`, `busboy`, or `express.static` setup).
- Ensure proper server route registration and static file serving for `/uploads`.

---

### 2️⃣ Implement Secure File Upload System

**Requirements:**
- Allow uploads for the following types:
  - **Images:** `.png, .jpg, .jpeg, .gif, .webp`
  - **Documents:** `.pdf, .doc, .docx, .ppt, .pptx, .xls, .xlsx, .txt`
  - **Media:** `.mp3, .mp4, .mov, .wav, .avi`
  - **Other safe file formats** (optional: `.zip, .rar`, etc.)
- Enforce **maximum file size: 10MB**.
- Store uploads in `/server/uploads/` with unique filenames (timestamp + random string).
- Sanitize filenames to prevent path traversal or command injection.
- Reject unknown or potentially dangerous file extensions.
- Ensure upload directory auto-creates if not existing.
- Return JSON response with file metadata (filename, size, type, URL).

---

### 3️⃣ Frontend Integration

**Tasks:**
- Update message input component (`MessageInput.tsx` or related file):
  - Add a file input or drag-and-drop upload option.
  - On upload success, automatically send the uploaded file as a chat message with a proper preview (image, doc, video icon, etc.).
- Display previews:
  - Images → inline thumbnail preview.
  - Documents / media → clickable file link or embed (if possible).
  - Unknown types → generic file icon with filename.
- Ensure encryption compatibility:
  - If encryption is enabled, encrypt file metadata (not the binary).
  - File itself remains stored unencrypted but served via secure URL.
  - Optional: add file signature or hash verification later.

---

### 4️⃣ Backend Security Hardening

- Use middleware such as `multer` for file handling.
- Validate file types using MIME type inspection (not just extension).
- Sanitize filenames before saving.
- Serve `/uploads` via `express.static` with read-only access.
- Disable directory listing and script execution.
- Enforce CORS and authentication if necessary.
- Prevent users from overwriting files with the same name.

Example save path:
```

/server/uploads/
        ├── images/
        ├── documents/
        ├── videos/
        └── others/

```
Auto-detect and save file to the correct subfolder.

---

### 5️⃣ Validation & Error Handling

- Return clear error messages if upload fails (size exceeded, invalid type, etc.).
- Handle server errors gracefully.
- Add frontend UI feedback (progress bar, upload success, upload failed).
- Validate that uploaded files appear correctly in chat history.

---

### 6️⃣ Output and Verification

After implementation, verify that:
- File uploads successfully to `/uploads` and persists.
- All file types listed above work and respect the 10MB limit.
- Malicious files or oversize uploads are blocked safely.
- Uploaded files appear correctly in chat (with proper icon or preview).
- Server logs show upload success and handle errors gracefully.
- No warnings or console errors appear in frontend or backend.

---

### 7️⃣ Deliverables

When finished, provide:
1. A summary of the root cause of the upload failure.
2. Explanation of security improvements applied.
3. List of modified or added files.
4. Confirmation that the upload feature is tested and stable for production.

---

### 8️⃣ Constraints

- Keep existing chat architecture and encryption logic intact.
- Do not modify unrelated modules (auth, socket encryption, etc.).
- Follow professional production standards for file handling and security.
- Maintain full TypeScript type safety.
- Preserve the existing folder structure and build scripts.

Now, begin by analyzing the entire upload pipeline (frontend to backend) and implement a **secure, reliable, and production-grade upload feature** for ChatLite.
```