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

### Saran utama saya adalah mengimplementasikan arsitektur 
  End-to-End Encryption (E2EE) yang sesungguhnya dan menjadikan 
  halaman `/settings/keys` sebagai pusat manajemen keamanan 
  pengguna.

  Ini akan mengubah halaman tersebut dari tidak berguna menjadi
  salah satu fitur paling krusial di aplikasi.

  Bagaimana kita bisa melakukannya?

  Halaman /settings/keys akan menjadi "brankas" digital pengguna,
   dengan fungsi sebagai berikut:

   1. Manajemen Kunci Identitas: Halaman ini akan mengelola kunci 
      privat pengguna, yang merupakan kunci utama untuk semua
      aktivitas enkripsi.
   2. Fitur Backup & Restore Kunci: Pengguna harus bisa mem-backup
      kunci privat mereka yang terenkripsi. Ini sangat penting.
      Tanpa backup, jika pengguna membersihkan cache browser atau
      pindah perangkat, mereka akan kehilangan akses ke semua
      riwayat pesan terenkripsi selamanya. Halaman ini bisa
      menyediakan fitur untuk mengunduh file backup kunci atau
      menampilkan "frasa pemulihan".
   3. Regenerasi Kunci: Memberikan opsi untuk membuat ulang pasann
       kunci (publik/privat) jika pengguna merasa kuncinya bocor.
      Ini akan memicu proses untuk mengenkripsi ulang kunci sesi i
      semua percakapan.
   4. Verifikasi Keamanan (Opsional, tapi sangat baik): Menampilkn
      "kode keamanan" atau "sidik jari" unik dari kunci pengguna,
      yang bisa mereka bandingkan dengan kontak mereka untuk
      memastikan tidak ada serangan man-in-the-middle.

  Langkah Teknisnya:

  Untuk mewujudkan ini, kita perlu melakukan refactor pada logika
  enkripsi:

   1. Hentikan penggunaan kunci dari ID percakapan.
   2. Gunakan arsitektur E2EE yang sudah dirintis: Saat percakapan
      dibuat, hasilkan sebuah "kunci sesi" yang acak.
   3. Enkripsi "kunci sesi" tersebut menggunakan kunci publik dari
      setiap partisipan dalam percakapan.
   4. Simpan atau distribusikan kunci sesi yang terenkripsi ini.
      Setiap pengguna kemudian bisa mendekripsinya menggunakan kui
       privat mereka sendiri.
   5. Gunakan kunci sesi yang sudah didekripsi untuk mengenkripsi
      dan mendekripsi semua pesan dalam percakapan tersebut.

  Kesimpulan:

  Daripada menghapus halaman /settings/keys, saya sangat
  menyarankan untuk menjadikannya inti dari fitur keamanan 
  aplikasi. Ini tidak hanya akan memperbaiki fungsionalitas yang
  rusak, tetapi juga secara dramatis meningkatkan tingkat
  keamanan dan kepercayaan pengguna terhadap Chat-Lite,
  mengubahnya menjadi aplikasi chat E2EE yang sebenarnya.