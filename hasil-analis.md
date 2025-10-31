# Analisis Proyek Chat-Lite

Dokumen ini merangkum analisis menyeluruh dari aplikasi Chat-Lite, mencakup arsitektur, fungsionalitas, dan potensi masalah.

---

### 1. **Struktur dan Arsitektur**

Proyek ini adalah monorepo dengan dua bagian utama: `server/` (backend) dan `web/` (frontend).

**Framework & Library Utama:**

*   **Backend (`server/`):**
    *   **Framework:** Node.js, Express.js
    *   **Real-time:** Socket.IO
    *   **Database ORM:** Prisma
    *   **Keamanan:** JWT (`jsonwebtoken`), `bcrypt`, `helmet`, `cors`
    *   **Lainnya:** `multer` (file uploads), `zod` (validasi), `web-push`

*   **Frontend (`web/`):**
    *   **Framework:** React, Vite
    *   **Styling:** TailwindCSS
    *   **State Management:** Zustand
    *   **Routing:** React Router
    *   **Real-time:** `socket.io-client`
    *   **UI Komponen:** `react-icons`, `@radix-ui/react-popover`
    *   **Kriptografi:** `libsodium-wrappers` (terindikasi untuk E2EE)

**Arsitektur Komunikasi:**

Aplikasi menggunakan **arsitektur hibrida**:
1.  **API REST:** Digunakan untuk operasi stateful seperti autentikasi (login/register), mengambil data awal (daftar chat, riwayat pesan), dan manajemen pengguna/grup. Dikelola oleh Express di `server/src/app.ts`.
2.  **WebSocket (Socket.IO):** Digunakan untuk semua komunikasi real-time setelah koneksi terjalin. Ini mencakup pengiriman/penerimaan pesan baru, status online, notifikasi pengetikan, reaksi, dll. Dikelola di `server/src/socket.ts`.

---

### 2. **Fungsi Utama Aplikasi**

Berdasarkan analisis file, berikut adalah fitur-fitur utama:

*   **Autentikasi:** ✅ Berfungsi. Menggunakan JWT (disimpan di cookie) dengan middleware di REST API dan Socket.IO.
*   **Real-time Chat Pribadi:** ✅ Berfungsi. Menggunakan event socket `message:new`.
*   **Real-time Chat Grup:** ✅ Berfungsi. Menggunakan sistem room dari Socket.IO.
*   **Typing Indicator:** ✅ Berfungsi. Menggunakan event `user:typing` dan `user:stopped-typing`.
*   **Online Status:** ✅ Berfungsi. Dikelola di server melalui map `onlineUsers` dan disiarkan melalui event `user:online` & `user:offline`.
*   **Reaksi Pesan:** ✅ Berfungsi. Menggunakan event `message:react` dan `message:updated`.
*   **Hapus Pesan:** ✅ Berfungsi. Menggunakan event `message:delete` dan `message:deleted`.
*   **Manajemen Grup:** ✅ Berfungsi. Dibuat melalui API, pembaruan disiarkan melalui socket (`conversation:new`, `conversation:deleted`).
*   **File Attachment:** ✅ Berfungsi. Upload ditangani melalui REST API (`/api/uploads`), dan pesan dengan lampiran dikirim melalui socket.
*   **End-to-End Encryption (E2EE):** ⚠️ Perlu cek. Terdapat dependensi `libsodium-wrappers` dan file `e2ee.ts`, `crypto.ts` di frontend, serta `keys.ts` di backend. Ini menandakan adanya infrastruktur untuk E2EE, namun fungsionalitas penuhnya perlu diverifikasi.

---

### 3. **Alur Kerja (Workflow)**

1.  **Inisialisasi:** Pengguna login melalui API REST. Server memvalidasi dan mengembalikan JWT.
2.  **Koneksi Socket:** Frontend menginisialisasi koneksi Socket.IO, mengirimkan JWT dalam *handshake* untuk autentikasi (`authSocketMiddleware`).
3.  **Pengiriman Pesan:**
    *   Input dari UI (`ChatWindow.tsx`) memicu fungsi yang memanggil `socket.emit('message:send', ...)`.
    *   Server (`socket.ts`) menerima event, memproses pesan (menyimpan ke DB), lalu menyiarkan `message:new` ke anggota percakapan (room).
4.  **Penerimaan Pesan:**
    *   Frontend (`Chat.tsx`) memiliki listener `socket.on('message:new', ...)`.
    *   Listener ini memanggil *action* dari store Zustand (`useMessageStore`).
    *   Store Zustand diperbarui, yang secara otomatis memicu re-render pada komponen React yang berlangganan (seperti `ChatWindow.tsx`).

