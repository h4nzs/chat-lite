import { io, Socket } from "socket.io-client";
import { toast } from "react-hot-toast";
import { useAuthStore } from "@store/auth";
import { useConversationStore } from "@store/conversation";
import { fulfillKeyRequest, storeReceivedSessionKey } from "@utils/crypto";
import { useKeychainStore } from "@store/keychain";

const WS_URL = (import.meta.env.VITE_WS_URL as string) || "http://localhost:4000";
let socket: Socket | null = null;
let connectionTimeout: number | null = null;

// --- Emitters for Key Recovery ---
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


export function getSocket() {
  if (!socket) {
    socket = io(WS_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: true,
      path: "/socket.io",
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket?.id);
      toast.success("Connected to chat server");

      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }

      const activeId = useConversationStore.getState().activeId;
      if (activeId) {
        socket?.emit("conversation:join", activeId);
      }
      
      const userId = useAuthStore.getState().user?.id;
      if (userId) {
        socket?.emit("presence:update", { userId, online: true });
      }
    });

    socket.on("conversation:new", (newConversation) => {
      console.log("[Socket] Received new conversation:", newConversation);
      useConversationStore.getState().addOrUpdateConversation(newConversation);
      // Also join the room for this new conversation
      socket?.emit("conversation:join", newConversation.id);
      toast.success(`You've been added to "${newConversation.title || 'a new chat'}"`);
    });

    // --- Listeners for Key Recovery ---
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
          // This is the magic that triggers the UI to re-render.
          useKeychainStore.getState().keysUpdated();
        })
        .catch(error => {
          console.error('Failed to store received session key:', error);
          toast.error('Failed to process new key.');
        });
    });


    socket.on("connect_error", (err: any) => {
      console.error("❌ Socket error:", err?.message ?? err);
      toast.error("Connection failed");
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ Socket disconnected:", reason);
      if (reason !== "io client disconnect") {
        toast.error("Disconnected from server");
      }
      if (connectionTimeout) clearTimeout(connectionTimeout);
      connectionTimeout = window.setTimeout(() => {
        if (!socket?.connected) {
          toast.error("Still trying to reconnect...");
        }
      }, 30_000);
    });

    socket.on("reconnect", (attempt) => {
      console.log("🔄 Reconnected after", attempt, "attempts");
      toast.success("Reconnected");
      if (connectionTimeout) clearTimeout(connectionTimeout);

      const { activeId, openConversation } = useConversationStore.getState();
      if (activeId) {
        socket?.emit("conversation:join", activeId);
        openConversation(activeId);
      }
    });

    socket.on("reconnect_failed", () => {
      console.error("❌ Reconnect failed");
      toast.error("Reconnect failed. Refresh page.");
      if (connectionTimeout) clearTimeout(connectionTimeout);
    });
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}