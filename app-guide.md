# Panduan dan Laporan Audit Aplikasi Chat-Lite

Dokumen ini berisi ringkasan hasil audit teknis pada proyek Chat-Lite, mencakup temuan masalah, rekomendasi perbaikan, dan panduan untuk pengembangan di masa depan.

---

## Ringkasan Umum

Aplikasi ini memiliki fondasi arsitektur yang kuat dengan tumpukan teknologi modern (React, Node.js, Prisma, Socket.IO). Fokus pada keamanan dengan enkripsi end-to-end (E2EE) adalah nilai jual utama. Namun, seiring dengan penambahan fitur, beberapa area di dalam basis kode mulai menunjukkan tanda-tanda "utang teknis" (technical debt), terutama di sisi frontend.

Secara keseluruhan, aplikasi ini berada dalam kondisi yang baik, tetapi memerlukan beberapa refaktorisasi strategis untuk memastikan skalabilitas dan kemudahan pemeliharaan di masa depan.

---

## Kekuatan Proyek

- **Arsitektur Modern:** Pemisahan yang jelas antara backend (Express) dan frontend (React) dalam satu monorepo.
- **Keamanan Solid:** Implementasi E2EE dengan `libsodium`, penggunaan cookie `httpOnly` untuk JWT, dan middleware keamanan standar (Helmet, CORS, CSRF) menunjukkan praktik terbaik.
- **Pengalaman Real-time:** Penggunaan Socket.IO yang efektif untuk fitur-fitur seperti status kehadiran, indikator pengetikan, dan pembaruan pesan instan.
- **Database Type-Safe:** Penggunaan Prisma sebagai ORM memberikan keamanan tipe dari database hingga ke frontend.

---

## Masalah Ditemukan & Rekomendasi Perbaikan

Berikut adalah daftar masalah yang ditemukan selama audit, diurutkan berdasarkan tingkat keparahan.

### Tingkat Kritis

