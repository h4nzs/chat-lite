# Audit Aplikasi & Rekomendasi Perbaikan

Dokumen ini berisi hasil audit menyeluruh pada aplikasi, mencakup potensi bug, error, inkonsistensi, dan risiko arsitektural di masa depan. Setiap temuan disertai dengan deskripsi dan rekomendasi perbaikan.

---

## 1. Arsitektur & Risiko Masa Depan

### [RISIKO] Kompleksitas State Management (Zustand)
- **Lokasi:** `web/src/store/conversation.ts`, `web/src/store/message.ts`
- **Deskripsi:** Seperti yang telah diidentifikasi sebelumnya, file-file store Zustand, terutama `message.ts`, telah menjadi sangat besar dan menangani terlalu banyak tanggung jawab (mengelola state pesan, logika pengiriman, unggah file, pencarian, dll.). Seiring bertambahnya fitur, file ini akan semakin sulit dipelihara, di-debug, dan dites.
- **Rekomendasi:**
    1.  **Pecah Store:** Refactor `useMessageStore` menjadi beberapa *store* yang lebih kecil dan terfokus. Contohnya:
        - `useMessageStore`: Hanya untuk state pesan (CRUD).
        - `useMessageSenderStore`: Untuk logika pengiriman pesan dan unggah file.
        - `useMessageSearchStore`: Untuk logika pencarian pesan.
    2.  Gunakan *middleware* Zustand (seperti `immer`) untuk menyederhanakan logika pembaruan state yang kompleks.

### [RISIKO] Alur Dekripsi yang Tidak Efisien Saat Kunci Baru Diterima
- **Lokasi:** `web/src/store/message.ts` (fungsi `redecryptMessages`)
- **Deskripsi:** Implementasi `redecryptMessages` saat ini, yang memuat ulang *semua* pesan dari server saat kunci baru diterima, adalah solusi sementara yang tidak efisien. Ini akan menyebabkan lonjakan lalu lintas jaringan dan UI yang berkedip (karena daftar pesan dikosongkan lalu diisi ulang).
- **Rekomendasi:**
    1.  **Simpan Ciphertext Asli:** Modifikasi tipe data `Message` di state Zustand untuk menyimpan *ciphertext* asli di samping konten yang sudah didekripsi (atau yang gagal didekripsi).
    2.  **Dekripsi Ulang di Tempat:** Ubah `redecryptMessages` agar tidak lagi memuat ulang dari server. Sebaliknya, ia harus mengiterasi pesan-pesan yang ada, mengambil *ciphertext* asli dari state, mencoba mendekripsinya dengan kunci baru, dan memperbarui konten pesan satu per satu di dalam state.

---

## 2. Backend

### [done] Potensi Race Condition pada Status Online
- **Lokasi:** `server/src/socket.ts`
- **Deskripsi:** Status online pengguna (`onlineUsers`) saat ini disimpan dalam sebuah `Set` di memori server. Jika server di-deploy di lebih dari satu *instance* (misalnya, untuk *load balancing*), setiap *instance* akan memiliki daftar `onlineUsers`-nya sendiri yang tidak sinkron. Ini akan menyebabkan fitur status online dan permintaan kunci sesi menjadi tidak andal.
- **Rekomendasi:**
    1.  **Pindahkan State ke Redis:** Pindahkan manajemen status online dari `Set` di memori ke Redis. Gunakan perintah Redis seperti `SADD`, `SREM`, dan `SMEMBERS` untuk mengelola daftar ID pengguna yang online. Ini memastikan semua *instance* server berbagi satu sumber kebenaran yang sama.

### [MISMATCH] Logika Pembuatan Percakapan 1-on-1
- **Lokasi:** `server/src/socket.ts` (event `message:send`)
- **Deskripsi:** Saat ini, percakapan 1-on-1 baru dibuat secara implisit ketika seorang pengguna mengirim pesan pertama ke pengguna lain. Logika ini tersembunyi di dalam event `message:send`. Ini kurang intuitif dan mencampurkan dua tanggung jawab yang berbeda (membuat pesan dan membuat percakapan).
- **Rekomendasi:**
    1.  **Buat Endpoint Eksplisit:** Pindahkan logika pembuatan percakapan 1-on-1 ke endpoint REST API-nya sendiri, misalnya `POST /api/conversations`.
    2.  **Ubah Alur Klien:** Di klien, sebelum mengirim pesan pertama ke pengguna baru, panggil dulu endpoint `POST /api/conversations` untuk membuat atau mendapatkan ID percakapan, baru kemudian kirim pesan ke ID tersebut. Ini membuat alur lebih jelas dan mudah di-debug.

---

## 3. Frontend

### [BUG] Ketergantungan pada `localStorage` untuk `activeId`
- **Lokasi:** `web/src/store/conversation.ts`
- **Deskripsi:** `activeId` (ID percakapan yang sedang aktif) diinisialisasi dari `localStorage`. Ini dapat menyebabkan *mismatch* antara state yang dirender di server (jika menggunakan SSR di masa depan) dan di klien. Selain itu, ini membuat state menjadi kurang terprediksi karena bergantung pada data di luar aplikasi React.
- **Rekomendasi:**
    1.  **Hapus Inisialisasi dari `localStorage`:** Hentikan pembacaan `localStorage` saat store diinisialisasi.
    2.  **Gunakan URL sebagai Sumber Kebenaran:** Jadikan URL sebagai satu-satunya sumber kebenaran untuk percakapan aktif. Misalnya, gunakan rute seperti `/chat/:conversationId`. Saat aplikasi dimuat, ambil `conversationId` dari parameter URL untuk menentukan `activeId`. Ini adalah pola yang lebih standar dan kuat di aplikasi React.

### [done] Penanganan Error yang Kurang Baik pada `loadConversations`
- **Lokasi:** `web/src/store/conversation.ts`
- **Deskripsi:** Di dalam `loadConversations`, jika panggilan API gagal, state `error` diatur, tetapi tidak ada mekanisme untuk membersihkan error tersebut atau mencoba lagi. Pengguna mungkin akan melihat pesan error selamanya tanpa bisa melakukan apa-apa.
- **Rekomendasi:**
    1.  **Tambahkan Aksi `clearError`:** Buat aksi baru di store untuk membersihkan pesan error.
    2.  **Tampilkan Tombol "Coba Lagi":** Di UI, jika `error` ada, tampilkan pesan error tersebut beserta tombol "Coba Lagi" yang akan memanggil kembali `loadConversations`.

### [INKONSISTENSI] Penggunaan `axios` dan `api`
- **Lokasi:** `web/src/store/message.ts` (fungsi `uploadFile`)
- **Deskripsi:** Sebagian besar aplikasi menggunakan *helper* `api` atau `authFetch` untuk panggilan jaringan. Namun, fungsi `uploadFile` menggunakan `axios` secara langsung. Ini menciptakan inkonsistensi dan membuat penanganan error atau *interceptors* menjadi lebih sulit dikelola secara terpusat.
- **Rekomendasi:**
    1.  **Refactor `uploadFile`:** Ubah fungsi `uploadFile` agar menggunakan *helper* `api` atau `authFetch` yang sudah ada, sama seperti bagian lain dari aplikasi. Jika `axios` diperlukan secara spesifik untuk *progress bar* unggahan, bungkus `axios` di dalam *helper* `api` agar konfigurasinya tetap terpusat.
