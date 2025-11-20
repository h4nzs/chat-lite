Rencana Detail Implementasi

  1. Model dan Skema Database
   - Tambahkan model SignedPreKey dan OneTimePreKey ke schema.prisma
   - Relasi ke User model untuk menyimpan pre-keys per pengguna
   - Validasi dan constraint yang tepat

  2. Endpoint API untuk Pre-Keys
   - /api/keys/prekeys (POST) - untuk mengunggah pre-keys
   - /api/keys/prekey-bundle/:userId (GET) - untuk mendapatkan pre-key bundle pengguna

  3. Proses Pembuatan Pre-Key Bundle
   - Setelah login/registrasi, pengguna otomatis membuat dan mengupload pre-key bundle
   - Signed pre-key yang ditandatangani dengan signing key pengguna
   - Batch one-time pre-keys (misalnya 100 keys)

  4. Proses Inisiasi Percakapan (X3DH-like handshake)
   - Saat memulai percakapan dengan user lain, ambil pre-key bundle mereka
   - Lakukan exchange kunci untuk membuat session key pertama
   - Gunakan session key ini untuk mengenkripsi pesan pertama
   - Kirim session key terenkripsi ke semua participant

  5. Integrasi dengan Sistem E2E yang Ada
   - Sesuaikan dengan sistem session key yang sudah ada
   - Proses ratcheting tetap berjalan seperti biasa setelah session diinisiasi
   - Tidak mengganggu flow percakapan yang sudah berjalan

  6. Penanganan Kesalahan dan Edge Cases
   - Penanganan ketika one-time pre-keys habis
   - Fallback ke metode lama jika pre-key tidak tersedia
   - Penanganan ketika pengguna belum upload pre-keys

  7. Integrasi UI
   - Pastikan tidak ada perubahan mendasar di UI
   - Proses inisiasi percakapan baru tetap bekerja seperti biasa
   - Tapi kini bisa dilakukan meski penerima offline

  Langkah-Langkah Implementasi Bertahap
   1. Update schema database
   2. Implementasi endpoint dan logika backend
   3. Update fungsi kripto frontend untuk proses X3DH
   4. Integrasi dengan konversasi saat membuat percakapan baru
   5. Testing komprehensif

  Pencegahan Masalah dari Implementasi Sebelumnya
   - Gunakan migrasi database yang aman
   - Validasi ketat di semua endpoint
   - Pastikan inisialisasi libsodium sebelum operasi kripto
   - Backward compatibility agar tidak mengganggu user lama