**1. *done* Konfigurasi ESLint Usang di Frontend**
- **Masalah:** Perintah `pnpm lint` di direktori `web` gagal total karena versi ESLint yang terpasang (v9+) mengharapkan file konfigurasi `eslint.config.js`, sementara proyek masih menggunakan `.eslintrc.cjs`.
- **Lokasi:** `web/package.json`, `web/.eslintrc.cjs`
- **Dampak:** Alat bantu kualitas kode statis tidak dapat berjalan, yang berarti potensi error dan inkonsistensi gaya tidak terdeteksi secara otomatis.
- **Rekomendasi:** Migrasikan konfigurasi ESLint dari format `.eslintrc.cjs` ke `eslint.config.js` sesuai dengan [panduan migrasi resmi ESLint v9](https://eslint.org/docs/latest/use/configure/migration-guide).

**2. *done* Masalah Kinerja N+1 Query di Backend**
- **Masalah:** Endpoint `GET /api/conversations` melakukan 2 query tambahan untuk setiap percakapan yang dimiliki pengguna guna menghitung pesan yang belum dibaca. Ini menyebabkan masalah performa serius yang akan meningkat seiring dengan jumlah percakapan.
- **Lokasi:** `server/src/routes/conversations.ts`
- **Dampak:** Waktu muat awal aplikasi menjadi sangat lambat bagi pengguna dengan banyak riwayat percakapan.
- **Rekomendasi:** Lakukan refaktor pada query ini. Gunakan `Prisma.$queryRaw` untuk menulis satu query SQL yang efisien untuk menghitung pesan yang belum dibaca untuk semua percakapan sekaligus, sehingga menghindari perulangan.

**3. *done* Kompleksitas Tinggi pada State Management Frontend (`useChatStore`)**
- **Masalah:** File `web/src/store/chat.ts` telah menjadi "God Object" yang menangani terlalu banyak tanggung jawab: state pesan, percakapan, kehadiran, listener socket, dan semua aksi terkait. Ini sangat sulit untuk dipelihara dan di-debug.
- **Lokasi:** `web/src/store/chat.ts`
- **Dampak:** Memperlambat pengembangan fitur baru dan meningkatkan risiko bug regresi karena perubahan di satu bagian dapat secara tidak terduga memengaruhi bagian lain.
- **Rekomendasi:** Pecah `useChatStore` menjadi beberapa *store* (slices) yang lebih kecil dan fokus, seperti:
  - `useConversationStore`: Mengelola daftar percakapan.
  - `useMessageStore`: Mengelola pesan.
  - `useSocketStore`: Mengelola koneksi dan listener Socket.IO.
  - `usePresenceStore`: Mengelola status online dan pengetikan.

### Tingkat Sedang

**1. *done* Validasi Input Backend yang Tidak Konsisten**
- **Masalah:** Beberapa rute API menggunakan middleware `zodValidate` untuk validasi skema (praktik baik), tetapi banyak rute lain yang melakukan validasi secara manual atau tidak sama sekali.
- **Lokasi:** `server/src/routes/keys.ts`, `server/src/routes/users.ts`, `server/src/routes/uploads.ts`
- **Dampak:** Inkonsistensi dalam penanganan input, meningkatkan risiko error dan potensi celah keamanan jika ada input yang tidak divalidasi dengan benar.
- **Rekomendasi:** Terapkan `zodValidate` secara konsisten di semua rute yang menerima input dari `req.body` atau `req.query`.

**2. *done* Rute Pencarian Pesan yang Tidak Berguna**
- **Masalah:** Endpoint `GET /api/messages/search` mencoba melakukan pencarian teks pada konten pesan di database. Karena konten dienkripsi, query ini tidak akan pernah mengembalikan hasil yang benar.
- **Lokasi:** `server/src/routes/messages.ts`
- **Dampak:** Memberikan fungsionalitas yang rusak dan rasa aman yang palsu. Membuang sumber daya server untuk query yang tidak akan pernah berhasil.
- **Rekomendasi:** Hapus endpoint ini dari backend. Pertahankan logika pencarian saat ini yang berjalan di sisi klien pada data yang sudah didekripsi.

### Tingkat Rendah

**1. *done* Penggunaan Tipe `any` yang Berlebihan di Backend**
- **Masalah:** Tipe `any` sering digunakan untuk objek `req` di middleware dan rute, yang menghilangkan jaminan keamanan tipe dari TypeScript.
- **Lokasi:** Hampir semua file di `server/src/routes/`.
- **Dampak:** Mengurangi manfaaat TypeScript, membuat kode lebih sulit untuk di-refactor, dan dapat menyembunyikan bug terkait tipe.
- **Rekomendasi:** Buat tipe kustom yang memperluas `Request` dari Express, misalnya `interface AuthenticatedRequest extends Request { user: UserPayload }`, dan gunakan di semua rute yang dilindungi oleh `requireAuth`.

**2. *done* Logika Dekripsi Frontend yang Berulang**
- **Masalah:** Logika untuk mendekripsi konten pesan (termasuk `repliedTo.content`) di-copy-paste di beberapa fungsi di dalam `useChatStore`.
- **Lokasi:** `loadConversations`, `loadMessagesForConversation`, dan listener `message:new` di `web/src/store/chat.ts`.
- **Dampak:** Membuat perubahan pada logika dekripsi menjadi sulit dan rawan kesalahan karena harus diubah di banyak tempat.
- **Rekomendasi:** Buat fungsi utilitas tunggal, misalnya `decryptMessageObject(message: Message): Promise<Message>`, yang menangani dekripsi secara rekursif dan panggil fungsi ini di semua tempat yang relevan.

**3. *done* Potensi Duplikasi Socket Listener**
- **Masalah:** `initSocketListeners` dipanggil di `App.tsx`. Jika terjadi koneksi ulang pada socket, ada kemungkinan listener lama tidak sepenuhnya bersih, yang berpotensi menyebabkan event ditangani beberapa kali.
- **Lokasi:** `web/src/store/chat.ts`, `web/src/App.tsx`
- **Dampak:** Perilaku aplikasi yang tidak terduga, seperti pesan yang muncul dua kali.
- **Rekomendasi:** Ubah `initSocketListeners` agar mengembalikan fungsi pembersihan. Panggil fungsi ini di dalam `useEffect` di `App.tsx` saat komponen di-*unmount* untuk memastikan semua listener selalu dibersihkan dengan benar.
