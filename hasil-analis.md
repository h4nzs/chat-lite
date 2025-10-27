# Analisis Proyek Chat-Lite

Dokumen ini berisi hasil analisis menyeluruh terhadap aplikasi web "Chat-Lite" sesuai dengan panduan yang diberikan.

---

### 1. Struktur dan Arsitektur

Proyek ini adalah monorepo dengan dua bagian utama: `server/` (backend) dan `web/` (frontend).

**Backend (`server/`):**
- **Framework:** Node.js dengan Express.js.
- **Database & ORM:** PostgreSQL (berdasarkan sintaks `prisma`) dengan Prisma ORM.
- **Komunikasi Real-time:** Socket.IO.
- **Dependensi Utama:**
  - `express`: Web server.
  - `socket.io`: Komunikasi WebSocket.
  - `@prisma/client`: ORM untuk interaksi database.
  - `jsonwebtoken` & `bcrypt`: Autentikasi (JWT).
  - `multer`: Penanganan file upload.
  - `libsodium-wrappers`: Kriptografi untuk E2E Encryption.
  - `helmet`, `cors`, `express-rate-limit`, `csurf`: Keamanan.
- **Struktur Direktori Penting:**
  - `src/routes/`: Mendefinisikan semua endpoint REST API (auth, users, messages, dll).
  - `src/middleware/auth.ts`: Middleware untuk otentikasi REST API dan Socket.IO.
  - `src/socket.ts`: Logika utama untuk semua event handler Socket.IO.
  - `prisma/schema.prisma`: Skema database.

**Frontend (`web/`):**
- **Framework & Bundler:** React 19 dengan Vite.
- **Bahasa:** TypeScript.
- **Styling:** TailwindCSS.
- **State Management:** Zustand.
- **Routing:** React Router.
- **Dependensi Utama:**
  - `react` & `react-dom`: Library UI.
  - `vite`: Build tool.
  - `tailwindcss`: CSS framework.
  - `zustand`: State management global.
  - `react-router-dom`: Routing sisi klien.
  - `socket.io-client`: Klien WebSocket.
  - `libsodium-wrappers`: Kriptografi untuk E2E Encryption.
- **Struktur Direktori Penting:**
  - `src/pages/`: Komponen level atas untuk setiap halaman (Chat, Login, Settings).
  - `src/components/`: Komponen UI yang dapat digunakan kembali (ChatList, ChatWindow, MessageBubble).
  - `src/store/`: Zustand stores (`auth.ts`, `chat.ts`) yang berisi state dan logika bisnis utama.
  - `src/lib/`: Modul untuk komunikasi (api.ts, socket.ts) dan inisialisasi library.
  - `src/hooks/`: Custom hooks untuk enkapsulasi logika (misal: `useConversation`).
  - `src/utils/`: Fungsi utilitas, termasuk logika kriptografi.

**Arsitektur Komunikasi:**
- **Hybrid:** Menggunakan REST API untuk operasi CRUD (data awal, profil, riwayat pesan) dan WebSocket (Socket.IO) untuk semua pembaruan real-time (pesan baru, status online, notifikasi mengetik).

---

### 2. Fungsi Utama Aplikasi

| Fitur | Status | Keterangan |
| :--- | :--- | :--- |
| **Autentikasi** | ✅ Berfungsi | Register, Login, Logout, dan Refresh Token via HTTP-only cookies (JWT). |
| **Real-time Chat (Private)** | ✅ Berfungsi | Pengiriman dan penerimaan pesan via Socket.IO. |
| **Real-time Chat (Grup)** | ✅ Berfungsi | Fungsionalitas grup didukung di backend (create, join). |
| **Enkripsi End-to-End** | ✅ Berfungsi | Pesan dienkripsi di klien sebelum dikirim dan didekripsi saat diterima menggunakan `libsodium`. |
| **Typing Indicator** | ✅ Berfungsi | Event `typing:start` dan `typing:stop` diimplementasikan. |
| **Online Status (Presence)** | ✅ Berfungsi | Server melacak user online dan menyiarkan status `user_joined` / `user_left`. |
| **Reaksi Pesan** | ✅ Berfungsi | Menambah dan menghapus reaksi pada pesan. |
| **Hapus Pesan** | ✅ Berfungsi | Pengirim dapat menghapus pesannya. |
| **Manajemen Grup** | ✅ Berfungsi | Backend mendukung pembuatan dan penghapusan grup oleh `creator`. |
| **File Attachment** | ✅ Berfungsi | Upload file via REST API, kemudian URL file dikirim sebagai pesan via socket. |
| **Pencarian Pesan** | ✅ Berfungsi | Endpoint `GET /api/messages/search` tersedia. |
| **Notifikasi Push** | ✅ Berfungsi | Backend memiliki logika untuk `web-push`. |
| **Read Receipts** | ✅ Berfungsi | Event `message:mark_as_read` dan `message:status_updated` diimplementasikan. |

