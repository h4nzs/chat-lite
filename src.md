# Roadmap Peningkatan UI/UX Chat-Lite

Setelah fondasi fungsional dan keamanan aplikasi solid, fokus selanjutnya adalah memoles tampilan, nuansa, dan pengalaman pengguna (UI/UX) untuk membuat aplikasi tidak hanya berfungsi dengan baik, tetapi juga terasa intuitif dan menyenangkan untuk digunakan.

---

### 1. Evolusi Gaya Visual: "Soft Material" & Hirarki yang Jelas

**Tujuan:** Mengembangkan gaya visual saat ini dari *neumorphism* murni menjadi sesuatu yang lebih jelas, modern, dan aksesibel, dengan tetap mempertahankan estetika yang lembut.

*   **Masalah:** Gaya *neumorphism* murni terkadang sulit dibaca dan kurang aksesibel karena kontras yang rendah. Beberapa elemen interaktif kurang menonjol.
*   **Langkah Implementasi:**
    1.  **Gunakan Lapisan & Bayangan Halus:** Alih-alih efek *inset* (ke dalam), gunakan kartu-kartu yang sedikit terangkat di atas latar belakang. Beri bayangan (shadow) yang sangat halus dan menyebar untuk menciptakan kedalaman yang elegan.
    2.  **Pertegas Warna Aksen:** Gunakan warna aksen secara lebih strategis. Warnai **hanya** elemen aksi utama (misalnya, tombol Kirim, tombol "Chat Baru") dan status aktif (misalnya, percakapan yang sedang dipilih) untuk menjadi pemandu visual bagi pengguna.
    3.  **Konsistensi Tipografi:** Terapkan skala tipografi yang ketat di seluruh aplikasi (misalnya, ukuran font untuk judul, sub-judul, teks isi, dan caption) untuk menciptakan tampilan yang lebih rapi dan profesional.

### 2. Interaksi Mikro & Umpan Balik (Micro-interactions & Feedback)

**Tujuan:** Membuat aplikasi terasa lebih hidup dan responsif dengan memberikan umpan balik visual yang memuaskan atas setiap aksi pengguna.

*   **Masalah:** Aplikasi sudah menggunakan `framer-motion`, tapi bisa dimanfaatkan lebih jauh untuk memberikan "sentuhan ajaib" pada interaksi.
*   **Langkah Implementasi:**
    1.  **Animasi Ikon:** Saat ikon-ikon penting (seperti Kirim, Lampiran, Pengaturan) di-hover atau diklik, berikan animasi halus. Misalnya, ikon bisa sedikit berputar atau membesar.
    2.  **Transisi Status yang Mulus:** Saat berpindah percakapan, buat konten `ChatWindow` yang lama memudar (fade out) dan konten yang baru muncul (fade in) untuk transisi yang lebih nyaman di mata.
    3.  **Animasi Tombol Kirim:** Saat kotak input teks kosong, tombol Kirim berwarna abu-abu. Saat pengguna mulai mengetik, tombol tersebut berubah menjadi warna aksen dengan animasi "pop" yang memuaskan.

### 3. Kepadatan Informasi & Keterbacaan

**Tujuan:** Menyajikan informasi dengan cara yang paling nyaman dan mudah dipindai oleh pengguna, mengurangi kelelahan visual dalam penggunaan jangka panjang.

*   **Masalah:** Tampilan chat sudah fungsional, namun bisa dioptimalkan agar tidak terlalu padat dan lebih mudah dibaca.
*   **Langkah Implementasi:**
    1.  **Terapkan "Spacing System":** Gunakan sistem spasi yang konsisten (misalnya, kelipatan 4px atau 8px) untuk semua `padding` dan `margin`. Ini akan menciptakan ritme visual yang harmonis.
    2.  **Pewarnaan Nama di Grup:** Di dalam chat grup, berikan warna unik yang subtil untuk nama setiap pengirim. Ini akan sangat membantu pengguna untuk dengan cepat membedakan siapa yang berbicara.
    3.  **Perluas Fungsi `DynamicIsland`:** Manfaatkan komponen ini untuk menampilkan status *upload file*, indikator panggilan suara (fitur masa depan), atau konfirmasi "Pesan Terkirim" yang elegan.

### 4. Aksesibilitas (Desain untuk Semua)

**Tujuan:** Memastikan aplikasi dapat digunakan dengan nyaman oleh semua orang, termasuk mereka yang memiliki keterbatasan visual atau menggunakan navigasi keyboard.

*   **Masalah:** Gaya visual saat ini berisiko memiliki kontras rendah dan status fokus untuk navigasi keyboard mungkin kurang jelas.
*   **Langkah Implementasi:**
    1.  **Pemeriksaan Kontras Warna:** Pastikan semua teks dan ikon memenuhi standar kontras WCAG AA terhadap latar belakangnya sebagai bagian dari evolusi ke gaya "Soft Material".
    2.  **Perjelas Status Fokus:** Buat status `:focus` yang jelas dan kustom untuk semua elemen interaktif (tombol, input, link). Gunakan warna aksen untuk membuat cincin fokus (focus ring) yang tebal.
    3.  **Gunakan Atribut ARIA:** Tinjau komponen-komponen kunci dan tambahkan atribut ARIA yang sesuai untuk membantu pengguna *screen reader* (misalnya, `role="log"` untuk daftar pesan).
