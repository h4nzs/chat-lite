# Rekomendasi & Rencana Pengembangan Chat-Lite

Berikut adalah daftar saran, ide, dan rekomendasi untuk perbaikan serta penambahan fitur pada aplikasi Chat-Lite di masa mendatang.

---

### 🚀 Fitur Baru (Major Features)

1.  **Pesan Suara (Voice Messages)**
    *   **Ide:** Menambahkan kemampuan bagi pengguna untuk merekam dan mengirim klip suara pendek, mirip seperti WhatsApp atau Telegram.
    *   **Manfaat:** Meningkatkan ekspresivitas dan memberikan alternatif selain mengetik.

2.  **Panggilan Suara & Video (Voice/Video Calls)**
    *   **Ide:** Mengintegrasikan fungsionalitas panggilan peer-to-peer (P2P) menggunakan teknologi WebRTC.
    *   **Manfaat:** Mengubah Chat-Lite menjadi platform komunikasi yang lebih lengkap.

3.  **Status Pengguna Kustom (Custom User Status)**
    *   **Ide:** Memungkinkan pengguna untuk mengatur status kustom (misalnya: "Sedang rapat", "Sedang liburan") selain hanya status "Online/Offline".
    *   **Manfaat:** Memberikan lebih banyak konteks tentang ketersediaan pengguna.

4.  **Integrasi GIF & Stiker**
    *   **Ide:** Menambahkan tombol untuk mencari dan mengirim GIF (misalnya via integrasi API Giphy) atau stiker kustom.
    *   **Manfaat:** Menambah elemen keseruan dalam percakapan.

---

### ✨ Peningkatan UI/UX (UI/UX Enhancements)

1.  **Edit Pesan Terkirim**
    *   **Ide:** Memberikan opsi bagi pengguna untuk mengedit pesan yang sudah mereka kirim (misalnya dalam batas waktu 5 menit).
    *   **Manfaat:** Fitur standar di aplikasi chat modern yang sangat berguna untuk memperbaiki kesalahan ketik.

2.  **UI Balasan Pesan yang Lebih Baik (Improved Reply UI)**
    *   **Ide:** Saat sebuah pesan merupakan balasan, tampilkan kutipan pesan asli yang lebih interaktif. Jika diklik, scroll ke pesan asli tersebut.
    *   **Manfaat:** Mempermudah mengikuti alur percakapan yang kompleks.

3.  **Pencarian Pesan di Sisi Server (Server-Side Search)**
    *   **Ide:** Mengganti pencarian pesan saat ini (yang hanya memfilter pesan yang sudah dimuat) dengan pencarian berbasis API yang mencari di seluruh riwayat percakapan.
    *   **Manfaat:** Memberikan hasil pencarian yang lengkap dan akurat.

4.  **Indikator Progres Upload File**
    *   **Ide:** Menampilkan bar atau persentase progres saat pengguna mengunggah file berukuran besar.
    *   **Manfaat:** Memberikan feedback visual dan meningkatkan pengalaman pengguna saat mengirim file.

5.  **Drag & Drop untuk Upload File**
    *   **Ide:** Memungkinkan pengguna untuk menyeret file dari desktop mereka langsung ke jendela chat untuk mengunggahnya.
    *   **Manfaat:** Mempercepat dan mempermudah alur pengiriman file.

---

### ⚡️ Peningkatan Real-time & Performa

1.  **Status "Telah Dibaca oleh..." (Read by...)**
    *   **Ide:** Di chat grup, tampilkan siapa saja yang sudah membaca pesan, tidak hanya status "telah dibaca" secara umum.
    *   **Manfaat:** Memberikan informasi yang lebih detail dan berguna dalam percakapan grup.

2.  **Indikator Pengetikan Grup yang Lebih Cerdas**
    *   **Ide:** Jika lebih dari satu orang sedang mengetik di grup, tampilkan pesan seperti "Beberapa orang sedang mengetik..." atau "User A, User B, dan User C sedang mengetik...".
    *   **Manfaat:** Mengurangi "noise" visual di grup yang aktif.

3.  **Penanda Pesan Belum Dibaca (Unread Message Marker)**
    *   **Ide:** Saat membuka chat yang memiliki pesan baru, tampilkan sebuah garis pemisah bertuliskan "Pesan Baru" di atas pesan pertama yang belum dibaca.
    *   **Manfaat:** Membantu pengguna dengan cepat menemukan titik di mana mereka terakhir kali membaca.

---

### 🛡️ Peningkatan Backend & Keamanan

1.  **Verifikasi Kunci Enkripsi (E2EE Key Verification)**
    *   **Ide:** Menambahkan fitur di mana dua pengguna dapat memverifikasi identitas satu sama lain dengan memindai kode QR atau membandingkan string keamanan.
    *   **Manfaat:** Meningkatkan kepercayaan dan keamanan dalam komunikasi end-to-end encryption.

2.  **Penambahan Unit & Integration Test**
    *   **Ide:** Menulis lebih banyak pengujian otomatis untuk backend (API & logika socket) dan frontend (interaksi komponen & state).
    *   **Manfaat:** Meningkatkan stabilitas aplikasi, mencegah regresi (bug lama muncul kembali), dan mempermudah refactoring di masa depan.
