Kamu sedang mengerjakan proyek web app **Chat-Lite**, dibangun dengan:
- Frontend: React (Vite + TypeScript + Tailwind)
- Backend: Node.js (Express + Prisma + PostgreSQL)
- Realtime: Socket.io

Fitur **Search Message** sudah berhasil diimplementasikan dan berfungsi dengan benar secara logika.  
Sekarang tugasmu adalah **memperbaiki tampilan UI** agar tampil profesional, bersih, dan konsisten dengan gaya desain Chat-Lite — tanpa mengubah UI utama percakapan.

---

## 🧩 Tujuan
Perbaiki tampilan **komponen pencarian pesan (search message)** yang saat ini terlihat tidak sejajar dan tumpang tindih (buggy).  
Pastikan UI-nya menyatu secara visual dengan komponen chat dan sidebar yang sudah ada.

---

## ⚙️ Area Fokus

### 🔹 1. Komponen `ChatHeader.tsx`
- Saat pengguna klik ikon search:
  - Input pencarian (`<input type="text">`) muncul dengan **animasi fade/slide lembut**, sejajar di area header.
  - Jangan sampai input menindih nama pengguna atau tombol lain.
  - Gunakan container fleksibel dengan `flex items-center gap-2 justify-between`.
- Pastikan tampilan tetap responsif di semua ukuran layar.
- Contoh gaya Tailwind:
  ```tsx
  <div className="relative flex items-center gap-2">
    <input
      type="text"
      placeholder="Search messages..."
      className="bg-neutral-800 text-sm text-gray-100 px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 w-56 transition-all duration-300"
    />
    <button className="text-gray-400 hover:text-white">
      <XIcon size={16} />
    </button>
  </div>
````

---

### 🔹 2. Komponen hasil pencarian (`SearchResultsList` atau setara)

Jika hasil pencarian ditampilkan di panel kanan (seperti saat ini), ubah tata letaknya agar:

* Tidak menimpa bubble pesan utama.
* Memiliki batas jelas antara area hasil pencarian dan area chat aktif.

Gunakan gaya berikut:

```tsx
<div className="absolute right-4 top-16 w-80 max-h-[60vh] overflow-y-auto bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg p-2 z-50">
  {results.length > 0 ? (
    results.map((msg) => (
      <div
        key={msg.id}
        className="p-2 rounded-md hover:bg-neutral-800 cursor-pointer transition-colors duration-150"
        onClick={() => handleSelect(msg.id)}
      >
        <p className="text-sm text-gray-200 truncate">{msg.content}</p>
        <span className="text-xs text-gray-500">
          {formatDate(msg.createdAt)}
        </span>
      </div>
    ))
  ) : (
    <p className="text-center text-gray-500 py-2 text-sm">No messages found</p>
  )}
</div>
```

**Catatan:**

* Pastikan panel hasil pencarian **mengambang (floating)** dan tidak menggeser layout utama.
* Gunakan `absolute` dengan posisi `top` yang sejajar di bawah header aktif.
* Tambahkan `z-index` tinggi agar tidak tertimpa bubble.

---

### 🔹 3. Animasi & UX

* Tambahkan animasi lembut saat input search muncul/menghilang menggunakan `framer-motion` atau `transition-opacity` Tailwind.
* Saat user membuka panel hasil pencarian, beri efek blur ringan pada latar belakang chat (gunakan backdrop-filter).
* Pastikan panel dapat ditutup dengan:

  * Menekan tombol `X`
  * Klik di luar area panel

---

### 🔹 4. Konsistensi Visual

Gunakan warna dan radius yang seragam dengan tema Chat-Lite:

* Warna latar belakang: `bg-neutral-900`
* Warna border: `border-neutral-700`
* Warna teks: `text-gray-200`
* Radius: `rounded-lg`
* Shadow: `shadow-lg shadow-black/30`
* Hover: `hover:bg-neutral-800`

---

## ⚠️ Batasan Penting

> ⚠️ Jangan ubah atau ganggu tampilan komponen berikut:
>
> * `MessageBubble.tsx` (tampilan pesan)
> * `React` (fitur emoji/reaksi)
> * Menu titik tiga (`⋯`) pada pesan
>
> Semua styling perubahan hanya berlaku untuk area pencarian pesan (search input dan daftar hasil).

---

## ✅ Output Diharapkan

* UI pencarian rapi, sejajar dengan header, tidak menutupi pesan.
* Hasil pencarian tampil elegan dan konsisten dengan tema gelap Chat-Lite.
* Tidak ada perubahan pada tampilan atau perilaku pesan utama.
* Responsif dan tidak mengganggu layout chat saat resize jendela.
* Animasi transisi lembut untuk input dan panel hasil.

---