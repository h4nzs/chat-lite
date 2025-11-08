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

**Masalah: Obrolan Grup (Group Chat)**

  Implementasi saat ini (crypto_box_easy) dirancang untuk
  komunikasi antara dua orang (1-on-1). Skema ini tidak efisien
  dan tidak cocok untuk obrolan grup. Untuk mengirim pesan ke 5
  orang, aplikasi harus mengenkripsi pesan yang sama sebanyak 5
  kali, satu untuk setiap penerima.

  Standar industri untuk E2EE dalam obrolan grup (seperti yang
  digunakan oleh Signal) adalah:
   1. Kunci Sesi: Pengirim membuat sebuah kunci simetris acak
      (misalnya, kunci AES).
   2. Enkripsi Pesan: Pesan dienkripsi satu kali saja menggunakan
      kunci simetris tersebut.
   3. Distribusi Kunci: Kunci simetris itu kemudian dienkripsi unk
      setiap anggota grup menggunakan kunci publik masing-masing
      anggota.
   4. Pengiriman: Pengirim mengirim satu paket berisi pesan yang
      terenkripsi dan kumpulan kunci sesi yang sudah terenkripsi
      untuk tiap anggota.

## Kesimpulan

Aplikasi ini berada di jalur yang benar untuk menjadi aplikasi obrolan yang aman dan modern. Dengan fokus pada penambahan fitur inti yang diminta pengguna dan terus memperkuat aspek teknis serta keamanan, aplikasi ini memiliki potensi besar untuk berkembang.
