import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";
import { useAuthStore } from "@store/auth";
import { useConversationStore } from "@store/conversation";
import { useMessageStore, decryptMessageObject } from "@store/message";
import { useConnectionStore } from "@store/connection";
import { usePresenceStore } from "@store/presence";
import { fulfillKeyRequest, storeReceivedSessionKey } from "@utils/crypto";
import { useKeychainStore } from "@store/keychain";
import type { Message } from "@store/conversation";

const WS_URL = (import.meta.env.VITE_WS_URL as string) || "http://localhost:4000";
let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(WS_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: false,
      path: "/socket.io",
    });

    const { setStatus } = useConnectionStore.getState();
    const { addOrUpdate, setOnlineUsers, userJoined, userLeft } = usePresenceStore.getState();
    const { addIncomingMessage, updateMessage, addReaction, removeReaction, updateMessageStatus } = useMessageStore.getState();
    const conversationStore = useConversationStore.getState();

    // --- System Listeners ---
    socket.on("connect", () => {
      setStatus('connected');
      const user = useAuthStore.getState().user;
      if (user) {
        socket?.emit("presence:update", { userId: user.id, online: true });
      }
      console.log("✅ Socket connected:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      setStatus('disconnected');
      if (reason !== "io client disconnect") toast.error("Disconnected. Reconnecting...");
      console.log("⚠️ Socket disconnected:", reason);
    });

    socket.on("connect_error", (err: any) => {
      setStatus('disconnected');
      console.error("❌ Socket connection error:", err?.message ?? err);
    });

    // --- Application-specific Listeners ---
    socket.on("message:new", async (newMessage: Message) => {
      try {
        const { replaceOptimisticMessage, addIncomingMessage } = useMessageStore.getState();
        const decryptedMessage = await decryptMessageObject(newMessage);

        // If the message has a tempId, it means it's an optimistic message
        // that the current user sent. We need to replace it with the real one.
        if (newMessage.tempId) {
          replaceOptimisticMessage(decryptedMessage.conversationId, newMessage.tempId, decryptedMessage);
        } else {
          // Otherwise, it's a new message from another user.
          addIncomingMessage(decryptedMessage.conversationId, decryptedMessage);
        }

        conversationStore.updateConversationLastMessage(decryptedMessage.conversationId, decryptedMessage);
        socket?.emit('message:ack_delivered', { messageId: decryptedMessage.id, conversationId: decryptedMessage.conversationId });
      } catch (e) {
        console.error("Failed to process incoming message", e);
      }
    });

    socket.on("message:updated", (updatedMessage: Message) => {
      updateMessage(updatedMessage.conversationId, updatedMessage.id, updatedMessage);
    });

    socket.on("presence:init", (onlineUserIds: string[]) => setOnlineUsers(onlineUserIds));
    socket.on("presence:user_joined", (userId: string) => userJoined(userId));
    socket.on("presence:user_left", (userId: string) => userLeft(userId));
    socket.on("typing:update", ({ userId, conversationId, isTyping }) => addOrUpdate({ id: userId, conversationId, isTyping }));
    socket.on("reaction:new", ({ conversationId, messageId, reaction }) => addReaction(conversationId, messageId, reaction));
    socket.on("reaction:deleted", ({ conversationId, messageId, reactionId }) => removeReaction(conversationId, messageId, reactionId));
    
    socket.on("conversation:new", (newConversation) => {
      conversationStore.addOrUpdateConversation(newConversation);
      socket?.emit("conversation:join", newConversation.id);
      toast.success(`You've been added to "${newConversation.title || 'a new chat'}"`);
    });

    socket.on("conversation:updated", (updates) => conversationStore.updateConversation(updates.id, updates));
    socket.on("conversation:deleted", ({ id }) => conversationStore.removeConversation(id));
    socket.on('message:status_updated', (payload) => {
      console.log('[STATUS] Received message:status_updated:', payload); // Diagnostic Log
      const { conversationId, messageId, deliveredTo, readBy, status } = payload;
      const userId = deliveredTo || readBy;
      if (userId) {
        updateMessageStatus(conversationId, messageId, userId, status);
      }
    });
    
    socket.on('session:fulfill_request', (data) => fulfillKeyRequest(data).catch(error => console.error('Failed to fulfill key request:', error)));
    socket.on('session:new_key', (data) => storeReceivedSessionKey(data).then(() => useKeychainStore.getState().keysUpdated()).catch(error => console.error('Failed to store received session key:', error)));
    socket.on('force_logout', () => {
      toast.error("This session has been logged out remotely.");
      useAuthStore.getState().logout();
      disconnectSocket();
    });

    socket.on("user:identity_changed", (data: { userId: string; name: string }) => {
      const message = `The security key for ${data.name} has changed. You may want to verify their identity.`;
      toast.success(message, { duration: 10000, icon: '🛡️' });
      const { conversations } = useConversationStore.getState();
      const { addSystemMessage } = useMessageStore.getState();
      conversations.forEach(convo => {
        if (convo.participants.some(p => p.id === data.userId)) {
          addSystemMessage(convo.id, message);
        }
      });
    });
  }
  return socket;
}

export function connectSocket() {
  if (socket && !socket.connected) socket.connect();
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

export function emitSessionKeyRequest(conversationId: string, sessionId: string) {
  getSocket()?.emit('session:request_key', { conversationId, sessionId });
}

export function emitSessionKeyFulfillment(payload: { requesterId: string; conversationId: string; sessionId: string; encryptedKey: string; }) {
  getSocket()?.emit('session:fulfill_response', payload);
}
