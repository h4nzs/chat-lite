# Saran dan Rekomendasi untuk Aplikasi Chat-Lite

Dokumen ini berisi saran dan ide untuk pengembangan aplikasi Chat-Lite di masa depan. Rekomendasi ini didasarkan pada analisis arsitektur saat ini, fitur yang ada, dan potensi untuk pertumbuhan.

## Ringkasan

Aplikasi ini memiliki fondasi yang sangat kuat: arsitektur modern (React, Node.js, TypeScript), manajemen state yang baik (Zustand), enkripsi End-to-End (E2EE) dengan Libsodium, dan fungsionalitas real-time melalui WebSockets. Desain Neumorphic yang baru juga memberikan tampilan yang unik dan modern. Saran berikut bertujuan untuk membangun di atas fondasi yang sudah solid ini.

---

## 1. Peningkatan Fitur Inti (Core Features)

Fitur-fitur ini akan memperkaya pengalaman pengguna dan membuat aplikasi lebih kompetitif.

- **Balasan Pesan (Message Replies):**
  - **Konsep:** Memungkinkan pengguna untuk membalas pesan tertentu, membuat alur percakapan lebih mudah diikuti.
  - **Implementasi:** Menambahkan tombol "Balas" pada gelembung pesan. Saat dibalas, pesan asli akan dikutip di atas pesan baru. Ini memerlukan pembaruan pada model data pesan (misalnya, `replyingToMessageId`).

- **Reaksi Pesan (Message Reactions):**
  - **Konsep:** Memberi pengguna kemampuan untuk bereaksi terhadap pesan dengan emoji. Komponen `Reactions.tsx` sudah ada dan bisa menjadi dasar.
  - **Implementasi:** Mengizinkan pengguna memilih emoji apa pun dari *emoji picker*, tidak hanya set yang telah ditentukan. Data reaksi perlu disimpan dan disinkronkan secara real-time.

- **Peningkatan Berbagi File:**
  - **Konsep:** Memperluas kemampuan berbagi file saat ini.
  - **Implementasi:** 
    - Dukungan untuk pratinjau file PDF atau pemutaran video/audio langsung di dalam aplikasi.
    - Membuat tab "Media" di panel info chat untuk menampilkan semua gambar, video, dan dokumen yang pernah dibagikan dalam satu galeri.

- **Status Pengguna Kustom:**
  - **Konsep:** Selain hanya "online/offline", izinkan pengguna mengatur status kustom (misalnya, "Sedang rapat", "Sibuk", atau emoji).
  - **Implementasi:** Menambahkan input status di halaman profil atau pengaturan, dan menampilkannya di samping nama pengguna.

- **Panggilan Suara/Video (Voice/Video Calls):**
  - **Konsep:** Ini adalah langkah besar berikutnya untuk aplikasi obrolan. Menambahkan kemampuan panggilan suara atau video 1-on-1 yang juga dienkripsi E2EE.
  - **Implementasi:** Memerlukan integrasi dengan teknologi **WebRTC**.

---

## 2. Peningkatan UI/UX

Peningkatan ini berfokus pada penyempurnaan pengalaman pengguna dan aksesibilitas.

- **Command Palette (`Ctrl+K`):**
  - **Konsep:** Mengembangkan shortcut `Ctrl+K` yang ada dari sekadar fokus pencarian menjadi *command palette* penuh (seperti di VS Code, Slack, atau Discord).
  - **Implementasi:** Pengguna bisa mengetik perintah seperti "/newgroup", "/settings", "/logout" untuk menjalankan aksi dengan cepat.

- **Kustomisasi Tema:**
  - **Konsep:** Memberi pengguna lebih banyak kontrol atas tampilan aplikasi.
  - **Implementasi:** Menambahkan pilihan untuk mengubah warna aksen aplikasi di halaman pengaturan.

- **Peningkatan Aksesibilitas (A11y):**
  - **Konsep:** Melanjutkan pekerjaan pada navigasi keyboard.
  - **Implementasi:** Memastikan semua elemen interaktif memiliki `aria-label` yang sesuai, dan memeriksa kembali kontras warna di semua tema untuk keterbacaan.

- **Onboarding & Bantuan:**
  - **Konsep:** Untuk aplikasi yang berfokus pada keamanan, alur orientasi bagi pengguna baru sangatlah penting.
  - **Implementasi:** Membuat tur singkat saat pertama kali login yang menjelaskan konsep kunci seperti *Recovery Phrase*, *Safety Number*, dan pentingnya verifikasi keamanan.

---

## 3. Peningkatan Teknis & Refactoring

Peningkatan di balik layar untuk menjaga kualitas kode dan kemudahan pemeliharaan.

- **Ekstraksi Logika Komponen:**
  - **Masalah:** Beberapa komponen seperti `ChatList.tsx` memiliki banyak logika di dalamnya.
  - **Solusi:** Mengekstrak lebih banyak logika ke dalam *custom hooks* terpisah. Ini akan membuat komponen lebih bersih dan fokus pada rendering (tampilan).

