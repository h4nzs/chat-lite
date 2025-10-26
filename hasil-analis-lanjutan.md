# Peta Alur Data & Analisis Logika Chat-Lite

Dokumen ini adalah analisis mendalam mengenai alur data, event socket, dan interaksi komponen dalam aplikasi Chat-Lite, berdasarkan kondisi kode saat ini.

---

### 1. Peta Alur Data Utama (Data Flow)

Berikut adalah pemetaan alur data untuk fitur-fitur inti:

**🔑 Autentikasi (Login)**
*   **Jenis:** API (Request-Response)
*   **Alur:**
    1.  `[User Action]` Pengguna mengisi form di `AuthForm.tsx` & submit.
    2.  `[Frontend Logic]` Komponen memanggil fungsi `login` dari `useAuthStore` (Zustand).
    3.  `[API Event]` Store melakukan panggilan ke `api('/api/auth/login', { method: 'POST', ... })`.
    4.  `[Backend Logic]` Endpoint di `routes/auth.ts` menerima request, memverifikasi kredensial dengan `bcrypt`, dan membuat JWT (access & refresh token).
    5.  `[Database]` `RefreshToken` disimpan di database.
    6.  `[Client Update]` Klien menerima `token` dan data pengguna, menyimpannya di `useAuthStore`, dan `refreshToken` disimpan dalam *HttpOnly cookie*. Pengguna diarahkan ke halaman chat.

**📨 Pengiriman Pesan**
*   **Jenis:** WebSocket (Real-time) dengan *Optimistic Update*
*   **Alur:**
    1.  `[User Action]` Pengguna mengetik di `MessageInput` (`ChatWindow.tsx`) dan mengirim.
    2.  `[Component Logic]` `ChatWindow` memanggil `sendMessage` dari hook `useConversation`.
    3.  `[State Update]` Hook memanggil `sendMessage` dari `useChatStore`, yang membuat pesan *optimis* (sementara) dan langsung menambahkannya ke state `messages`, memicu re-render UI.
    4.  `[Socket Event]` Store mengirim `socket.emit('message:send', data, ackCallback)`.
    5.  `[Backend Logic]` Server (`socket.ts`) menerima event, membersihkan input (`xss`), menyimpan pesan ke DB (Prisma), dan memanggil `ackCallback({ ok: true, msg: ... })`.
    6.  `[Socket Broadcast]` Server mengirim `io.to(conversationId).emit('message:new', newMessage)` ke semua anggota percakapan.
    7.  `[Client Update]`
        *   Store pengirim menerima `ackCallback` dan mengganti pesan optimis dengan data pesan asli dari server.
        *   Store klien lain menerima `message:new` dan menambahkan pesan tersebut ke state `messages`.

**🟢 Status Online/Offline (Presence)**
*   **Jenis:** WebSocket (Real-time, Efisien)
*   **Alur:**
    1.  `[User Action]` Pengguna membuka aplikasi, `getSocket()` dipanggil.
    2.  `[Socket Event]` Klien berhasil terhubung ke server (`on('connect')`).
    3.  `[Backend Logic]` Server (`socket.ts`) di `io.on('connection')` menambahkan `userId` ke `onlineUsers` (sebuah `Set`).
    4.  `[Socket Broadcast]`
        *   Server mengirim `socket.emit('presence:init', ...)` **hanya** ke klien yang baru terhubung.
        *   Server mengirim `socket.broadcast.emit('presence:user_joined', userId)` ke semua klien **lain**.
    5.  `[Client Update]` `useChatStore` melalui `initSocketListeners` memperbarui array `presence` di state, yang kemudian digunakan oleh komponen seperti `ChatHeader`.

**✍️ Indikator Pengetikan**
*   **Jenis:** WebSocket (Real-time, Sementara)
*   **Alur:**
    1.  `[User Action]` Pengguna mengetik di `MessageInput`.
    2.  `[Component Logic]` `ChatWindow` memanggil `handleTyping`, yang mengirim `socket.emit('typing:start', ...)` dan mengatur `setTimeout` untuk mengirim `typing:stop` setelah 1.5 detik.
    3.  `[Backend Logic]` Server menerima `typing:start` dan langsung meneruskannya ke anggota percakapan lain dengan `socket.to(id).emit('typing:update', ...)`.
    4.  `[Client Update]` `useChatStore` menerima `typing:update` dan memperbarui state `typing`, yang menyebabkan UI di `ChatWindow` menampilkan indikator.

---

### 2. Peta Event Socket.IO

**Client → Server:**
*   `conversation:join` (conversationId: string): Bergabung ke *room* percakapan untuk menerima pesan.
*   `message:send` (data, cb): Mengirim pesan baru. Menggunakan *callback* untuk konfirmasi.
*   `typing:start` ({ conversationId }): Memberi tahu server bahwa pengguna mulai mengetik.
*   `typing:stop` ({ conversationId }): Memberi tahu server bahwa pengguna berhenti mengetik.
*   `push:subscribe` (data): Mengirim detail *push subscription* untuk disimpan.
*   `message:mark_as_read` ({ messageId, conversationId }): Menandai pesan sebagai telah dibaca.