**Event Socket.IO Utama:**
*   `connection`, `disconnect`
*   `message:send`, `message:new`, `message:read`, `message:delete`, `message:deleted`, `message:react`, `message:updated`
*   `user:typing`, `user:stopped-typing`
*   `user:online`, `user:offline`
*   `conversation:new`, `conversation:updated`, `conversation:deleted`

---

### 4. **Kondisi UI & UX**

*   **Komponen:** Struktur komponen cukup modular (`ChatItem`, `ChatList`, `MessageBubble`, dll).
*   **Styling:** Menggunakan TailwindCSS secara ekstensif. Konfigurasi ada di `tailwind.config.ts`. Tidak ada indikasi *dark mode* aktif.
*   **Interaktivitas:** Terdapat elemen interaktif seperti `Reactions.tsx`, `OnlineDot.tsx`, dan menu popover dari Radix UI.
*   **Responsivitas:** Perlu diuji secara manual, namun penggunaan TailwindCSS biasanya memfasilitasi desain responsif.

---

### 5. **State Management**

*   **Zustand:** Digunakan sebagai state management global di frontend.
*   **Struktur Store:** State dibagi menjadi beberapa *slice* yang logis: `auth.ts`, `conversation.ts`, `message.ts`, `presence.ts`.
*   **Alur Update:** Komponen UI tidak secara langsung menangani logika event socket. Event listener di `Chat.tsx` bertindak sebagai jembatan yang meneruskan data dari socket ke store Zustand. Komponen kemudian bereaksi terhadap perubahan di store. Ini adalah pola yang baik dan terpusat.

---

### 6. **Keamanan & Koneksi**

*   **Autentikasi:** Cukup kuat. Token JWT diverifikasi di semua endpoint API yang dilindungi dan pada saat koneksi awal Socket.IO.
*   **Transport:** Koneksi socket aman karena token dikirim dalam payload `auth` saat *handshake*, bukan sebagai parameter query.
*   **Middleware:** Penggunaan `helmet` dan `cors` di backend adalah praktik keamanan standar yang baik.
*   **Otorisasi:** Logika di sisi server (misalnya saat mengirim pesan) tampaknya memastikan bahwa pengguna hanya dapat berinteraksi dalam percakapan di mana mereka menjadi anggota.

---

### 7. **Masalah Potensial & Area Risiko**

*   **Duplikasi Event Listener:** Di `web/src/pages/Chat.tsx`, `useEffect` yang mengatur listener socket tidak memiliki fungsi *cleanup* yang benar untuk menghapus semua listener (`socket.off(...)`). Jika komponen ini di-unmount dan di-mount kembali, ini akan menyebabkan listener duplikat, memicu beberapa pembaruan state untuk satu event. **Ini adalah risiko tinggi.**
*   **Sinkronisasi Fitur:** Fitur seperti pembuatan grup bergantung pada panggilan API awal. Jika siaran socket gagal, UI bisa menjadi tidak sinkron dengan server sampai di-refresh manual.
*   **Manajemen Koneksi Socket:** Logika koneksi dan diskoneksi socket tersebar. Perlu dipastikan bahwa `socket.disconnect()` dipanggil dengan benar saat pengguna logout untuk membersihkan sumber daya di server.
*   **Kompleksitas Komponen:** `Chat.tsx` menjadi sangat kompleks karena menangani semua logika listener socket. Ini bisa menjadi kandidat untuk refactor dengan memindahkannya ke *custom hook* (misalnya `useSocketEvents`).

---

### 8. **Output Analisis & Rekomendasi**

*   **Ringkasan Logika:** UI (React) → State (Zustand) → Socket Client → Socket Server (Node.js/Socket.IO) → Database (Prisma).
*   **Dependensi Kunci:** React, Socket.IO, Zustand, Prisma, Express, TailwindCSS.
*   **Area Risiko Tinggi:** Manajemen *event listener* di `Chat.tsx` adalah prioritas utama untuk diperbaiki guna mencegah kebocoran memori dan bug.
*   **Rekomendasi Singkat:**
    1.  **Stabilisasi:** Segera perbaiki masalah *event listener* di `Chat.tsx` dengan menambahkan fungsi *cleanup* yang komprehensif di dalam `useEffect`.
    2.  **Refactor:** Ekstrak semua logika penanganan event socket dari `Chat.tsx` ke dalam satu atau beberapa *custom hooks* (misalnya `useSocketListeners`) untuk memisahkan *concerns* dan membuat komponen lebih bersih.
    3.  **Verifikasi E2EE:** Lakukan audit pada alur kerja enkripsi untuk memastikan implementasinya benar dan aman dari ujung ke ujung.