---

### 3. Alur Kerja (Workflow)

1.  **User Input (UI):** Pengguna mengetik pesan di komponen `ChatWindow`.
2.  **State & Logic (Frontend):**
    - Komponen memanggil `useChatStore.sendMessage()`.
    - Pesan dienkripsi menggunakan `encryptMessage()`.
    - Pesan baru ditambahkan ke state lokal secara "optimistic" agar langsung tampil di UI.
3.  **Kirim ke Backend (Socket):**
    - Event socket `message:send` dikirim ke server dengan payload yang sudah terenkripsi.
4.  **Proses di Backend:**
    - Handler `message:send` di `server/src/socket.ts` menerima pesan.
    - Pesan disimpan ke database melalui Prisma.
    - Server menyiarkan pesan terenkripsi ke semua partisipan dalam percakapan melalui event `message:new`.
5.  **Terima & Re-render (Frontend):**
    - Klien lain (dan pengirim asli) menerima event `message:new`.
    - Handler di `useChatStore` menangkap event ini.
    - Pesan didekripsi menggunakan `decryptMessage()`.
    - State Zustand diperbarui dengan pesan baru yang sudah didekripsi.
    - Komponen React yang berlangganan state tersebut akan otomatis melakukan re-render untuk menampilkan pesan baru.

**Event Socket.IO Utama:**
- **Koneksi & Kehadiran:** `connect`, `disconnect`, `presence:init`, `presence:user_joined`, `presence:user_left`.
- **Percakapan:** `conversation:join`, `conversation:new`, `conversation:deleted`.
- **Pesan:** `message:send` (kirim), `message:new` (terima), `message:deleted`, `message:mark_as_read`, `message:status_updated`.
- **Interaksi:** `typing:start`, `typing:stop`, `reaction:new`, `reaction:remove`.
- **Lainnya:** `push:subscribe`, `user:updated`.

---

### 4. Kondisi UI & UX

- **Styling:** Menggunakan TailwindCSS secara ekstensif. Terdapat file `tailwind.config.ts` namun tidak ada kustomisasi tema yang signifikan. Mode gelap diaktifkan secara default pada `App.tsx`.
- **Komponen:** Proyek memiliki daftar komponen yang terstruktur dengan baik di `web/src/components`, seperti `ChatList`, `ChatWindow`, `MessageBubble`, `CreateGroupChat`, dll.
- **Responsivitas:** Terdapat penggunaan kelas responsif (`md:`, `lg:`) dan logika untuk menampilkan/menyembunyikan sidebar di perangkat mobile, menunjukkan bahwa desain responsif telah dipertimbangkan.
- **Interaktivitas:** Terdapat elemen interaktif seperti menu, tombol reaksi, dan indikator status online/mengetik.

---

### 5. State Management

- **Zustand:** Digunakan sebagai state management global.
- **Stores:**
    - `useAuthStore`: Mengelola state autentikasi, data user, dan tema. Bertanggung jawab untuk proses login, logout, dan bootstraping sesi.
    - `useChatStore`: "Otak" dari aplikasi. Mengelola state percakapan, pesan, status online, notifikasi mengetik, dan semua logika yang terkait dengan interaksi chat. Store ini juga menginisialisasi dan mengelola semua listener Socket.IO.
- **Update State:** State diperbarui sebagai respons terhadap aksi pengguna (misalnya, `sendMessage`) dan event socket yang masuk dari server (`message:new`). Pemisahan menjadi dua store membantu mengurangi re-render yang tidak perlu.

---

### 6. Keamanan & Koneksi

