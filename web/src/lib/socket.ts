import { io, Socket } from "socket.io-client";
import { useChatStore } from "@store/chat";
import { toast } from "react-hot-toast";

const WS_URL =
  (import.meta.env.VITE_WS_URL as string) || "http://localhost:4000";
let socket: Socket | null = null;
let connectionTimeout: NodeJS.Timeout | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ["websocket"],
      withCredentials: true,
      // Hapus properti auth karena token tidak lagi dibaca secara manual
    });

    // === Event listeners ===
    socket.on("connect", () => {
      console.log("✅ Socket connected with ID:", socket.id);
      toast.success("Connected to chat server");

      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }

      // auto join conversation jika ada yang aktif
      const activeId = useChatStore.getState().activeId;
      if (activeId) {
        socket.emit("conversation:join", activeId);
      }
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error.message || error);
      toast.error("Connection to chat server failed. Retrying...");
      
      // Check if it's an authentication error and trigger a token refresh
      if (error.message && error.message.includes("Unauthorized")) {
        console.log("Socket authentication error detected, attempting to refresh token...");
        // In a real implementation, you would call your token refresh function here
        // For now, we'll just log it as the instructions don't specify the exact refresh mechanism
      }
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

      const activeId = useChatStore.getState().activeId;
      if (activeId) {
        socket.emit("conversation:join", activeId);
        useChatStore.getState().openConversation(activeId);
      }
    });

    socket.on("reconnect_failed", () => {
      console.error("❌ Failed to reconnect to socket");
      toast.error("Failed to reconnect to chat server. Please refresh the page.");
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
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
