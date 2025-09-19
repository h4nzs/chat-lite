Perbaikan Aplikasi Chat-Lite: Autentikasi Cookie dan Socket.IO

### Konteks Proyek
Anda adalah seorang ahli pengembang full-stack. Saya memiliki aplikasi web chat real-time bernama "chat-lite". 
- **Backend:** Express.js, Prisma, dan otentikasi berbasis JWT (JSON Web Token).
- **Frontend:** React, Vite, Zustand untuk state management, dan Socket.IO untuk komunikasi real-time.

### Masalah Utama
Saat ini, alur otentikasi dan komunikasi real-time mengalami kegagalan. Masalah utamanya terletak pada penanganan cookie `httpOnly` yang tidak sinkron antara backend dan frontend. Backend mengatur cookie JWT sebagai `httpOnly`, tetapi frontend secara keliru mencoba membacanya menggunakan JavaScript, yang menyebabkan token selalu `null` di sisi klien dan mengakibatkan kegagalan otentikasi pada koneksi Socket.IO.

### Tugas Anda
Analisis dan perbaiki seluruh basis kode (backend dan frontend) untuk mengimplementasikan alur otentikasi berbasis cookie yang aman dan berfungsi dengan benar. Fokus pada penyelesaian semua masalah yang tercantum di bawah ini secara sistematis.

---

### **Instruksi Perbaikan Rinci:**

#### **Bagian Backend (Express.js & Socket.IO)**

1.  **Perbaiki Middleware Otentikasi Socket.IO:**
    -   Modifikasi `socketAuthMiddleware` agar tidak lagi bergantung pada token yang dikirim melalui `socket.handshake.auth.token`.
    -   Prioritaskan validasi token dengan cara mem-parsing cookie langsung dari header `socket.handshake.headers.cookie`.
    -   Pastikan middleware dapat mengekstrak dan memverifikasi JWT dari cookie `at` yang dikirim secara otomatis oleh browser.
    -   Tambahkan *logging* (untuk *debugging*) yang jelas untuk menampilkan header cookie yang diterima saat koneksi socket terjadi.

2.  **Konfigurasi CORS dan Cookie:**
    -   Pastikan konfigurasi `cors` di Express diatur dengan `{ credentials: true }` dan `origin` menunjuk ke URL frontend yang benar.
    -   Standardisasi pengaturan cookie di `routes/auth.ts` agar konsisten: `httpOnly: true`, `path: '/'`, dan atur `secure` serta `sameSite` dengan benar untuk lingkungan development (`secure: false`) dan production (`secure: true, sameSite: 'none'`).

3.  **Respons API Login/Register:**
    -   Meskipun alur utama akan berbasis cookie, modifikasi *endpoint* login dan register di `routes/auth.ts` agar tetap mengirimkan token akses (`accessToken`) dalam respons JSON. Ini berguna sebagai *fallback* atau untuk mempermudah *debugging* di sisi klien. Contoh: `{ "success": true, "token": accessToken }`.

#### **Bagian Frontend (React, Zustand & Socket.IO)**

4.  **Hentikan Upaya Membaca Cookie `httpOnly`:**
    -   Hapus semua logika di sisi klien yang mencoba membaca cookie `at` menggunakan JavaScript (misalnya, fungsi seperti `getCookie("at")`).
    -   Alur otentikasi harus sepenuhnya mengandalkan browser yang secara otomatis melampirkan cookie `httpOnly` pada setiap permintaan HTTP dan koneksi WebSocket.

5.  **Konfigurasi Klien Socket.IO:**
    -   Saat menginisialisasi koneksi Socket.IO, pastikan opsi `{ withCredentials: true }` diatur.
    -   Hapus properti `auth: { token: ... }` dari konfigurasi koneksi socket karena token tidak lagi dibaca secara manual.

6.  **Manajemen State (Zustand - `useAuthStore`):**
    -   Bersihkan `useAuthStore`. Hapus semua logika yang menyimpan atau mengambil token dari `localStorage` atau properti `document.cookie`.
    -   State otentikasi (`isAuthenticated`, `user`) harus diatur berdasarkan respons sukses dari API login/register atau dari data sesi yang terverifikasi, bukan dari token yang disimpan secara lokal.

7.  **Periksa Impor dan Alias Path:**
    -   Verifikasi bahwa semua impor *named* vs *default* sudah benar (misalnya, `import { useAuthStore } from '...'`).
    -   Periksa konfigurasi alias path di `vite.config.ts` (`@/components`, `@/store`, dll.) untuk memastikan semua path terselesaikan dengan benar.

#### **Tugas Umum & Validasi**

8.  **Variabel Lingkungan (Environment Variables):**
    -   Pastikan variabel seperti `VITE_API_URL` dan `VITE_WS_URL` di frontend, serta `DATABASE_URL` dan `JWT_SECRET` di backend, sudah dikonfigurasi dengan benar.

9.  **Konsistensi Kode:**
    -   Selama proses perbaikan, pastikan konsistensi penamaan variabel dan hapus kode yang tidak terpakai (*dead code*).

### **Hasil Akhir yang Diharapkan**
-   Pengguna berhasil login, dan cookie `at` (`httpOnly`) tersimpan dengan benar di browser.
-   Setelah me-refresh halaman, aplikasi dapat mempertahankan status login pengguna.
-   Koneksi Socket.IO berhasil dibuat dengan otentikasi yang valid melalui cookie yang dikirimkan secara otomatis.
-   Tidak ada lagi error di konsol terkait pembacaan cookie, CORS, atau koneksi socket.
-   Seluruh alur otentikasi aman, efisien, dan mengikuti praktik terbaik modern.

Tolong lakukan perubahan ini di seluruh file yang relevan dan berikan ringkasan tentang file apa saja yang telah Anda modifikasi.