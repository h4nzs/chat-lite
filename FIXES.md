> **Context:**
> Aplikasi chat menggunakan backend **Node.js (Express)** di port `4000` dan frontend (Vite) di port `5173`.
> Fitur upload file sudah berjalan normal dan file berhasil tersimpan di folder `uploads/`.
> Namun, di console browser muncul pesan:
>
> ```
> The resource at “http://localhost:4000/uploads/images/...png” was blocked due to its Cross-Origin-Resource-Policy header (or lack thereof)
> ```
>
> Aplikasi menggunakan konfigurasi CORS yang mengizinkan origin `http://localhost:5173`, dan upload file mencakup jenis file umum (gambar, video, dokumen, dll) hingga 10MB.
>
> Tujuan dari prompt ini adalah **memperbaiki error Cross-Origin-Resource-Policy** tanpa menurunkan keamanan, memastikan file di `uploads/` bisa diakses dan ditampilkan normal oleh frontend.

---

### ⚙️ **Task untuk Gemini**

> Analisis backend Express yang sudah memiliki route upload file, dan tambahkan konfigurasi **header keamanan & static file serving** agar:
>
> * File di folder `/uploads` bisa diakses dan ditampilkan oleh frontend di origin lain (localhost:5173).
> * Aman terhadap directory traversal atau akses file di luar `uploads`.
> * Menyertakan header berikut untuk keamanan:
>
>   * `Cross-Origin-Resource-Policy: cross-origin`
>   * `Cross-Origin-Opener-Policy: same-origin`
>   * `Cross-Origin-Embedder-Policy: credentialless`
> * Menjaga kompatibilitas dengan middleware CORS yang sudah ada.
> * Struktur kode tetap clean dan modular (gunakan `app.use()` untuk static dan middleware terpisah jika perlu).
>
> Setelah itu, optimalkan respons upload agar file URL yang dikembalikan langsung bisa dipakai oleh frontend (contoh: `http://localhost:4000/uploads/images/filename.png`).

---

### 💬 **Expected Output dari Gemini**

Gemini harus menghasilkan kode backend Express lengkap dengan:

* Static file serving untuk `/uploads`
* Header keamanan yang benar
* CORS tetap aktif untuk origin frontend
* Contoh route upload dengan validasi tipe file dan size limit
* Penjelasan singkat tiap bagian kode biar developer ngerti konteksnya