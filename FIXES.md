> **Role:**
> Kamu adalah *senior fullstack engineer* yang sedang memperbaiki bug pada aplikasi chat real-time (React + Zustand + Socket.IO + Node.js + Prisma).
> Fokus kamu hanya memperbaiki masalah **lastMessage tidak muncul atau tidak update di daftar percakapan (ChatList)**.
> **Jangan ubah logika lain apa pun** seperti pengiriman pesan, upload, enkripsi, atau sistem socket selain yang langsung berkaitan dengan pembaruan `lastMessage`.

---

### 🧠 Konteks Masalah

* Pada `ChatList`, kolom pesan terakhir (`lastMessage`) tidak menampilkan pesan terbaru setelah mengirim atau menerima pesan.
* Namun, pesan terkirim dan tampil di window chat dengan benar.
* Artinya event socket `message:new` berjalan, tetapi state `lastMessage` pada daftar percakapan **tidak diperbarui**.

---

### 🎯 Tujuan

1. Memastikan setiap kali ada pesan baru (baik teks maupun file), field `lastMessage` di ChatList langsung update tanpa refresh.
2. Menjaga agar logika chat lain (pesan, upload, typing, presence, dsb.) tidak berubah.
3. Memastikan sinkronisasi antara database dan UI tetap konsisten.

---

### 🧩 Langkah Perbaikan yang Harus Diterapkan

#### 1️⃣ Backend — Update `lastMessage` di Database

Pastikan endpoint `/api/messages` atau handler socket `message:new` **menyimpan pesan terakhir** ke tabel `Conversation`.

Contoh:

```ts
// server/src/socket.ts (atau controller pesan)
const message = await prisma.message.create({
  data: {
    content,
    type,
    conversationId,
    senderId,
  },
  include: { sender: true },
});

// Update lastMessage di conversation
await prisma.conversation.update({
  where: { id: conversationId },
  data: { lastMessageId: message.id },
});

// Emit pesan baru ke semua anggota
io.to(conversationId).emit("message:new", message);
```

> 🔒 Pastikan Gemini **tidak memodifikasi logika enkripsi, pengiriman file, atau validasi token** — hanya tambahkan bagian update `lastMessage`.

---

#### 2️⃣ Frontend — Sinkronisasi `lastMessage` via Socket

Pastikan handler socket `message:new` di `web/src/store/chat.ts` **memperbarui ChatList** selain hanya menambah pesan ke thread aktif.

```ts
socket.on("message:new", (message) => {
  set((state) => {
    // update messages di thread aktif
    if (state.activeConversation?.id === message.conversationId) {
      state.messages.push(message);
    }

    // update lastMessage di daftar percakapan
    state.conversations = state.conversations.map((conv) =>
      conv.id === message.conversationId
        ? { ...conv, lastMessage: message }
        : conv
    );
  });
});
```

---

#### 3️⃣ UI — Pastikan ChatList Render `lastMessage` dengan Aman

Di `web/src/components/ChatListItem.tsx`, pastikan render-nya seperti:

```tsx
<p className="text-sm text-gray-400 truncate">
  {conversation.lastMessage?.type === "file"
    ? "📎 File terkirim"
    : conversation.lastMessage?.content || "Tidak ada pesan"}
</p>
```

> 🔧 Gemini hanya boleh memperbarui bagian yang menampilkan `conversation.lastMessage`, tanpa mengubah struktur styling utama.

---

#### 4️⃣ Tes Otomatis (opsional)

Tambahkan console log sementara di frontend:

```ts
socket.on("message:new", (msg) => console.log("Last message update:", msg));
```

Dan pastikan setelah mengirim pesan, ChatList langsung menampilkan isi terbaru tanpa refresh.

---

### ✅ Hasil Akhir yang Diharapkan

| Skenario         | Hasil                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| Kirim pesan teks | ChatList langsung menampilkan pesan baru                                      |
| Kirim file       | ChatList menampilkan “📎 File terkirim”                                       |
| Pesan dihapus    | Jika pesan terakhir dihapus, ChatList menampilkan pesan sebelumnya (opsional) |
| Refresh halaman  | Data `lastMessage` tetap sinkron dari database                                |

---

### ⚠️ Batasan & Instruksi Keras

* ❌ Jangan ubah logika pengiriman pesan atau socket selain yang berhubungan langsung dengan pembaruan `lastMessage`.
* ❌ Jangan ubah tipe data Message, Conversation, atau struktur enkripsi.
* ✅ Pastikan hanya file berikut yang disunting:

  * `server/src/socket.ts` atau `server/src/routes/messages.ts`
  * `web/src/store/chat.ts`
  * `web/src/components/ChatListItem.tsx` (jika perlu tampilan)

---