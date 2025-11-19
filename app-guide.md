# Panduan Aplikasi & Analisis Bug - Chat Lite

Dokumen ini berisi analisis komprehensif mengenai bug, potensi masalah, dan area yang memerlukan perbaikan dalam aplikasi Chat Lite.

---

## Kategori 1: Masalah Sinkronisasi Real-time (Socket.IO)

Masalah dalam kategori ini berkaitan dengan pengiriman dan penerimaan data secara real-time.

### Bug 1.1: Pesan Baru Tidak Muncul Secara Real-time

-   **Gejala:** Pengguna harus me-reload halaman untuk melihat pesan baru yang dikirim oleh orang lain.
-   **Akar Masalah:** *Endpoint* untuk membuat pesan baru (`POST /api/messages`) tidak ada di *backend*. Akibatnya, saat *frontend* mengirim pesan, tidak ada yang terjadi di sisi server, dan tidak ada *event* `message:new` yang dikirim ke penerima.
-   **Status:** **Telah Diperbaiki.** Saya telah menambahkan *endpoint* yang hilang di `server/src/routes/messages.ts`.

### Potensi Masalah 1.2: Duplikasi Event Listener pada Hot Reload

-   **Gejala:** Selama pengembangan, terkadang sebuah *event* (misalnya, menerima pesan baru) sepertinya diproses beberapa kali, menyebabkan pesan duplikat di UI.
-   **Akar Masalah:** Mekanisme Hot Module Replacement (HMR) di Vite dapat menyebabkan file `socket.ts` dievaluasi ulang, yang berpotensi membuat koneksi socket baru atau mendaftarkan *listener* untuk kedua kalinya tanpa membersihkan yang lama. Bendera `listenersInitialized` yang saya tambahkan adalah upaya untuk mencegah ini, tetapi mungkin tidak cukup andal.
-   **Rekomendasi Perbaikan:** Terapkan pola singleton yang lebih ketat untuk inisialisasi *socket* dan *listener*-nya, dengan fungsi `disconnectSocket` yang benar-benar membersihkan semua *listener* yang ada sebelum koneksi baru dibuat.

---

## Kategori 2: Masalah Dekripsi Pesan (End-to-End Encryption)

Masalah dalam kategori ini berkaitan dengan kegagalan enkripsi atau dekripsi pesan.

### Bug 2.1: Pesan Diterima Tidak Terdekripsi (`[Requesting key to decrypt...]`)

-   **Gejala:** Pengguna menerima notifikasi pesan baru secara *real-time*, tetapi konten pesan menampilkan placeholder seperti `[Requesting key to decrypt...]` hingga halaman di-*reload*.
-   **Akar Masalah:** Ini adalah sebuah **race condition**.
    1.  *Event* `message:new` tiba di klien penerima.
    2.  Fungsi `decryptMessage` mencoba mendekripsi pesan tetapi menemukan bahwa kunci sesi (`sessionId`) yang diperlukan belum ada di *database* lokal (IndexedDB).
    3.  Fungsi tersebut kemudian mengirim permintaan kunci ke pengirim (`emitSessionKeyRequest`).
    4.  Beberapa saat kemudian, pengirim merespons dan klien menerima kunci sesi baru melalui *event* `session:new_key`.
    5.  **Masalahnya:** Tidak ada mekanisme yang secara otomatis memicu dekripsi ulang pesan yang gagal setelah kunci yang benar diterima. Pesan tersebut tetap menampilkan placeholder. Saat di-*reload*, kunci sudah ada di *database*, sehingga dekripsi berhasil.
-   **Rekomendasi Perbaikan:** Buat mekanisme di *frontend* untuk mencoba kembali dekripsi. Saat *event* `session:new_key` berhasil menyimpan kunci baru, picu sebuah fungsi yang mencari semua pesan di percakapan yang relevan yang memiliki status "gagal dekripsi" dan coba dekripsi ulang pesan-pesan tersebut dengan kunci yang baru.

### Bug 2.2: Kegagalan Handshake Awal (`incomplete input`)

-   **Gejala:** Mencoba memulai percakapan baru dengan pengguna lain gagal total dengan *error* `incomplete input` di konsol.
-   **Akar Masalah:** Ini disebabkan oleh serangkaian masalah yang saling terkait:
    1.  **Inkonsistensi Format Base64:** Beberapa kunci dikodekan dengan format Base64 `ORIGINAL`, sementara yang lain dengan `URLSAFE_NO_PADDING`. Ini menyebabkan `libsodium` gagal saat proses dekode.
    2.  **Data Kunci Kosong:** Validasi di *backend* tidak cukup ketat, memungkinkan kunci publik disimpan sebagai *string* kosong (`""`) di *database*, yang menyebabkan *crash* saat didekode.
    3.  **Alur Registrasi Tidak Lengkap:** Pengguna yang baru mendaftar tidak secara otomatis membuat dan mengunggah "pre-key" mereka. Ini menyebabkan setiap upaya untuk memulai percakapan dengan mereka gagal dengan *error* `404 Not Found` karena *pre-key bundle* mereka tidak ada.
