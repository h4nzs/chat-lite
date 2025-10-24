# Peta Alur Data & Analisis Logika Chat-Lite

Dokumen ini adalah analisis mendalam mengenai alur data, event socket, dan interaksi komponen dalam aplikasi Chat-Lite, sesuai dengan instruksi lanjutan.

---

### 1. Peta Alur Data Utama (Data Flow)

Berikut adalah pemetaan alur untuk setiap fitur utama, dari aksi pengguna hingga pembaruan UI.

**➡️ Autentikasi (Login/Register)**
*   **Jenis:** REST API (Sinkron)
*   **Alur:**
    1.  `[User Action]` User mengisi form di `AuthForm.tsx`.
    2.  `[Frontend Component]` Memanggil `login()` atau `register()` dari `useAuthStore`.
    3.  `[API Event]` `authFetch` mengirim request `POST` ke `/api/auth/login` atau `/api/auth/register`.
    4.  `[Backend Logic]` Server memvalidasi data, membuat/memeriksa user di DB, membuat JWT.
    5.  `[Database]` `SELECT` atau `INSERT` ke tabel `User`.
    6.  `[API Response]` Server mengirim kembali data user dan menyetel cookie `at` & `rt`.
    7.  `[State Update]` `useAuthStore` menyimpan data user, memanggil `ensureSocket()` untuk memulai koneksi socket.

**📨 Pengiriman & Penerimaan Pesan**
*   **Jenis:** WebSocket (Asinkron) dengan UI Optimistis
*   **Alur:**
    1.  `[User Action]` User mengetik pesan dan menekan "kirim" di `ChatWindow.tsx`.
    2.  `[Frontend Component]` Memanggil `sendMessage()` dari `useChatStore`.
    3.  `[State Update (Optimistic)]` `useChatStore` langsung menambahkan pesan sementara ke state `messages`. UI langsung di-update.
    4.  `[Socket Event]` `socket.emit('message:send', payload, ackCallback)`.
    5.  `[Backend Logic]` Server menerima event `message:send`, membersihkan input (`xss`), dan menyimpan pesan.
    6.  `[Database]` `INSERT` ke tabel `Message`.
    7.  `[Socket Broadcast]` `io.to(conversationId).emit('message:new', messageData)`.
    8.  `[Client Update]`
        *   **Pengirim:** `ackCallback` dari server diterima, `useChatStore` mengganti pesan sementara dengan data pesan asli dari server.
        *   **Penerima:** Event `message:new` diterima, `useChatStore` menambahkan pesan baru ke state `messages`, UI di-update.

**📎 File Attachment**
*   **Jenis:** Hybrid (REST API untuk upload, WebSocket untuk pesan)
*   **Alur:**
    1.  `[User Action]` User memilih file di `ChatWindow.tsx`.
    2.  `[Frontend Component]` Memanggil `uploadFile()` dari `useChatStore`.
    3.  `[API Event]` `authFetch` mengirim `POST` request dengan `FormData` ke `/api/uploads/:conversationId/upload`.
    4.  `[Backend Logic]` Middleware `multer` memproses dan menyimpan file di server.
    5.  `[API Response]` Server mengembalikan URL dan metadata file.
    6.  `[State Update]` Fungsi `uploadFile` kemudian memanggil `sendMessage()` dengan data file (URL, nama, tipe), yang mengikuti alur "Pengiriman Pesan" di atas.

**⌨️ Typing Indicator**
*   **Jenis:** WebSocket (Real-time)
*   **Alur:**
    1.  `[User Action]` User mulai mengetik di `ChatWindow.tsx`.
    2.  `[Socket Event]` `socket.emit('typing:start', { conversationId })`.
    3.  `[Backend Logic]` Server menerima `typing:start`.
    4.  `[Socket Broadcast]` `socket.to(conversationId).emit('typing:update', { userId, isTyping: true })`.
    5.  `[Client Update]` Semua klien di room menerima `typing:update`, `useChatStore` memperbarui state `typing`, `TypingIndicator.tsx` menampilkan notifikasi.
    6.  Proses serupa terjadi untuk `typing:stop`.

