Fase 1: Pembaruan Database & Backend (Struktur Data)

   1. Modifikasi Skema Database (`schema.prisma`):
       * Saya akan menambahkan kolom baru pada tabel Conversation:
           * description: String? — untuk menyimpan deskripsi gru.
           * avatarUrl: String? — untuk menyimpan URL gambar avatr
              grup.
       * Saya akan memanfaatkan kolom role yang sudah ada pada
         tabel Participant untuk mengelola peran "ADMIN" dan
         "MEMBER".
       * Setelah skema diperbarui, saya akan membuat dan
         menjalankan migrasi database untuk menerapkan perubahan
         ini.

    2. Pembuatan API Endpoint Baru 
      (`server/routes/conversations.ts`):
       * Saya akan membuat beberapa endpoint baru yang dilindungi,
         di mana hanya pengguna dengan peran "ADMIN" yang dapat
         mengaksesnya:
           * PUT /api/conversations/:id/details: Untuk mengedit
             nama (title), description, dan avatarUrl grup.
           * POST /api/conversations/:id/participants: Untuk
             menambah anggota baru ke grup.
           * DELETE /api/conversations/:id/participants/:userId:
             Untuk mengeluarkan anggota dari grup.
           * PUT /api/conversations/:id/participants/:userId/role:
             Untuk mempromosikan anggota menjadi admin atau
             menurunkannya kembali menjadi anggota biasa.

      3. Integrasi Real-Time dengan Socket.IO (`server/src/socket.ts:
       * Setiap aksi admin melalui API di atas akan memicu event
         socket yang akan disiarkan ke semua anggota grup.
         Contohnya:
           * conversation:updated: Saat detail grup
             (nama/deskripsi/avatar) berubah.
           * participant:added / participant:removed: Saat anggota
             ditambah atau dikeluarkan.
           * participant:role_changed: Saat peran seorang anggota
             diubah.

Fase 2: Implementasi Frontend (UI & Logika)

   1. Pembuatan Komponen UI Baru (`web/src/components`):
       * Saya akan membuat panel atau modal "Info Grup". Panel ini
         akan menampilkan avatar, nama, dan deskripsi grup, besera
          daftar lengkap semua anggota dan peran mereka ("Admin" /
         "Anggota").
       * Di dalam panel "Info Grup", jika pengguna yang melihat
         adalah seorang "ADMIN", akan muncul tombol-tombol untuk:
           * Mengedit detail grup.
           * Menambah anggota baru.
           * Mengelola anggota lain (memberi peran admin,
             mengeluarkan).

   2. Manajemen State Frontend (Zustand):
       * Saya akan memperbarui state useConversationStore untuk
         menyimpan dan mengelola data baru (deskripsi, avatar,
         daftar partisipan yang lebih detail termasuk peran).
       * Saya akan menambahkan listener di sisi klien untuk
         menangani event-event socket baru (conversation:updated,
         dll.) dan secara otomatis memperbarui tampilan UI tanpa
         perlu me-refresh halaman.

    3. Alur Kerja Pengguna:
       * Pengguna (admin) mengklik header grup di ChatWindow untuk
         membuka panel "Info Grup".
       * Dari sana, admin dapat melakukan perubahan. Setiap
         perubahan akan mengirim permintaan ke API backend, yang
         kemudian akan menyiarkan pembaruan ke semua anggota grup
         secara real-time.

Ringkasan semua perubahan:

   * Backend (`server/`):
       * `schema.prisma`: Menambahkan bidang description dan
         avatarUrl ke model Conversation.
       * `conversations.ts`:
           * Memodifikasi pembuatan grup untuk menetapkan pembuat
             sebagai "ADMIN".
           * Menambahkan PUT /api/conversations/:id/details untuk
             memperbarui nama/deskripsi grup.
           * Menambahkan POST /api/conversations/:id/avatar untuk
             mengunggah avatar grup.
           * Menambahkan POST /api/conversations/:id/participants
             untuk menambahkan anggota.
           * Menambahkan DELETE 
             /api/conversations/:id/participants/:userId untuk
             menghapus anggota.
           * Menambahkan PUT 
             /api/conversations/:id/participants/:userId/role untk
              mengubah peran peserta.
           * Semua endpoint baru menyertakan pemeriksaan otorisasi
             admin dan menyiarkan event soket yang relevan.
   * Frontend (`web/`):
       * `useConversationStore`:
           * Memperbarui tipe Conversation dan Participant untuk
             menyertakan description, avatarUrl, dan role.
           * Memodifikasi loadConversations untuk memetakan peran
             peserta dengan benar.
           * Menambahkan tindakan (addParticipants,
             removeParticipant, updateParticipantRole) untuk
             menangani pembaruan real-time.
       * `useSocketStore`: Menambahkan pendengar untuk event soket
         baru (conversation:updated,
         conversation:participants_added,
         conversation:participant_removed,
         conversation:participant_updated) dan memperbarui fungsi
         pembersihan.
       * `ChatWindow.tsx`: Memodifikasi ChatHeader agar dapat
         diklik untuk obrolan grup, membuka GroupInfoPanel.
       * `GroupInfoPanel.tsx`:
           * Membuat komponen baru untuk menampilkan detail grup
             dan peserta.
           * Mengintegrasikan EditGroupInfoModal dan
             AddParticipantModal.
           * Menambahkan fungsionalitas bagi admin untuk mengunggh
              avatar grup.
       * `ParticipantList.tsx`: Membuat komponen untuk menampilkan
         peserta, peran mereka, dan tindakan admin
         (menjadikan/memberhentikan admin, menghapus).
       * `EditGroupInfoModal.tsx`: Membuat modal bagi admin untuk
         mengedit nama dan deskripsi grup.
       * `AddParticipantModal.tsx`: Membuat modal bagi admin untuk
         menambahkan peserta baru.