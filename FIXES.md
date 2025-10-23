> **Role:**
> Kamu adalah *senior fullstack realtime developer* yang diminta untuk memulihkan fitur realtime chat yang sebelumnya sudah stabil, dan memperbaiki fitur yang belum berfungsi. Aplikasi ini menggunakan **React + Zustand + Socket.IO + Node.js/Express backend**.

---

### 🎯 Tujuan

Kembalikan stabilitas penuh fitur realtime ChatLite:

| Fitur                       | Status Sebelumnya                   | Target                                                     |
| --------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| Typing Indicator            | ✅ Berfungsi (sebelum update)        | Pulihkan fungsionalitas seperti sebelumnya                 |
| Realtime Delete             | ✅ Berfungsi (sebelum update)        | Pulihkan agar tetap realtime & bubble berubah ke “deleted” |
| Online Indicator (Presence) | ⚠️ Tidak berfungsi (selalu abu-abu) | Perbaiki agar berubah hijau saat user online               |
| Reactions                   | ⚠️ Tidak tampil                     | Aktifkan & tampilkan tombol emoji + sinkronisasi realtime  |

---

### 🧠 Instruksi Teknis Detail

#### 1️⃣ **Restore Typing Indicator**

* Ambil implementasi **sebelum update terakhir** (versi yang bekerja).
* Pastikan event client → server → broadcast berjalan pakai event lama:

  ```ts
  socket.emit("typing", { conversationId, isTyping: true })
  ```

  dan server broadcast ke semua member:

  ```ts
  socket.to(conversationId).emit("typing", { userId, isTyping });
  ```
* Gunakan kembali state `typingUsers` di frontend (Zustand/React) dan jangan ubah structure-nya.
* Typing indicator muncul & hilang otomatis sesuai event lama.

#### 2️⃣ **Restore Delete Message Realtime**

* Gunakan event lama, misal:

  ```ts
  socket.emit("deleteMessage", { messageId, conversationId });
  socket.on("messageDeleted", ({ messageId }) => removeMessage(messageId));
  ```
* Pastikan:

  * Pesan yang dihapus berubah jadi “This message was deleted” (tanpa reload).
  * Di database benar-benar terhapus.
  * Broadcast tetap jalan antar client seperti sebelumnya.

#### 3️⃣ **Fix Online Indicator (Presence)**

* Implementasikan server-side tracking menggunakan `Map` atau `Set` untuk menyimpan userId yang online.

  ```ts
  const onlineUsers = new Set();

  io.on("connection", (socket) => {
    const userId = socket.user?.id;
    if (!userId) return;

    onlineUsers.add(userId);
    io.emit("presence:update", Array.from(onlineUsers));

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      io.emit("presence:update", Array.from(onlineUsers));
    });
  });
  ```
* Di frontend:

  ```tsx
  socket.on("presence:update", (usersOnline) => setOnlineUsers(usersOnline));
  ```

  dan di UI:

  ```tsx
  <span className={`dot ${onlineUsers.includes(user.id) ? "bg-green-500" : "bg-gray-500"}`} />
  ```

#### 4️⃣ **Add & Activate Message Reactions**

* Implement event baru:

  ```ts
  socket.on("reaction:add", (data) => {
    io.to(data.conversationId).emit("reaction:update", data);
  });
  ```
* UI:

  * Saat hover bubble pesan → muncul tombol emoji kecil (misal ❤️, 😂, 👍).
  * Klik emoji → kirim event `reaction:add`.
  * Update tampilan pesan dengan jumlah & jenis emoji yang sudah diberikan.

  contoh frontend snippet:

  ```tsx
  <div
    onMouseEnter={() => setHover(true)}
    onMouseLeave={() => setHover(false)}
    className="relative group"
  >
    <p>{message.text}</p>

    {hover && (
      <div className="absolute right-0 top-0 flex gap-1">
        {["❤️", "😂", "👍", "😮"].map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReaction(message.id, emoji)}
            className="bg-gray-700 rounded-full p-1 text-sm hover:scale-110 transition"
          >
            {emoji}
          </button>
        ))}
      </div>
    )}

    {message.reactions?.length > 0 && (
      <div className="flex gap-1 mt-1 text-xs">
        {message.reactions.map((r) => (
          <span key={r.emoji}>{r.emoji}</span>
        ))}
      </div>
    )}
  </div>
  ```
* Pastikan `reaction:update` sinkron di semua client tanpa reload.

---

### ✅ **Checklist Hasil Akhir**

| Fitur              | Behavior                                        | Status |
| ------------------ | ----------------------------------------------- | ------ |
| Typing Indicator   | Muncul realtime antar 2 akun                    | ✅      |
| Delete Message     | Bubble berubah ke “deleted” realtime            | ✅      |
| Presence Indicator | Dot berubah hijau saat online                   | ✅      |
| Reaction           | Tombol muncul saat hover, emoji tampil realtime | ✅      |

---

### 🧩 Tips Gemini

> Jika logic typing & delete sudah ter-overwrite, ambil versi stable dari backup atau commit sebelumnya, lalu gabungkan kembali dengan kode baru yang mengatur presence & reactions.
> Pastikan tidak menimpa event `typing` dan `deleteMessage` lama.

---