# Analisis Proyek "Chat-Lite"

Dokumen ini berisi hasil analisis menyeluruh terhadap proyek "Chat-Lite". Tujuannya adalah untuk memetakan arsitektur, fungsionalitas, alur kerja, dan kondisi proyek secara keseluruhan.

---

### 1. Arsitektur & Teknologi Utama

Proyek ini menggunakan arsitektur monorepo dengan pemisahan yang jelas antara frontend dan backend.

-   **Struktur:**
    -   `server/`: Backend (Node.js)
    -   `web/`: Frontend (React)

-   **Tumpukan Teknologi (Tech Stack):**
    -   **Backend:**
        -   **Framework:** Express.js
        -   **Bahasa:** TypeScript (dieksekusi dengan `tsx`)
        -   **Database:** PostgreSQL dengan Prisma sebagai ORM.
        -   **Real-time:** Socket.IO
        -   **Autentikasi:** JSON Web Tokens (JWT) dengan `bcrypt` untuk hashing password.
        -   **Lainnya:** `multer` untuk file upload, `helmet` & `cors` untuk keamanan, `zod` untuk validasi.
    -   **Frontend:**
        -   **Framework:** React 19
        -   **Build Tool:** Vite
        -   **Bahasa:** TypeScript
        -   **State Management:** Zustand
        -   **Routing:** React Router
        -   **Styling:** TailwindCSS
        -   **Real-time:** `socket.io-client`

-   **Arsitektur Komunikasi:**
    -   **Hybrid:** Proyek ini secara efektif menggabungkan dua pola komunikasi:
        1.  **REST API:** Digunakan untuk operasi data yang bersifat *request-response* seperti autentikasi, pengambilan data awal (daftar percakapan, riwayat pesan), pencarian pengguna, dan upload file.
        2.  **WebSockets (Socket.IO):** Digunakan untuk semua komunikasi *real-time* yang membutuhkan latensi rendah, seperti pengiriman pesan baru, status online (presence), indikator pengetikan, dan pembaruan status pesan.

---

### 2. Daftar Fitur Utama & Statusnya

-   **✅ Autentikasi & Sesi:** Berfungsi. Menggunakan JWT dengan mekanisme *access token* dan *refresh token* (disimpan di HttpOnly cookie) yang aman.
-   **✅ Real-time Chat (Pesan Pribadi & Grup):** Berfungsi. Alur pengiriman pesan menggunakan *optimistic updates* di frontend untuk UX yang responsif.
-   **✅ Status Online (Presence):** Berfungsi dan sudah dioptimalkan. Server mengirim daftar lengkap saat koneksi awal (`presence:init`) dan hanya mengirim pembaruan saat ada pengguna yang bergabung (`presence:user_joined`) atau keluar (`presence:user_left`), mengurangi beban jaringan.
-   **✅ Indikator Pengetikan:** Berfungsi. Menggunakan event `typing:start` dan `typing:stop`.
-   **✅ Reaksi & Hapus Pesan:** Fungsionalitas backend dan event socket (`reaction:new`, `message:deleted`) tersedia.
-   **✅ Manajemen Grup:** Berfungsi. API memungkinkan pembuatan dan penghapusan grup.
-   **✅ Lampiran File:** Berfungsi. Alur upload terpisah dari pengiriman pesan, di mana file diunggah terlebih dahulu, lalu URL-nya dikirim melalui socket.
-   **⚠️ Enkripsi End-to-End (E2EE):** Dalam pengembangan. Terdapat API untuk manajemen kunci (`/api/keys`) dan fungsi enkripsi/dekripsi di frontend, namun alur pertukaran kunci belum sepenuhnya terimplementasi.
-   **✅ Notifikasi Push:** Terimplementasi. Klien dapat mengirim *subscription* (`push:subscribe`) dan server akan mengirim notifikasi saat ada pesan baru.

---

### 3. Alur Kerja & Logika Utama

Alur kerja pengiriman pesan menjadi contoh utama dari arsitektur aplikasi ini:

1.  **UI (`ChatWindow.tsx`):** Pengguna mengetik pesan dan menekan tombol kirim.
2.  **Hook (`useConversation.ts`):** Logika UI memanggil fungsi `sendMessage` yang diekspos oleh hook ini. Hook ini berfungsi sebagai jembatan antara komponen dan state manager.
3.  **State (`useChatStore.ts`):**
    -   Fungsi `sendMessage` di dalam store membuat **pesan optimis** (pesan sementara) dan langsung menampilkannya di UI.
    -   Store kemudian memancarkan (`emit`) event `message:send` ke server melalui Socket.IO, beserta *callback* untuk konfirmasi (ack).
