## Peta Alur Data & Analisis Lanjutan Proyek Chat-Lite

Dokumen ini adalah analisis lanjutan yang memetakan alur data, event socket, dan interaksi komponen secara mendetail untuk memberikan pemahaman menyeluruh tentang cara kerja aplikasi Chat-Lite.

---

### 1. Peta Alur Data (Data Flow)

Berikut adalah pemetaan alur data untuk setiap fitur utama dari aksi pengguna hingga pembaruan UI.

**➡️ Autentikasi (Login)**
`[User Action: Isi & Submit Form]` → `[Component: <Login>]` → `[State: useAuthStore.login(email, pass)]` → `[API: POST /api/auth/login]` → `[Backend: auth.ts]` → `[DB: Validasi user & passwordHash]` → `[Backend: Buat JWT & set cookie]` → `[API Response: User data]` → `[State: set({ user })]` → `[Client: Redirect ke /]`

**📨 Pengiriman & Penerimaan Pesan**
`[User Action: Ketik & Kirim]` → `[Component: <MessageInput>]` → `[State: useChatStore.sendMessage(msg)]` → `(Client Side) [Encrypt Message]` → `[Socket: emit('message:send', payload)]` → `[Backend: on('message:send')]` → `[DB: prisma.message.create()]` → `[Socket: broadcast('message:new', data)]` → `[Client: on('message:new')]` → `(Client Side) [Decrypt Message]` → `[State: set(messages)]` → `[UI: <MessageList> re-render]`

**📎 Pengiriman File (Attachment)**
`[User Action: Pilih File]` → `[Component: <MessageInput>]` → `[State: useChatStore.uploadFile(file)]` → `[API: POST /api/uploads/:convId/upload]` → `[Backend: upload.ts (multer)]` → `[File System: Simpan file]` → `[API Response: File URL & metadata]` → `[State: useChatStore.sendMessage({ fileUrl, ... })]` → *(Alur berlanjut seperti pengiriman pesan biasa)*

**👨‍👩‍👧‍👦 Pembuatan Grup Baru**
`[User Action: Buka modal & pilih user]` → `[Component: <CreateGroupChat>]` → `[API: POST /api/conversations]` → `[Backend: conversations.ts]` → `[DB: prisma.conversation.create() & prisma.participant.createMany()]` → `[API Response: Data grup baru]` → `[Socket: broadcast('conversation:new', data)]` → `[Client: on('conversation:new')]` → `[State: set(conversations)]` → `[UI: <ChatList> re-render]`

**👍 Reaksi pada Pesan**
`[User Action: Klik emoji di pesan]` → `[Component: <MessageItem>]` → `[API: POST /api/messages/:msgId/reactions]` → `[Backend: messages.ts]` → `[DB: prisma.messageReaction.create()]` → `[Socket: broadcast('reaction:new', data)]` → `[Client: on('reaction:new')]` → `[State: set(messages)]` → `[UI: <MessageItem> re-render]`

**🗑️ Hapus Pesan**
`[User Action: Klik hapus di pesan]` → `[Component: <MessageItem>]` → `[API: DELETE /api/messages/:msgId]` → `[Backend: messages.ts]` → `[DB: prisma.message.delete()]` → `[Socket: broadcast('message:deleted', data)]` → `[Client: on('message:deleted')]` → `[State: set(messages)]` → `[UI: <MessageItem> re-render]`

**✍️ Indikator Pengetikan (Typing Indicator)**
`[User Action: Mulai mengetik]` → `[Component: <MessageInput>]` → `[Socket: emit('typing:start')]` → `[Backend: on('typing:start')]` → `[Socket: broadcast('typing:update', { isTyping: true })]` → `[Client: on('typing:update')]` → `[State: set(typing)]` → `[UI: <ChatWindow> tampilkan indikator]`
*(Proses serupa terjadi untuk `typing:stop` setelah jeda waktu tertentu)*

**🟢 Status Online/Offline**
`[User Action: Buka/Tutup Aplikasi]` → `[Client: Socket 'connect'/'disconnect']` → `[Backend: on('connection')]` → `[Backend: onlineUsers.add(userId)]` → `[Socket: broadcast('presence:user_joined', userId)]` → `[Client: on('presence:user_joined')]` → `[State: set(presence)]` → `[UI: <ChatList> & <ChatHeader> update dot status]`
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
- `conversation:new` / `conversation:deleted` (payload: `data`): Memberi tahu klien tentang percakapan yang baru dibuat atau dihapus.
- `message:deleted` (payload: `{ messageId, conversationId }`): Memberi tahu klien bahwa sebuah pesan telah dihapus.
- `reaction:new` / `reaction:remove` (payload: `data`): Memberi tahu klien tentang reaksi yang ditambahkan atau dihapus.
- `message:status_updated` (payload: `data`): Memberi tahu pengirim asli bahwa status pesannya telah diperbarui (misalnya, menjadi 'READ').

