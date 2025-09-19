**Misi Kritis: Audit, Identifikasi, dan Perbaikan Total Aplikasi Chat-Lite**

### Konteks
Anda adalah seorang **Senior Full-Stack Developer dan Code Auditor** dengan spesialisasi dalam debugging masalah kompleks pada aplikasi web modern (React, Node.js, Prisma, JWT, WebSocket). Proyek "chat-lite" saat ini berada dalam kondisi kritis: meskipun pengguna bisa login, semua request API untuk mengambil data (seperti pesan, daftar percakapan, dan user) gagal dengan error `403 Forbidden`. Ini menyebabkan frontend sama sekali tidak bisa menampilkan data aplikasi. Upaya perbaikan yang terfokus sebelumnya gagal, menandakan adanya masalah mendasar atau beberapa bug yang saling terkait.

### Misi Utama
Tugas Anda adalah melakukan **analisis dan audit end-to-end secara sistematis** pada seluruh basis kode (frontend dan backend). Identifikasi **semua** error, bug, inkonsistensi logika, dan potensi masalah (*code smells*) yang menyebabkan kegagalan fungsionalitas saat ini. Setelah identifikasi, implementasikan perbaikan yang bersih, efisien, dan benar secara fundamental.

### **Metodologi Kerja yang Wajib Diikuti:**

#### **Fase 1: Analisis Statis & Investigasi Menyeluruh**

1.  **Lacak Alur Otentikasi Penuh:**
    -   **Backend (`routes/auth.ts`):** Verifikasi proses pembuatan JWT. Apa saja isi *payload*-nya? Apakah `id` pengguna sudah pasti ada dan formatnya benar? Bagaimana cookie (`at` dan `rt`) diatur?
    -   **Middleware (`authMiddleware.ts`):** Audit baris per baris. Bagaimana token diekstrak dari `req.cookies.at`? Bagaimana proses verifikasinya? Pastikan `req.user` (atau nama sejenisnya) dilampirkan dengan benar ke objek `request`.

2.  **Audit Logika Otorisasi & Akses Data:**
    -   **Semua Controller API (Backend):** Periksa **setiap** *endpoint* yang dilindungi oleh `authMiddleware`.
    -   **Fokus pada Query Prisma:** Cermati semua query Prisma (`findUnique`, `findMany`, dll.) yang digunakan untuk mengambil data. Apakah query tersebut sudah **pasti** menyertakan klausa `where` untuk memfilter data berdasarkan `req.user.id`? Ini adalah kemungkinan terbesar penyebab error `403`. Cari "mismatch" antara ID pengguna di token dengan cara query ke database.

3.  **Analisis Kode Frontend:**
    -   **cari kode yang menangani input pesan, file dan tombol kirim.**

#### **Fase 2: Implementasi Perbaikan Holistik**

1.  **Perbaiki Akar Masalah:** Berdasarkan temuan Anda di Fase 1, perbaiki masalah utamanya. Ini bukan tentang menambal gejala, tetapi memperbaiki logika yang salah. Jika masalahnya ada di query Prisma, perbaiki query tersebut. Jika masalahnya di pembuatan JWT, perbaiki *payload*-nya.

2.  **Standardisasi & Konsistensi:**
    -   Pastikan cara penanganan otentikasi dan otorisasi konsisten di **semua** *endpoint* backend.
    -   Pastikan cara penanganan respons API (termasuk error) konsisten di seluruh aplikasi frontend.

3.  **Hapus Kode Bermasalah:** Singkirkan semua kode sisa, variabel yang tidak digunakan, atau logika duplikat yang dapat menyebabkan kebingungan atau bug di masa depan.

4.  **tempat untuk input pesan, file dan kirim masih tidak muncul**  Perbaiki tampilan sticky dari tempat mengetik pesan, memasukan pesan dan tombol send agar ada di bagian bawah percakapan.

#### **Fase 3: Laporan & Penjelasan**

Setelah semua perbaikan diimplementasikan, sediakan laporan singkat dalam format berikut:

-   **Akar Masalah yang Ditemukan:** Tempat untuk mengirim pesan masih tidak tampil.
-   **Ringkasan Perubahan:** Buat daftar file yang telah Anda modifikasi dan jelaskan secara singkat perubahan penting yang dibuat di setiap file.

### **Tujuan Akhir**
Aplikasi harus berfungsi penuh: Pengguna dapat login, melihat daftar percakapan dan user lain, membuka percakapan, melihat riwayat pesan, dan mengirim pesan baru secara *real-time* tanpa ada error apapun di konsol browser maupun server. Saya memberikan Anda otonomi penuh untuk melakukan refaktor yang diperlukan demi mencapai tujuan ini.

### **error yang muncul di konsol browser**
