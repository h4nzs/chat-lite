# Rencana Peningkatan dan Stabilitas Aplikasi

Berikut adalah daftar tugas yang direkomendasikan untuk meningkatkan keamanan, keandalan, dan kualitas kode aplikasi secara keseluruhan.

### 1. Keamanan Fitur Penautan Perangkat (Prioritas Kritis)

- **[ done ] Ganti Password Hardcoded dengan Input Pengguna:**
  - **Lokasi:** `web/src/pages/LinkDevicePage.tsx`
  - **Tugas:** Saat ini, kunci utama dienkripsi ulang dengan password `"password"` yang di-hardcode. Ganti ini dengan modal (UI pop-up) yang meminta pengguna untuk membuat kata sandi baru khusus untuk perangkat tersebut.
  - **Alasan:** Ini adalah langkah keamanan fundamental untuk melindungi kunci enkripsi pengguna di setiap perangkat.

### 2. Keandalan & Skalabilitas (Prioritas Tinggi)

- **[ done ] Gunakan Redis untuk Penyimpanan Token Penautan:**
  - **Lokasi:** `server/src/socket.ts` dan `server/src/routes/auth.ts`
  - **Tugas:** Ganti penyimpanan `linkingToken` dari `Map` di memori server ke **Redis**.
  - **Alasan:** `Map` di memori tidak akan berfungsi di lingkungan produksi dengan lebih dari satu server (scaling) dan tidak andal jika server di-restart. Redis adalah solusi standar industri untuk ini.

### 3. Peningkatan Real-time & Pengalaman Pengguna

- **[ done ] Tangani Pembuatan Obrolan 1-on-1 via Pesan Baru:**
  - **Lokasi:** `server/src/routes/messages.ts` (perlu diverifikasi)
  - **Tugas:** Periksa logika pengiriman pesan. Jika sebuah pesan dikirim ke pengguna yang belum pernah berinteraksi sebelumnya, sebuah percakapan 1-on-1 baru kemungkinan dibuat secara implisit. Pastikan event socket `conversation:new` juga dikirim ke penerima dalam kasus ini.
  - **Alasan:** Agar percakapan baru langsung muncul di daftar obrolan penerima secara real-time, sama seperti saat ditambahkan ke grup.

- **[ done ] Penanganan Error Enkripsi yang Lebih Baik:**
  - **Lokasi:** Di seluruh aplikasi klien (misalnya, `web/src/store/conversation.ts`).
  - **Tugas:** Jika sebuah pesan gagal didekripsi, jangan hanya menampilkan `[Encrypted Message]`. Berikan pesan error yang lebih informatif kepada pengguna, seperti "Kunci enkripsi untuk pesan ini tidak ditemukan."
  - **Alasan:** Meningkatkan pengalaman pengguna dan mempermudah debugging masalah E2EE.

### 4. Kualitas Kode & Praktik Terbaik

- **[ ] Refactor Panggilan API di `LinkDevicePage.tsx`:**
  - **Lokasi:** `web/src/pages/LinkDevicePage.tsx`
  - **Tugas:** Ubah panggilan `fetch` ke `/api/auth/finalize-linking` agar menggunakan fungsi `api` atau `authFetch` terpusat yang ada di `web/src/lib/api.ts`.
  - **Alasan:** Menjaga konsistensi kode, memusatkan logika API, dan menyederhanakan penanganan error.

- **[ ] Tinjau dan Perkuat Header Keamanan:**
  - **Lokasi:** `server/src/app.ts`
  - **Tugas:** Tinjau konfigurasi `helmet` dan pertimbangkan untuk menambahkan header yang lebih ketat seperti `Content-Security-Policy` (CSP).
  - **Alasan:** Memberikan lapisan pertahanan tambahan terhadap serangan seperti XSS (Cross-Site Scripting).
