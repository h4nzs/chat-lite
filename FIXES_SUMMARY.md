# Peta Alur Data & Analisis Logika Chat-Lite (Diperbarui)

Dokumen ini adalah analisis mendalam mengenai alur data, event socket, dan interaksi komponen dalam aplikasi Chat-Lite, yang telah diperbarui untuk mencerminkan kondisi proyek setelah serangkaian perbaikan.

---

### 1. Peta Alur Data Utama (Data Flow)

Alur data untuk fitur-fitur utama sebagian besar tetap sama, dengan pembaruan penting pada alur status online dan penanganan error.

**... (Alur Autentikasi, Pengiriman Pesan, dll. tetap sama) ...**

**🟢 Status Online/Offline (Telah Dioptimalkan)**
*   **Jenis:** WebSocket (Real-time, Efisien)
*   **Alur:**
    1.  `[User Action]` User membuka aplikasi.
    2.  `[Socket Event]` Klien terhubung ke server.
    3.  `[Backend Logic]` Server `io.on('connection')` aktif. `userId` ditambahkan ke `onlineUsers`.
    4.  `[Socket Broadcast]`
        *   Server mengirim `socket.emit('presence:init', Array.from(onlineUsers))` **hanya ke klien yang baru terhubung**.
        *   Server mengirim `socket.broadcast.emit('presence:user_joined', userId)` ke **semua klien lain**.
    5.  `[Client Update]`
        *   Klien yang baru terhubung menginisialisasi daftar `presence`.
        *   Klien lain hanya menambahkan satu `userId` baru ke daftar `presence` mereka.
    6.  Saat `disconnect`, server mengirim `io.emit('presence:user_left', userId)` ke semua klien yang tersisa, yang kemudian menghapus `userId` tersebut dari daftar mereka.

**⚠️ Penanganan Error (Baru)**
*   **Jenis:** State Management & UI
*   **Alur (Gagal Kirim Pesan):**
    1.  `[Socket Event]` `socket.emit('message:send', ..., ack)` menerima `ack` dengan `{ ok: false }`.
    2.  `[State Update]` `useChatStore` memperbarui pesan sementara di state, menyetel `error: true`.
    3.  `[UI Update]` `MessageItem.tsx` mendeteksi `message.error` dan menampilkan ikon error.
*   **Alur (Gagal Memuat Data):**
    1.  `[API Event]` Panggilan `api(...)` di `loadConversations` atau `loadMessagesForConversation` gagal (throw error).
    2.  `[State Update]` `useChatStore` menangkap error dan menyetel state `error` dengan pesan yang sesuai.
    3.  `[UI Update]` `ChatList.tsx` atau `ChatWindow.tsx` mendeteksi state `error` dan menampilkan pesan error kepada pengguna.

---

### 2. Peta Event Socket.IO (Diperbarui)

**Client → Server:**
*   `conversation:join` (conversationId: string): (Tidak berubah)
*   `message:send` (data: object, cb: function): (Tidak berubah, namun callback sekarang menangani status `error`)
*   `typing:start` ({ conversationId }): (Tidak berubah)
*   `typing:stop` ({ conversationId }): (Tidak berubah)
*   `push:subscribe` (data: object): (Tidak berubah)

**Server → Client:**
*   `presence:init` (onlineUserIds: string[]): **(BARU)** Mengirim daftar lengkap pengguna online hanya ke klien yang baru terhubung.
*   `presence:user_joined` (userId: string): **(BARU)** Memberi tahu klien lain bahwa seorang pengguna telah bergabung.
*   `presence:user_left` (userId: string): **(BARU)** Memberi tahu semua klien bahwa seorang pengguna telah terputus.
*   `presence:update`: **(DIHAPUS)** Event ini tidak lagi digunakan.
*   `typing:update`: (Tidak berubah)
*   `message:new`: (Tidak berubah)
*   `conversation:new`: (Tidak berubah)
*   `conversation:deleted`: (Tidak berubah, namun logika klien sekarang membuka sidebar).
*   `message:deleted`: (Tidak berubah)
*   `reaction:new`: (Tidak berubah)
*   `reaction:remove`: (Tidak berubah)

---

### 3. Hubungan Antar Komponen (Setelah Refactor)

Struktur komponen utama tetap sama, namun aliran data internal telah disederhanakan.

```
<App>
 └── <BrowserRouter>
      └── <Routes>
           └── <ProtectedRoute> → <Chat>
                ├── <ChatList> ... </ChatList>
                └── <ChatWindow>  // <-- SEKARANG MENGGUNAKAN useConversation()
                     ├── <ChatHeader />
                     ├── <Virtuoso (MessageList)> ... </Virtuoso>
                     └── <MessageInput />
```

**Penjelasan Perubahan:**
*   **`ChatWindow.tsx`** sekarang jauh lebih sederhana. Ia tidak lagi berisi `useEffect` untuk memuat data atau fungsi untuk mengirim pesan secara langsung. Semua logika tersebut telah dipindahkan ke hook **`useConversation.ts`**.
*   Komponen ini sekarang hanya menerima `id` percakapan, memanggil `useConversation(id)`, dan menggunakan data serta fungsi yang dikembalikan (seperti `messages`, `sendMessage`, `isLoading`, `error`) untuk me-render UI.

---

### 4. Integrasi API & Backend Logic

Perubahan penting pada backend:

*   `GET /api/conversations`:
    *   **Perbaikan:** Query Prisma sekarang secara eksplisit menyertakan `creatorId` dalam data yang dikembalikan untuk memastikan logika "Delete Group" di frontend berfungsi secara konsisten.

---

### 5. Temuan & Insight (Status Terbaru)

*   **Fitur Sinkron (✅):** Semua fitur utama berfungsi dan sinkron.

*   **Fitur yang Diperbaiki (✅):**
    *   **Efisiensi Presence System:** Masalah boros bandwidth telah **diselesaikan** dengan mengganti event `presence:update`.
    *   **Error Handling di UI:** Penanganan error untuk pesan yang gagal terkirim dan kegagalan memuat data telah **diimplementasikan**.
    *   **Inkonsistensi Tombol Hapus:** Bug pada tombol hapus grup telah **diperbaiki**.

*   **Kualitas Kode (✅):**
    *   **Refactor ke Custom Hooks:** Logika `ChatWindow` telah berhasil dipisahkan ke dalam hook `useConversation`, meningkatkan keterbacaan dan pemeliharaan.

*   **Saran Singkat (Status Terbaru):**
    *   Semua saran utama dari analisis sebelumnya (Optimasi Socket, Stabilisasi UI, Refactor) telah **ditindaklanjuti dan diselesaikan**.
    *   Proyek sekarang berada dalam kondisi yang stabil dan kokoh. Langkah selanjutnya dapat berfokus pada penambahan fitur baru atau audit keamanan yang lebih mendalam jika diperlukan.