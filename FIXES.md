Kamu adalah AI Coder yang membantu memperbaiki proyek web app bernama **Chat-Lite**.  
Fokus tugasmu kali ini adalah memperbaiki UI pencarian dan pembaruan daftar grup, tanpa mengubah logika utama atau menghapus kode yang tidak berkaitan.

🎯 Tujuan Perbaikan:
1. **Kolom pencarian ganda**
   - Di sidebar kiri (komponen daftar chat), saat membuka tampilan "Search or start new chat", muncul **dua kolom pencarian**.
   - Kolom pertama di atas: “Search or start new chat…” (yang seharusnya dipakai).
   - Kolom kedua: “Search users…” (yang tidak perlu ditampilkan lagi).
   - Solusi:
     - Gabungkan fungsionalitas keduanya menjadi satu kolom pencarian di bagian atas.
     - Kolom ini harus bisa mencari:
       - 🔹 User (individual chat)
       - 🔹 Group (group chat)
     - Saat mengetik, hasil pencarian ditampilkan dinamis (misal dropdown list atau langsung di daftar).
     - Pastikan placeholder tetap: **“Search or start new chat…”**.

2. **Grup tidak muncul setelah dibuat**
   - Saat pengguna membuat grup baru (melalui tombol “+ Group”), grup berhasil dibuat di server tetapi tidak langsung muncul di daftar chat.
   - Sekarang pengguna harus me-refresh halaman agar grup tampil.
   - Solusi:
     - Setelah `createGroup()` sukses (atau event socket `group:created` diterima), **otomatis tambahkan grup baru ke daftar chat secara real-time.**
     - Jika socket sudah menyiarkan event `groupCreated` atau `group:created`, pastikan listener-nya aktif dan memicu re-render daftar chat.
     - Jika belum ada listener, tambahkan di tempat yang sesuai (`ChatList`, `Sidebar`, atau `useChatStore`).
     - Hindari re-fetch penuh; cukup tambahkan grup baru ke state lokal (`chats`, `groups`, atau sejenisnya).

🧩 Petunjuk Implementasi Teknis:

- Lokasi kemungkinan:
  - `web/src/components/Sidebar.tsx`
  - `web/src/components/SearchBar.tsx`
  - `web/src/components/ChatList.tsx`
  - `web/src/hooks/useChatStore.ts` atau `web/src/context/ChatContext.tsx`

- Untuk kolom pencarian:
  - Hapus atau sembunyikan input kedua (`Search users…`), gabungkan logikanya ke input pertama.
  - Tambahkan fungsi pencarian tunggal seperti:
    ```tsx
    const handleSearch = (query: string) => {
      setSearchQuery(query);
      const results = allChats.filter(chat =>
        chat.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredChats(results);
    };
    ```
  - Pastikan UI menggunakan `value={searchQuery}` dan `onChange={handleSearch}`.

- Untuk daftar grup:
  - Pastikan listener socket aktif, contoh:
    ```tsx
    socket.on("group:created", (newGroup) => {
      setChats(prev => [...prev, newGroup]);
    });
    ```
  - Jika event bernama lain, sesuaikan dengan event yang digunakan di backend.
  - Setelah ditambahkan, pastikan daftar otomatis ter-render ulang tanpa reload.

⚠️ Aturan:
- Jangan menghapus kode lain yang tidak berkaitan.
- Jangan ubah struktur logika socket, hanya tambahkan event handler bila perlu.
- Jangan ubah styling utama (tema dark modern).
- Pastikan kompatibilitas tetap dengan versi UI terbaru yang sudah responsif.

✅ Hasil yang Diharapkan:
- Sidebar hanya memiliki **satu kolom pencarian** yang berfungsi mencari user dan grup.
- Setelah grup baru dibuat, langsung tampil di daftar chat tanpa reload.
- Tidak ada regresi fungsi atau UI lain.