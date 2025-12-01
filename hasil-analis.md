# Laporan Analisis Awal "Chat Lite" oleh Gemini

Dokumen ini merangkum hasil analisis awal dari basis kode "Chat Lite". Analisis ini dilakukan menggunakan `codebase_investigator` dan ditindaklanjuti dengan inspeksi manual.

## Temuan Kunci & Isu Kritis

Analisis awal berhasil mengungkap dua isu fundamental yang memerlukan perhatian segera sebelum pengembangan lebih lanjut.

### 1. **Bug Kritis: Regenerasi Kunci Otomatis saat Login di Perangkat Baru**

-   **Lokasi:** `web/src/store/auth.ts` (fungsi `login`)
-   **Masalah:** Alur login saat ini memeriksa keberadaan kunci privat terenkripsi di `localStorage`. Jika tidak ditemukan (kasus umum pada perangkat baru), aplikasi secara keliru melanjutkan untuk membuat **pasangan kunci identitas yang sama sekali baru** dan menyimpannya.
-   **Dampak:** Ini adalah pelanggaran serius terhadap model identitas E2EE. Kunci publik baru akan menimpa kunci publik lama di server, menyebabkan semua kontak kehilangan kemampuan untuk mengenkripsi pesan untuk pengguna tersebut dengan benar. Ini juga membuat pengguna tidak dapat mendekripsi riwayat pesan mereka di perangkat baru, karena mereka tidak memiliki kunci privat yang sesuai.
-   **Seharusnya:** Jika kunci tidak ada, alur aplikasi harus secara eksplisit mengarahkan pengguna ke halaman pemulihan akun (`/restore`) untuk menggunakan *recovery phrase* mereka, yang akan meregenerasi kunci asli secara deterministik.

### 2. **Disparitas Sistem Kunci: Implementasi Tidak Sesuai Dokumentasi**

-   **Lokasi:** `web/src/utils/keyManagement.ts`
-   **Masalah:** Dokumentasi (`prompt-analis.md`) menjelaskan sistem **dual-key** yang menggunakan satu pasang kunci untuk enkripsi (X25519) dan satu lagi untuk tanda tangan digital (Ed25519). Namun, kode sumber hanya mengimplementasikan dan menggunakan **satu pasang kunci** (X25519 untuk `crypto_box`). Fungsi untuk menghasilkan kunci tanda tangan tidak pernah dibuat atau digunakan.
-   **Dampak:** Aplikasi ini tidak memiliki lapisan keamanan tambahan dari tanda tangan digital, yang seharusnya dapat memverifikasi integritas dan otentisitas pengirim pesan. Fitur keamanan seperti *Safety Numbers* (nomor keamanan) tidak dapat diimplementasikan dengan andal tanpa kunci penandatangan.

---

## Analisis Alur Kerja (Selesai Sebagian)

### Alur Otentikasi dan Manajemen Kunci Identitas

Alur ini sebagian besar terpusat di `web/src/store/auth.ts` dan `web/src/utils/keyManagement.ts`.

-   **Registrasi (`registerAndGeneratePhrase`):**
    1.  Sebuah *seed* acak 32-byte dibuat.
    2.  Dari *seed* ini, satu pasang kunci enkripsi X25519 (`publicKey`, `privateKey`) dibuat secara deterministik.
    3.  Sebuah *recovery phrase* (BIP39 mnemonic) 24 kata dibuat dari *seed* tersebut.
    4.  `privateKey` dienkripsi dengan *password* pengguna (menggunakan `crypto_secretbox`) dan disimpan di `localStorage`.
    5.  `publicKey` dan *hash* dari *recovery phrase* dikirim ke server (`POST /api/auth/register`). Server menyimpan `publicKey` dan `recoveryPhraseHash` pada model `User`.

-   **Login (`login`):**
    1.  Pengguna mengirimkan kredensial.
    2.  Server memvalidasi kredensial.
    3.  Aplikasi memeriksa `localStorage` untuk `encryptedPrivateKey`.
    4.  **DI SINILAH BUG TERJADI:** Jika tidak ada, kunci baru dibuat. Jika ada, kunci tersebut akan didekripsi dan dimuat ke dalam state.

-   **Pemulihan Akun (`Restore.tsx`):**
    1.  Pengguna memasukkan *recovery phrase* dan *password* baru.
    2.  Aplikasi mengubah *phrase* kembali menjadi *seed* aslinya.
    3.  Pasangan kunci X25519 yang identik dibuat ulang dari *seed* tersebut.
    4.  Aplikasi mengirim *hash* dari *phrase* ke server (`POST /api/keys/verify`) untuk verifikasi.
    5.  Jika berhasil, `privateKey` yang baru dibuat dienkripsi dengan *password* baru dan disimpan, menyelesaikan proses pemulihan. Alur ini berfungsi dengan benar dan aman.

### Alur Enkripsi End-to-End (E2EE)

**Status: Analisis Belum Selesai.**

Analisis investigator terhenti sebelum dapat sepenuhnya memetakan alur ini. Investigasi manual akan dilanjutkan pada file-file berikut:
-   `web/src/store/conversation.ts`
-   `web/src/utils/crypto.ts`
-   `web/src/lib/socket.ts`
-   `server/src/socket.ts`
-   `server/src/routes/conversations.ts`
-   `server/src/routes/keys.ts`

Langkah selanjutnya adalah memahami bagaimana kunci sesi (session keys) dibuat, didistribusikan (diratchet), dan digunakan untuk mengenkripsi/mendekripsi pesan individual.