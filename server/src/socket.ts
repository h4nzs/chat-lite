import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { socketAuthMiddleware, verifySocketAuth } from "./middleware/auth.js";

export function registerSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  // === Custom middleware untuk verifikasi token ===
  io.use((socket, next) => {
    try {
      // Prioritaskan validasi token dengan cara mem-parsing cookie langsung dari header
      let token: string | null = null;
      
      // Logging untuk debugging
      console.log("Socket handshake headers:", socket.handshake.headers);
      
      // Ekstrak token dari cookie
      if (socket.handshake.headers?.cookie) {
        const cookies = Object.fromEntries(
          socket.handshake.headers.cookie.split(";").map((c) => {
            const [k, v] = c.trim().split("=");
            return [k, decodeURIComponent(v)];
          })
        );
        token = cookies["at"] || null;
        console.log("Token from cookie:", token);
      }

      const user = verifySocketAuth(token);
      if (!user) {
        return next(new Error("Unauthorized"));
      }

      (socket as any).user = user;
      next();
    } catch (err) {
      console.error("Socket authentication error:", err);
      next(new Error("Unauthorized"));
    }
  });

  // === Events ===
  io.on("connection", (socket: any) => {
    console.log("✅ User connected:", socket.user);

    socket.on("conversation:join", (conversationId: string) => {
      socket.join(conversationId);
      console.log(`👥 ${socket.user?.id} joined conversation ${conversationId}`);
    });

    socket.on("message:send", async (data, cb) => {
      const newMessage = {
        id: Date.now().toString(),
        conversationId: data.conversationId,
        senderId: socket.user.id,
        content: data.content || null,
        createdAt: new Date().toISOString(),
        tempId: data.tempId,
      };

      // Broadcast ke semua member di room conversation
      io.to(data.conversationId).emit("message:new", newMessage);

      cb?.({ ok: true, msg: newMessage });
    });

    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.user?.id);
    });
  });

  return io;
}
