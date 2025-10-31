## Peta Alur Data & Analisis Lanjutan Proyek Chat-Lite

Dokumen ini adalah analisis lanjutan yang memetakan alur data, event socket, dan interaksi komponen secara mendetail untuk memberikan pemahaman menyeluruh tentang cara kerja aplikasi Chat-Lite.

---

### 1. Peta Alur Data (Data Flow)

Berikut adalah pemetaan alur data untuk setiap fitur utama dari aksi pengguna hingga pembaruan UI.

**➡️ Autentikasi (Login)**
`[User Action: Isi & Submit Form]` → `[Component: <AuthForm>]` → `[State: useAuthStore.login(email, pass)]` → `[API: POST /api/auth/login]` → `[Backend: auth.ts]` → `[DB: Validasi user & passwordHash]` → `[Backend: Buat JWT & set cookie]` → `[API Response: User data]` → `[State: set({ user })]` → `[Client: Redirect ke /chat]`

**📨 Pengiriman & Penerimaan Pesan**
`[User Action: Ketik & Kirim]` → `[Component: <ChatWindow>]` → `[State: useMessageStore.sendMessage(msg)]` → `[Optimistic UI: addOptimisticMessage(tempMsg)]` → `[Socket: emit('message:send', payload)]` → `[Backend: on('message:send')]` → `[DB: prisma.message.create()]` → `[Socket: broadcast('message:new', data)]` → `[Client: on('message:new')]` → `[State: replaceOptimisticMessage(tempId, realMsg)]` → `[UI: <ChatWindow> re-render]`

**📎 Pengiriman File (Attachment)**
`[User Action: Pilih File]` → `[Component: <ChatWindow>]` → `[State: useMessageStore.uploadFile(file)]` → `[API: POST /api/uploads/:convId/upload]` → `[Backend: uploads.ts (multer)]` → `[File System: Simpan file]` → `[API Response: File URL & metadata]` → `[State: useMessageStore.sendMessage({ fileUrl, ... })]` → *(Alur berlanjut seperti pengiriman pesan biasa)*

**👨‍👩‍👧‍👦 Pembuatan Grup Baru (✅ Real-time)**
`[User Action: Buka modal & pilih user]` → `[Component: <CreateGroupChat>]` → `[API: POST /api/conversations]` → `[Backend: conversations.ts]` → `[DB: prisma.conversation.create() & prisma.participant.createMany()]` → `[API Response: Data grup baru ke **pembuat**]` → `[State (Pembuat): Menambahkan grup baru ke list]` → `[UI (Pembuat): <ChatList> re-render]`
**DAN**
`[Backend: conversations.ts]` → `[Socket: emit('conversation:new', data) ke setiap anggota baru]` → `[Client (Anggota): on('conversation:new')]` → `[State (Anggota): Menambahkan grup baru ke list]` → `[UI (Anggota): <ChatList> re-render]`
*Catatan: Fitur ini sudah real-time. Anggota baru menerima pembaruan melalui socket.* 

**👍 Reaksi pada Pesan**
`[User Action: Klik emoji di pesan]` → `[Component: <MessageBubble>]` → `[Socket: emit('message:react', {msgId, emoji})]` → `[Backend: on('message:react')]` → `[DB: prisma.messageReaction.create()]` → `[Socket: broadcast('reaction:new', data)]` → `[Client: on('reaction:new')]` → `[State: useMessageStore.addReaction()]` → `[UI: <MessageBubble> re-render]`

**🗑️ Hapus Pesan (Grup oleh Admin)**
`[User Action: Klik hapus grup]` → `[Component: <ChatList>]` → `[API: DELETE /api/conversations/:id]` → `[Backend: conversations.ts]` → `[DB: prisma.conversation.deleteMany({ where: { creatorId: userId } })]` → `[Socket: broadcast('conversation:deleted', { id }) ke semua anggota]` → `[Client: on('conversation:deleted')]` → `[State: useConversationStore.removeConversation()]` → `[UI: <ChatList> re-render]`

