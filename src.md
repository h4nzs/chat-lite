# Roadmap Aplikasi Chat-Lite

Dokumen ini berisi rencana pengembangan fitur-fitur baru dan penyempurnaan arsitektur untuk meningkatkan fungsionalitas, keamanan, dan kenyamanan pengguna.

---

### Bagian 1: Keamanan & Kontrol Akun Pengguna

**Tujuan:** Memberikan pengguna kontrol penuh atas keamanan akun mereka, terutama dalam skenario perangkat hilang atau dicuri.

#### Fitur 1.1: Manajemen Sesi Aktif & Pencabutan Jarak Jauh **done**

*   **Masalah yang Dipecahkan:** Saat ini, jika perangkat pengguna yang dalam keadaan login jatuh ke tangan orang lain, tidak ada cara bagi pengguna untuk membatalkan sesi aktif di perangkat tersebut dari jarak jauh. Ini adalah celah keamanan yang signifikan.
*   **Konsep:** Membuat sebuah halaman di mana pengguna dapat melihat semua perangkat dan browser tempat akun mereka aktif, dan memiliki kemampuan untuk "menendang" atau me-logout sesi tersebut dari jarak jauh.

*   **Langkah Implementasi:**
    1.  **Lacak Sesi di Database:** Perluas model `RefreshToken` atau buat tabel `Session` baru di `schema.prisma`. Tabel ini akan menyimpan `userId`, `sessionId`, `ipAddress`, `userAgent` (info browser/OS), dan `lastUsedAt` untuk setiap sesi login yang valid.
    2.  **Buat Halaman UI "Manajemen Sesi":** Di dalam halaman Pengaturan, tambahkan menu baru (misalnya, "Perangkat & Sesi Aktif") yang akan mengambil dan menampilkan daftar semua sesi aktif dari server.
    3.  **Implementasikan "Logout Jarak Jauh":**
        *   **API:** Buat endpoint baru (`DELETE /api/sessions/:sessionId`) yang akan menghapus sesi yang ditargetkan dari database.
        *   **Real-time:** Setelah menghapus data sesi, server harus menggunakan Socket.IO untuk mengirim perintah `force_logout` ke klien spesifik yang terkait dengan `sessionId` yang dihapus.
        *   **Client:** Saat menerima event `force_logout`, aplikasi klien harus secara otomatis menjalankan fungsi `logout()` lokal, menghapus semua kunci dan data sensitif, lalu mengarahkan pengguna ke halaman login.

---

### Bagian 2: Persistensi Riwayat Pesan Lintas Sesi

**Tujuan:** Memungkinkan pengguna untuk tetap dapat membaca riwayat pesan dari sesi sebelumnya setelah melakukan logout dan login kembali di perangkat yang sama.

#### Opsi 2.1: "Master Key" yang Dapat Dipulihkan (Sangat Aman, Lebih Kompleks)

*   **Konsep:** Kunci master privat tidak lagi dibuat secara acak, melainkan **dihasilkan ulang** setiap kali login menggunakan Frasa Pemulihan (Recovery Phrase) sebagai sumber utamanya.
*   **Trade-off:** Keamanan sangat tinggi, tetapi pengguna wajib menjaga Frasa Pemulihan mereka. Jika hilang, akun tidak dapat dipulihkan.

