Task: Fix circular dependencies causing "getState is undefined" and restore broken Socket.IO event listeners.

Context: During the recent service extractions, some `useXStore.getState()` calls were likely placed at the top level of service files, causing circular dependency crashes during module evaluation. Additionally, the socket event listeners at the bottom of `web/src/store/message.ts` are wrapped in an `if (socket)` block at the module level, meaning they evaluate to `null` on load and never attach.

Action Plan & Directives:

1. Fix Top-Level `.getState()` Calls:
   - Scan ALL files in `web/src/services/` (especially `auth.service.ts`, `messageHandler.service.ts`, `conversation.service.ts`, `sessionKey.service.ts`).
   - Look for any line like `const authState = useAuthStore.getState();` or `const user = useAuthStore.getState().user;` or `const state = useMessageStore.getState();` that is OUTSIDE of a function (at the module/top level).
   - MOVE these calls INSIDE the specific exported functions that actually need them. No Zustand `.getState()` should ever run at the top level of a file.

2. Restore Socket Listeners in `web/src/lib/socket.ts`:
   - Open `web/src/lib/socket.ts`.
   - Locate the `connectSocket` function. After the `socket = io(...)` is initialized and `socket.on("connect", ...)` is defined, ensure the message listeners are registered here.
   - Example to add inside `connectSocket` after connection:
     ```typescript
     socket.on('message:new', async (message: Message) => {
       await useMessageStore.getState().addIncomingMessage(message.conversationId, message);
     });
     socket.on('message:deleted', ({ id, conversationId }: { id: string; conversationId: string }) => {
       useMessageStore.getState().removeMessage(conversationId, id);
     });
     socket.on('message:updated', (message: Message) => {
       useMessageStore.getState().updateMessage(message.conversationId, message.id, message);
     });
     socket.on('message:status_updated', ({ messageId, conversationId, readBy, status }: { messageId: string; conversationId: string; readBy?: string; status?: 'SENT' | 'DELIVERED' | 'READ' }) => {
       if (readBy && status) {
         useMessageStore.getState().updateMessageStatus(conversationId, messageId, readBy, status);
       }
     });
     ```
   - Ensure the offline queue processor is also triggered inside `socket.on("connect", ...)`: `useMessageStore.getState().processOfflineQueue();`.

3. Clean up `web/src/store/message.ts`:
   - Scroll to the bottom of `web/src/store/message.ts`.
   - DELETE the entire block starting with `// Setup socket listeners` and `const socket = getSocket(); if (socket) { ... }`. We have safely moved this back to `socket.ts` where it belongs.

Please execute these critical runtime fixes.