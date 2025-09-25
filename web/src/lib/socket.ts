import { io, Socket } from "socket.io-client";
import { useChatStore } from "@store/chat";
import { toast } from "react-hot-toast";

const WS_URL = (import.meta.env.VITE_WS_URL as string) || "http://localhost:4000";
let socket: Socket | null = null;
let connectionTimeout: number | null = null;

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

      const activeId = useChatStore.getState().activeId;
      if (activeId) {
        socket?.emit("conversation:join", activeId);
      }
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

      const activeId = useChatStore.getState().activeId;
      if (activeId) {
        socket?.emit("conversation:join", activeId);
        useChatStore.getState().openConversation(activeId);
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
