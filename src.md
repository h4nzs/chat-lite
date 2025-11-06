# Roadmap Implementasi: "Neumorphism Gradien"

Tujuan dari fase ini adalah untuk mengintegrasikan prinsip-prinsip desain Neumorphism ke dalam UI aplikasi, menciptakan tampilan yang taktil, modern, dan menyatu dengan baik dengan efek "Floating Glass" dan tema gradien "Aurora" yang sudah ada.

---

### **Fase 1: Definisikan Utilitas Bayangan Neumorphic**

**Tujuan:** Membuat kelas utilitas di Tailwind CSS untuk menerapkan efek neumorphism dengan mudah di seluruh aplikasi.

- **Tugas:**
  1.  **Analisis Warna Bayangan:** Untuk setiap warna latar (`--bg-surface`, `--bg-main`), kita perlu mendefinisikan versi yang sedikit lebih gelap dan sedikit lebih terang untuk digunakan sebagai bayangan.
  2.  **Buat Utilitas di `tailwind.config.ts`:**
      - `shadow-neumorphic-convex`: Untuk elemen yang "menonjol". Ini akan menerapkan `box-shadow` dengan dua bayangan (gelap di kanan bawah, terang di kiri atas).
      - `shadow-neumorphic-concave`: Untuk elemen yang "tenggelam". Ini akan menerapkan `box-shadow` inset (bayangan ke dalam).
      - `shadow-neumorphic-pressed`: Varian dari `concave` untuk status tombol saat ditekan.
- **Alasan:** Dengan mendefinisikan ini sebagai utilitas, kita dapat menerapkan gaya yang kompleks dan konsisten hanya dengan menambahkan satu kelas, membuat proses refactoring komponen menjadi cepat dan efisien.

---

### **Fase 2: Refactor Komponen "Tenggelam" (Concave)**

**Tujuan:** Menerapkan efek "tenggelam" pada semua elemen input dan kontainer statis.

- **Tugas:**
  1.  **Input Pesan & Pencarian:** Ubah `MessageInput` dan `Search` bar di `ChatList` untuk menggunakan `shadow-neumorphic-concave`. Latar belakangnya akan dibuat sama dengan latar belakang utama (`bg-main` atau `bg-surface`), dan bentuknya akan diciptakan oleh bayangan ke dalam.
  2.  **Kartu (Cards):** Terapkan efek `concave` pada `SettingsCard` dan kartu utama di halaman `Login`/`Register`. Ini akan membuat mereka terlihat seperti "terukir" di latar belakang.
  3.  **Area Balasan Pesan:** Kontainer yang menampilkan pesan yang sedang dibalas (`ReplyPreview`) juga akan menggunakan gaya `concave`.
- **Alasan:** Ini akan menciptakan hierarki visual di mana elemen interaktif (input) dan kontainer informasi terlihat berbeda dari tombol aksi.

---

### **Fase 3: Refactor Komponen "Menonjol" (Convex)**

**Tujuan:** Menerapkan efek "menonjol" pada semua tombol aksi dan elemen interaktif.

- **Tugas:**
  1.  **Tombol Utama:** Ubah semua tombol (`.btn-primary`, `.btn-secondary`) untuk menggunakan `shadow-neumorphic-convex`. Gradien "Aurora" akan tetap ada di `.btn-primary`, menciptakan efek tombol gradien yang menonjol.
  2.  **Gelembung Pesan (`MessageBubble`):** Terapkan efek `convex` pada gelembung pesan. Ini akan membuat setiap pesan terlihat seperti objek fisik yang lembut di layar.
  3.  **Item Daftar (`ChatItem`):** Berikan `ChatItem` di `ChatList` efek `convex` yang halus. Saat aktif, kita bisa mengubah bayangannya agar terlihat lebih menonjol.
  4.  **Tombol Ikon:** Tombol "Kirim", "Emoji", "File", dan tombol ikon lainnya akan menjadi target utama untuk efek `convex`.
- **Alasan:** Ini akan memberikan umpan balik taktil yang jelas kepada pengguna, di mana tombol-tombol terlihat seolah-olah mereka dapat benar-benar ditekan.

---

### **Fase 4: Status "Pressed" & Transisi**

**Tujuan:** Menyempurnakan interaksi dengan menambahkan status "ditekan" yang memuaskan.

- **Tugas:**
  1.  **Implementasi Status `:active`:** Untuk semua tombol `convex`, saat `:active` (ditekan), ganti `shadow-neumorphic-convex` dengan `shadow-neumorphic-pressed`.
  2.  **Transisi Halus:** Pastikan ada `transition` yang mulus pada properti `box-shadow` sehingga perubahan dari menonjol ke ditekan terasa seperti animasi yang lembut.
- **Alasan:** Umpan balik visual saat menekan tombol sangat penting dalam desain neumorphic untuk meniru interaksi dengan objek fisik.