---

### 3. Hubungan Antar Komponen (Frontend)

Struktur komponen utama pada halaman chat adalah sebagai berikut:

```
<Chat> (Page)
 ├── <ChatList> (Sidebar)
 │    ├── <UserProfile>
 │    ├── <SearchBar>
 │    ├── <StartNewChat> (muncul saat mencari)
 │    └── <CreateGroupChat> (modal)
 └── <ChatWindow> (Main Content)
      ├── <ChatHeader>
      ├── <Virtuoso> (Virtual List untuk Pesan)
      │    └── <MessageItem> (Setiap pesan)
      │         └── <Reactions>
      └── <MessageInput>
```

- **State Global (`useChatStore`, `useAuthStore`)**: Hampir semua komponen di atas bergantung pada state global. 
  - `<ChatList>` menggunakan `conversations` dan `presence`.
  - `<ChatWindow>` menggunakan `messages`, `typing`, dan `activeId`.
  - `<MessageItem>` menggunakan data pesan dari `messages`.
- **State Lokal**: Komponen seperti `<MessageInput>` (untuk teks input) dan `<ChatList>` (untuk query pencarian) memiliki state lokal sendiri untuk mengelola input pengguna sebelum dikirim ke state global.
- **Props & Callbacks**: Komponen induk seperti `<Chat>` dan `<ChatList>` meneruskan fungsi callback (misalnya `onOpen`) ke komponen anak untuk menangani event klik.

---

### 4. Integrasi API & Backend Logic

- **`/api/auth/*`**: Mengelola semua logika otentikasi (register, login, logout, refresh). Tidak memerlukan middleware auth, tetapi `logout` dan `refresh` bekerja dengan cookie yang ada.
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
- Jika `Conversation.isGroup = false`, itu adalah chat 1-on-1.
- Jika `Conversation.isGroup = true`, itu adalah chat grup dan memiliki `creatorId` yang menunjuk ke `User` yang membuatnya.

Alur data grup:
1.  Client membuat grup melalui `POST /api/conversations`.
2.  Server membuat entri `Conversation` dan beberapa entri `Participant`.
3.  Server kemudian mem-broadcast event `conversation:new` ke semua user ID yang terlibat dalam grup tersebut.
4.  Client yang menerima event ini akan menambahkan percakapan baru ke state `conversations` mereka.

---

### 6. Temuan & Insight

- **✅ Fitur Sinkron Penuh**: Sebagian besar fitur inti (pengiriman pesan, reaksi, status online, typing) sudah sepenuhnya sinkron dan real-time berkat arsitektur hybrid yang solid.
- **⚠️ Potensi Peningkatan**: 
  - **Initial Load**: Saat membuka aplikasi, client melakukan beberapa request REST (untuk user, lalu percakapan, lalu pesan). Ini dapat dioptimalkan dengan menggabungkan beberapa data dalam satu panggilan awal atau menggunakan data yang dikirim saat koneksi socket awal.
  - **Error Handling di UI**: Meskipun ada state `error` di `useChatStore`, implementasinya di beberapa komponen bisa lebih konsisten untuk memberi tahu pengguna jika ada masalah (misalnya, gagal memuat riwayat pesan).
- **❌ Kerawanan (Minor)**:
  - **Race Condition**: Tidak ada race condition yang jelas terdeteksi pada alur utama. Penggunaan *optimistic UI* di client dan *single source of truth* dari server setelah broadcast adalah pola yang baik untuk menghindarinya.
  - **Duplikasi Listener**: Masalah ini sudah ditangani dengan baik di `useChatStore` dengan membersihkan listener lama sebelum mendaftarkan yang baru. Ini menunjukkan kesadaran akan potensi masalah tersebut.

**Saran Singkat Stabilisasi:**
1.  **Refactor `useChatStore`**: Seperti yang disebutkan sebelumnya, memecah `useChatStore` menjadi beberapa *slice* atau *custom hooks* (misalnya, `useMessages`, `usePresence`) akan sangat meningkatkan keterbacaan dan pemeliharaan.
2.  **Optimasi Pengambilan Data**: Pertimbangkan untuk mengirim batch data awal (misalnya, 10 percakapan teratas beserta pesan terakhirnya) langsung setelah koneksi socket berhasil untuk mengurangi jumlah request HTTP awal.
3.  **UI Feedback**: Tingkatkan umpan balik UI untuk status loading dan error di seluruh aplikasi secara konsisten.