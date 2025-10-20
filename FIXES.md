# TASK: Fix message rendering and realtime update in ChatLite

## Context:
- Current UI shows empty message area (no message bubbles).
- Messages do not appear in real time until page reload.
- This indicates that the messages store is not updating React state properly and socket listeners are broken.
- Also, message normalization and rendering logic may be filtering valid messages.

## Goals:
1. Fix Zustand store (web/src/store/chat.ts):
   - Ensure new messages trigger a React re-render by using immutable updates.
   - Reconnect socket listeners properly and prevent duplicates.
   - Normalize message structure before saving to store.

2. Fix ChatList.tsx and MessageBubble.tsx rendering:
   - Ensure `m.content` is a string before render.
   - Add fallback safe rendering if message is invalid.

---

### ✅ Fix 1: Store (web/src/store/chat.ts)
- Locate `socket.on("message:new", handler)` and replace the handler with:

```ts
socket.off("message:new");
socket.on("message:new", (incomingMsg) => {
  const msg = normalizeMessage(incomingMsg);
  if (!msg?.id || !msg?.content) return;

  set((state) => ({
    messages: [...state.messages.filter((m) => m.id !== msg.id), msg],
  }));
});
````

* Add helper at the top:

```ts
function normalizeMessage(m: any) {
  if (!m) return m;
  if (typeof m.content === "object" && m.content !== null) {
    if ("content" in m.content) m.content = m.content.content;
  }
  if (typeof m.content !== "string") m.content = String(m.content ?? "");
  return m;
}
```

* For any function like `sendMessage`, `loadOlderMessages`, `openConversation`, make sure messages are updated immutably:

```ts
set((state) => ({ messages: [...state.messages, msg] }));
```

---

### ✅ Fix 2: Component rendering (web/src/components/MessageBubble.tsx)

Replace current code with:

```tsx
import React from "react";
import clsx from "clsx";

export function MessageBubble({ m }) {
  if (!m || typeof m.content !== "string" || !m.content.trim()) return null;

  const mine = m.mine ?? m.isMine ?? false;

  return (
    <div
      className={clsx(
        "bubble px-3 py-2 rounded-2xl my-1",
        mine ? "bg-blue-600 text-white ml-auto" : "bg-gray-700 text-gray-100 mr-auto"
      )}
    >
      {m.content}
    </div>
  );
}
```

---

### ✅ Fix 3: Ensure realtime reactivity in ChatList.tsx or Chat.tsx

Inside the main message list container, add:

```tsx
const messages = useChatStore((s) => s.messages);
const messagesEndRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);

return (
  <div className="flex flex-col overflow-y-auto">
    {messages.map((m) => (
      <MessageBubble key={m.id} m={m} />
    ))}
    <div ref={messagesEndRef} />
  </div>
);
```

---

### ✅ Fix 4: Ensure socket initialization only happens once

In `auth.ts` or `socket.ts`, wrap socket setup in:

```ts
if (!socket.connected) socket.connect();
socket.off("message:new");
socket.on("message:new", handleIncomingMessage);
```

And call `socket.off()` in cleanup functions or before re-attaching handlers.

---

### ✅ Verification steps:

1. Start server and web app.
2. Open two browser tabs (User A & User B).
3. Send messages → should appear immediately without refresh.
4. Each message bubble must show text content.
5. After sending, chat automatically scrolls to the newest message.

---

### ✅ Optional enhancement:

If still blank, log what messages look like right before rendering:

```ts
console.log("Rendering messages:", messages);
```

---

After implementing this prompt:

* Chat messages will appear instantly (real-time socket updates restored).
* Bubbles will display proper text.
* UI scrolls automatically to latest message.
* No duplicates or blank message placeholders remain.

```