> **Instruksi Lengkap:**
>
> Kamu adalah seorang *senior fullstack engineer* yang sedang melakukan **debug dan analisis sistem chat real-time ChatLite**.
> Setelah integrasi beberapa fitur baru (delete message, emoji reactions, push notification), kini muncul bug baru:
>
> ---
>
> 🧠 **Masalah:**
> Saat pengguna mengirim pesan, status pesan di UI tetap `sending...` dan **tidak pernah berubah menjadi “sent”** atau dikonfirmasi berhasil, meskipun pesan sebenarnya mungkin sudah terkirim ke backend.
> --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
>
> **Tugasmu adalah melakukan audit dan analisa mendalam pada keseluruhan alur pengiriman pesan**, lalu berikan *fix atau patch rekomendasi* yang spesifik.
>
> Analisis meliputi:
>
> 1. **Frontend (web/):**
>
>    * File utama terkait pengiriman pesan:
>      `ChatWindow.tsx`, `store/chat.ts`, dan `lib/socket.ts`
>    * Periksa apakah fungsi `sendMessage()` benar-benar menunggu respons server / event `message:new` sebelum mengubah status `sending → sent`.
>    * Cek apakah `socket.emit("message:new", messageData, callback)` masih memiliki callback acknowledgment dari server.
>    * Pastikan handler `socket.on("message:new")` di frontend masih aktif setelah implementasi fitur baru.
> 2. **Backend (server/):**
>
>    * File utama terkait pesan:
>      `routes/messages.ts`, `socket.ts`
>    * Pastikan server-side event `socket.on("message:new", ...)` menerima payload dari frontend dan memanggil `io.to(conversationId).emit("message:new", message)` untuk broadcast balik.
>    * Cek apakah ada error di proses `prisma.message.create()` yang menyebabkan promise tidak pernah resolve, membuat frontend stuck.
>    * Verifikasi bahwa setelah `message` disimpan, server mengirimkan ACK balik ke pengirim (contoh: `callback(message)` atau `socket.emit("message:ack", message)`).
> 3. **Middleware / Integrasi:**
>
>    * Pastikan middleware autentikasi socket tidak memblokir event `message:new` setelah perubahan di fitur push notification.
>    * Cek apakah ada konflik dengan event lain (`message:deleted`, `reaction:new`, dll.) yang override namespace `message:new`.
>
> ---
>
> 🧾 **Output yang Diharapkan:**
>
> 1. Jelaskan *alur eksekusi pesan dari klik kirim hingga tampil di penerima*, lalu tandai di titik mana proses macet.
> 2. Identifikasi baris kode (atau fungsi) yang menyebabkan status `sending` tidak berubah.
> 3. Jika ada event socket yang tidak pernah di-emit / tidak match, tunjukkan perbedaannya (misal `message:new` vs `message:create`).
> 4. Berikan **kode fix langsung**, misalnya:
>
>    ```ts
>    socket.emit("message:new", payload, (serverMessage) => {
>      updateMessageStatus(serverMessage.id, "sent");
>    });
>    ```
>
>    atau patch backend dengan:
>
>    ```ts
>    socket.on("message:new", async (data, callback) => {
>      const message = await prisma.message.create({ ... });
>      io.to(data.conversationId).emit("message:new", message);
>      callback(message); // <— ACK balik
>    });
>    ```
> 5. Tambahkan rekomendasi pengujian untuk memverifikasi fix-nya.
>
> ---
>
> 💡 **Tujuan Akhir:**
> Setelah audit dan perbaikan:
>
> * Pesan baru langsung berubah status dari `sending` → `sent` setelah ACK server diterima.
> * Pesan tampil di UI penerima secara real-time.
> * Tidak ada error di console atau pending promise di `sendMessage()`.

---