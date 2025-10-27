# Analisis Proyek Aplikasi "Chat-Lite"

Dokumen ini berisi hasil analisis menyeluruh terhadap proyek Chat-Lite, sesuai dengan arahan yang diberikan. Tujuannya adalah untuk mendapatkan pemahaman penuh terhadap arsitektur, fungsionalitas, dan kondisi proyek saat ini.

---

### 1. **Struktur dan Arsitektur**

- **Struktur Proyek**: Monorepo dengan dua direktori utama: `server/` (backend) dan `web/` (frontend).
- **Backend (`server/`)**:
    - **Framework**: Node.js dengan Express.js.
    - **Komunikasi Real-time**: `socket.io`.
    - **Database & ORM**: PostgreSQL dengan Prisma.
    - **Autentikasi**: `jsonwebtoken` (JWT) untuk token, `bcrypt` untuk hashing password.
    - **Keamanan**: `helmet` untuk header keamanan, `express-rate-limit` untuk pembatasan permintaan, dan `csurf` untuk proteksi CSRF.
    - **File Upload**: `multer` untuk menangani unggahan file.
    - **Lainnya**: `web-push` untuk notifikasi push, `zod` untuk validasi, `morgan` untuk logging.
- **Frontend (`web/`)**:
    - **Framework**: React 19 dengan Vite sebagai build tool.
    - **State Management**: Zustand (`create` dari `zustand`).
    - **Routing**: `react-router-dom`.
    - **Styling**: TailwindCSS.
    - **Komunikasi**: `socket.io-client` untuk koneksi WebSocket dan `fetch` (via wrapper `api.ts`) untuk API REST.
    - **Enkripsi**: `libsodium-wrappers`, menandakan adanya implementasi E2EE (End-to-End Encryption).
    - **UI Komponen**: Radix UI (`DropdownMenu`, `Popover`) dan `react-icons`.
- **Arsitektur Komunikasi**:
    - **API REST**: Digunakan untuk operasi CRUD utama seperti autentikasi (`/api/auth`), manajemen pengguna (`/api/users`), percakapan (`/api/conversations`), dan pengambilan riwayat pesan (`/api/messages`).
    - **WebSocket (Socket.IO)**: Digunakan untuk semua komunikasi real-time, termasuk pengiriman dan penerimaan pesan baru, status kehadiran (`presence`), indikator pengetikan (`typing`), dan pembaruan lainnya.

---

### 2. **Fungsi Utama Aplikasi**

Berdasarkan analisis file, berikut adalah daftar fitur utama dan statusnya:

- **Autentikasi**: ✅ Berfungsi. Menggunakan JWT (access & refresh token) yang disimpan di cookies (HttpOnly). Terdapat endpoint untuk register, login, logout, dan refresh token.
- **Real-time Chat**: ✅ Berfungsi. Pesan dikirim melalui event socket `message:send` dan diterima melalui `message:new`.
- **Enkripsi End-to-End (E2EE)**: ✅ Berfungsi. `libsodium-wrappers` digunakan di frontend (`crypto.ts`) untuk mengenkripsi/dekripsi konten pesan sebelum dikirim dan setelah diterima. Kunci dikelola per percakapan.
- **Pesan Pribadi dan Grup**: ✅ Berfungsi. Model `Conversation` memiliki flag `isGroup`. Logika untuk membuat grup dan percakapan pribadi ada.
- **Indikator Pengetikan (`Typing Indicator`)**: ✅ Berfungsi. Menggunakan event socket `typing:start` dan `typing:stop`.
- **Status Online (`Presence`)**: ✅ Berfungsi. Server melacak pengguna online (`onlineUsers`) dan menyiarkan status `presence:user_joined` dan `presence:user_left`.
- **Reaksi Pesan**: ✅ Berfungsi. Model `MessageReaction` ada di skema Prisma. Event socket `reaction:new` dan `reaction:remove` diimplementasikan di frontend.
- **Hapus Pesan**: ✅ Berfungsi. Event socket `message:deleted` ada.
- **Manajemen Grup**: ⚠️ Perlu cek. Terdapat API untuk membuat grup, namun fungsionalitas seperti menambah/mengeluarkan anggota atau menghapus grup perlu diverifikasi lebih lanjut di UI.
- **File Attachment**: ✅ Berfungsi. Menggunakan `multer` di backend dan `FormData` di frontend. File diunggah ke server, dan URL-nya dikirim sebagai pesan.
- **Notifikasi Push**: ✅ Berfungsi. Menggunakan `web-push` di server dan Service Worker di client. Ada event `push:subscribe` untuk menyimpan data langganan.

---

### 3. **Alur Kerja (Workflow)**

1.  **Pengiriman Pesan**:
    - User mengetik di UI (`ChatWindow.tsx`).
    - `sendMessage` dari store Zustand (`useChatStore`) dipanggil.
    - Pesan dienkripsi menggunakan `encryptMessage`.
    - Pesan "optimistic" (belum dikonfirmasi server) langsung ditambahkan ke state UI.
    - Event socket `message:send` dipancarkan ke server dengan payload terenkripsi.
2.  **Proses di Server**:
    - Middleware `socketAuthMiddleware` memverifikasi token user.
    - Event `message:send` diterima di `server/src/socket.ts`.
    - Pesan disimpan ke database menggunakan Prisma.
    - Server memancarkan event `message:new` ke semua partisipan dalam percakapan tersebut (termasuk pengirim asli).