**✍️ Indikator Pengetikan (Typing Indicator)**
`[User Action: Mulai mengetik]` → `[Component: <ChatWindow>]` → `[Socket: emit('typing:start', { convId })]` → `[Backend: on('typing:start')]` → `[Socket: broadcast('typing:update', { isTyping: true })]` → `[Client: on('typing:update')]` → `[State: usePresenceStore.setTyping()]` → `[UI: <ChatWindow> tampilkan indikator]`
*(Proses serupa terjadi untuk `typing:stop`)*

**🟢 Status Online/Offline**
`[User Action: Buka/Tutup Aplikasi]` → `[Client: Socket 'connect'/'disconnect']` → `[Backend: on('connection')]` → `[Backend: onlineUsers.add(userId)]` → `[Socket: broadcast('presence:user_joined', userId)]` → `[Client: on('presence:user_joined')]` → `[State: usePresenceStore.addOnlineUser()]` → `[UI: <ChatList> & <ChatHeader> update dot status]`
*(Proses serupa terjadi untuk `disconnect` dengan event `presence:user_left`)*

---

### 2. Peta Event Socket.IO

**Client → Server:**
- `conversation:join` (payload: `conversationId`): Meminta server untuk memasukkan socket client ke dalam room percakapan tertentu.
- `message:send` (payload: `data`, `cb`): Mengirim pesan baru. Menggunakan callback untuk konfirmasi pengiriman (acknowledgement).
- `typing:start` / `typing:stop` (payload: `{ conversationId }`): Memberi tahu server bahwa pengguna mulai atau berhenti mengetik.
- `push:subscribe` (payload: `data`): Mendaftarkan endpoint push notification pengguna.
- `message:mark_as_read` (payload: `{ messageId, conversationId }`): Memberi tahu server bahwa pengguna telah membaca pesan tertentu.

**Server → Client:**
- `presence:init` (payload: `string[]`): Mengirim daftar lengkap ID pengguna yang sedang online, hanya kepada klien yang baru terhubung.
- `presence:user_joined` / `presence:user_left` (payload: `userId`): Memberi tahu semua klien bahwa seorang pengguna telah terhubung atau terputus.
- `typing:update` (payload: `{ userId, conversationId, isTyping }`): Meneruskan status pengetikan ke anggota percakapan lain.
- `message:new` (payload: `Message`): Meneruskan pesan baru yang telah disimpan ke semua anggota percakapan.
- `conversation:new` (payload: `Conversation`): Memberi tahu pengguna yang baru ditambahkan ke grup.
- `conversation:deleted` (payload: `{ id }`): Memberi tahu klien tentang percakapan yang dihapus.
- `message:deleted` (payload: `{ messageId, conversationId }`): Memberi tahu klien bahwa sebuah pesan telah dihapus.
- `reaction:new` / `reaction:remove` (payload: `data`): Memberi tahu klien tentang reaksi yang ditambahkan atau dihapus.
- `message:status_updated` (payload: `data`): Memberi tahu pengirim asli bahwa status pesannya telah diperbarui (misalnya, menjadi 'READ').

---

### 3. Hubungan Antar Komponen (Frontend)

Struktur komponen utama pada halaman chat adalah sebagai berikut:

```
<Chat> (Page)
 ├── <ChatList> (Sidebar)
 │    ├── (Header dengan User Profile & Settings)
 │    ├── (Search Bar)
 │    └── (List of Conversations -> <ChatItem>)
 └── <ChatWindow> (Main Content)
      ├── <ChatHeader>
      ├── <MessageList> (Virtual List untuk Pesan)
      │    └── <MessageBubble> (Setiap pesan)
      │         └── <Reactions>
      ├── <TypingIndicator>
      └── <MessageInput>
```

- **State Global (Zustand)**: Logika event socket terpusat dan memanggil aksi dari berbagai store (`useMessageStore`, `useConversationStore`, `usePresenceStore`). Komponen-komponen di atas berlangganan ke store ini:
  - `<ChatList>` menggunakan `conversations` dan `onlineUsers`.
  - `<ChatWindow>` menggunakan `messages`, `typingUsers`, dan `activeConversation`.
  - `<MessageBubble>` menggunakan data pesan individual dari `messages`.
