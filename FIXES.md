# Rekomendasi Peningkatan untuk Aplikasi Chat-Lite

Dokumen ini berisi daftar saran perbaikan, pengoptimalan, dan ide fitur baru yang dapat diimplementasikan untuk meningkatkan kualitas, performa, dan fungsionalitas aplikasi Chat-Lite.

---

### 💡 Fase 1: Pengoptimalan & Peningkatan Stabilitas

Prioritas utama adalah memastikan aplikasi berjalan secepat dan seandal mungkin. Langkah-langkah ini berfokus pada pengalaman pengguna inti.

#### 1. **Optimalkan Pengambilan Data Awal (Initial Data Fetch)**
*   **Masalah:** Saat ini, aplikasi memuat daftar percakapan terlebih dahulu, kemudian secara terpisah memuat pesan saat setiap percakapan dibuka. Ini menciptakan beberapa permintaan jaringan yang dapat memperlambat waktu muat awal.
*   **Rekomendasi:** Modifikasi *endpoint* `GET /api/conversations` di backend untuk menyertakan **1 pesan terakhir** dari setiap percakapan dalam respons awal. Di frontend, `useConversationStore` dapat langsung menggunakan data ini. Ini akan menghilangkan kebutuhan untuk permintaan jaringan tambahan saat hanya melihat pratinjau pesan terakhir di sidebar, membuat aplikasi terasa lebih responsif saat startup.

#### 2. **Tingkatkan & Standarisasi Umpan Balik UI**
*   **Masalah:** Umpan balik untuk status `loading` dan `error` belum konsisten di seluruh aplikasi. Beberapa bagian mungkin menampilkan spinner, sementara yang lain mungkin gagal secara diam-diam.
*   **Rekomendasi:** Buat komponen `Spinner` dan `ErrorMessage` yang dapat digunakan kembali. Terapkan komponen-komponen ini secara konsisten pada semua operasi asinkron, seperti: 
    *   `login` dan `register`
    *   Mengunggah file
    *   Memuat riwayat pesan lama
    *   Menyimpan perubahan di halaman Pengaturan
    Ini memberikan kejelasan kepada pengguna tentang apa yang sedang terjadi di aplikasi.

#### 3. **Audit Komprehensif Event Listener**
*   **Masalah:** Meskipun masalah utama *listener* duplikat telah diperbaiki, aplikasi yang berkembang secara kompleks berisiko mengalami kebocoran memori (*memory leaks*) jika *event listener* (terutama dari Socket.IO) tidak dibersihkan dengan benar saat komponen di-*unmount*.
*   **Rekomendasi:** Lakukan audit menyeluruh pada semua `useEffect` di seluruh aplikasi yang mendaftarkan *event listener* (misalnya di `useSocketStore` dan `MessageItem`). Pastikan setiap `useEffect` tersebut mengembalikan **fungsi cleanup** yang memanggil `socket.off("event-name")` atau `observer.disconnect()` untuk semua *listener* yang didaftarkan. Ini adalah praktik terbaik untuk menjaga stabilitas aplikasi jangka panjang.

---

### ⭐ Fase 2: Fitur Baru yang Potensial

Setelah aplikasi stabil, fitur-fitur ini dapat ditambahkan untuk memperkaya fungsionalitas dan menyaingi aplikasi chat modern lainnya.

#### 1. **Edit Pesan Terkirim**
*   **Ide:** Berikan pengguna kemampuan untuk mengedit pesan teks mereka dalam jangka waktu terbatas setelah dikirim (misalnya, 15 menit).
*   **Implementasi:**
    *   **Backend:** Buat *endpoint* API baru `PUT /api/messages/:id`.
    *   **UI:** Di `MessageItem`, tampilkan tombol "Edit" di menu dropdown untuk pesan milik pengguna sendiri. Saat diklik, ubah `MessageBubble` menjadi area input teks.
    *   **Socket.IO:** Siarkan *event* `message:updated` ke semua anggota percakapan agar pesan yang diedit diperbarui secara *real-time*.

