# 🧠 Prompt Gemini — ChatLite UI Bubble Fix + File Picker Lag Diagnosis

You are a **senior fullstack engineer and UX performance auditor** assigned to the **ChatLite** project (React + TypeScript frontend + Express backend + Socket.io).
Your goal: fix and polish the **text bubble style** so it uses only gradient (no dark background), and **diagnose + optimize the lag** that occurs when clicking the file upload button (file explorer popup appears slowly).

---

## Context

* Frontend runs at `http://localhost:5173` (Vite + React + Tailwind + Zustand)
* Backend runs at `http://localhost:4000`
* The project uses Socket.io for realtime chat, and `uploadFile` (in `web/src/store/chat.ts`) for attachments.
* Current behavior:

  1. **Bubble Issue:** Text-only messages have a **double-layer style** — a dark base bubble + gradient overlay.
     Expected: text-only bubbles should have **gradient only** (no dark inner layer).
     The gradient color scheme should stay consistent with the current message theme (blue/purple gradient for sender, neutral gray for receiver).
  2. **File Upload Lag:** When the user clicks the attachment icon (paperclip) to select a file, the **browser lags** for 2–3 seconds before showing the system file picker.
     This only happens when ChatLite is running, not on other sites. The user suspects the cause may be from the app itself (e.g., large re-render, heavy event listener, or async blocking in the UI thread).

---

## Goals

1. 🟣 **Fix Chat Bubble Style**

   * Target file: `web/src/components/MessageItem.tsx` (and any related CSS/Tailwind utilities)
   * When rendering **text-only** messages:

     * Use **gradient bubble only** (remove or disable dark base div/layer).
     * Apply Tailwind style like:

       ```tsx
       bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md
       ```

       with padding and rounded corners.
     * Ensure no dark overlay or nested container causes double background.
   * For **file-only** or **combined** messages, keep the file card UI as-is (file preview bubble stays).
   * Make sure wrapping and line height remain correct (`whitespace-pre-wrap`, `break-words`, `max-w-[75%]`).

2. 🧠 **Diagnose File Picker Lag**

   * Investigate root cause of lag when clicking the upload (file input).
   * Focus on these possible causes:

     * Large re-render triggered by Zustand store mutation or parent `ChatWindow` component state updates.
     * The file input may be wrapped inside a `<label>` with an unnecessary `onChange` or complex state binding that triggers re-renders before file selection.
     * Blocking async logic (like fetching encryption keys or creating blobs) inside the same event as `input.click()`.
     * Dev server (Vite hot reload) interfering with file picker in development mode.
   * Run profiling to confirm if the delay happens **before** the OS file dialog opens (app-level issue) or **after** (device/OS-level latency).

3. ⚙️ **Optimize if Lag Is App-Side**

   * If confirmed app-related:

     * Move any heavy code (like encryption prep or preview generation) to **after** file selection (`onChange`), not before.
     * Ensure `input[type=file]` is hidden and not re-mounted every render.
     * Memoize or use `useRef` for file input to prevent unnecessary component reloads.
     * Keep the file input’s `accept` attribute specific to allowed types (`.png,.jpg,.jpeg,.mp4,.pdf,.docx,.pptx,.zip,.txt`).
     * Ensure no Zustand `set()` call or async runs before `input.click()`.
   * If lag persists, report that the delay is likely **system-level** (GPU-accelerated compositor delay or file picker API blocking thread in Ubuntu/Wayland) and **not app-side**.

4. ✅ **Deliverables**

   * Clean fixed UI (gradient-only text bubbles)
   * Profiling analysis (summary: app vs device cause)
   * Optimized upload trigger (if needed)
   * Updated code snippets for:

     * `MessageItem.tsx`
     * `MessageInput.tsx` (upload button logic)
   * Keep all existing functionality (file upload, encryption, socket emit) intact.

5. ⚡ **Expected Result**

   * Text-only messages look clean, just gradient bubble, no black background.
   * File messages remain with card UI (no duplicates).
   * File picker opens instantly (<0.5s delay).
   * No layout shift or performance drop in chat view.

---

## Constraints

* Keep backward compatibility (no breaking API/socket changes).
* Keep UI lightweight and responsive for mid-tier laptops.
* Maintain security: still validate file types and size limit (10MB max).
* Write all code in TypeScript and follow existing project conventions.

---

## Output Format

Return:

1. **Modified code** (full relevant components)
2. **Explanation** (why changes fix the issues)
3. **Lag diagnosis summary** (app-level vs device-level)
4. **Final testing steps** to verify both fixes.

---

Kirim hasil akhir dalam format “code + explanation + test guide”.
Jangan hanya menjelaskan — implementasikan langsung fix dan optimasi di level komponen & store.

---