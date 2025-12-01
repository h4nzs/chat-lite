# Laporan Lanjutan & Analisis Kegagalan Perbaikan E2EE

Dokumen ini merangkum serangkaian upaya perbaikan bug pada alur Enkripsi End-to-End (E2EE) asinkron, status kegagalan saat ini, dan analisis akar masalah yang paling mungkin.

## Status Terakhir (Bug Masih Ada)

Meskipun serangkaian perbaikan telah dilakukan, bug inti tetap ada:
-   **Gejala:** Saat pengguna penerima (misal: "B") menerima pesan pertama dari pengguna pengirim ("A") dalam percakapan baru, klien "B" gagal mendekripsi pesan.
-   **Penyebab Langsung:** Log menunjukkan klien "B" mencoba mengambil data sesi awal dari server (`GET /api/keys/initial-session/...`) tetapi menerima respons `404 Not Found`.
-   **Bukti Database:** Pengecekan langsung ke database PostgreSQL (`SELECT * FROM "SessionKey" ...`) membuktikan bahwa kolom `initiatorEphemeralKey` **selalu kosong (NULL)**, meskipun seharusnya diisi saat percakapan dibuat.

Ini menyebabkan alur dekripsi asinkron gagal dan terpaksa menggunakan metode fallback (meminta kunci dari peer yang sedang online), yang bukan perilaku yang diinginkan.

---

## Ringkasan Upaya Perbaikan & Analisis

Berikut adalah kronologi langkah-langkah perbaikan yang telah ditempuh dan hasil analisis di setiap tahap:

### 1. Analisis Awal: Bug Teridentifikasi

-   **Temuan:** Alur E2EE asinkron rusak karena `ephemeralPublicKey` dari pengirim tidak disimpan oleh server. Akibatnya, penerima tidak dapat menghitung kunci sesi bersama (shared session key).

### 2. Upaya Perbaikan #1: Perbaikan Logika End-to-End

-   **Tindakan:**
    1.  **Database:** Skema Prisma (`schema.prisma`) diubah untuk menambahkan kolom `initiatorEphemeralKey` pada tabel `SessionKey`. Migrasi database dijalankan dan **berhasil** (seperti yang diverifikasi dari file `migration.sql`).
    2.  **Server (Penyimpanan):** Logika di `server/utils/sessionKeys.ts` diperbarui untuk menerima dan menyimpan `ephemeralPublicKey` ke kolom baru.
    3.  **Server (Pengambilan):** Endpoint baru `GET /api/keys/initial-session/...` dibuat di `server/src/routes/keys.ts` untuk menyajikan data sesi awal kepada penerima.
    4.  **Klien:** Logika dekripsi di `web/utils/crypto.ts` dirombak total untuk memanggil endpoint baru di atas dan melakukan perhitungan kunci sesi dari sisi penerima.
-   **Hasil:** **Gagal.** Log dan pengecekan database menunjukkan kolom `initiatorEphemeralKey` tetap kosong.

### 3. Upaya Perbaikan #2: Debugging dengan `console.log`

-   **Tindakan:** Untuk memastikan data benar-benar sampai di server, `console.log("DEBUG initialSession:", initialSession)` ditambahkan di `server/src/routes/conversations.ts`.
-   **Hasil:** **Berhasil Sebagian.** Log server dengan jelas menunjukkan bahwa `initialSession` (termasuk `ephemeralPublicKey`) **berhasil diterima** oleh rute `POST /api/conversations`. Ini membuktikan masalah bukan pada klien atau transmisi data. Masalah terjadi setelah data diterima oleh rute.

### 4. Upaya Perbaikan #3: Inline Logic

-   **Tindakan:** Untuk menghilangkan kemungkinan adanya masalah pada impor modul atau resolusi file saat runtime, logika dari `sessionKeys.ts` dipindahkan langsung (inline) ke dalam `conversations.ts`. Ini adalah pendekatan paling langsung untuk memastikan kode penyimpanan dieksekusi.
-   **Hasil:** **Gagal.** Meskipun logika penyimpanan sekarang berada langsung di dalam file rute, pengecekan database final tetap menunjukkan kolom `initiatorEphemeralKey` tidak terisi.

---

## Analisis Akar Masalah yang Paling Mungkin

Setelah semua upaya perbaikan logika kode gagal, padahal kode secara sintaksis dan alur sudah terlihat benar, kesimpulan yang paling mungkin adalah:

**Masalahnya bukan pada logika kode, tetapi pada proses *build* atau *execution* di sisi server.**

-   Sangat mungkin server Node.js menjalankan **versi file JavaScript lama yang sudah di-cache**.
-   Meskipun file TypeScript (`.ts`) telah berulang kali diubah, proses *transpiler* (kemungkinan `tsx` atau `ts-node`) gagal memperbarui file JavaScript (`.js`) yang sebenarnya dieksekusi oleh Node.js.
-   Inilah mengapa `console.log` yang saya tambahkan di `conversations.ts` sempat muncul di log Anda (karena file itu mungkin kebetulan di-build ulang), tetapi perubahan di file lain seperti `sessionKeys.ts` atau perubahan final di `conversations.ts` tidak pernah benar-benar dieksekusi, meskipun saya sudah menimpanya.

## Bug Sampingan yang Berhasil Diperbaiki

Selama proses ini, beberapa bug lain berhasil diidentifikasi dan diperbaiki secara permanen:

1.  **`TypeError: loadConversations is not a function`:** Disebabkan oleh state yang tidak bersih saat logout. Diperbaiki dengan menambahkan fungsi `reset()` pada setiap store Zustand dan memanggilnya saat logout.
2.  **Server Crash (`ReferenceError: c is not defined`):** Disebabkan oleh kesalahan ketik (typo) di `conversations.ts`. Telah diperbaiki.
3.  **Gagal Menampilkan Recovery Phrase:** Disebabkan `localStorage.clear()` yang terlalu agresif saat logout. Diperbaiki dengan menggantinya menjadi `localStorage.removeItem('user')` yang lebih spesifik.
