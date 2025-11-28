# Prompt Analisis Komprehensif untuk Aplikasi "Chat Lite"

**Tujuan Utama:** Analisis dan pahami secara menyeluruh basis kode aplikasi "Chat Lite" untuk mempersiapkan tugas pengembangan, perbaikan bug, dan implementasi fitur di masa mendatang.

---

### 1. Ringkasan Proyek

"Chat Lite" adalah aplikasi perpesanan *full-stack* yang aman, dengan enkripsi *end-to-end* (E2EE) dan komunikasi *real-time*. Fokus utamanya adalah pada privasi pengguna dan pengalaman pengguna yang modern.

### 2. Tumpukan Teknologi (Tech Stack)

-   **Struktur:** Monorepo dengan dua direktori utama: `web/` (frontend) dan `server/` (backend).
-   **Frontend:**
    -   **Framework:** React dengan Vite.
    -   **Bahasa:** TypeScript.
    -   **State Management:** Zustand.
    -   **Styling:** Tailwind CSS.
    -   **Komponen UI:** Radix UI (khususnya untuk Dropdown, Popover).
    -   **Animasi:** Framer Motion.
-   **Backend:**
    -   **Runtime:** Node.js dengan Express.
    -   **Database:** PostgreSQL dengan Prisma sebagai ORM.
    -   **Real-time:** Socket.IO.
-   **Kriptografi:** `libsodium-wrappers` untuk semua operasi kriptografi inti.

### 3. Alur Kerja Kritis & Konsep Inti

#### 3.1. Alur Otentikasi dan Manajemen Kunci Identitas

Aplikasi ini menggunakan sistem **dual-key**: satu pasang kunci untuk enkripsi (`crypto_box`, X25519) dan satu lagi untuk tanda tangan digital (`crypto_sign`, Ed25519).

-   **Registrasi (`web/src/store/auth.ts` -> `registerAndGeneratePhrase`):**
    1.  Dua pasang kunci (enkripsi dan tanda tangan) dibuat menggunakan `generateKeyPairs` dari `keyManagement.ts`.
    2.  Kedua kunci privat dienkripsi dengan *password* pengguna dan disimpan sebagai satu bundel di `localStorage` di bawah kunci `encryptedPrivateKeys`.
    3.  Kedua kunci publik (`publicKey` dan `signingKey`) dikirim ke server saat registrasi (`POST /api/auth/register`). Server menyimpannya di model `User`.
    4.  Sebuah *recovery phrase* 24 kata dibuat dari *hash* gabungan kedua kunci privat.

-   **Login (`web/src/store/auth.ts` -> `login`):**
    1.  Pengguna login menggunakan *username*/*email* dan *password*.
    2.  Aplikasi kemudian memeriksa keberadaan `encryptedPrivateKeys` di `localStorage`.
    3.  Jika tidak ada (misalnya, di perangkat baru), aplikasi akan menampilkan peringatan dan pengguna harus memulihkan akunnya menggunakan *recovery phrase*.

-   **Pemulihan Akun (`web/src/pages/Restore.tsx`):**
    1.  Pengguna memasukkan *recovery phrase* dan *password* baru.
    2.  *Phrase* tersebut diubah kembali menjadi "benih" (*seed*) yang sama persis seperti saat registrasi.
    3.  Kedua pasang kunci (enkripsi dan tanda tangan) dibuat ulang secara deterministik dari *seed* tersebut.
    4.  Kunci-kunci privat baru ini dienkripsi dengan *password* baru dan disimpan di `localStorage`, menyelesaikan proses pemulihan untuk perangkat tersebut.

#### 3.2. Alur Enkripsi End-to-End (E2EE) - Versi Stabil Saat Ini

**Penting:** Versi stabil ini menggunakan model E2EE **real-time/sinkron**. Belum ada dukungan untuk pesan asinkron (mengirim pesan ke pengguna yang offline).

-   **Memulai Percakapan Baru (`web/src/store/conversation.ts` -> `startConversation`):**
    1.  *Frontend* hanya mengirim permintaan sederhana ke `POST /api/conversations` yang berisi ID pengguna lain.
    2.  *Backend* kemudian bertanggung jawab untuk membuat kunci sesi pertama, mengenkripsinya untuk setiap peserta menggunakan `publicKey` mereka yang tersimpan di *database*, dan mendistribusikannya. Ini mengasumsikan kedua pengguna pernah *online* dan memiliki kunci di server.

-   **Manajemen Sesi (`web/src/utils/crypto.ts` -> `ensureAndRatchetSession`):**
    1.  Sebelum memuat pesan dalam sebuah percakapan, fungsi ini dipanggil.
    2.  Ia meminta kunci sesi baru dari *backend* (`POST /api/session-keys/:conversationId/ratchet`).
    3.  *Backend* membuat kunci sesi baru, mengenkripsinya untuk semua anggota percakapan, dan menyimpannya. Kunci sesi yang dienkripsi untuk pengguna saat ini dikirim kembali ke *frontend*.
    4.  *Frontend* mendekripsi dan menyimpan kunci sesi ini di IndexedDB (`keychainDb`).

-   **Enkripsi/Dekripsi Pesan:**
    1.  `encryptMessage`: Mengambil kunci sesi terbaru dari `keychainDb` dan menggunakan `sodium.crypto_secretbox_easy` untuk mengenkripsi pesan.
    2.  `decryptMessage`: Mencoba mengambil kunci sesi dari `keychainDb` berdasarkan `sessionId` pesan.
        -   Jika kunci **tidak ditemukan**, ia memanggil `emitSessionKeyRequest` melalui *socket* untuk meminta kunci dari peserta lain yang sedang *online*. Ia mengembalikan status "pending".
        -   Jika kunci **ditemukan**, ia mendekripsi pesan menggunakan `sodium.crypto_secretbox_open_easy`.

### 4. Tugas Pertama Anda

Sebagai agen AI, tugas pertama Anda adalah membaca dan memahami file-file inti yang terkait dengan alur di atas:
1.  **Frontend - Otentikasi & Kunci:**
    -   `web/src/store/auth.ts`
    -   `web/src/utils/keyManagement.ts`
    -   `web/src/pages/Restore.tsx`
2.  **Frontend - Sesi & Kripto:**
    -   `web/src/utils/crypto.ts`
    -   `web/src/store/conversation.ts` (terutama `startConversation`)
    -   `web/src/lib/socket.ts` (untuk melihat *event-event* E2EE seperti `session:new_key`)
3.  **Backend - Rute:**
    -   `server/src/routes/auth.ts` (terutama `/register`)
    -   `server/src/routes/conversations.ts` (terutama `POST /`)
    -   `server/src/routes/keys.ts`

Setelah Anda membaca dan memahami file-file ini, konfirmasikan pemahaman Anda tentang alur E2EE saat ini sebelum melanjutkan dengan tugas spesifik apa pun.