- **Peningkatan Test Coverage:**
  - **Masalah:** Direktori `tests/` ada tetapi cakupannya masih bisa ditingkatkan.
  - **Solusi:** Menambahkan lebih banyak *unit test* dan *integration test*, terutama untuk alur kerja penting seperti E2EE (enkripsi), otentikasi, dan logika state management di Zustand.

- **Manajemen Dependensi:**
  - **Solusi:** Secara berkala meninjau dan memperbarui *library* (NPM packages) yang digunakan untuk mendapatkan fitur terbaru dan, yang lebih penting, patch keamanan.

---

## 4. Peningkatan Keamanan & Stabilitas

Memperkuat fondasi keamanan aplikasi.

- **Alur Verifikasi Keamanan (E2EE):**
  - **Konsep:** Membuat proses verifikasi "Safety Number" lebih mudah dan menarik bagi pengguna.
  - **Implementasi:** Menambahkan opsi verifikasi dengan memindai **kode QR** antar perangkat, yang jauh lebih cepat daripada membandingkan angka secara manual.

- **Rate Limiting di Backend:**
  - **Konsep:** Mencegah serangan *brute-force* atau spam.
  - **Implementasi:** Menerapkan pembatasan jumlah permintaan (rate limiting) pada endpoint API kritis di sisi server, seperti `/login`, `/register`, dan pengiriman pesan.

- **Validasi Input di Backend:**
  - **Konsep:** Menganggap semua input dari pengguna sebagai tidak tepercaya.
  - **Implementasi:** Memastikan semua data yang dikirim ke server (pesan, nama grup, deskripsi profil) divalidasi dan disanitasi secara ketat di backend untuk mencegah serangan seperti XSS (Cross-Site Scripting).

---

### Rencana Implementasi Fitur "Lupa Password"

Fitur ini memberikan jalan keluar bagi pengguna yang lupa password dan frasa pemulihan, dengan konsekuensi riwayat pesan lama tidak bisa didekripsi.

#### 1. Komponen Layanan Email
Kita akan menggunakan layanan pihak ketiga untuk mengirim email reset.

*   **Library:** **`Nodemailer`** untuk Node.js.
*   **Layanan Pengembangan:** **Mailtrap.io** untuk menangkap email keluar selama pengembangan tanpa mengirim ke inbox asli.
*   **Layanan Produksi:** **SendGrid** atau **Mailgun** (memiliki *free tier* yang cukup).
*   **Aksi:** Instal library di direktori `server`:
    ```bash
    npm install nodemailer
    npm install -D @types/nodemailer
    ```

#### 2. Komponen Backend (Server)

*   **Modifikasi Skema Database (`prisma/schema.prisma`):**
    Tambahkan kolom opsional pada model `User` untuk menyimpan token reset.
    ```prisma
    model User {
      // ... kolom yang sudah ada
      passwordResetToken   String?   @unique
      passwordResetExpires DateTime?
    }
    ```

*   **Endpoint API Baru (`server/src/routes/auth.ts`):**
    1.  `POST /api/auth/forgot-password`:
        - Menerima `email` pengguna.
        - Membuat token reset yang aman dan unik.
        - Menyimpan *hash* dari token dan waktu kedaluwarsanya di database.
        - Menggunakan `Nodemailer` untuk mengirim email berisi link reset ke pengguna.
    2.  `POST /api/auth/reset-password`:
        - Menerima `token` dan `newPassword`.
        - Memverifikasi token dan masa berlakunya.
        - Jika valid, perbarui password pengguna dan hapus token dari database.

*   **Utilitas Email (`server/src/utils/sendEmail.ts`):**
    - Buat fungsi terpusat untuk mengonfigurasi dan mengirim email menggunakan `Nodemailer`.

#### 3. Komponen Frontend (Klien)

*   **Halaman Baru:**
    1.  **`web/src/pages/ForgotPassword.tsx`**: Form sederhana untuk pengguna memasukkan email mereka dan meminta link reset.
    2.  **`web/src/pages/ResetPassword.tsx`**: Form untuk memasukkan password baru, diakses dari link di email. Halaman ini akan mengambil `token` dari parameter URL.

*   **Logika Penghapusan Kunci Lama:**
    - Setelah pengguna berhasil login dengan password baru hasil reset, aplikasi perlu menangani kunci enkripsi lama yang tidak bisa lagi didekripsi.
    - **Alur:**
        1.  Setelah login, aplikasi mencoba mendekripsi kunci privat utama dan gagal.
        2.  Tangani kegagalan ini dengan memunculkan **modal peringatan** yang jelas: *"Kami mendeteksi Anda baru saja mereset password. Untuk melanjutkan, kunci enkripsi baru akan dibuat. **Semua riwayat pesan lama Anda tidak akan bisa dibaca lagi.**"*
        3.  Setelah pengguna menekan "Setuju", panggil fungsi `regenerateKeys(newPassword)` yang sudah ada di `web/src/store/auth.ts` untuk menghapus kunci lama dan membuat yang baru.

## Kesimpulan

Aplikasi ini berada di jalur yang benar untuk menjadi aplikasi obrolan yang aman dan modern. Dengan fokus pada penambahan fitur inti yang diminta pengguna dan terus memperkuat aspek teknis serta keamanan, aplikasi ini memiliki potensi besar untuk berkembang.
