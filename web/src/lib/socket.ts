import { io, Socket } from "socket.io-client";
import { useChatStore } from "@store/chat";
import { getCookie } from "./tokenStorage";
import { toast } from "react-hot-toast";

const WS_URL =
  (import.meta.env.VITE_WS_URL as string) || "http://localhost:4000";

let socket: Socket | null = null;
let connectionTimeout: NodeJS.Timeout | null = null;

/**
 * Ambil token access (at) dari cookie
 */
function getToken(): string | null {
  return getCookie("at"); // 🔥 hanya gunakan cookie access token
}

/**
 * Singleton socket instance
 */
export function getSocket() {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ["websocket"],
      withCredentials: true,
      auth: { token: getToken() }, // kirim token saat handshake
    });

    // === Events ===
    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      toast.success("Connected to chat server");

      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }

      const activeId = useChatStore.getState().activeId;
      if (activeId) {
        socket.emit("conversation:join", activeId);
      }
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message || err);
      toast.error("Connection to chat server failed. Retrying...");
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ Socket disconnected:", reason);
      if (reason !== "io client disconnect") {
        toast.error("Disconnected from chat server");
      }

      if (connectionTimeout) clearTimeout(connectionTimeout);
      connectionTimeout = setTimeout(() => {
        if (!socket?.connected) {
          toast.error("Still trying to reconnect to chat server...");
        }
      }, 30000);
    });

    socket.on("reconnect", (attempt) => {
      console.log("🔄 Reconnected after", attempt, "attempts");
      toast.success("Reconnected to chat server");

      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }

      // refresh token saat reconnect
      socket.auth = { token: getToken() };

      const activeId = useChatStore.getState().activeId;
      if (activeId) {
        socket.emit("conversation:join", activeId);
        useChatStore.getState().openConversation(activeId);
      }
    });

    socket.on("reconnect_attempt", () => {
      // setiap kali coba reconnect → refresh token
      socket.auth = { token: getToken() };
    });

    socket.on("reconnect_failed", () => {
      console.error("❌ Failed to reconnect to socket");
      toast.error(
        "Failed to reconnect to chat server. Please refresh the page."
      );
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
    });
  }
  return socket;
}

/**
 * Disconnect manual
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