3.  **Penerimaan Pesan**:
    - Frontend menerima event `message:new` melalui listener di `useChatStore.initSocketListeners`.
    - Jika pengirim adalah user saat ini, pesan "optimistic" digantikan dengan data dari server.
    - Jika pengirim adalah user lain, pesan baru didekripsi menggunakan `decryptMessage` dan ditambahkan ke state.
    - `useEffect` di komponen akan memicu re-render untuk menampilkan pesan baru.

---

### 4. **Kondisi UI & UX**

- **Komponen Utama**: `ChatList` (sidebar), `ChatWindow` (area chat utama), `MessageBubble`, `MessageItem`, `CreateGroupChat`, `Settings`.
- **Styling**: Menggunakan TailwindCSS secara ekstensif. Konfigurasi ada di `tailwind.config.ts`. Terdapat file `index.css` untuk gaya dasar.
- **Responsivitas**: Terdapat logika untuk menangani tampilan mobile. `isSidebarOpen` di `useChatStore` digunakan untuk menampilkan/menyembunyikan sidebar di layar kecil.
- **Konsistensi**: Struktur komponen terlihat modular dan konsisten.
- **Interaktivitas**: Terdapat komponen untuk reaksi, menu, dan indikator status, menandakan UI yang cukup interaktif.

---

### 5. **State Management**

- **Library**: Zustand.
- **Stores**:
    - `useAuthStore`: Mengelola state autentikasi, data pengguna, dan token.
    - `useChatStore`: Sangat komprehensif. Mengelola daftar percakapan, pesan aktif, status kehadiran, indikator pengetikan, dan semua logika terkait socket (listener dan emitter).
- **Update State**: State diperbarui sebagai respons terhadap aksi pengguna (misalnya, `sendMessage`) dan event socket yang masuk (misalnya, `message:new`). Logika pembaruan terpusat di dalam `useChatStore`, yang merupakan praktik yang baik.

---

### 6. **Keamanan & Koneksi**

- **Autentikasi API**: Menggunakan middleware `auth.ts` untuk memverifikasi JWT dari header `Authorization`.
- **Autentikasi Socket**: `socketAuthMiddleware` digunakan saat koneksi socket awal untuk memvalidasi token dari cookie. Ini adalah pendekatan yang aman.
- **Proteksi**: CSRF, Helmet, dan rate limiting sudah diimplementasikan di level Express, memberikan lapisan keamanan yang solid.
- **Enkripsi**: Implementasi E2EE dengan `libsodium-wrappers` adalah fitur keamanan yang kuat, melindungi konten pesan bahkan dari server itu sendiri.

---

### 7. **Masalah Potensial & Area Risiko**

- **Duplikasi Event Listener**: `useChatStore.initSocketListeners` membersihkan listener lama (`socket.off`) sebelum mendaftarkan yang baru. Ini adalah praktik yang baik untuk mencegah duplikasi, namun perlu dipastikan fungsi ini dipanggil hanya sekali saat inisialisasi.
- **Re-render**: Penggunaan Zustand umumnya efisien, tetapi komponen seperti `ChatWindow` yang di-`key`-kan dengan `activeId` akan di-remount sepenuhnya setiap kali percakapan diganti. Ini bisa jadi disengaja untuk mereset state, tetapi bisa juga tidak efisien jika state internalnya kompleks.
- **Sinkronisasi Data**: Logika "optimistic updates" untuk pengiriman pesan adalah kompleks. Ada potensi ketidaksinkronan jika konfirmasi dari server gagal atau terlambat. Penanganan error (`ack` callback dan properti `error` pada pesan) sudah ada, tetapi perlu diuji secara menyeluruh.
- **Manajemen Kunci Enkripsi**: Keamanan E2EE sangat bergantung pada bagaimana kunci dikelola. Kesalahan dalam penyimpanan atau pertukaran kunci dapat mengkompromikan seluruh sistem. Kode di `utils/crypto.ts` dan `utils/keyManagement.ts` menjadi area kritis.
- **Kompleksitas `useChatStore`**: File `web/src/store/chat.ts` sangat besar dan menangani banyak logika (API calls, socket listeners, state updates). Ini bisa menjadi area risiko tinggi untuk bug dan sulit untuk dipelihara. Memecahnya menjadi beberapa store atau custom hooks yang lebih kecil bisa dipertimbangkan di masa depan.

---

### 8. **Output Analisis & Ringkasan**

- **Dependensi Penting**: React, Node.js, Socket.IO, Prisma, Zustand, TailwindCSS, libsodium-wrappers.
- **Struktur Logika Utama**: UI (React Components) → State (Zustand Store) → Komunikasi (Socket.IO & Fetch) → Server (Express, Prisma).
- **Area Risiko Tinggi**:
    1.  **`web/src/store/chat.ts`**: Titik pusat dari hampir semua logika sisi klien. Kompleksitasnya tinggi.
    2.  **`web/src/utils/crypto.ts` & `keyManagement.ts`**: Inti dari fitur keamanan E2EE. Kesalahan di sini berdampak kritis.
    3.  **Alur Optimistic Update**: Logika untuk mengganti pesan sementara dengan pesan dari server di `message:new` listener.
- **Rekomendasi Singkat**:
    - Aplikasi ini memiliki fondasi yang solid dan modern.
    - Fokus utama untuk perbaikan di masa depan adalah **refactoring `useChatStore`** untuk mengurangi kompleksitasnya.
    - Pengujian menyeluruh pada alur E2EE dan penanganan error pada optimistic updates sangat disarankan.
