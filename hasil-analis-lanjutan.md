Berikut adalah rencana perbaikan komprehensif untuk ketiga masalah tersebut:

  Rencana Perbaikan Arsitektur E2EE

  Langkah 1: Perbaiki `User.publicKey` yang Tidak Diperbarui

   - Masalah: Saat ini, POST /prekey-bundle hanya menyimpan bundle, tetapi tidak
     memperbarui kolom publicKey di tabel User, yang dapat menyebabkan error 404 di
     kemudian hari.
   - Tindakan:
       1. Saya akan memodifikasi endpoint POST /prekey-bundle di file
          server/src/routes/keys.ts.
       2. Setelah berhasil menyimpan pre-key bundle, saya akan menambahkan perintah
          prisma.user.update untuk menyalin identityKey dari bundle tersebut ke kolom
          publicKey pada record User yang bersangkutan.

  Langkah 2: Tambahkan Transaksi Atomik pada Pembuatan Percakapan

   - Masalah: Pembuatan percakapan dan pembuatan kunci sesinya terjadi dalam dua langkah
     terpisah. Jika langkah kedua gagal, akan tercipta "percakapan hantu" tanpa kunci.
   - Tindakan:
       1. Saya akan memodifikasi endpoint POST / di file
          server/src/routes/conversations.ts.
       2. Saya akan membungkus kedua operasi database (prisma.conversation.create dan
          prisma.sessionKey.createMany) di dalam sebuah prisma.$transaction([...]). Ini
          memastikan jika salah satu gagal, semua akan dibatalkan (rollback), menjaga
          integritas data.

  Langkah 3: Atasi Mismatch Arsitektur (Sesi Awal vs. Ratchet)

   - Masalah: Klien saat ini bingung karena sesi yang dibuat oleh server (ratchet) tidak
     memiliki initiatorEphemeralKey, menyebabkan error 404 saat klien mencoba mengambilnya.
   - Tindakan: Saya akan membuat kedua alur menjadi konsisten.
       1. Sisi Server: Saya akan memodifikasi fungsi rotateAndDistributeSessionKeys di
          server/src/utils/sessionKeys.ts. Saat server membuat sesi ratchet baru, ia juga
          akan membuat sebuah ephemeral key sementara dan menyimpannya di kolom
          initiatorEphemeralKey, sama seperti yang dilakukan klien.
       2. Sisi Klien: Setelah server diperbaiki, saya akan mengembalikan logika "pintar" di
          web/utils/crypto.ts (decryptMessage). Ia akan kembali mencoba GET
          /initial-session terlebih dahulu. Karena sekarang semua sesi (awal maupun
          ratchet) memiliki initiatorEphemeralKey, panggilan ini akan selalu berhasil.