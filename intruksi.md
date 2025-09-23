 ---

# 📋 ChatLite ToDo / Issue List

## 🔴 Bug Fixes

1. **ConversationId `undefined`**

   * **File:** `chat.ts`, `ChatList.tsx`, `StartNewChat.tsx`
   * **Issue:** `openConversation` kadang dipanggil dengan `id=undefined` → server error 404.
   * **Fix:** Tambahkan guard `if (!id) return` sebelum panggil API/socket. Pastikan setiap `onOpen` atau `onStarted` selalu memberi `id` valid.

2. **Virtualized list tidak muncul / putih**

   * **File:** `ChatWindow.tsx`
   * **Issue:** `AutoSizer` + `VariableSizeList` butuh parent `min-h-0` di flex container.
   * **Fix:** Pastikan parent `<div className="flex-1 flex flex-col min-h-0">` ada di Chat.tsx dan ChatWindow\.tsx.

3. **Runtime crash saat error message render**

   * **File:** `MessageItem.tsx`
   * **Issue:** Bila `formatTimestamp` tidak diberikan atau file util return undefined, seluruh app blank.
   * **Fix:** Tambahkan React Error Boundary + default fallback timestamp (`?? new Date().toLocaleTimeString()`).

4. **`as any` untuk store actions**

   * **File:** `ChatWindow.tsx`, `chat.ts`
   * **Issue:** `(s as any).uploadFile`, `(s as any).deleteMessage` → rawan runtime error.
   * **Fix:** Tambahkan tipe di store state biar aman.

5. **Socket auth**

   * **File:** `@lib/socket.ts`, server `auth.ts`
   * **Issue:** Kadang `Unauthorized socket connection` muncul (token hilang/expire).
   * **Fix:** Pastikan handshake bawa cookie/token. Tambah handler `socket.on("connect_error", …)` untuk fallback login/refresh.

---

## 🟠 Enhancements

6. **Error & loading states lebih jelas**

   * **File:** `ChatWindow.tsx`, `StartNewChat.tsx`
   * **Issue:** User tidak selalu tahu kalau sedang loading/fail.
   * **Fix:** Tambah spinner / disable tombol saat async, tampilkan error message di UI.

7. **Refactor util/helper**

   * **File:** `MessageItem.tsx`, `ChatWindow.tsx`
   * **Issue:** Ada duplikasi `formatTimestamp`, `getFullUrl`.
   * **Fix:** Buat `src/lib/utils.ts` untuk simpan semua helper (timestamp, fileUrl builder, file type checks).

8. **Scroll behavior kadang salah**

   * **File:** `ChatWindow.tsx`
   * **Issue:** Scroll ke bawah tidak selalu jalan pas pesan baru / upload.
   * **Fix:** Tambah `useLayoutEffect` + `scrollToBottom()` setelah `messages` update.

9. **Error boundary global**

   * **File:** `App.tsx` (root)
   * **Enhancement:** Bungkus ChatWindow dengan `<ErrorBoundary>` supaya error lokal tidak blank total.

10. **UX: fokus input otomatis**

    * **File:** `ChatWindow.tsx`
    * **Enhancement:** Setelah buka percakapan, otomatis fokus ke input text.

11. **Presence lebih akurat**

    * **File:** `ChatList.tsx`
    * **Issue:** Sekarang cuma ambil peer\[0], group chat belum benar.
    * **Fix:** Periksa semua peserta (kecuali diri sendiri), tampilkan online count.

---

## 🟢 Nice-to-have

12. **Testing**

    * Tambah unit test untuk:

      * `openConversation`
      * `sendMessage` (optimistic update)
      * `loadOlderMessages`
      * `deleteMessage`
    * Bisa pakai Vitest/Jest.

13. **Caching lebih pintar**

    * Saat banyak percakapan, batasi jumlah cache per conversation agar memory stabil.

14. **Accessibility**

    * Tambah label `aria-label` untuk input file / tombol send.
    * Pastikan tombol send bisa di-trigger dengan Enter/Shift+Enter di input.

---