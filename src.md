# Roadmap Peningkatan UI/UX

Dokumen ini menguraikan rencana untuk meningkatkan antarmuka pengguna (UI) dan pengalaman pengguna (UX) aplikasi agar lebih modern, profesional, dan menyenangkan untuk digunakan. Fondasi aplikasi sudah baik, dan sekarang kita akan fokus pada lapisan "poles".

---

## 1. Membangun Sistem Desain yang Konsisten

Tujuan: Menciptakan tampilan yang kohesif dan konsisten di seluruh aplikasi.

- **[ ] Definisikan Palet Warna Profesional:**
  - **Tugas:** Tinjau dan perbarui `tailwind.config.ts`. Definisikan palet warna yang jelas untuk mode terang dan gelap, termasuk warna primer (aksen), sekunder, latar belakang (utama, permukaan), teks (primer, sekunder), dan border.
  - **Alasan:** Konsistensi warna adalah fondasi dari desain yang baik dan meningkatkan keterbacaan.

- **[ ] Standarisasi Tipografi:**
  - **Tugas:** Tetapkan skala tipografi yang jelas untuk berbagai elemen teks (judul halaman, nama di daftar obrolan, isi pesan, label tombol). Tentukan ukuran font, ketebalan (font-weight), dan tinggi baris (line-height).
  - **Alasan:** Tipografi yang konsisten meningkatkan hierarki visual dan membuat konten lebih mudah dibaca.

- **[ ] Terapkan Skala Spasi (Spacing Scale):**
  - **Tugas:** Gunakan skala spasi yang konsisten (misalnya, kelipatan 4px atau 8px) untuk semua `margin`, `padding`, dan `gap`. Ini dapat dikonfigurasi di `tailwind.config.ts`.
  - **Alasan:** Menciptakan ritme visual yang teratur dan membuat tata letak terlihat lebih rapi dan terstruktur.

---

## 2. Mendesain Ulang Komponen Kunci

Tujuan: Membuat komponen inti lebih menarik secara visual dan lebih informatif.

- **[ ] `ChatItem` (Item dalam Daftar Obrolan):**
  - **Tugas:** Desain ulang tampilan setiap item. Pertimbangkan untuk menggunakan gradien halus atau bayangan untuk item yang aktif. Tambahkan efek `hover` yang lebih terlihat. Buat indikator "belum dibaca" lebih menonjol.
  - **Alasan:** Memudahkan pengguna untuk memindai daftar obrolan mereka dan menemukan percakapan yang relevan dengan cepat.

- **[ ] `MessageBubble` (Gelembung Pesan):**
  - **Tugas:** Perhalus tampilan gelembung pesan. Tambahkan "ekor" pada gelembung untuk menunjukkan arah pesan. Perbaiki spasi di dalam gelembung dan tingkatkan tampilan status pesan (terkirim, dibaca).
  - **Alasan:** Meningkatkan estetika inti dari aplikasi obrolan dan kejelasan status pesan.

- **[ ] `ChatWindow` (Jendela Obrolan):**
  - **Tugas:** Desain ulang header `ChatWindow` agar lebih menarik, mungkin dengan menyatukan avatar dan nama dengan lebih baik. Tambahkan latar belakang yang halus (subtle pattern atau gradien) pada area obrolan.
  - **Alasan:** Membuat area interaksi utama lebih menarik secara visual.

- **[ ] Formulir & Tombol:**
  - **Tugas:** Standarisasi tampilan semua tombol (primer, sekunder, destruktif) dan input field. Pastikan status `hover`, `focus`, dan `disabled` terlihat jelas dan konsisten.
  - **Alasan:** Meningkatkan kegunaan dan memberikan umpan balik visual yang jelas kepada pengguna.

---

## 3. Menambahkan Interaksi Mikro & Animasi

Tujuan: Membuat aplikasi terasa lebih hidup, responsif, dan modern.

- **[ ] Transisi Halus:**
  - **Tugas:** Terapkan `transition` CSS pada semua elemen interaktif (tombol, tautan, input) untuk perubahan warna dan bayangan yang mulus saat hover atau focus.
  - **Alasan:** Memberikan pengalaman yang lebih halus dan profesional.

- **[ ] Animasi dengan `framer-motion`:**
  - **Tugas:** Manfaatkan `framer-motion` (yang sudah menjadi dependensi) untuk menambahkan animasi yang berarti:
    - Animasi `layout` saat daftar obrolan diurutkan ulang.
    - Animasi `fade-in` dan `slide-up` saat pesan baru muncul.
    - Animasi `scale` dan `fade` saat modal muncul dan menghilang.
    - Animasi saat sidebar mobile terbuka dan tertutup.
  - **Alasan:** Meningkatkan UX secara signifikan dengan memberikan umpan balik visual yang dinamis dan memandu perhatian pengguna.

---

## 4. Peningkatan Aksesibilitas (a11y)

Tujuan: Memastikan aplikasi dapat digunakan oleh sebanyak mungkin orang.

- **[ ] Status Fokus yang Jelas:**
  - **Tugas:** Pastikan semua elemen interaktif (tombol, input, tautan) memiliki indikator fokus yang jelas (misalnya, cincin fokus atau outline) saat dinavigasi menggunakan keyboard. Gunakan `focus-visible` dari Tailwind.
  - **Alasan:** Penting untuk pengguna yang mengandalkan navigasi keyboard.

- **[ ] Kontras Warna:**
  - **Tugas:** Setelah palet warna baru didefinisikan, periksa kembali rasio kontras antara teks dan latar belakang untuk memastikan keterbacaan, terutama untuk teks sekunder.
  - **Alasan:** Membantu pengguna dengan gangguan penglihatan untuk menggunakan aplikasi dengan nyaman.
