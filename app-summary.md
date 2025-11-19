# Laporan Status Proyek: Implementasi Ulang E2EE Asinkron

Dokumen ini merangkum pekerjaan yang telah dilakukan untuk mengimplementasikan kembali enkripsi end-to-end (E2EE) asinkron, status saat ini, dan daftar masalah yang masih ada.

## Konteks

Proyek ini di-rollback ke commit yang stabil setelah penambahan notifikasi sistem, tetapi sebelum refaktor besar pada sistem E2EE. Tujuannya adalah untuk mengimplementasikan kembali E2EE asinkron dengan benar, menggunakan pendekatan dual-key (X25519 untuk enkripsi, Ed25519 untuk tanda tangan) dan mekanisme Pre-Key Signal (X3DH).

## Pekerjaan yang Telah Selesai

1.  **Rollback & Persiapan**:
    *   Kode proyek di-rollback ke basis kode yang lebih stabil.
    *   Database **tidak** di-rollback dan skemanya (model `User`, `SignedPreKey`, `OneTimePreKey`) sudah sesuai dengan kebutuhan E2EE baru.

2.  **Backend (Server)**:
    *   Endpoint registrasi (`/api/auth/register`) diperbarui untuk menerima dan menyimpan `publicKey` (enkripsi) dan `signingKey` (tanda tangan).
    *   Endpoint untuk mengunggah dan mengambil *pre-key bundle* telah dibuat (`POST /api/keys/prekeys` dan `GET /api/keys/prekey-bundle/:userId`).
    *   Endpoint untuk membuat percakapan (`POST /api/conversations`) diperbarui untuk menerima *initial session keys* yang dibuat dari *handshake* X3DH.
    *   Logika distribusi kunci (`sessionKeys.ts`) diperbarui untuk menggunakan kunci publik dari database.
    *   Implementasi CSRF manual sederhana ditambahkan untuk menggantikan `csurf` yang gagal diinstal.

3.  **Frontend (Web)**:
    *   Utilitas manajemen kunci (`keyManagement.ts`) ditulis ulang sepenuhnya untuk menangani pembuatan, penyimpanan, dan pemulihan sistem dual-key.
    *   Alur registrasi dan login (`auth.ts`) diperbarui untuk:
        *   Membuat *master seed* 32-byte.
        *   Menderivasi *encryption seed* dan *signing seed* secara deterministik.
        *   Membuat *key pair* enkripsi dan tanda tangan dari *seed* tersebut.
        *   Membuat *recovery phrase* (mnemonic) dari *master seed*.
        *   Secara otomatis membuat dan mengunggah *pre-key bundle* ke server setelah login/registrasi berhasil.
    *   Alur pemulihan akun (`Restore.tsx`) diperbarui untuk meregenerasi kunci dengan benar dari *recovery phrase*.
    *   Logika memulai percakapan (`conversation.ts`) ditulis ulang untuk melakukan *handshake* X3DH:
        1.  Mengambil *pre-key bundle* pengguna lain.
        2.  Melakukan kalkulasi Diffie-Hellman.
        3.  Membuat *session key* awal.
        4.  Mengirim permintaan pembuatan percakapan ke server dengan kunci sesi awal yang sudah dienkripsi untuk kedua belah pihak.

## Status Saat Ini: **Banyak Bug Kritis**

Meskipun alur utama telah diimplementasikan, aplikasi saat ini tidak dapat digunakan karena serangkaian *error* yang saling terkait, terutama setelah proses registrasi dan saat mencoba memulai percakapan.

## Daftar Masalah dan Kemungkinan Penyebab

Berikut adalah daftar *error* yang telah kita temui secara berurutan setelah *rollback*, yang menunjukkan adanya masalah fundamental dan sistemik:

1.  **`Invalid CSRF token` (Frontend)**
    *   **Masalah:** *Frontend* gagal melakukan permintaan API karena token CSRF tidak valid. Ini terjadi meskipun *endpoint* dan *middleware* CSRF manual sudah ditambahkan di *backend*.
    *   **Kemungkinan Penyebab:**
        *   **Masalah Utama (Sangat Mungkin):** Adanya data pengguna atau sesi yang korup di *database* dari percobaan-percobaan sebelumnya. Meskipun logika sudah benar, data lama yang salah format menyebabkan kegagalan otentikasi atau sesi, yang merusak alur CSRF.
        *   **Masalah Sekunder:** *Timing issue* di *frontend*, di mana permintaan API dilakukan sebelum token CSRF yang baru berhasil diambil dan disimpan.

2.  **`PrismaClientValidationError: Argument 'encryptedKey' is missing` (Backend)**
    *   **Masalah:** *Error* dari Prisma saat mencoba menyimpan *session key* baru ke *database*.
    *   **Status:** **Telah Diperbaiki.** Ini adalah kesalahan penamaan properti (`key` vs `encryptedKey`) di `sessionKeys.ts` yang sudah dikoreksi.

3.  **`SyntaxError: does not provide an export named '...'` (Backend)**
    *   **Masalah:** Serangkaian *error* saat startup server karena impor modul ES yang salah. Contoh: `getSodium`, `authMiddleware`, `handleApiError`, `prisma`.
    *   **Status:** **Telah Diperbaiki.** Ini disebabkan oleh refaktor yang tidak konsisten dan penggunaan `import default` vs `import { named }`. Semua impor yang diketahui bermasalah telah diperbaiki.

4.  **`SyntaxError: The requested module '...' doesn't provide an export named '...'` (Frontend)**
    *   **Masalah:** Serangkaian *error* di *frontend* karena komponen mencoba mengimpor fungsi utilitas kriptografi yang telah dihapus atau diganti nama saat refaktor. Contoh: `decryptSessionKeyForUser`, `storePrivateKey`, `importPublicKey`, `generateSafetyNumber`, `encryptFile`.
    *   **Status:** **Telah Diperbaiki.** Semua fungsi yang hilang telah ditambahkan kembali atau komponen yang menggunakannya telah diperbarui.

5.  **`Invalid seed length` / `source array is too long` / `Invalid entropy` (Frontend)**
    *   **Masalah:** Serangkaian *error* kriptografi dari `libsodium` dan `bip39` selama proses registrasi dan pemulihan akun.
    *   **Status:** **Telah Diperbaiki.** Ini disebabkan oleh pemahaman yang salah tentang panjang *seed* dan kunci yang dibutuhkan oleh `libsodium`. Logika sekarang sudah benar: menggunakan satu *master seed* 32-byte untuk menderivasi semua kunci lain secara deterministik.

## Rekomendasi

Fokus utama saat ini adalah menyelesaikan *error* **`Invalid CSRF token`**. Mengingat riwayat masalah, sangat disarankan untuk memulai dengan **membersihkan total database pengembangan** untuk memastikan tidak ada data korup yang tersisa.

```bash
# Di dalam direktori /server
npx prisma migrate reset
```

Setelah itu, jika masalah masih berlanjut, investigasi harus difokuskan pada alur *fetching* dan *attaching* token CSRF di `web/src/lib/api.ts` dan *middleware* validasi di `server/src/app.ts`.