- **Autentikasi:**
    - **REST API:** Dilindungi oleh middleware `requireAuth` yang memvalidasi JWT dari cookie `at`.
    - **Socket.IO:** Koneksi diamankan oleh `socketAuthMiddleware` yang juga memvalidasi JWT dari cookie saat proses handshake.
- **Proteksi:**
    - **CSRF:** `csurf` digunakan di backend untuk melindungi endpoint yang mengubah data. Token CSRF diambil oleh frontend dan dikirim melalui header `CSRF-Token`.
    - **Keamanan Header:** `helmet` digunakan untuk mengatur header HTTP yang aman.
    - **Rate Limiting:** Diterapkan untuk membatasi jumlah request.
- **Enkripsi:**
    - **Transport:** Komunikasi dilindungi oleh HTTPS/WSS di lingkungan produksi.
    - **End-to-End:** Pesan dienkripsi dari ujung ke ujung, memastikan server tidak dapat membaca konten pesan.

---

### 7. Masalah Potensial & Area Risiko

- **Duplikasi Event Listener:** Kode di `useChatStore.initSocketListeners` sudah menerapkan praktik yang baik dengan memanggil `socket.off()` sebelum mendaftarkan listener baru. Ini secara efektif mencegah duplikasi listener yang umum terjadi pada aplikasi React.
- **Konsistensi Data:** Alur kerja dengan "optimistic updates" dan satu sumber kebenaran dari server (via socket events) adalah pendekatan yang solid. Namun, jika terjadi kegagalan pengiriman, pesan akan ditandai sebagai error di UI, yang merupakan penanganan yang baik.
- **Kompleksitas State:** `useChatStore` sangat besar dan menangani banyak logika. Meskipun ini menyatukan logika terkait, ini bisa menjadi area yang sulit untuk dipelihara atau di-debug di masa depan. Memecahnya lebih lanjut berdasarkan fungsionalitas (misalnya, `usePresenceStore`, `useMessageStore`) bisa menjadi pertimbangan.
- **Manajemen Kunci Enkripsi:** Kunci privat yang dienkripsi disimpan di `localStorage`. Meskipun dienkripsi, ini kurang aman dibandingkan menyimpannya di `IndexedDB` atau mekanisme penyimpanan yang lebih aman. Proses setup kunci saat ini terikat pada login/register, yang bisa menjadi masalah jika proses tersebut gagal.

---

### 8. Output Analisis & Rekomendasi

- **Ringkasan:** Aplikasi ini adalah aplikasi chat yang fungsional dan dibangun dengan baik menggunakan tumpukan teknologi modern. Arsitekturnya solid, memisahkan logika backend dan frontend dengan jelas, dan menggunakan kombinasi REST dan WebSocket secara efektif. Implementasi fitur-fitur inti seperti E2E encryption, real-time presence, dan optimistic updates menunjukkan tingkat kematangan yang tinggi.
- **Dependensi Penting:** React, Zustand, Socket.IO, Express, Prisma, libsodium-wrappers.
- **Area Risiko Tinggi untuk Refactor:**
    - **`useChatStore`:** Ukuran dan kompleksitasnya menjadikannya kandidat utama untuk refaktorisasi. Memecahnya menjadi store yang lebih kecil dan lebih fokus akan meningkatkan keterbacaan dan pemeliharaan.
    - **Manajemen Kunci E2E:** Alur kerja untuk membuat dan memulihkan kunci dapat dibuat lebih kuat dan ramah pengguna, misalnya dengan memisahkannya dari alur login dan memberikan opsi pemulihan kunci.
- **Rekomendasi Singkat:**
    1.  **Stabilisasi:** Aplikasi dalam kondisi yang cukup stabil. Fokus utama harus pada peningkatan pengalaman pengguna dan pemeliharaan.
    2.  **Refactor Store:** Pertimbangkan untuk memecah `useChatStore` menjadi beberapa store yang lebih kecil (misalnya, `useConversationStore`, `useMessageStore`, `usePresenceStore`) untuk mengelola state yang lebih terisolasi.
    3.  **Tingkatkan UX Enkripsi:** Buat halaman atau modal khusus untuk manajemen kunci (membuat, mencadangkan, memulihkan) agar tidak terikat erat dengan proses login/register.
