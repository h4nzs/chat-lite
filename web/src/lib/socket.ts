import { io, Socket } from "socket.io-client";
import { toast } from "react-hot-toast";
import { useAuthStore } from "@store/auth";
import { useConversationStore } from "@store/conversation";
import { fulfillKeyRequest, storeReceivedSessionKey } from "@utils/crypto";
import { useKeychainStore } from "@store/keychain";
import { useConnectionStore } from "@store/connection"; // Import the new store

const WS_URL = (import.meta.env.VITE_WS_URL as string) || "http://localhost:4000";
let socket: Socket | null = null;

/**
 * Emit a request to retrieve the encrypted session key for a specific conversation session.
 *
 * @param conversationId - ID of the conversation to which the key request belongs
 * @param sessionId - ID of the session whose key is being requested
 */
export function emitSessionKeyRequest(conversationId: string, sessionId: string) {
  getSocket()?.emit('session:request_key', { conversationId, sessionId });
}

/**
 * Emit a session key fulfillment response to the server for a pending session key request.
 *
 * @param payload - The fulfillment payload
 * @param payload.requesterId - ID of the user who requested the session key
 * @param payload.conversationId - Conversation identifier the session belongs to
 * @param payload.sessionId - Session identifier for which the key is being fulfilled
 * @param payload.encryptedKey - The session key encrypted for the requester
 */
export function emitSessionKeyFulfillment(payload: {
  requesterId: string;
  conversationId: string;
  sessionId: string;
  encryptedKey: string;
}) {
  getSocket()?.emit('session:fulfill_response', payload);
}

/**
 * Provide a singleton Socket.IO client configured with lifecycle and application-specific event handlers.
 *
 * The socket is lazily initialized on first call and wired with centralized handlers for connection state,
 * reconnection behavior, conversation events, session key workflows, and force-logout handling.
 *
 * @returns The singleton Socket.IO `Socket` instance
 */
export function getSocket() {
  // The singleton pattern is kept to ensure only one socket instance
  if (!socket) {
    socket = io(WS_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: false, // We will connect manually
      path: "/socket.io",
    });

    // Get the status setter from the store
    const { setStatus } = useConnectionStore.getState();

    // --- Centralized Event Listeners ---

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket?.id);
      toast.success("Connected to chat server");
      setStatus('connected');

      // Resync state to ensure consistency after connection, but only if initial load hasn't completed
      // This prevents loops on reconnects, especially for users with no conversations
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
      // The default backoff mechanism will handle retries, so a toast here might be too noisy.
      // Only show a persistent error if reconnects fail.
    });

    socket.on("reconnect", (attempt) => {
      console.log("🔄 Reconnected after", attempt, "attempts");
      // The 'connect' event will fire after this, where we handle the state resync.
      // No need to do it here to avoid duplication.
      setStatus('connecting'); // Set to connecting, 'connect' event will set to 'connected'
    });

    socket.on("reconnect_failed", () => {
      console.error("❌ Reconnect failed permanently.");
      toast.error("Could not reconnect to the server. Please refresh the page.");
      setStatus('disconnected');
    });

    // --- Application-specific Listeners ---

    socket.on("conversation:new", (newConversation) => {
      console.log("[Socket] Received new conversation:", newConversation);
      useConversationStore.getState().addOrUpdateConversation(newConversation);
      socket?.emit("conversation:join", newConversation.id);
      toast.success(`You've been added to "${newConversation.title || 'a new chat'}"`);
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
  }
  return socket;
}

/**
 * Initiates a connection attempt for the module's singleton socket when it exists and is not already connected.
 *
 * Sets the global connection status to `'connecting'` and triggers the socket to connect.
 */

export function connectSocket() {
  if (socket && !socket.connected) {
    useConnectionStore.getState().setStatus('connecting');
    socket.connect();
  }
}

/**
 * Disconnects the active socket connection if it is currently connected.
 *
 * The socket instance is preserved (not set to `null`) so it can be reused for reconnection.
 */
export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
  // We don't nullify the socket object to allow for reconnection.
}