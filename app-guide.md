# Panduan Pengembangan & Peta Jalan Fitur Aplikasi Chat-Lite

Dokumen ini berisi ide, saran, dan rekomendasi untuk fitur-fitur baru yang dapat ditambahkan ke aplikasi Chat-Lite. Tujuannya adalah untuk memberikan peta jalan yang jelas untuk pengembangan selanjutnya, membangun di atas fondasi aplikasi yang sudah solid.

---

### Konteks: Status Aplikasi Saat Ini

Aplikasi Chat-Lite telah mencapai tingkat stabilitas dan kualitas kode yang tinggi. Fondasi utamanya meliputi:
- Chat pribadi dan grup yang fungsional.
- Enkripsi End-to-End (E2EE).
- Pengiriman file, status online, dan indikator pengetikan.
- Penanganan error yang baik dan UI yang telah di-refactor.

Fitur-fitur berikut direkomendasikan untuk meningkatkan pengalaman pengguna, utilitas, dan daya saing aplikasi.

---

## 1. Fitur Prioritas Utama (Must-Have)

Fitur-fitur ini dianggap esensial untuk aplikasi chat modern dan akan memberikan peningkatan nilai yang paling signifikan bagi pengguna.

### a. Jumlah Pesan Belum Dibaca (Unread Message Count)

*   **Mengapa Ini Penting?**
    Ini adalah standar UX fundamental. Pengguna perlu tahu secara sekilas percakapan mana yang memiliki pesan baru yang belum mereka lihat. Fitur ini secara drastis meningkatkan keterlibatan pengguna dan efisiensi komunikasi.

*   **Rencana Implementasi:**
    1.  **Backend:** Modifikasi endpoint `GET /api/conversations`. Untuk setiap percakapan, hitung jumlah pesan yang memiliki `createdAt` lebih baru dari `lastReadMsgId` milik pengguna saat ini (data `lastReadMsgId` sudah ada di model `Participant`). Sertakan `unreadCount` ini dalam data yang dikirim ke klien.
    2.  **Frontend:** Di komponen `ChatList.tsx`, saat me-render setiap item percakapan, tampilkan `unreadCount` sebagai *badge* (lencana) notifikasi. Hilangkan badge ini saat pengguna membuka percakapan tersebut.
    3.  **Real-time Update:** Saat pesan baru diterima melalui socket (`message:new`) di percakapan yang tidak aktif, `useChatStore` harus secara dinamis menambah `unreadCount` di state.

### b. Pencarian Pesan (Message Search)

*   **Mengapa Ini Penting?**
    Seiring waktu, percakapan akan berisi informasi penting. Tanpa fungsi pencarian, menemukan kembali informasi tersebut menjadi tidak mungkin. Ini adalah fitur utilitas murni yang sangat dibutuhkan.

*   **Rencana Implementasi:**
    1.  **Backend:** Buat endpoint baru, misalnya `GET /api/messages/search?q=<query>&conversationId=<id>`. Endpoint ini akan melakukan pencarian teks (misalnya menggunakan `contains` atau fitur Full-Text Search dari PostgreSQL) pada model `Message`, yang terbatas pada satu percakapan.
    2.  **Frontend:** Tambahkan ikon dan input pencarian di dalam `ChatHeader.tsx`. Saat pengguna melakukan pencarian, panggil API baru tersebut. Hasilnya dapat ditampilkan dalam sebuah modal atau dengan menyorot pesan yang cocok di dalam `ChatWindow`.

---

## 2. Fitur Peningkatan Penting (Should-Have)

Fitur-fitur ini akan secara signifikan memperkaya pengalaman pengguna dan menambahkan lapisan personalisasi yang penting.

### a. Kustomisasi Profil Pengguna (Avatar & Status)

*   **Mengapa Ini Penting?**
    Memberi pengguna kemampuan untuk mempersonalisasi profil mereka (terutama gambar profil) adalah kunci untuk menciptakan rasa memiliki dan identitas di dalam aplikasi. Saat ini, avatar dibuat secara otomatis.

