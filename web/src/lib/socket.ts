import { io, Socket } from "socket.io-client";
import { toast } from "react-hot-toast";
import { useAuthStore } from "@store/auth";
import { useConversationStore, Message } from "@store/conversation";
import { useMessageStore, decryptMessageObject } from "@store/message";
import { fulfillKeyRequest, storeReceivedSessionKey } from "@utils/crypto";
import { useKeychainStore } from "@store/keychain";
import { useConnectionStore } from "@store/connection";

const WS_URL = (import.meta.env.VITE_WS_URL as string) || "http://localhost:4000";
let socket: Socket | null = null;
let listenersInitialized = false;

export function emitSessionKeyRequest(conversationId: string, sessionId: string) {
  getSocket()?.emit('session:request_key', { conversationId, sessionId });
}

export function emitSessionKeyFulfillment(payload: {
  requesterId: string;
  conversationId: string;
  sessionId: string;
  encryptedKey: string;
}) {
  getSocket()?.emit('session:fulfill_response', payload);
}

function initSocketListeners() {
  if (!socket || listenersInitialized) return;

  const { setStatus } = useConnectionStore.getState();

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket?.id);
    toast.success("Connected to chat server");
    setStatus('connected');
    const { initialLoadCompleted } = useConversationStore.getState();
    if (!initialLoadCompleted) {
      useConversationStore.getState().resyncState();
    }
    const userId = useAuthStore.getState().user?.id;
    if (userId) {
      socket?.emit("presence:update", { userId, online: true });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("⚠️ Socket disconnected:", reason);
    setStatus('disconnected');
    if (reason !== "io client disconnect") {
      toast.error("Disconnected from server. Reconnecting...");
    }
  });

  socket.on("connect_error", (err: any) => {
    console.error("❌ Socket connection error:", err?.message ?? err);
    setStatus('disconnected');
  });

  socket.on("reconnect", (attempt) => {
    console.log("🔄 Reconnected after", attempt, "attempts");
    setStatus('connecting');
  });

  socket.on("reconnect_failed", () => {
    console.error("❌ Reconnect failed permanently.");
    toast.error("Could not reconnect to the server. Please refresh the page.");
    setStatus('disconnected');
  });

  socket.on("conversation:new", (newConversation) => {
    console.log("[Socket] Received new conversation:", newConversation);
    useConversationStore.getState().addOrUpdateConversation(newConversation);
    socket?.emit("conversation:join", newConversation.id);
    toast.success(`You've been added to "${newConversation.title || 'a new chat'}"`);
  });

  socket.on("message:new", async (newMessage: Message) => {
    let processedMessage: Message;
    try {
      processedMessage = await decryptMessageObject(newMessage);
    } catch (e) {
      console.error(`Decryption failed for incoming message ${newMessage.id}.`, e);
      if (newMessage.sessionId) {
        emitSessionKeyRequest(newMessage.conversationId, newMessage.sessionId);
      }
      processedMessage = { ...newMessage, content: '[Requesting key to decrypt...]' };
    }
    
    useMessageStore.getState().addIncomingMessage(processedMessage.conversationId, processedMessage);
    useConversationStore.getState().updateConversationLastMessage(processedMessage.conversationId, processedMessage);
  });

  socket.on('session:fulfill_request', (data) => {
    console.log('[Socket] Received request to fulfill a session key:', data);
    fulfillKeyRequest(data).catch(error => {
      console.error('Failed to fulfill key request:', error);
    });
  });

  socket.on('session:new_key', (data) => {
    console.log('[Socket] Received a new session key from a peer:', data);
    storeReceivedSessionKey(data)
      .then(() => {
        toast.success("New decryption key stored!");
        useKeychainStore.getState().keysUpdated();
      })
      .catch(error => {
        console.error('Failed to store received session key:', error);
        toast.error('Failed to process new key.');
      });
  });

  socket.on('force_logout', (data) => {
    console.log(`Received force_logout for session: ${data.jti}. Logging out.`);
    toast.error("This session has been logged out remotely.");
    useAuthStore.getState().logout();
    disconnectSocket();
  });

  socket.on("user:identity_changed", (data: { userId: string; name: string }) => {
    console.log(`[Socket] Identity changed for user: ${data.name}`);
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

  listenersInitialized = true;
}

export function getSocket() {
  if (!socket) {
    socket = io(WS_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: false,
      path: "/socket.io",
    });
    initSocketListeners();
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    useConnectionStore.getState().setStatus('connecting');
    s.connect();
  }
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
  listenersInitialized = false;
}
