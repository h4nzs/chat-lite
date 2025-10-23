# TASK: Fix message synchronization and real-time persistence in ChatLite

## Context
Messages now display only for seed data from database.
Newly sent or received messages appear briefly or not at all.
This means:
- The socket "message:new" handler is not properly updating the store,
- Or openConversation() is overwriting state after fetch,
- Or message IDs are missing and filtered out.

---

## Goals
1. Ensure new messages from socket are added to store persistently.
2. Prevent openConversation() or loadMessages() from overwriting existing messages.
3. Make sure message IDs are handled correctly (skip only if truly missing).
4. Verify conversation filtering and active conversation behavior.

---

### ✅ Step 1: Fix socket message handler (in web/src/store/chat.ts)
Replace current socket listener with:

```ts
socket.off("message:new");
socket.on("message:new", (msg) => {
  if (!msg) return;

  // Normalize message content
  msg.content = normalizeMessageContent(msg.content);

  // Skip only if ID truly missing
  if (!msg.id) {
    console.warn("Received message without ID:", msg);
    return;
  }

  // Add message if it's for the current conversation
  const activeId = get().activeConversationId;
  if (msg.conversationId !== activeId) return;

  set((state) => {
    const exists = state.messages.some((m) => m.id === msg.id);
    if (exists) return {}; // skip duplicates

    const merged = [...state.messages, msg];
    return { messages: merged };
  });
});
````

---

### ✅ Step 2: Fix openConversation()

In openConversation(), **remove or comment out any** `set({ messages: ... })`.
Replace with merge:

```ts
if (data?.messages?.length) {
  set((state) => {
    const existing = state.messages ?? [];
    const merged = [...existing];
    for (const m of data.messages) {
      m.content = normalizeMessageContent(m.content);
      if (!merged.find((x) => x.id === m.id)) merged.push(m);
    }
    return { messages: merged };
  });
}
```

---

### ✅ Step 3: Add logging for debugging

Before every set() call, log:

```ts
console.log("Updating messages:", get().messages.length, "→", newMessages.length);
```

---

### ✅ Step 4: Verify

1. Open chat in two browsers.
2. Send message → must appear instantly and stay visible.
3. Refresh both browsers → messages persist.
4. No message disappears after a second.
5. Console should log “Received message without ID” if backend fails to provide one.

---

### ✅ Step 5: Backend verification

Ensure server emits messages **after Prisma saves**:

```js
const saved = await prisma.message.create({ data: { ... } });
io.emit("message:new", saved);
```

---

After implementing this patch:

* Messages will persist across socket updates and page reloads.
* Both sender and receiver see new messages instantly.
* Store no longer overwrites live data after fetch.
* Logs clearly show when backend sends invalid messages.

```