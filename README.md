# Chat-Lite 💬

[](https://opensource.org/licenses/MIT)
[](https://react.dev/)
[](https://nodejs.org/)
[](https://www.prisma.io/)
[](https://socket.io/)

Aplikasi web chat *real-time* modern yang dibangun dengan tumpukan teknologi terkini untuk komunikasi yang cepat dan efisien. Chat-Lite menawarkan pengalaman chatting yang aman dengan enkripsi end-to-end dan berbagai fitur canggih lainnya.

## ✨ Fitur Utama

  - **Otentikasi Aman**: Sistem login dan registrasi menggunakan JWT (JSON Web Tokens) dengan *access token* dan *refresh token* yang disimpan dalam cookie `httpOnly` untuk keamanan maksimal.
  - **Real-Time Chat**: Komunikasi instan antar pengguna menggunakan **Socket.IO** untuk pengalaman percakapan yang mulus.
  - **Percakapan Pribadi**: Pengguna dapat memulai percakapan satu lawan satu dengan pengguna lain yang terdaftar.
  - **Riwayat Pesan**: Semua pesan disimpan dalam database dan dapat diakses kembali kapan saja.
  - **Antarmuka Responsif**: Didesain agar berfungsi dengan baik di perangkat desktop maupun mobile.
  - **Enkripsi End-to-End**: Pesan dienkripsi menggunakan **libsodium** sebelum dikirim dan hanya dapat dibaca oleh penerima yang dituju. Menggunakan kunci enkripsi per percakapan untuk memastikan keamanan komunikasi.
  - **Reaksi Pesan**: Pengguna dapat menambahkan reaksi emoji ke pesan dengan cepat menggunakan tombol reaksi. Mendukung berbagai emoji umum dan menampilkan jumlah pengguna yang memberikan reaksi yang sama pada sebuah pesan.
  - **Status Pesan**: Indikator status pesan (terkirim, terkirim ke server, dibaca) memberikan informasi real-time tentang status pesan. Pengguna dapat melihat kapan pesan mereka telah dibaca oleh penerima.
  - **Tema Gelap & Terang**: Dukungan untuk tema gelap dan terang yang dapat dialihkan sesuai preferensi pengguna. Menggunakan Tailwind CSS dengan mode gelap yang dikonfigurasi untuk memberikan pengalaman pengguna yang nyaman dalam berbagai kondisi pencahayaan.
  - **Upload File & Gambar**: Kemampuan untuk mengirim file dan gambar dalam percakapan. File yang diunggah disimpan di server dan diakses melalui URL yang aman. Mendukung berbagai format gambar (PNG, JPG, GIF, WebP) dan file dokumen.

  - **Notifikasi Push**: Notifikasi push untuk pesan baru bahkan saat aplikasi tidak aktif (dengan dukungan service worker). Menggunakan Web Push API untuk mengirim notifikasi ke perangkat pengguna.
  - **Indikator Online/Offline**: Status ketersediaan pengguna secara real-time untuk menunjukkan kapan pengguna online atau offline. Menggunakan koneksi Socket.IO untuk melacak status koneksi pengguna.

-----

## 🛠️ Tumpukan Teknologi (Tech Stack)

Arsitektur proyek ini dibagi menjadi dua bagian utama: frontend dan backend.

#### **Frontend**

  - **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
  - **Manajemen State**: [Zustand](https://github.com/pmndrs/zustand)
  - **Komunikasi Real-Time**: [Socket.IO Client](https://socket.io/docs/v4/client-api/)
  - **Styling**: [Tailwind CSS](https://tailwindcss.com/)
  - **Routing**: [React Router](https://reactrouter.com/)
  - **Notifikasi**: [React Hot Toast](https://react-hot-toast.com/)
  - **Virtualisasi**: [React Window](https://github.com/bvaughn/react-window)
  - **Enkripsi**: [Libsodium](https://github.com/jedisct1/libsodium.js)
  - **Pengujian**: [Vitest](https://vitest.dev/) dan [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

#### **Backend**

  - **Framework**: [Express.js](https://expressjs.com/)
  - **ORM**: [Prisma](https://www.prisma.io/)
  - **Database**: PostgreSQL
  - **Otentikasi**: JSON Web Tokens (`jsonwebtoken`) & `cookie-parser`
  - **Komunikasi Real-Time**: [Socket.IO Server](https://socket.io/docs/v4/server-api/)
  - **Enkripsi**: [Libsodium](https://github.com/jedisct1/libsodium)
  - **Validasi**: [Zod](https://zod.dev/)
  - **Keamanan**: [Helmet](https://helmetjs.github.io/), [CORS](https://github.com/expressjs/cors), Rate Limiting
  - **Upload File**: [Multer](https://github.com/expressjs/multer)
  - **Pengujian**: [Jest](https://jestjs.io/) dan [Supertest](https://github.com/visionmedia/supertest)
  - **Bahasa**: TypeScript

-----

## 🔐 Enkripsi dengan Libsodium

Chat-Lite menggunakan pustaka [Libsodium](https://github.com/jedisct1/libsodium) untuk enkripsi end-to-end pesan. Setiap pesan dienkripsi sebelum dikirim ke server dan hanya dapat didekripsi oleh penerima yang dituju. Ini memastikan bahwa bahkan jika data tersimpan di server dilanggar, isi pesan tetap aman dan tidak dapat dibaca oleh pihak yang tidak berwenang.

## 🧩 Prisma ORM

Proyek ini menggunakan [Prisma](https://www.prisma.io/) sebagai Object-Relational Mapping (ORM) untuk berinteraksi dengan database PostgreSQL. Prisma menyediakan pendekatan type-safe untuk akses database dengan skema yang didefinisikan dalam file `schema.prisma`, yang memungkinkan migrasi database yang andal dan autocompletion yang kuat saat menulis kueri database.

## 🗄️ Struktur Database

Proyek ini menggunakan PostgreSQL dengan Prisma sebagai ORM. Struktur database mencakup beberapa model utama:

- **User**: Menyimpan informasi pengguna termasuk kredensial, nama, dan metadata lainnya
- **Conversation**: Mewakili percakapan antara pengguna (bisa satu lawan satu atau grup)
- **Participant**: Menghubungkan pengguna dengan percakapan tempat mereka berpartisipasi
- **Message**: Menyimpan konten pesan, metadata pengirim, dan referensi ke percakapan
- **MessageStatus**: Melacak status pengiriman dan pembacaan pesan
- **MessageReaction**: Menyimpan reaksi emoji yang diberikan pengguna terhadap pesan
- **RefreshToken**: Mengelola token refresh untuk autentikasi berkelanjutan

## 🔐 Keamanan

Keamanan adalah prioritas utama dalam Chat-Lite:

- **Enkripsi End-to-End**: Pesan dienkripsi menggunakan pustaka libsodium sebelum dikirim dan hanya dapat didekripsi oleh penerima yang dituju
- **Autentikasi JWT**: Menggunakan JSON Web Tokens dengan access token dan refresh token yang disimpan dalam cookie httpOnly untuk mencegah serangan XSS. Token diperbarui secara otomatis menggunakan mekanisme refresh token.
- **Keamanan HTTP**: Menggunakan Helmet untuk melindungi aplikasi dari kerentanan web yang diketahui
- **Rate Limiting**: Mencegah penyalahgunaan API dengan membatasi jumlah permintaan
- **Validasi Input**: Menggunakan Zod untuk memvalidasi dan membersihkan input pengguna
- **CORS Protection**: Mengonfigurasi kebijakan berbagi sumber daya lintas asal dengan benar

### **1. Klon Repositori**

```bash
git clone https://github.com/h4nzs/chat-lite.git
cd chat-lite
```

### **2. Setup Backend**

```bash
# Pindah ke direktori backend
cd server

# Install dependencies
pnpm install

# Buat file .env dan salin dari .env.example
cp .env.example .env
```

Isi variabel lingkungan di dalam berkas `.env` dengan kredensial database dan rahasia JWT Anda.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
JWT_SECRET="rahasia-jwt-anda"
JWT_REFRESH_SECRET="rahasia-jwt-refresh-anda"
```

Terapkan skema database menggunakan Prisma:

```bash
# Terapkan migrasi ke database
pnpm prisma migrate dev

# (Opsional) Buka Prisma Studio untuk melihat data
pnpm prisma studio
```

Jalankan server backend:

```bash
pnpm dev
```

Server akan berjalan di `http://localhost:4000` (atau port yang Anda tentukan).

### **3. Setup Frontend**

```bash
# Pindah ke direktori frontend
cd ../web

# Install dependencies
pnpm install

# Buat file .env dan salin dari .env.example
cp .env.example .env
```

Pastikan variabel di dalam `.env` frontend menunjuk ke URL backend yang benar.

```env
VITE_API_URL=http://localhost:4000
VITE_WS_URL=http://localhost:4000
```

Jalankan aplikasi React:

```bash
pnpm dev
```

Aplikasi akan dapat diakses di `http://localhost:5173`.

## 🧪 Pengujian

Proyek ini mencakup pengujian untuk memastikan kualitas dan keandalan kode:

### Backend Testing

```bash
# Jalankan pengujian backend
cd server
pnpm test
```

### Frontend Testing

```bash
# Jalankan pengujian frontend
cd ../web
pnpm test
```

Pengujian mencakup unit test untuk fungsi penting, integrasi API, dan komponen UI untuk memastikan aplikasi berfungsi dengan benar.

## ⚠️ Penanganan Error

Aplikasi ini dilengkapi dengan sistem penanganan error yang komprehensif:

- **Error boundary** di React untuk mencegah crash UI
- **Validasi input** di frontend dan backend
- **Penanganan error jaringan** dengan retry otomatis
- **Logging error** untuk debugging
- **Notifikasi pengguna** yang ramah untuk error umum

## 🚀 Development Server

Untuk menjalankan kedua server (frontend dan backend) secara bersamaan, Anda dapat menggunakan script yang disediakan:

```bash
# Jalankan script development
./start-dev.sh
```

Script ini akan menjalankan server backend di port 4000 dan frontend di port 5173 secara bersamaan.

## 🌍 Environment Variables

Proyek ini menggunakan environment variables untuk konfigurasi. Salin file `.env.example` menjadi `.env` di masing-masing direktori (`server` dan `web`) dan sesuaikan nilai-nilai sesuai dengan lingkungan Anda.

### Backend Environment Variables (server/.env)

- `DATABASE_URL`: URL koneksi ke database PostgreSQL
- `JWT_SECRET`: Rahasia untuk menandatangani JWT access token
- `JWT_REFRESH_SECRET`: Rahasia untuk menandatangani JWT refresh token
- `PORT`: Port untuk menjalankan server (default: 4000)
- `CORS_ORIGIN`: Origin yang diizinkan untuk CORS (default: http://localhost:5173)
- `UPLOAD_DIR`: Direktori untuk menyimpan file upload (default: uploads)

### Frontend Environment Variables (web/.env)

- `VITE_API_URL`: URL ke backend API (default: http://localhost:4000)
- `VITE_WS_URL`: URL ke WebSocket server (default: http://localhost:4000)

## ☁️ Deployment

Untuk deployment produksi, Anda perlu:

1. **Mengatur Environment Variables**:
   - Sesuaikan semua environment variables untuk lingkungan produksi
   - Gunakan rahasia yang kuat untuk `JWT_SECRET` dan `JWT_REFRESH_SECRET`
   - Konfigurasi `CORS_ORIGIN` dengan domain produksi Anda

2. **Migrasi Database**:
   ```bash
   cd server
   pnpm prisma migrate deploy
   ```

3. **Build Aplikasi**:
   ```bash
   # Build frontend
   cd ../web
   pnpm build
   
   # Build backend (jika diperlukan)
   cd ../server
   pnpm build
   ```

4. **Menjalankan dalam Produksi**:
   ```bash
   # Jalankan server backend
   cd server
   pnpm start
   
   # Serv file frontend dengan server web (nginx, apache, dll.)
   ```

## 🚀 Performa dan Optimasi

Chat-Lite dirancang dengan mempertimbangkan performa dan pengalaman pengguna:

- **Virtualisasi daftar pesan** menggunakan React Window untuk rendering efisien ribuan pesan
- **Caching agresif** untuk data pengguna dan percakapan
- **Pagination** untuk riwayat pesan dan daftar percakapan
- **Optimistic updates** untuk pengalaman pengguna yang responsif
- **Bundle splitting** untuk pemuatan halaman yang cepat
- **Komponen yang dimemoisasi** untuk mencegah render ulang yang tidak perlu
- **WebSocket connection pooling** untuk koneksi real-time yang efisien
- **Lazy loading** untuk komponen dan fitur yang tidak segera digunakan
- **Image optimization** untuk gambar yang diunggah
- **Database indexing** untuk query yang cepat

## 📈 Skalabilitas

Arsitektur Chat-Lite mendukung skalabilitas horizontal dan vertikal:

- **Microservices-ready** dengan pemisahan jelas antara frontend dan backend
- **Database connection pooling** untuk menangani banyak koneksi
- **WebSocket clustering** untuk mendukung banyak instance server
- **Load balancing** kompatibel untuk deployment skala besar
- **Caching layer** (Redis) dapat dengan mudah diintegrasikan
- **CDN-friendly** untuk aset statis
- ** Stateless architecture** untuk deployment yang mudah di lingkungan cloud

## 📝 Lisensi

Proyek ini dilisensikan di bawah **Lisensi MIT**. Lihat berkas `LICENSE` untuk detail lebih lanjut.

## 👥 Komunitas dan Dukungan

Jika Anda memiliki pertanyaan, masalah, atau ingin berkontribusi pada proyek ini:

- Buka issue di [GitHub Issues](https://github.com/h4nzs/chat-lite/issues) untuk melaporkan bug atau meminta fitur
- Bergabung dengan diskusi di [GitHub Discussions](https://github.com/h4nzs/chat-lite/discussions) untuk berdialog dengan komunitas
- Ikuti [@h4nzs](https://github.com/h4nzs) untuk pembaruan proyek
- Baca [dokumentasi lengkap](https://github.com/h4nzs/chat-lite/wiki) untuk panduan lebih detail

## 🔧 Troubleshooting

Berikut adalah beberapa masalah umum dan solusinya:

### Masalah Koneksi Database
- Pastikan PostgreSQL berjalan dan kredensial di `.env` benar
- Periksa apakah pengguna database memiliki izin yang cukup
- Verifikasi bahwa port database (default: 5432) tidak diblokir firewall

### Masalah Autentikasi
- Jika mengalami masalah login, coba hapus cookie browser
- Pastikan `JWT_SECRET` dan `JWT_REFRESH_SECRET` telah diatur dengan benar
- Periksa konsol browser untuk error CORS jika ada masalah dengan cookie

### Masalah WebSocket
- Periksa apakah koneksi WebSocket terbentuk dengan melihat log server
- Pastikan `VITE_WS_URL` diatur dengan benar di lingkungan frontend
- Jika menggunakan reverse proxy, pastikan konfigurasi WebSocket proxy benar

### Masalah Upload File
- Periksa izin direktori `uploads` di server
- Pastikan ukuran file tidak melebihi batas maksimum (5MB)
- Verifikasi bahwa tipe file yang diunggah didukung (PNG, JPG, GIF, WebP)

### Masalah Performa
- Untuk aplikasi dengan banyak pengguna, pertimbangkan untuk menambahkan caching (Redis)
- Periksa query database yang lambat menggunakan Prisma Studio
- Optimalkan index database untuk query yang sering digunakan

## 📜 Changelog

Untuk informasi tentang perubahan versi terbaru, lihat [CHANGELOG.md](CHANGELOG.md).

## 🤝 Kontribusi

Kontribusi sangat dihargai! Untuk berkontribusi pada proyek ini:

1. Fork repositori ini
2. Buat branch fitur Anda (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan Anda (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buka Pull Request

Pastikan untuk menjalankan pengujian sebelum mengirimkan pull request.

### Dukungan

Jika Anda menemukan proyek ini berguna, pertimbangkan untuk:

- Memberikan bintang di GitHub
- Menyebarkan proyek ini ke orang lain
- Berkontribusi pada kode atau dokumentasi
- [Menjadi sponsor](https://github.com/sponsors/h4nzs) untuk mendukung pengembangan berkelanjutan

## 🗺️ Roadmap

Berikut adalah beberapa fitur yang direncanakan untuk pengembangan masa depan:

- **Percakapan Grup**: Dukungan untuk percakapan dengan lebih dari dua orang
- **Panggilan Video/Audio**: Komunikasi real-time melalui video dan audio
- **Integrasi Bot**: Dukungan untuk bot percakapan otomatis
- **Pencarian Pesan**: Kemampuan untuk mencari pesan dalam riwayat percakapan
- **Emoji dan Stiker**: Dukungan yang lebih luas untuk emoji dan stiker
- **Penyebutan Pengguna**: Notifikasi khusus ketika pengguna disebut dalam pesan
- **Arsip Percakapan**: Kemampuan untuk mengarsipkan percakapan yang tidak aktif
- **Mode Jangan Ganggu**: Kontrol notifikasi yang lebih granular
- **Sinkronisasi Antar Perangkat**: Dukungan untuk beberapa perangkat aktif secara bersamaan
- **Ekspor Data**: Kemampuan untuk mengekspor riwayat percakapan

## 📁 Struktur Proyek

```
chat-lite/
├── server/                 # Backend Express.js dengan Prisma
│   ├── prisma/             # Skema database dan migrasi Prisma
│   ├── src/                # Kode sumber backend
│   │   ├── routes/         # Endpoint API
│   │   ├── middleware/     # Middleware Express
│   │   ├── lib/            # Library dan utilitas
│   │   ├── utils/          # Fungsi utilitas
│   │   └── index.ts        # Entry point aplikasi
│   ├── tests/              # Pengujian backend
│   └── uploads/            # Direktori untuk file upload
├── web/                    # Frontend React dengan Vite
│   ├── src/                # Kode sumber frontend
│   │   ├── components/     # Komponen React
│   │   ├── pages/          # Halaman aplikasi
│   │   ├── store/          # State management (Zustand)
│   │   ├── lib/            # Library dan utilitas
│   │   ├── utils/          # Fungsi utilitas
│   │   └── App.tsx         # Komponen aplikasi utama
│   ├── public/             # File publik
│   └── tests/              # Pengujian frontend
├── start-dev.sh            # Script untuk menjalankan development server
└── README.md               # Dokumentasi proyek ini
```

## 🌟 Kesimpulan

Chat-Lite adalah aplikasi chat modern yang menggabungkan teknologi terkini dengan praktik keamanan terbaik. Dengan fitur enkripsi end-to-end, antarmuka yang responsif, dan berbagai kemampuan komunikasi real-time, Chat-Lite memberikan pengalaman chatting yang aman dan menyenangkan untuk pengguna.

Fitur-fitur canggih seperti reaksi pesan, status pesan, tema gelap, dan notifikasi push membuat aplikasi ini siap untuk digunakan dalam produksi. Arsitektur yang terpisah antara frontend dan backend memungkinkan skalabilitas dan pemeliharaan yang mudah.

Dibangun dengan teknologi modern seperti React, Vite, TypeScript, Express.js, Socket.IO, dan Prisma, Chat-Lite menunjukkan bagaimana aplikasi web real-time dapat dibangun dengan efisien dan aman.

-----

## 💻 Prasyarat Sistem

Sebelum memulai instalasi, pastikan sistem Anda memenuhi prasyarat berikut:

- [Node.js](https://nodejs.org/) versi 18 atau lebih baru
- [pnpm](https://pnpm.io/) (direkomendasikan) atau npm/yarn untuk manajemen paket
- Server database [PostgreSQL](https://www.postgresql.org/) versi 10 atau lebih baru
- [Git](https://git-scm.com/) untuk kontrol versi

## 📦 Dependensi

Proyek ini menggunakan berbagai pustaka dan kerangka kerja modern:

### Backend
- [Express.js](https://expressjs.com/) - Kerangka kerja web minimalis
- [Prisma](https://www.prisma.io/) - ORM modern dengan type-safety
- [Socket.IO](https://socket.io/) - Komunikasi real-time
- [TypeScript](https://www.typescriptlang.org/) - JavaScript dengan tipifikasi statis
- [Zod](https://zod.dev/) - Validasi skema dan parsing
- [Libsodium](https://github.com/jedisct1/libsodium) - Kriptografi modern

### Frontend
- [React](https://react.dev/) - Pustaka UI komponen
- [Vite](https://vitejs.dev/) - Build tool cepat
- [Zustand](https://github.com/pmndrs/zustand) - Manajemen state minimalis
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS utilitas
- [React Router](https://reactrouter.com/) - Routing deklaratif
- [React Window](https://github.com/bvaughn/react-window) - Rendering virtualisasi
- [React Hot Toast](https://react-hot-toast.com/) - Notifikasi pengguna

## 🙏 Ucapan Terima Kasih

Terima kasih kepada semua kontributor dan pengguna yang telah membantu dalam pengembangan Chat-Lite. Proyek ini tidak akan menjadi mungkin tanpa dukungan dari komunitas open-source.

## 📄 Lisensi

Proyek ini dilisensikan di bawah **Lisensi MIT**. Lihat berkas `LICENSE` untuk detail lebih lanjut.

---

Dibuat dengan ❤️ oleh [h4nzs](https://github.com/h4nzs)