## ⚙️ Prompt Lanjutan — Peta Alur Data & Socket Flow Chat-Lite

```
Sekarang kamu sudah menyelesaikan analisis arsitektur dan kondisi proyek Chat-Lite.

Lanjutkan dengan membuat **peta logika dan alur data menyeluruh sistem Chat-Lite**, agar kamu benar-benar memahami interaksi antar komponen, socket event, dan data flow di antara frontend ↔ backend ↔ database.

---

### 🎯 Tujuan
Buat analisis visual (dalam bentuk teks terstruktur) yang menjelaskan seluruh:
1. **Alur data utama (Data Flow)**
2. **Event Socket.IO dan dependensinya**
3. **Hubungan antar komponen dan state (Frontend Flow)**
4. **Interaksi Client ↔ Server**
5. **Keterkaitan antar fitur besar (Chat, Group, Typing, Auth, dsb)**

---

### 🧩 Detail yang Harus Dijelaskan

#### 1. Peta Alur Data
Tampilkan urutan proses dari awal:
```

[User Action] → [Frontend Component] → [State/Context] → [API/Socket Event] → [Backend Logic] → [Database] → [Socket Broadcast] → [Client Update]

```

Jelaskan untuk setiap fitur utama:
- Login / Register
- Chat pribadi
- Chat grup
- Pembuatan grup
- Pengiriman & penerimaan pesan
- File attachment
- Reaction dan delete message
- Typing indicator
- Status online / offline

Gunakan gaya seperti berikut:
```

📨 Message Flow:
User kirim pesan → InputBar.jsx → messagesContext.addMessage() → socket.emit('sendMessage', payload)
→ server on('sendMessage') → simpan ke database → io.emit('message:new', data) → client receive → re-render MessageList

```

---

#### 2. Peta Event Socket.IO
Buat daftar semua event Socket.IO yang ditemukan di client dan server, beserta arah dan fungsinya. Contoh:
```

Client → Server:

* 'sendMessage': kirim pesan baru
* 'typing:start': notifikasi sedang mengetik
* 'group:create': buat grup baru

Server → Client:

* 'message:new': broadcast pesan baru
* 'group:created': grup baru muncul
* 'user:online': update status user

```

Tambahkan keterangan: event mana yang memiliki keterlambatan, error handler, atau potensi race condition.

---

#### 3. Hubungan Antar Komponen (Frontend)
Buat diagram teks atau hierarki komponen seperti ini:
```

<App>
 ├── <Sidebar>
 │    ├── <SearchBar> 
 │    ├── <UserList>
 │    └── <GroupList>
 ├── <ChatWindow>
 │    ├── <MessageList>
 │    ├── <MessageItem>
 │    └── <InputBar>
 └── <SettingsModal>
```
Tambahkan penjelasan:
- Komponen mana yang menyimpan state lokal.
- Komponen mana yang bergantung pada context global (user, chat, socket, dsb).
- Event apa yang menghubungkan antar komponen.

---

#### 4. Integrasi API & Backend Logic

Untuk setiap endpoint atau fungsi di `server/`, jelaskan:

* Endpoint/path (mis. `/api/auth/login`, `/api/chat/send`)
* Tujuan dan data yang dikirim/diterima
* Middleware yang digunakan (mis. JWT auth)
* Interaksi dengan database

---

#### 5. Pemetaan Group dan User System

Jelaskan bagaimana sistem grup dan user saling berhubungan, misalnya:

```
User 1 ─┬─ Group A
         ├─ Group B
User 2 ──┘
```

dan bagaimana data ini dikirim melalui socket event `group:created`, `group:join`, dsb.

---

#### 6. Temuan & Insight

Buat kesimpulan akhir yang berisi:

* Fitur yang sudah sinkron sepenuhnya (✅)
* Fitur yang belum realtime (⚠️ butuh refresh manual)
* Fitur yang masih rawan race condition atau duplikasi listener
* Saran singkat stabilisasi socket dan optimasi UI

---