Langkah 1: Integrasikan `RecoveryPhraseModal` ke Alur 
  Registrasi

   * File yang akan diubah: web/src/pages/Register.tsx dan
     web/src/store/auth.ts.
   * Logika:
       1. Setelah pengguna berhasil mendaftar di Register.tsx,
          jangan langsung arahkan mereka ke halaman chat.
       2. Sebagai gantinya, panggil sebuah fungsi baru di auth.ts,
          misalnya generateAndShowRecoveryPhrase().
       3. Fungsi ini akan:
           * Membuat frasa pemulihan baru menggunakan bip39.
           * Menyimpan hash dari frasa ini di server. Ini penting
             agar server bisa memverifikasi frasa saat pemulihan
             tanpa pernah mengetahui frasa aslinya.
           * Membuka RecoveryPhraseModal dan menampilkan frasa
             tersebut kepada pengguna.
       4. Hanya setelah pengguna berhasil memverifikasi frasa di
          modal, kita akan menyelesaikan proses login dan
          mengarahkan mereka ke halaman chat.

  Langkah 2: Ubah Logika `logout` dan `login` untuk Persistensi

   * File yang akan diubah: web/src/store/auth.ts.
   * Logika `logout`:
       * Hapus baris
         localStorage.removeItem('encryptedPrivateKey'); dan
         localStorage.removeItem('publicKey');. Kita tidak lagi
         menghancurkan kunci saat logout.
   * Logika `login`:
       * Setelah login dengan password berhasil, aplikasi harus
         memeriksa: "Apakah encryptedPrivateKey ada di
         localStorage?".
       * Jika ya: Tidak perlu melakukan apa-apa. Pengguna bisa
         langsung melanjutkan karena kuncinya sudah ada dari sesi
         sebelumnya.
       * Jika tidak (kasus login di perangkat baru): Ini adalah
         titik di mana kita seharusnya mengarahkan pengguna ke
         halaman Restore.tsx atau menampilkan pesan yang
         menyarankan mereka untuk memulihkan dari frasa atau
         menautkan perangkat baru. Namun, untuk saat ini, kita bia
          membiarkannya kosong, dan pengguna harus secara manual
         pergi ke halaman "Restore".

  Langkah 3: Modifikasi Alur `Restore.tsx`

   * File yang akan diubah: server/src/routes/keys.ts (atau file
     rute yang menangani /api/keys/verify).
   * Logika:
       * Endpoint /api/keys/verify tidak boleh hanya memverifikasi
         kunci publik. Ia harus menerima frasa pemulihan (atau
         hash-nya), membandingkannya dengan hash yang disimpan di
         database, dan jika cocok, barulah mengizinkan pembaruan
         password. Ini adalah perubahan backend yang paling 
         signifikan.

#### Opsi 2.2: Menyimpan Kunci Master Terenkripsi (Lebih Nyaman, Sedikit Kurang Aman)

*   **Konsep:** Kita hanya mengubah satu aturan: **tidak menghancurkan** `encryptedPrivateKey` dari `localStorage` saat logout.
*   **Trade-off:** Pengalaman pengguna sangat mulus, tetapi sedikit menurunkan jaminan keamanan absolut karena kunci (meskipun terenkripsi) tetap ada di perangkat setelah logout.

---

### Bagian 3: Fitur Multi-Perangkat & Sinkronisasi

**Tujuan:** Memungkinkan pengguna untuk menggunakan akun mereka di beberapa perangkat secara bersamaan (misalnya, ponsel dan laptop) dengan pengalaman yang mulus.

#### Fitur 3.1: Penautan Perangkat Terpercaya (Trusted Device Linking)

*   **Konsep:** Mengimplementasikan alur di mana pengguna dapat mengotorisasi perangkat baru dengan aman menggunakan perangkat lama yang sudah login, tanpa perlu memasukkan password atau frasa pemulihan di perangkat baru.
*   **Cara Kerja:** Melalui pemindaian Kode QR, perangkat lama secara aman mentransfer kunci master ke perangkat baru, memungkinkan sinkronisasi sesi.
*   **Ketergantungan:** Fitur ini idealnya diimplementasikan **setelah** salah satu opsi dari **Bagian 2** diputuskan, karena akan memengaruhi cara kunci ditransfer.

---

**Rekomendasi Alur Pengembangan:**

1.  **Implementasikan Fitur Manajemen Sesi** dari **Bagian 1**. Ini adalah fitur keamanan fundamental yang harus diprioritaskan.
2.  **Putuskan dan Implementasikan** salah satu pendekatan persistensi dari **Bagian 2**.
3.  **Bangun Fitur Penautan Perangkat** dari **Bagian 3** sebagai langkah evolusi selanjutnya.