- **State Lokal**: Komponen seperti `<MessageInput>` (untuk teks input) dan `<ChatList>` (untuk query pencarian) memiliki state lokal sendiri untuk mengelola UI internal sebelum berinteraksi dengan state global.

---

### 4. Integrasi API & Backend Logic

- **`/api/auth/*`**: Mengelola semua logika otentikasi (register, login, logout). Tidak memerlukan middleware auth.
- **`/api/conversations`**: 
  - `GET /`: Mengambil semua percakapan pengguna. Middleware: `requireAuth`.
  - `POST /`: Membuat percakapan baru. Middleware: `requireAuth`.
  - `DELETE /:id`: Menghapus/menyembunyikan percakapan. Middleware: `requireAuth`.
- **`/api/messages/:conversationId`**: 
  - `GET /`: Mengambil riwayat pesan untuk satu percakapan. Middleware: `requireAuth`.
- **`/api/uploads/:conversationId/upload`**: 
  - `POST /`: Mengunggah file. Middleware: `requireAuth` dan `multer`.

---

### 5. Pemetaan Group dan User System

Hubungan data dimodelkan dalam `schema.prisma`:

- **User ↔ Conversation**: Hubungan Many-to-Many melalui model perantara `Participant`.
- **Satu `User`** dapat menjadi bagian dari **banyak `Conversation`**.
- **Satu `Conversation`** dapat memiliki **banyak `User`** (peserta).
- Jika `Conversation.isGroup = true`, ia memiliki `creatorId` yang menunjuk ke `User` yang membuatnya, memberikan hak admin (seperti menghapus grup).

**Alur data pembuatan grup (yang sebenarnya terjadi):**
1.  Client (pembuat) mengirim request `POST /api/conversations`.
2.  Server membuat entri `Conversation` dan beberapa entri `Participant` di database.
3.  Server mengembalikan data grup baru dalam respons API kepada si pembuat.
4.  Server juga menyiarkan event socket `conversation:new` ke semua ID pengguna lain yang ditambahkan ke grup, membuat mereka secara otomatis melihat grup baru tersebut.

---

### 6. Temuan & Insight

- **✅ Fitur Sinkron Penuh**: Sebagian besar fitur interaktif (pengiriman pesan, reaksi, status online, typing, hapus pesan, **dan pembuatan grup**) sudah sepenuhnya sinkron dan real-time berkat arsitektur hybrid yang solid.
- **⚠️ Potensi Masalah**: 
  - **Manajemen Event Listener**: Walaupun tidak ditemukan di `Chat.tsx`, sangat penting untuk memastikan bahwa listener socket (`socket.on`) yang didaftarkan di dalam store atau hooks memiliki mekanisme *cleanup* untuk menghindari duplikasi saat terjadi re-koneksi atau perubahan state yang memicu pendaftaran ulang.
- **❌ Kerawanan**: Tidak ada kerawanan keamanan atau *race condition* yang jelas terdeteksi pada alur utama. Penggunaan *optimistic UI* di client dan *single source of truth* dari server setelah broadcast adalah pola yang baik.

**Saran Singkat Stabilisasi:**
1.  **Audit Event Listener Cleanup**: Lakukan audit di seluruh basis kode frontend (terutama di dalam store Zustand) untuk memastikan setiap `socket.on()` memiliki `socket.off()` yang sesuai dalam fungsi cleanup (`useEffect` atau mekanisme sejenis) untuk menjamin stabilitas jangka panjang.
2.  **Optimasi Pengambilan Data Awal**: Pertimbangkan untuk mengirim batch data awal (misalnya, 10 percakapan teratas beserta pesan terakhirnya) langsung setelah koneksi socket berhasil untuk mengurangi jumlah request HTTP di awal sesi.
3.  **Konsistensi Umpan Balik UI**: Tingkatkan dan standarisasi umpan balik UI untuk status `loading` dan `error` di seluruh aplikasi secara konsisten, terutama pada operasi asinkron seperti upload file atau memuat pesan lama.