-   **Status:** **Sebagian Besar Telah Diperbaiki.** Saya telah menyeragamkan format Base64, menambahkan validasi di *backend*, dan memperbaiki alur registrasi untuk mengunggah *pre-key*. Namun, sisa-sisa data buruk di *database* mungkin masih ada.

---

## Kategori 3: Potensi Race Condition Lainnya

Masalah yang mungkin terjadi karena urutan operasi yang tidak terjamin.

### Potensi Masalah 3.1: Memulai Percakapan Terlalu Cepat

-   **Gejala:** Pengguna *login* dan langsung mencoba memulai percakapan dengan sangat cepat, yang terkadang gagal.
-   **Akar Masalah:** Fungsi `login` memicu pengunggahan *pre-key* secara asinkron. Jika pengguna mencoba memulai percakapan sebelum proses unggah selesai, *backend* mungkin belum memiliki *pre-key* terbaru, yang menyebabkan kegagalan.
-   **Rekomendasi Perbaikan:** Implementasikan status "siap" (`isE2EEReady`) di `useAuthStore`. Nonaktifkan sementara tombol untuk memulai percakapan baru hingga proses unggah *pre-key* setelah *login* dikonfirmasi selesai.

---

## Kategori 4: Ketidakcocokan Frontend & Backend

Masalah yang disebabkan oleh perbedaan struktur data atau ekspektasi antara klien dan server.

### Potensi Masalah 4.1: Struktur Objek `Participant` yang Tidak Konsisten

-   **Gejala:** Terkadang, nama atau avatar pengguna di daftar peserta atau detail grup tidak muncul dengan benar.
-   **Akar Masalah:** Cara *backend* mengambil dan mengubah data peserta berbeda di beberapa *endpoint*. Terkadang, data pengguna berada di dalam `participant.user`, sementara di tempat lain ia langsung berada di `participant`. Ini memaksa *frontend* untuk menangani kedua kasus tersebut, yang rawan kesalahan.
-   **Rekomendasi Perbaikan:** Buat fungsi transformasi data terpusat di *backend* untuk memastikan bahwa objek `Participant` yang dikirim ke *frontend* **selalu** memiliki struktur yang sama di semua *endpoint*.

## error console browser

Uncaught TypeError: loadConversations is not a function
    Chat Chat.tsx:49
    React 40
    performWorkUntilDeadline scheduler.development.js:45
    scheduler react-dom_client.js:156
    scheduler react-dom_client.js:266
    __require chunk-4MBMRILA.js:11
    scheduler react-dom_client.js:277
    __require chunk-4MBMRILA.js:11
    React 2
    __require chunk-4MBMRILA.js:11
    dom React
    __require chunk-4MBMRILA.js:11
    <anonymous> react-dom_client.js:20192
Chat.tsx:49:7
An error occurred in the <Chat> component.

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://react.dev/link/error-boundaries to learn more about error boundaries.
react-dom-client.development.js:9362:15

​
Received new session key 26d5a42e0ff43fcdfaeb06caa26f25f2 for conversation cmi4l2y7f0008utzp6jayyd14
socket.ts:266 Failed to process new session key: TypeError: useAuthStore.getState(...).getPrivateKey is not a function
    at Socket2.<anonymous> (socket.ts:253:58)
    at Emitter.emit (socket__io-client.js?v=ded2e180:354:20)
    at Socket2.emitEvent (socket__io-client.js?v=ded2e180:2655:16)
    at Socket2.onevent (socket__io-client.js?v=ded2e180:2643:12)
    at Socket2.onpacket (socket__io-client.js?v=ded2e180:2614:14)
    at Emitter.emit (socket__io-client.js?v=ded2e180:354:20)
    at socket__io-client.js?v=ded2e180:3218:12
(anonymous) @ socket.ts:266
Emitter.emit @ socket__io-client.js?v=ded2e180:354
emitEvent @ socket__io-client.js?v=ded2e180:2655
onevent @ socket__io-client.js?v=ded2e180:2643
onpacket @ socket__io-client.js?v=ded2e180:2614
Emitter.emit @ socket__io-client.js?v=ded2e180:354
(anonymous) @ socket__io-client.js?v=ded2e180:3218
Promise.then
(anonymous) @ socket__io-client.js?v=ded2e180:372
ondecoded @ socket__io-client.js?v=ded2e180:3217
Emitter.emit @ socket__io-client.js?v=ded2e180:354
add @ socket__io-client.js?v=ded2e180:2069
ondata @ socket__io-client.js?v=ded2e180:3206
Emitter.emit @ socket__io-client.js?v=ded2e180:354
_onPacket @ socket__io-client.js?v=ded2e180:1379
Emitter.emit @ socket__io-client.js?v=ded2e180:354
onPacket @ socket__io-client.js?v=ded2e180:553
onData @ socket__io-client.js?v=ded2e180:545
ws.onmessage @ socket__io-client.js?v=ded2e180:1009