#### 2. **Pencarian Global**
*   **Ide:** Perluas fitur pencarian saat ini yang hanya mencari di dalam percakapan aktif. Buat bar pencarian global yang dapat mencari pesan atau nama pengguna di semua percakapan.
*   **Implementasi:**
    *   **Backend:** Buat *endpoint* API baru `GET /api/search?q=<query>` yang melakukan pencarian *full-text* di model `Message` dan `User`.
    *   **UI:** Tampilkan hasil pencarian dalam sebuah dropdown atau halaman khusus, yang dikelompokkan berdasarkan percakapan. Mengklik hasil akan menavigasi ke pesan tersebut dalam percakapan yang relevan.

#### 3. *done* **Notifikasi Dalam Aplikasi (In-App Notifications)**
*   **Ide:** Selain *push notification*, buat sistem notifikasi di dalam aplikasi (mirip lonceng notifikasi) untuk memberitahu pengguna saat mereka ditambahkan ke grup baru, peran mereka diubah, atau saat ada sebutan (mention) `@username`.
*   **Implementasi:**
    *   Buat komponen *popover* notifikasi baru di `Header` utama.
    *   Gunakan *event-event* Socket.IO yang sudah ada (`conversation:new`, `participant:role_changed`) untuk memicu penambahan item notifikasi baru ke *state*.

#### 4. **Status Kehadiran (Presence) yang Lebih Detail**
*   **Ide:** Izinkan pengguna mengatur status kustom mereka (misalnya, "Away", "Do Not Disturb", "In a meeting") selain hanya "Online" atau "Offline".
*   **Implementasi:**
    *   Tambahkan kolom `status` pada model `User` di `schema.prisma`.
    *   Buat *endpoint* API atau *event socket* bagi pengguna untuk memperbarui status mereka.
    *   Di UI, tampilkan ikon status yang berbeda di `ChatList`, `ChatHeader`, dan profil pengguna berdasarkan status mereka.

#### 5. **Pratinjau Tautan (Link Preview)**
*   **Ide:** Saat pengguna mengirim pesan yang berisi URL, secara otomatis ambil metadata (judul, deskripsi, gambar) dari URL tersebut dan tampilkan sebagai kartu pratinjau yang kaya.
*   **Implementasi:**
    *   **Backend:** Saat menerima pesan baru, periksa apakah ada URL di dalamnya. Jika ada, gunakan library seperti `link-preview-js` untuk mengambil metadata di sisi server.
    *   **UI:** Buat komponen `LinkPreviewCard` baru yang akan dirender di bawah konten pesan jika pesan tersebut berisi metadata pratinjau.

#### Rencana Implementasi user description:

   1. Backend (`server/`):
       * Database: Saya akan menambahkan kolom baru description
         (tipe String, opsional) ke model User di
         prisma/schema.prisma.
       * Migrasi: Saya akan menjalankan prisma migrate dev untuk
         menerapkan perubahan skema ke database.
       * API: Saya akan memodifikasi endpoint PUT /api/users/me di
         server/src/routes/users.ts. Saya akan menambahkan validai
          untuk description (misalnya, panjang maksimal) dan
         memperbarui logika untuk menyimpan deskripsi baru ke
         database.
       * Data Transfer: Saya akan memastikan data description
         disertakan saat data pengguna diambil (misalnya, di
         endpoint /api/users/me dan di dalam objek participants
         pada data percakapan).

   2. Frontend (`web/`):
       * State Management: Saya akan menambahkan properti
         description ke tipe User di web/src/store/auth.ts dan di
         tempat lain jika diperlukan.
       * UI Halaman Pengaturan: Saya akan memodifikasi
         SettingsPage.tsx (web/src/pages/SettingsPage.tsx).
           * Saya akan menambahkan textarea baru di bawah input
             "Display Name" agar pengguna bisa melihat dan mengedt
              deskripsi mereka.
           * Saya akan menambahkan tombol "Save" atau membuat
             pembaruan terjadi secara otomatis saat fokus input
             hilang (on blur).
       * UI Tampilan Profil: Saya akan memodifikasi komponen yang
         menampilkan detail pengguna (misalnya, GroupInfoPanel.tsx
         atau saat melihat profil pengguna lain) untuk menampilkan
         deskripsi baru ini di bawah nama pengguna.