*   **Rencana Implementasi:**
    1.  **Backend:** Buat endpoint `POST /api/users/me/avatar` yang menerima unggahan gambar, memprosesnya (misalnya resize), dan menyimpan URL-nya di `avatarUrl` pada model `User`. Buat juga endpoint `PUT /api/users/me` untuk memperbarui detail lain seperti nama atau status.
    2.  **Frontend:** Buat halaman atau modal `Settings` baru. Tambahkan komponen untuk memilih dan mengunggah gambar profil, serta form untuk mengubah nama. Perbarui `useAuthStore` untuk menangani logika ini.

### b. Pratinjau Gambar & Media (Image & Media Previews)

*   **Mengapa Ini Penting?**
    Saat ini, lampiran file hanya ditampilkan sebagai link. Menampilkan pratinjau gambar secara langsung di dalam chat adalah pengalaman yang jauh lebih baik dan sesuai dengan ekspektasi pengguna dari aplikasi chat modern.

*   **Rencana Implementasi:**
    1.  **Frontend:** Modifikasi komponen `MessageItem.tsx`. Jika objek pesan berisi `imageUrl` (atau `fileUrl` dengan `fileType` gambar), render komponen `LazyImage.tsx` (yang sudah ada di proyek) untuk menampilkan gambar tersebut, bukan hanya teks.
    2.  **Lightbox:** Implementasikan *lightbox* sederhana. Saat pengguna mengklik pratinjau gambar, gambar tersebut akan ditampilkan dalam layar penuh (fullscreen overlay) untuk pengalaman melihat yang lebih baik.

---

## 3. Fitur Jangka Panjang (Nice-to-Have)

Fitur-fitur ini lebih kompleks tetapi akan membedakan aplikasi Anda dan mempersiapkannya untuk masa depan.

### a. Status Pesan Terbaca (Read Receipts)

*   **Mengapa Ini Penting?**
    Memberikan kepastian kepada pengirim bahwa pesan mereka tidak hanya terkirim tetapi juga telah dilihat oleh penerima. Ini adalah fitur standar di aplikasi seperti WhatsApp dan Telegram.

*   **Rencana Implementasi:**
    1.  **Database:** Model `MessageStatus` sudah ada dengan enum `READ`. Ini adalah fondasi yang bagus.
    2.  **Backend:** Buat event socket baru dari klien, misalnya `message:mark_as_read`, yang membawa `messageId`.
    3.  **Frontend:** Di `ChatWindow`, saat sebuah `MessageItem` masuk ke dalam viewport (bisa dideteksi dengan `Intersection Observer API`), panggil event `message:mark_as_read`.
    4.  **UI:** Di `MessageItem.tsx`, tampilkan ikon centang yang berbeda (misalnya, dua centang biru) jika status pesan adalah `READ`.
    5.  **Privasi:** Sebagai pengembangan lanjutan, tambahkan opsi di pengaturan bagi pengguna untuk menonaktifkan pengiriman *read receipts*.

### b. Balas Pesan (Reply to Message)

*   **Mengapa Ini Penting?**
    Dalam percakapan grup yang ramai, fitur balas sangat penting untuk menjaga konteks. Ini memungkinkan pengguna untuk merespons pesan tertentu secara langsung.

*   **Rencana Implementasi:**
    1.  **Database:** Tambahkan relasi opsional pada model `Message`, misalnya `repliedToId: String?` yang merujuk ke `id` pesan lain.
    2.  **Frontend:** Di `MessageItem.tsx`, tambahkan tombol "Reply" (misalnya di menu dropdown). Saat diklik, UI di `MessageInput` akan menampilkan kutipan pesan yang akan dibalas. Saat mengirim, `repliedToId` disertakan dalam payload `message:send`.
    3.  **UI:** Di `MessageItem.tsx`, jika sebuah pesan memiliki `repliedToId`, render kutipan kecil dari pesan asli di atas konten pesan balasan tersebut.