4.  **Server (`socket.ts`):**
    -   Server menerima event `message:send`, membersihkan input menggunakan `xss`, dan menyimpan pesan ke database melalui Prisma.
    -   Server memancarkan event `message:new` ke semua anggota percakapan (termasuk pengirim asli).
    -   Server memanggil *callback* (ack) untuk memberitahu pengirim bahwa pesan telah berhasil disimpan.
5.  **Pembaruan State:**
    -   Saat *callback* diterima, store di frontend akan mengganti pesan optimis dengan data pesan asli dari server. Jika gagal, pesan akan ditandai sebagai error.
    -   Klien lain yang menerima `message:new` akan langsung menambahkan pesan tersebut ke state mereka.

---

### 4. Kondisi UI & UX

-   **Komponen:** Kode terstruktur dengan baik ke dalam komponen yang dapat digunakan kembali (`MessageItem`, `ChatHeader`, `Spinner`).
-   **Styling:** Menggunakan TailwindCSS dengan tema gelap (`dark`) yang konsisten.
-   **Responsivitas:** Desain sudah responsif, terlihat dari adanya tombol *hamburger* untuk membuka/menutup sidebar di layar kecil.
-   **Pengalaman Pengguna:** Cukup baik. Menggunakan `react-virtuoso` untuk virtualisasi daftar pesan (efisien), `react-hot-toast` untuk notifikasi, dan indikator loading/error. Logika yang kompleks telah diekstraksi dari komponen ke dalam *custom hooks* (`useConversation`), yang merupakan praktik terbaik.

---

### 5. State Management

-   **Zustand:** Digunakan sebagai state manager global. `useChatStore` menjadi satu-satunya sumber kebenaran (*single source of truth*) untuk data terkait chat (percakapan, pesan, status online, dll).
-   **Sentralisasi Logika:** Semua listener event socket diinisialisasi dalam satu fungsi (`initSocketListeners`) di dalam store. Ini adalah praktik yang sangat baik untuk mencegah kebocoran memori dan duplikasi event listener.

---

### 6. Keamanan

-   **Otorisasi:** Setiap request API dan koneksi socket dilindungi oleh middleware (`authenticateToken`, `socketAuthMiddleware`) yang memverifikasi JWT.
-   **CSRF Protection:** Implementasi `csurf` di backend dan pengiriman token via header di frontend memberikan perlindungan yang kuat terhadap serangan Cross-Site Request Forgery.
-   **Input Sanitization:** Penggunaan library `xss` di server untuk membersihkan konten pesan sebelum disimpan membantu mencegah serangan XSS.
-   **Keamanan Header:** `Helmet` digunakan untuk mengatur header HTTP yang aman.

---

### 7. Area Risiko & Rekomendasi

-   **Kompleksitas E2EE:** Fitur enkripsi end-to-end adalah yang paling kompleks dan berisiko. Perlu perhatian khusus pada manajemen dan pertukaran kunci agar aman dan andal.
-   **Penanganan Error UI:** Aplikasi sudah memiliki state `error`, namun bisa ditingkatkan. Misalnya, memberikan opsi "Coba lagi" untuk pesan yang gagal terkirim.
-   **Stabilitas Kode:** Kode secara umum ditulis dengan baik. Penggunaan custom hooks seperti `useConversation` sangat bagus untuk pemisahan logika (separation of concerns) dan harus dipertahankan atau diperluas untuk fitur lain.
-   **Sinkronisasi:** Tidak ada masalah sinkronisasi yang jelas terdeteksi dari analisis kode. Penggunaan socket untuk semua pembaruan real-time memastikan data tetap sinkron.

### Kesimpulan Analisis

Proyek "Chat-Lite" memiliki fondasi arsitektur yang solid, modern, dan aman. Pemisahan antara REST API untuk data statis dan WebSockets untuk data real-time sudah tepat. Kualitas kode baik, dengan penerapan praktik terbaik seperti sentralisasi logika state, penggunaan custom hooks, dan langkah-langkah keamanan yang kuat. Proyek ini berada dalam kondisi yang sangat baik untuk melanjutkan pengembangan, baik untuk menyelesaikan fitur yang ada (E2EE) maupun menambahkan fitur baru.
