Kamu sedang mengerjakan proyek web app bernama Chat-Lite. Analisis seluruh struktur dan komponen yang berhubungan dengan UI sidebar (panel kiri tempat daftar percakapan/chat list). Jangan ubah logika, event, state, atau fungsi socket. Fokus hanya pada tampilan (style, layout, warna, animasi, dan keselarasan visual).

🎯 Tujuan:
Perbarui tampilan UI sidebar agar terlihat lebih profesional, modern, dan elegan seperti aplikasi chat premium (misalnya Slack atau Discord). Tetap gunakan tema gelap (dark mode) khas Chat-Lite dengan aksen gradasi ungu ke pink.

---

### 🎨 Desain Sidebar yang Diinginkan

**1. Struktur Utama Sidebar**
- Sidebar menempel di sisi kiri layar, dengan lebar tetap sekitar 300–340px.
- Warna latar belakang: abu gelap kehitaman `#1E1E1E`.
- Gunakan layout berbasis `flex` dengan kolom vertikal yang terdiri dari 3 bagian:
  1. **Bagian Atas:** Profil pengguna dan ikon kontrol.
  2. **Bagian Tengah:** Navigasi tab dan kolom pencarian.
  3. **Bagian Bawah:** Daftar percakapan (chat list).

---

**2. Bagian Profil Pengguna (Header Sidebar)**
- Tampilkan:
  - Avatar pengguna berbentuk lingkaran di kiri.
  - Nama pengguna di kanan avatar, menggunakan font tebal dan warna putih.
  - Status kecil di bawah nama, misalnya “Available” dengan titik hijau kecil.
- Di kanan atas, tampilkan dua ikon kecil:
  - ⚙️ (ikon pengaturan / settings)
  - 🔄 atau ↩️ (ikon logout / keluar)
- Pastikan layout header rapi, berjarak seimbang, dan responsif.
- Gunakan padding sekitar `1rem 1.2rem`.

---

**3. Navigasi Tab**
- Tepat di bawah header, tambahkan tiga tab navigasi horizontal:
  - “Active Now” | “All”
- Tab aktif diberi highlight dengan garis bawah tipis berwarna gradien ungu ke pink.
- Font kecil tapi jelas, uppercase opsional, dengan spacing antar tab seimbang.
- Hover tab menampilkan efek warna halus (sedikit lebih terang).

---

**4. Kolom Pencarian**
- Letakkan satu kolom pencarian di bawah tab.
- Placeholder teks: “Search or start a new chat...”
- Ikon pencarian di sisi kiri dalam input.
- Warna border/input: gradasi ungu-pink atau efek neon tipis.
- **Hapus field pencarian kedua** — cukup satu input saja yang juga berfungsi mencari user atau grup.

---

**5. Daftar Percakapan (Chat List)**
- Setiap item chat berupa card horizontal dengan:
  - Avatar pengguna atau grup di kiri (lingkaran).
  - Di tengah: nama pengguna (teks tebal) dan pesan terakhir (teks abu-abu muda).
  - Di kanan: waktu pesan terakhir.
- Di pojok kanan item, tetap tampilkan tombol menu “⋮” (tiga titik vertikal).
- Jika user sedang online, tampilkan titik hijau kecil di bawah avatar.
- Tambahkan efek hover lembut: latar sedikit lebih terang (misal `rgba(255,255,255,0.05)`).
- Gunakan `border-radius: 12px` pada setiap item untuk tampilan modern.

---

**6. Responsivitas**
- Pastikan sidebar tetap proporsional di layar sedang (tablet) dan kecil (mobile).
- Pada layar kecil:
  - Sidebar bisa di-collapse dengan tombol toggle di kiri atas.
  - Item daftar chat tetap terbaca dengan baik (teks dipotong rapi bila panjang).

---

**7. Warna dan Font**
- Gunakan font sans-serif modern seperti “Inter”, “Poppins”, atau font bawaan Chat-Lite.
- Warna dominan: latar `#1E1E1E`, teks putih/abu terang, aksen ungu ke pink.
- Gradient contoh: dari `#9333EA` (ungu) ke `#EC4899` (pink).

---

**8. Animasi dan Efek**
- Gunakan transisi halus (0.2–0.3s) pada hover atau perubahan tab.
- Efek bayangan lembut untuk memberi kesan kedalaman (`box-shadow` tipis pada item aktif).

---

🧩 Catatan Teknis:
- Jangan ubah fungsi logika chat, socket, state management, atau routing.
- Pastikan event handler seperti klik item chat, menu tiga titik, dan pencarian tetap berjalan normal.
- Setelah perubahan, lakukan validasi internal untuk memastikan tidak ada event yang rusak atau style yang bentrok dengan komponen lain.

---

Output yang diharapkan:
- File CSS/JSX/TSX yang diperbarui agar sidebar tampil modern dan selaras dengan desain deskripsi di atas.
- Tidak ada perubahan di bagian chat room utama atau fitur real-time lainnya.
