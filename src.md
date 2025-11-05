# Dokumentasi Teknis & Panduan Pengembangan Aplikasi

Dokumen ini berfungsi sebagai panduan teknis untuk arsitektur, alur kerja, dan pengembangan aplikasi obrolan ini.

---

## 1. Arsitektur & Teknologi

Aplikasi ini menggunakan arsitektur client-server modern dengan fokus kuat pada keamanan dan komunikasi real-time.

- **Frontend (Direktori `web/`):**
  - **Framework:** React (dibuat dengan Vite)
  - **Bahasa:** TypeScript
  - **Manajemen State:** Zustand (dengan pemisahan store per-fitur, misal `authStore`, `conversationStore`, `socketStore`)
  - **Styling:** Tailwind CSS
  - **Fitur:** Progressive Web App (PWA) dengan Service Worker untuk fungsionalitas offline dan notifikasi.

- **Backend (Direktori `server/`):**
  - **Framework:** Node.js dengan Express.js
  - **Bahasa:** TypeScript
  - **Database:** PostgreSQL dengan **Prisma** sebagai ORM.
  - **Cache & Antrian:** **Redis** (digunakan untuk fitur penautan perangkat).

- **Komunikasi & Keamanan:**
  - **Real-time:** **Socket.IO** digunakan untuk semua komunikasi real-time (pesan, status online, notifikasi).
  - **Enkripsi End-to-End (E2EE):** Menggunakan `libsodium-wrappers` untuk memastikan hanya pengirim dan penerima yang dapat membaca pesan.
  - **Otentikasi:** Menggunakan JSON Web Tokens (JWT) dengan mekanisme refresh token, serta mendukung login tanpa kata sandi melalui **Passkeys (WebAuthn)**.
  - **Keamanan Server:** Menggunakan `helmet` untuk header keamanan (termasuk CSP), proteksi CSRF, dan `rate-limiting`.

---

## 2. Alur Kerja Utama

### a. Enkripsi End-to-End (E2EE)

Server tidak pernah bisa membaca isi pesan. Alurnya adalah sebagai berikut:
1.  **Distribusi Kunci:** Saat sebuah percakapan dibuat, sebuah *kunci sesi* (session key) dibuat. Kunci ini kemudian dienkripsi menggunakan kunci publik (public key) dari masing-masing peserta dan disimpan di server.
2.  **Pengambilan Kunci:** Saat pengguna membuka percakapan, klien akan mengunduh *kunci sesi* yang terenkripsi untuknya, lalu mendekripsinya menggunakan kunci privat (private key) pengguna tersebut.
3.  **Enkripsi/Dekripsi Pesan:** Semua pesan yang dikirim dalam sesi tersebut dienkripsi dan didekripsi di sisi klien menggunakan *kunci sesi* ini.

### b. Penautan Perangkat (Device Linking)

Fitur ini memungkinkan pengguna untuk login di perangkat baru dengan aman tanpa memasukkan kata sandi.
1.  **Inisiasi (Perangkat Baru):** Menampilkan QR code yang berisi `roomId` dan *kunci publik sementara*.
2.  **Pemindaian (Perangkat Lama):** Memindai QR code, lalu mengenkripsi *kunci privat utama* pengguna dengan *kunci publik sementara* dari perangkat baru.
3.  **Transfer Aman:** Kunci yang terenkripsi ini dikirim ke server, yang kemudian meneruskannya ke perangkat baru melalui room Socket.IO yang aman.
4.  **Amankan Ulang:** Perangkat baru mendekripsi *kunci privat utama*, lalu **meminta pengguna membuat kata sandi baru** khusus untuk perangkat tersebut. Kunci utama kemudian dienkripsi ulang dengan kata sandi baru ini dan disimpan di `localStorage`.
5.  **Finalisasi:** Perangkat baru menyelesaikan otentikasi dengan server dan sesi baru pun dimulai.

### c. Komunikasi Real-time

Aplikasi sangat bergantung pada Socket.IO untuk interaktivitas.
- **Rooms:** Setiap pengguna otomatis bergabung ke *room* dengan `userId`-nya sendiri (untuk notifikasi personal) dan juga ke *room* untuk setiap percakapan yang sedang dibuka (`conversationId`).
- **Event Penting:**
  - `message:send`: Mengirim pesan. Logika di server akan membuat percakapan 1-on-1 secara implisit jika belum ada.
  - `conversation:new`: Server mengirim event ini ke pengguna yang baru ditambahkan ke sebuah percakapan, agar daftar obrolan mereka diperbarui secara real-time.
  - `presence:*`: Menangani status online/offline pengguna.
  - `typing:*`: Menangani indikator "sedang mengetik".

---

## 3. Panduan Pengembangan

### a. Prasyarat
- Node.js (v18+)
- pnpm
- PostgreSQL
- Redis

### b. Setup Awal
1.  **Konfigurasi Environment:** Salin `.env.example` menjadi `.env` di direktori `server/` dan `web/`, lalu isi nilainya sesuai kebutuhan pengembangan.
2.  **Instalasi Dependensi:** Jalankan `pnpm install` di direktori root, `server/`, dan `web/`.
3.  **Setup Database:** Jalankan `pnpm prisma migrate dev` di dalam direktori `server/` untuk membuat dan migrasi database.

### c. Menjalankan Aplikasi
1.  **Jalankan Redis:** Buka terminal dan jalankan `redis-server`.
2.  **Jalankan Backend:** Di direktori `server/`, jalankan `pnpm dev`.
3.  **Jalankan Frontend:** Di direktori `web/`, jalankan `pnpm dev`.

### d. Perintah Penting
- `pnpm prisma migrate reset` (di `server/`): Mengosongkan dan mereset database.
- `pnpm test` (di `server/` atau `web/`): Menjalankan unit test.

---

## 4. Rencana Perbaikan & Roadmap

Berikut adalah daftar tugas yang direkomendasikan untuk pengembangan selanjutnya.

- **[ ] Refactor Panggilan API di `LinkDevicePage.tsx`:**
  - **Tugas:** Ubah panggilan `fetch` ke `/api/auth/finalize-linking` agar menggunakan fungsi `api` terpusat dari `web/src/lib/api.ts`.
  - **Alasan:** Konsistensi kode dan sentralisasi logika API.

- **[ ] Tinjau dan Perkuat Header Keamanan (CSP):**
  - **Tugas:** Di `server/src/app.ts`, sesuaikan `connectSrc` di dalam `Content-Security-Policy` untuk lingkungan produksi.
  - **Alasan:** Memastikan kebijakan keamanan sesuai dengan domain produksi Anda.
