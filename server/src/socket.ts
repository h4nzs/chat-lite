import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { socketAuthMiddleware, verifySocketAuth } from "./middleware/auth.js";
import { prisma } from "./lib/prisma.js";

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
      
      // Ekstrak token dari cookie dengan penanganan yang lebih baik
      if (socket.handshake.headers?.cookie) {
        // Parse cookies dengan cara yang lebih aman
        const cookies: Record<string, string> = {};
        socket.handshake.headers.cookie.split(";").forEach((cookie) => {
          const parts = cookie.trim().split("=");
          if (parts.length === 2) {
            const key = parts[0].trim();
            const value = decodeURIComponent(parts[1].trim());
            cookies[key] = value;
          }
        });
        
        token = cookies["at"] || null;
        console.log("Token from cookie:", token);
      }

      const user = verifySocketAuth(token || undefined);
      if (!user) {
        console.log("Socket authentication failed: No valid user found");
        // Provide more specific error message for debugging
        if (!token) {
          console.log("No token provided in socket handshake");
          return next(new Error("Unauthorized: No token provided"));
        } else {
          console.log("Token verification failed for token:", token.substring(0, 20) + "...");
          return next(new Error("Unauthorized: Token verification failed"));
        }
      }

      (socket as any).user = user;
      console.log("Socket authentication successful for user:", user);
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
      try {
        console.log("=== MESSAGE:SEND EVENT ===");
        console.log("Received message data:", data);
        console.log("Received content type:", typeof data.content);
        console.log("Received content length:", data.content ? data.content.length : 0);
        console.log("Conversation ID:", data.conversationId);
        console.log("Sender ID:", socket.user.id);
        // Save message to database
        const newMessage = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderId: socket.user.id,
            content: data.content || null,
            imageUrl: data.imageUrl || null,
            fileUrl: data.fileUrl || null,
            fileName: data.fileName || null,
          },
        });
        console.log("Saved message to database:", newMessage);
        console.log("Encrypted content in database:", newMessage.content);
        console.log("Database content type:", typeof newMessage.content);
        console.log("Database content length:", newMessage.content ? newMessage.content.length : 0);

        // Broadcast ke semua member di room conversation
        const broadcastData = {
          ...newMessage,
          tempId: data.tempId,
        };
        console.log("Broadcasting message:", broadcastData);
        console.log("Encrypted content in broadcast:", broadcastData.content);
        console.log("=== END MESSAGE:SEND EVENT ===");
        io.to(data.conversationId).emit("message:new", broadcastData);

        cb?.({ ok: true, msg: newMessage });
      } catch (error) {
        console.error("Failed to save message:", error);
        cb?.({ ok: false, error: "Failed to save message" });
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.user?.id);
    });
  });

  return io;
}
