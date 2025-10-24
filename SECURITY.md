Kamu adalah AI Developer Assistant yang bertugas melakukan **analisis menyeluruh proyek web app bernama "Chat-Lite"**.  
Analisis ini bertujuan agar kamu sepenuhnya memahami kondisi aplikasi saat ini sebelum melanjutkan perbaikan atau penambahan fitur.

📦 Konteks:
Proyek Chat-Lite adalah aplikasi chat real-time berbasis React + TypeScript di sisi frontend dan Node.js/Express + Socket.IO di sisi backend.  
Struktur monorepo terdiri dari dua folder utama:
- `web/` → frontend client
- `server/` → backend API & socket server

---

### 🎯 Tujuan Analisis
Kamu harus memahami dan menjelaskan (secara internal) aspek berikut:

#### 1. **Struktur dan Arsitektur**
- Identifikasi semua direktori dan file penting dalam `web/` dan `server/`.
- Petakan struktur proyek (komponen, hooks, context, utils, service, dan konfigurasi).
- Deteksi framework, library utama, dan dependency yang digunakan (misalnya: Vite, React Router, TailwindCSS, Zustand/Context API, Socket.IO client, JWT, bcrypt, dsb).
- Tentukan arsitektur komunikasi antara `server/` dan `web/` (API REST vs WebSocket).

#### 2. **Fungsi Utama Aplikasi**
- Identifikasi dan jelaskan fitur utama aplikasi:
  - Autentikasi (login/register/token)
  - Realtime chat (pesan pribadi dan grup)
  - Typing indicator
  - Online status
  - Reaction dan delete message
  - Group management (create, join, delete)
  - File attachment
- Catat dependensi antar fitur — misalnya: “typing indicator” bergantung pada socket event `typing:start` dan `typing:stop`.

#### 3. **Alur Kerja (Workflow)**
- Jelaskan bagaimana data mengalir:
  - Dari user input (UI) → ke state/frontend logic → ke backend → lalu ke socket broadcast.
- Catat semua event Socket.IO yang digunakan di client dan server (mis. `message`, `deleteMessage`, `group:created`, `typing`, `user:online`).
- Tentukan bagaimana frontend melakukan re-render setelah menerima event socket.

#### 4. **Kondisi UI & UX**
- Audit semua komponen UI (ChatWindow, Sidebar, MessageItem, InputBar, GroupList, dsb).
- Catat implementasi TailwindCSS dan custom theme (warna, font, dark mode).
- Identifikasi apakah UI sudah:
  - Responsif di semua layar.
  - Konsisten antar komponen.
  - Mengandung elemen interaktif seperti menu ⋮, tombol reaction, indikator status.

#### 5. **State Management**
- Analisis mekanisme penyimpanan state global (Context API, Zustand, Redux, dsb).
- Pastikan bagaimana state `chats`, `messages`, `users`, dan `groups` diatur dan di-update dari event socket.

#### 6. **Keamanan & Koneksi**
- Audit bagaimana autentikasi dan otorisasi ditangani:
  - Token JWT
  - Middleware socket auth (misalnya di `server/src/middleware/auth.ts`)
- Periksa apakah koneksi socket aman (misalnya token dikirim via handshake).

#### 7. **Masalah Potensial**
- Deteksi dan catat:
  - Duplikasi event listener socket.
  - Kondisi re-render berulang.
  - Ketidakkonsistenan antara data client dan server.
  - Fitur yang tampak tidak sinkron (mis. grup baru perlu refresh).
  - Komponen dengan kode UI bertumpuk (seperti dua kolom search).
  - CSS redundancy atau konflik Tailwind class.

#### 8. **Output Analisis**
Buat ringkasan analisis yang mencakup:
- Daftar fitur aktif dan statusnya (✅ Berfungsi / ⚠️ Perlu cek / ❌ Rusak)
- Struktur logika utama (UI → state → socket → server)
- Dependensi penting proyek
- Area risiko tinggi untuk refactor (komponen dengan event listener banyak, atau fungsi socket yang bercampur dengan UI)
- Rekomendasi singkat untuk stabilisasi sistem

---

### ⚙️ Aturan
- **Jangan ubah kode apapun** selama proses analisis.
- Hanya baca, pahami, dan catat hasilnya.
- Setelah selesai analisis, kamu boleh menyarankan area yang layak diperbaiki, tapi tidak menulis ulang kode.

📍 Fokuskan hasil analisis agar kamu memiliki *pemahaman penuh terhadap arsitektur dan logika proyek Chat-Lite* sebelum melakukan prompt perbaikan atau refactor berikutnya.