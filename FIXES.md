> **Peran:**
> Kamu adalah *Fullstack Realtime Engineer* yang bertugas memperbaiki integrasi **Socket.IO dan UI Realtime Update** di proyek ChatLite.
>
> Fokus utama: memperbaiki event socket `typing`, `presence`, `reaction`, dan `message:deleted` agar semuanya **sinkron secara real-time antar pengguna**, tanpa reload atau refresh manual.
>
> Stack:
>
> * Frontend: React + Zustand + Socket.IO client
> * Backend: Node.js (Express) + Prisma + Socket.IO server

---

### 🎯 **Tujuan Utama**

Perbaiki dan sinkronkan:

1. ✍️ **Typing Indicator** — Harus muncul di user lain saat seseorang mengetik, lalu hilang otomatis setelah delay.
2. 🟢 **Presence Indicator** — Avatar user harus berubah dari abu-abu ke hijau ketika user online.
3. 💬 **Reaction Button** — Tombol reaction muncul saat hover message, event `reaction:new` dan `reaction:remove` bekerja realtime.
4. 🗑️ **Delete Message** — Ketika pesan dihapus:

   * Bubble pesan langsung berubah jadi “message deleted” tanpa reload.
   * Event socket broadcast ke semua klien.
   * Pesan benar-benar dihapus di database Prisma.
   * Tidak ada bug pada pagination atau infinite scroll setelah penghapusan.

---

### 🧩 **Langkah Perbaikan Terperinci**

#### 1️⃣ **Perbaiki Typing Indicator**

* **Backend (server/src/socket.ts):**

  ```ts
  socket.on("typing:start", ({ conversationId, userId }) => {
    socket.to(conversationId).emit("typing:update", { userId, isTyping: true });
  });

  socket.on("typing:stop", ({ conversationId, userId }) => {
    socket.to(conversationId).emit("typing:update", { userId, isTyping: false });
  });
  ```
* **Frontend (web/src/store/chat.ts):**

  * Pastikan `socket.emit("typing:start")` dijalankan saat user mengetik dan `typing:stop` saat berhenti (gunakan `debounce` 1 detik).
  * Tambahkan listener:

    ```ts
    socket.on("typing:update", ({ userId, isTyping }) => {
      updateUserTypingState(userId, isTyping);
    });
    ```
  * Update komponen header/chat agar menampilkan indikator “Typing…” bila user tersebut aktif mengetik.

---

#### 2️⃣ **Perbaiki Presence Indicator**

* **Backend:**

  * Emit presence saat user connect/disconnect:

    ```ts
    io.emit("presence:update", { userId, status: "online" });
    socket.on("disconnect", () => {
      io.emit("presence:update", { userId, status: "offline" });
    });
    ```
* **Frontend:**

  * Listener:

    ```ts
    socket.on("presence:update", ({ userId, status }) => {
      setUserPresence(userId, status === "online");
    });
    ```
  * Update UI avatar agar otomatis berubah:

    ```tsx
    <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-gray-500"}`} />
    ```

---

#### 3️⃣ **Aktifkan Tombol Reaction**

* Pastikan tombol reaction muncul di hover `MessageItem`.
* **Backend:**

  * Tambahkan event real-time:

    ```ts
    socket.on("reaction:add", async ({ messageId, emoji, userId, conversationId }) => {
      await prisma.reaction.create({ data: { emoji, userId, messageId } });
      io.to(conversationId).emit("reaction:new", { messageId, emoji, userId });
    });
    ```
* **Frontend:**

  * Emit saat user pilih emoji:

    ```ts
    socket.emit("reaction:add", { messageId, emoji, userId, conversationId });
    ```
  * Listener:

    ```ts
    socket.on("reaction:new", ({ messageId, emoji, userId }) => {
      addReactionToMessage(messageId, { emoji, userId });
    });
    ```

---

#### 4️⃣ **Fix Delete Message Realtime**

* **Backend:**

  ```ts
  app.delete("/api/messages/:conversationId/:messageId", async (req, res) => {
    const { conversationId, messageId } = req.params;
    await prisma.message.delete({ where: { id: messageId } });
    io.to(conversationId).emit("message:deleted", { messageId });
    res.sendStatus(200);
  });
  ```
* **Frontend (web/src/store/chat.ts):**

  * Listener:

    ```ts
    socket.on("message:deleted", ({ messageId }) => {
      updateMessageState(messageId, { deleted: true });
    });
    ```
  * UI:

    ```tsx
    {message.deleted ? (
      <p className="italic text-gray-400">This message was deleted</p>
    ) : (
      <p>{message.text}</p>
    )}
    ```

---

### 🧪 **Checklist Testing**

| Fitur          | Aksi                    | Expected Result                                          |
| -------------- | ----------------------- | -------------------------------------------------------- |
| Typing         | User A mengetik di chat | User B lihat "Typing..." muncul & hilang otomatis        |
| Presence       | User A login/logout     | User B lihat indikator hijau/abu muncul/hilang           |
| Reaction       | Hover + pilih emoji     | Emoji muncul realtime di bubble pesan semua user         |
| Delete Message | User A hapus pesan      | Pesan berubah jadi “deleted” di semua klien tanpa reload |
| DB Sync        | Cek database Prisma     | Pesan yang dihapus benar-benar hilang                    |

---

### 🧠 **Output yang Diharapkan**

* Semua socket event (`typing:update`, `presence:update`, `reaction:new`, `message:deleted`) sinkron di dua akun berbeda.
* Tidak perlu reload halaman untuk melihat perubahan.
* Pesan pending dan pesan dihapus bekerja konsisten di UI dan database.
* Log konsol `[SOCKET EVENT]` muncul untuk debugging tiap event.

---