**🟢 Status Online/Offline**
*   **Jenis:** WebSocket (Real-time)
*   **Alur:**
    1.  `[User Action]` User membuka aplikasi (terhubung) atau menutupnya (terputus).
    2.  `[Socket Event]` Klien terhubung ke server socket.
    3.  `[Backend Logic]` Server `io.on('connection')` aktif, `userId` ditambahkan ke `onlineUsers` (Set).
    4.  `[Socket Broadcast]` `io.emit('presence:update', Array.from(onlineUsers))`. **Catatan: Seluruh daftar dikirim ke semua klien.**
    5.  `[Client Update]` Semua klien menerima daftar `onlineUserIds`, `useChatStore` memperbarui state `presence`, UI (misalnya `OnlineDot.tsx`) di-update.
    6.  Proses serupa terjadi saat `disconnect`.

---

### 2. Peta Event Socket.IO

**Client → Server:**
*   `conversation:join` (conversationId: string): Meminta untuk bergabung ke room percakapan agar bisa menerima pesan.
*   `message:send` (data: object, cb: function): Mengirim pesan baru. Menggunakan callback untuk acknowledgment.
*   `typing:start` ({ conversationId }): Memberi tahu server bahwa user mulai mengetik.
*   `typing:stop` ({ conversationId }): Memberi tahu server bahwa user berhenti mengetik.
*   `push:subscribe` (data: object): Mengirim detail langganan push notification untuk disimpan.

**Server → Client:**
*   `presence:update` (onlineUserIds: string[]): Broadcast daftar lengkap ID user yang sedang online.
*   `typing:update` ({ userId, conversationId, isTyping }): Broadcast status mengetik seorang user ke anggota percakapan lain.
*   `message:new` (newMessage: Message): Broadcast pesan baru ke semua anggota percakapan.
*   `conversation:new` (newConversation: Conversation): Broadcast saat percakapan baru dibuat (misalnya setelah `startConversation`).
*   `conversation:deleted` ({ id }): Memberi tahu klien bahwa sebuah percakapan telah dihapus.
*   `message:deleted` ({ messageId, conversationId }): Memberi tahu klien bahwa sebuah pesan telah dihapus (kontennya disembunyikan).
*   `reaction:new` (reaction: object): Broadcast reaksi baru pada sebuah pesan.
*   `reaction:remove` ({ reactionId, messageId }): Broadcast bahwa sebuah reaksi telah dihapus.

---

### 3. Hubungan Antar Komponen (Frontend)

```
<App>
 └── <BrowserRouter>
      └── <Routes>
           ├── <ProtectedRoute> → <Chat>
           │    ├── <ChatList>
           │    │    ├── <StartNewChat />
           │    │    └── <ChatItem /> (dipetakan dari state.conversations)
           │    └── <ChatWindow>
           │         ├── (Header Percakapan)
           │         ├── <Virtuoso (MessageList)>
           │         │    └── <MessageItem /> (dipetakan dari state.messages)
           │         ├── <TypingIndicator />
           │         └── (Form Input Pesan)
           ├── <Login />
           │    └── <AuthForm />
           └── <Register />
                └── <AuthForm />
```

**Penjelasan:**
*   **Komponen Kontainer:** `Chat.tsx` adalah komponen utama yang mengatur layout dan mengambil data awal.
*   **Ketergantungan State Global (Zustand):**
    *   Hampir semua komponen "pintar" bergantung pada `useChatStore` dan `useAuthStore`.
    *   `ChatList` membaca `conversations` dan `presence`.
    *   `ChatWindow` membaca `messages`, `typing`, dan `activeId`.
    *   `ChatItem` dan `MessageItem` adalah komponen presentasional yang menerima data melalui props.
