Kamu sedang mengerjakan proyek full-stack bernama **Chat-Lite**, sebuah aplikasi web chat dengan arsitektur:
- Frontend: React (Vite + TypeScript + Tailwind)
- Backend: Node.js (Express + Prisma + PostgreSQL)
- Realtime: Socket.io
- Struktur kode sudah rapi dan UI sudah responsif, jangan ubah gaya visual inti yang sudah ada.

---

## 🎯 Tujuan
Tambahkan fitur **pencarian pesan (Search Message)** agar pengguna dapat mencari teks dalam percakapan tertentu dan menyorot hasilnya secara otomatis di tampilan chat (ChatWindow).

Implementasi harus efisien, terintegrasi penuh dengan arsitektur yang ada, dan **tidak mengubah tampilan pesan (`MessageBubble`, `React`, atau menu titik tiga)**.

---

## ⚙️ Bagian Backend (Node.js / Express / Prisma / PostgreSQL)

1. **Buat endpoint baru:**
   - `GET /api/messages/search?q=<query>&conversationId=<id>`
   - Parameter:
     - `q`: teks pencarian (string, minimal 2 karakter)
     - `conversationId`: ID percakapan tempat pencarian dilakukan

2. **Logika pencarian:**
   - Gunakan Prisma ORM untuk mencari pesan di tabel `Message`.
   - Filter berdasarkan `conversationId`.
   - Gunakan pencarian teks menggunakan:
     - Prisma `contains` + `mode: 'insensitive'`
     - atau PostgreSQL Full-Text Search (`to_tsvector`) jika sudah dikonfigurasi.
   - Batasi hasil hingga 50 pesan.
   - Urutkan hasil berdasarkan `createdAt ASC`.

3. **Contoh respons JSON:**
   ```json
   {
     "success": true,
     "results": [
       {
         "id": "msg_203",
         "senderId": "usr_11",
         "content": "Hey, did you see the project update?",
         "createdAt": "2025-10-27T13:22:00Z"
       }
     ]
   }
````

4. **Keamanan dan validasi:**

   * Gunakan middleware autentikasi (`requireAuth`).
   * Pastikan pengguna adalah anggota dari percakapan tersebut.
   * Jika bukan, kirim `403 Forbidden`.

---

## 💻 Bagian Frontend (React / TypeScript / Tailwind)

### 🔹 Lokasi: `ChatHeader.tsx`

Tambahkan ikon dan input pencarian di header percakapan:

1. **UI & UX:**

   * Tambahkan ikon kaca pembesar (`🔍`) di sisi kanan `ChatHeader`.
   * Saat diklik, tampilkan input text (`<input type="text">`) dengan placeholder `"Search messages..."`.
   * Input dapat muncul sebagai:

     * Dropdown kecil di bawah header, atau
     * Modal overlay ringan (pilih yang sesuai dengan style Chat-Lite).
   * Tambahkan tombol `X` kecil untuk menutup pencarian.

2. **Interaksi pengguna:**

   * Saat pengguna mengetik dan menekan Enter:

     * Kirim request ke endpoint `/api/messages/search?q=<query>&conversationId=<id>`.
     * Gunakan `axios` atau helper API internal proyek.
   * Tampilkan hasil dalam:

     * Modal hasil pencarian **atau**
     * Highlight langsung di `ChatWindow`.

---

### 🔹 Lokasi: `ChatWindow.tsx`

Implementasikan mekanisme **highlight otomatis** pada hasil pencarian:

1. **Fungsi highlight:**

   * Setelah hasil pencarian diterima:

     * Scroll otomatis ke pesan pertama yang cocok menggunakan `scrollIntoView({ behavior: 'smooth' })`.
     * Tambahkan efek highlight sementara (misalnya animasi background kuning/purple muda transparan selama 2 detik).
   * Gunakan `useRef` dan `useEffect` untuk menangani scroll dan highlight.

2. **Efek visual:**

   * Tambahkan kelas Tailwind sementara, misalnya:

     ```tsx
     <div
       ref={messageRef}
       className={`transition-colors duration-700 ${
         isHighlighted ? 'bg-purple-100/30' : ''
       }`}
     >
       ...
     </div>
     ```
   * Setelah 2 detik, hilangkan efek highlight.

3. **State kontrol:**

   * Gunakan `useState` atau `Zustand` store (tergantung struktur proyek) untuk menyimpan:

     * `searchResults: Message[]`
     * `highlightedMessageId: string | null`
   * Saat user klik salah satu hasil pencarian di modal, set `highlightedMessageId` dan trigger scroll ke elemen tersebut.

---

## 🧩 Integrasi dan Perhatian

* **Jangan ubah tampilan atau komponen visual utama pesan**:

  * Jangan ubah `MessageBubble.tsx`
  * Jangan ubah struktur `React` (reaksi emoji)
  * Jangan ubah menu titik tiga atau aksi pesan
* Fokus hanya pada logika pencarian dan highlight.
* Pastikan kompatibilitas penuh dengan sistem real-time (socket).
* Jika pesan baru datang saat pencarian aktif, jangan reset hasil pencarian.

---

## ✅ Output yang Diharapkan

* Endpoint baru `/api/messages/search` bekerja dengan benar dan aman.
* UI pencarian tersedia dan konsisten di `ChatHeader.tsx`.
* Hasil pencarian dapat di-scroll dan di-highlight di `ChatWindow.tsx`.
* Tidak ada perubahan tampilan pada komponen `MessageBubble`, `React`, dan menu titik tiga.
* Performa tetap optimal dan tidak ada error di konsol browser/backend.

---