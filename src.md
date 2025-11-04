# Roadmap Peningkatan Layout & Posisi

Fokus dari roadmap ini adalah untuk melakukan standardisasi dan penyempurnaan tata letak di seluruh aplikasi untuk memastikan pengalaman pengguna yang konsisten, profesional, dan intuitif.

---

### 1. Standardisasi Komponen Modal

**Tujuan:** Memastikan semua jendela modal (`ConfirmModal`, `UserInfoModal`, `CreateGroupChat`, dll.) memiliki struktur, ukuran, dan gaya yang seragam untuk pengalaman pengguna yang prediktif dan profesional.

*   **Masalah:** Setiap modal mungkin saat ini memiliki padding, ukuran judul, dan penempatan tombol yang sedikit berbeda, menciptakan inkonsistensi visual.
*   **Langkah Implementasi:**
    1.  **Buat Komponen `ModalBase.tsx`:** Membuat satu komponen dasar baru yang dapat digunakan kembali. Komponen ini akan menyediakan kerangka standar untuk semua modal, termasuk:
        *   Latar belakang overlay semi-transparan.
        *   Kontainer kartu utama dengan `shadow-card`.
        *   Struktur internal: `Header` (untuk judul & tombol tutup), `Content` (untuk isi modal), dan `Footer` (untuk tombol aksi seperti "OK" atau "Batal").
        *   Animasi masuk dan keluar yang konsisten menggunakan `AnimatePresence`.
    2.  **Refaktor Modal yang Ada:** Memfaktorkan ulang semua komponen modal yang ada untuk menggunakan `ModalBase.tsx` sebagai pembungkusnya. Ini akan secara otomatis menyeragamkan padding, posisi judul, dan perataan tombol di seluruh aplikasi.

### 2. Penataan Ulang Halaman Pengaturan (`Settings`)

**Tujuan:** Mengubah halaman Pengaturan dari daftar opsi sederhana menjadi tata letak berbasis kartu yang bersih, terorganisir, dan mudah dinavigasi.

*   **Masalah:** Halaman Pengaturan mungkin belum memiliki pengelompokan visual yang jelas, sehingga terlihat kurang terstruktur.
*   **Langkah Implementasi:**
    1.  **Audit `SettingsPage.tsx`:** Membaca file tersebut untuk memahami strukturnya saat ini.
    2.  **Kelompokkan Pengaturan ke dalam Kartu:** Mengelompokkan item-item pengaturan yang saling terkait ke dalam "kartu" visual yang terpisah (misalnya, kartu untuk "Akun", "Keamanan", "Tampilan"). Setiap kartu akan memiliki `shadow-soft` dan `rounded-lg`.
    3.  **Buat Layout Item yang Konsisten:** Di dalam setiap kartu, setiap baris pengaturan akan memiliki tata letak yang seragam (misalnya: ikon di kiri, label di tengah, dan tombol/toggle di kanan), disejajarkan dengan rapi menggunakan flexbox.

### 3. Penyempurnaan Tata Letak Utama & Panel Info

**Tujuan:** Melakukan tinjauan akhir pada komponen tata letak utama untuk memastikan semuanya selaras dan memiliki spasi yang benar.

*   **Masalah:** Mungkin masih ada inkonsistensi kecil pada komponen yang belum kita sentuh, seperti `GroupInfoPanel`.
*   **Langkah Implementasi:**
    1.  **Audit `GroupInfoPanel.tsx`:** Menganalisis komponen panel info grup untuk memastikan tata letak daftar peserta, tombol aksi, dan informasinya selaras dengan gaya "Soft Material" yang baru.
    2.  **Tinjauan Spasi Akhir:** Melakukan pemeriksaan terakhir pada komponen `ChatList` dan `ChatWindow` untuk memastikan semua spasi sudah sesuai dengan sistem grid 4px yang kita tuju.