**Server → Client:**
*   `presence:init` (onlineUserIds: string[]): Mengirim daftar lengkap pengguna online **hanya** saat koneksi awal.
*   `presence:user_joined` (userId: string): Notifikasi bahwa seorang pengguna baru saja online.
*   `presence:user_left` (userId: string): Notifikasi bahwa seorang pengguna telah offline.
*   `typing:update` ({ userId, isTyping }): Broadcast status mengetik ke anggota percakapan.
*   `message:new` (message: Message): Broadcast pesan baru ke anggota percakapan.
*   `conversation:new` (conversation: Conversation): Notifikasi saat percakapan baru dibuat (misalnya pengguna ditambahkan ke grup).
*   `conversation:deleted` ({ id }): Notifikasi bahwa sebuah percakapan telah dihapus.
*   `message:deleted` ({ messageId, conversationId }): Notifikasi bahwa sebuah pesan telah dihapus.
*   `reaction:new` / `reaction:remove`: Notifikasi untuk menambah/menghapus reaksi.
*   `message:status_updated`: Notifikasi bahwa status pesan (mis. 'READ') telah diperbarui.

---

### 3. Hubungan Antar Komponen (Frontend)

Struktur komponen utama dan aliran datanya adalah sebagai berikut:

```
<App>
 └── <BrowserRouter>
      └── <Routes>
           └── <ProtectedRoute> → <Chat> (Halaman Utama)
                ├── <ChatList> (Sidebar)
                │    └── (Menampilkan daftar dari `store.conversations`)
                └── <ChatWindow> (jika `store.activeId` ada)
                     │ // Menggunakan hook `useConversation(activeId)`
                     ├── <ChatHeader />
                     ├── <Virtuoso (MessageList)>
                     │    └── <MessageItem /> (Merender `message` dari `useConversation`)
                     └── <MessageInput />
```

-   **`App.tsx`**: Titik masuk utama, menginisialisasi `socketListeners` sekali.
-   **`Chat.tsx`**: Halaman utama yang mengatur tata letak `ChatList` dan `ChatWindow`.
-   **`useChatStore` (Zustand)**: Bertindak sebagai *single source of truth*. Semua komponen yang membutuhkan data global (daftar percakapan, status online) atau perlu memanggil aksi global (mengirim pesan) berinteraksi dengan store ini.
-   **`ChatWindow.tsx`**: Komponen ini menjadi lebih sederhana (*presentational*). Ia tidak lagi mengelola logikanya sendiri, melainkan mendelegasikannya ke hook `useConversation`.
-   **`useConversation.ts`**: Hook ini adalah inovasi penting. Ia mengambil `conversationId`, lalu menyaring dan menyediakan semua data (`messages`, `conversation`) dan fungsi (`sendMessage`, `uploadFile`) yang relevan dari `useChatStore`. Ini adalah contoh bagus dari *separation of concerns*.

---

### 4. Integrasi API & Backend Logic

Setiap file di `server/src/routes/` memiliki tanggung jawab yang jelas dan dilindungi oleh middleware `authenticateToken`.

-   `/api/auth`: Menangani registrasi, login, logout, dan refresh token.
-   `/api/users`: Mencari pengguna dan mendapatkan profil pengguna saat ini (`/me`).
-   `/api/conversations`: Mengelola percakapan (CRUD), termasuk membuat grup dan mengambil daftar percakapan pengguna.
-   `/api/messages`: Mengambil riwayat pesan untuk sebuah percakapan (dengan paginasi) dan mengelola reaksi.
-   `/api/uploads`: Menangani upload file melalui `multer`.
-   `/api/keys`: Mengelola penyimpanan dan pengambilan kunci publik untuk E2EE.

---

### 5. Pemetaan Group dan User System

Berdasarkan `schema.prisma`, hubungan antara pengguna dan percakapan adalah **Many-to-Many** yang diimplementasikan melalui tabel perantara `Participant`.

-   `User` bisa menjadi bagian dari banyak `Conversation`.
-   `Conversation` bisa memiliki banyak `User`.
-   Tabel `Participant` menghubungkan `userId` dengan `conversationId`.

Ini adalah desain skema yang fleksibel dan standar untuk aplikasi chat, memungkinkan baik chat pribadi (2 partisipan) maupun chat grup (N partisipan) tanpa mengubah struktur dasar.

---

### 6. Temuan & Insight

-   **Fitur Sinkron (✅):** Semua fitur real-time inti (pesan, presence, typing) berfungsi dengan baik dan sinkron berkat arsitektur berbasis Socket.IO yang solid.
-   **Kualitas Kode (✅):** Kode sangat terstruktur. Sentralisasi logika socket di `useChatStore` dan ekstraksi logika komponen ke `useConversation` adalah praktik terbaik yang membuat kode bersih dan mudah dipelihara.
-   **Stabilitas & Efisiensi (✅):** Sistem *presence* telah dioptimalkan untuk tidak membanjiri jaringan. Penanganan *optimistic updates* dengan *callbacks* memastikan UI tetap responsif bahkan jika ada latensi jaringan.
-   **Keamanan (✅):** Proyek ini menerapkan beberapa lapisan keamanan (JWT, CSRF, XSS-sanitization, HttpOnly cookies) yang menunjukkan pemahaman yang baik tentang praktik keamanan web modern.
-   **Area Kompleks (⚠️):** Satu-satunya area yang memerlukan perhatian ekstra adalah implementasi E2EE. Alur kerja kriptografi, terutama pertukaran kunci yang aman, secara inheren rumit dan harus diuji secara menyeluruh untuk memastikan tidak ada celah keamanan.

Secara keseluruhan, analisis alur data menunjukkan bahwa aplikasi ini dirancang dengan baik, efisien, dan stabil. Proyek ini siap untuk pengembangan fitur lebih lanjut.