*   **State Lokal:** Sebagian besar state dikelola secara global oleh Zustand. State lokal hanya digunakan untuk hal-hal sederhana seperti input form sebelum dikirim ke store (misalnya di `AuthForm` atau form input pesan).
*   **Alur Interaksi:**
    1.  `ChatList` → `useChatStore.openConversation(id)` → mengubah `activeId`.
    2.  Perubahan `activeId` dideteksi oleh `ChatWindow`, yang kemudian memuat dan menampilkan pesan yang sesuai dari state.

---

### 4. Integrasi API & Backend Logic

Berikut adalah beberapa endpoint REST API utama:

*   `GET /api/csrf-token`:
    *   **Tujuan:** Memberikan token CSRF ke klien. Penting untuk keamanan.
    *   **Middleware:** `csrfProtection`.
*   `POST /api/auth/login`:
    *   **Tujuan:** Mengautentikasi pengguna, mengembalikan data user & set cookie JWT.
*   `POST /api/auth/register`:
    *   **Tujuan:** Mendaftarkan pengguna baru.
*   `POST /api/auth/logout`:
    *   **Tujuan:** Menghapus refresh token dari database.
*   `GET /api/users/me`:
    *   **Tujuan:** Mendapatkan data pengguna yang sedang login.
    *   **Middleware:** `auth` (verifikasi JWT).
*   `GET /api/conversations`:
    *   **Tujuan:** Mengambil semua percakapan milik pengguna.
    *   **Middleware:** `auth`.
*   `POST /api/conversations/start`:
    *   **Tujuan:** Memulai percakapan baru dengan pengguna lain.
    *   **Middleware:** `auth`.
*   `GET /api/messages/:conversationId`:
    *   **Tujuan:** Mengambil riwayat pesan untuk sebuah percakapan.
    *   **Middleware:** `auth`.
*   `POST /api/uploads/:conversationId/upload`:
    *   **Tujuan:** Mengunggah file.
    *   **Middleware:** `auth`, `multer`.
*   `POST /api/keys/public`:
    *   **Tujuan:** Menyimpan kunci publik E2EE milik pengguna.
    *   **Middleware:** `auth`.

---

### 5. Temuan & Insight

*   **Fitur Sinkron (✅):**
    *   Pengiriman/penerimaan pesan, indikator pengetikan, dan status online berfungsi secara real-time dan sinkron.
    *   Alur autentikasi dan manajemen sesi sudah solid.
    *   Implementasi UI Optimistis pada pengiriman pesan adalah nilai tambah yang besar untuk UX.

*   **Fitur yang Perlu Perhatian (⚠️):**
    *   **Broadcast `presence:update`:** Seperti yang disebutkan sebelumnya, mengirim seluruh daftar pengguna online setiap kali ada perubahan tidak efisien untuk skala besar. Ini adalah kandidat utama untuk optimasi di masa depan.
    *   **Error Handling di UI:** Kode di `useChatStore` menangani error dengan `console.error`, namun belum jelas bagaimana semua skenario error (misalnya, pesan gagal terkirim setelah UI optimis) ditampilkan kepada pengguna. Perlu dipastikan ada feedback visual yang jelas.

*   **Potensi Race Condition/Duplikasi (Risiko Rendah):**
    *   Risiko duplikasi listener socket sudah ditangani dengan baik melalui pembersihan (`socket.off()`) di `initSocketListeners`. Ini adalah praktik yang sangat baik dan harus dipertahankan.

*   **Saran Singkat:**
    1.  **Optimasi Socket:** Prioritaskan refaktor event `presence:update` untuk hanya mengirim perubahan delta (`user_joined` / `user_left`) jika aplikasi ditujukan untuk basis pengguna yang besar.
    2.  **Stabilisasi UI:** Lakukan audit UI untuk memastikan semua state (loading, error, empty) memiliki representasi visual yang jelas. Misalnya, jika pesan gagal terkirim, tandai pesan tersebut dengan ikon error di `MessageItem`.
    3.  **Refactor ke Custom Hooks:** Pertimbangkan untuk memindahkan logika dari `useEffect` di dalam komponen seperti `ChatWindow` ke dalam custom hooks (misalnya `useMessages(conversationId)`). Ini akan membuat komponen lebih bersih dan logikanya lebih mudah diuji.
