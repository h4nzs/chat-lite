import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { socketAuthMiddleware, verifySocketAuth } from "./middleware/auth.js";
import { prisma } from "./lib/prisma.js";
import cookie from 'cookie';
import xss from 'xss';
import { sendPushNotification } from "./utils/sendPushNotification.js";

// Ekspor variabel untuk menampung instance io
export let io: Server;

export function registerSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  // ... (sisa kode middleware dan event handler tetap sama)
  // === Custom middleware untuk verifikasi token ===
  io.use((socket, next) => {
    try {
      let token: string | null = null;
      if (socket.handshake.headers?.cookie) {
        const cookies = cookie.parse(socket.handshake.headers.cookie);
        token = cookies["at"] || null;
      }

      const user = verifySocketAuth(token || undefined);
      if (!user) {
        return next(new Error("Unauthorized: Token verification failed"));
      }

      (socket as any).user = user;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  // === Events ===
  io.on("connection", (socket: any) => {
    socket.on("conversation:join", (conversationId: string) => {
      socket.join(conversationId);
    });

    socket.on("message:send", async (data, cb) => {
      try {
        const sanitizedContent = data.content != null ? xss(data.content) : null;
        
        const newMessage = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderId: socket.user.id,
            content: sanitizedContent,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileType: data.fileType,
            fileSize: data.fileSize,
          },
        });

        const broadcastData = JSON.parse(JSON.stringify({
          ...newMessage,
          tempId: data.tempId,
        }));
        io.to(data.conversationId).emit("message:new", broadcastData);

        // Kirim push notification ke partisipan lain
        const participants = await prisma.participant.findMany({
          where: { 
            conversationId: data.conversationId,
            userId: { not: socket.user.id } // Jangan kirim ke diri sendiri
          },
          select: { userId: true }
        });

        const payload = {
          title: `Pesan baru dari ${socket.user.username}`,
          body: sanitizedContent || (data.fileName ? `Mengirim file: ${data.fileName}` : 'Mengirim gambar'),
          icon: socket.user.avatarUrl || '/default-avatar.png',
          data: { conversationId: data.conversationId },
        };

        participants.forEach(p => sendPushNotification(p.userId, payload));

        cb?.({ ok: true, msg: newMessage });
      } catch (error) {
        cb?.({ ok: false, error: "Failed to save message" });
      }
    });

    socket.on("disconnect", () => {
      io.emit("presence:update", {
        userId: socket.user?.id,
        online: false,
      });
    });

    socket.on("typing:start", ({ conversationId }) => {
      if (conversationId) {
        socket.to(conversationId).emit("typing:update", {
          userId: (socket as any).user.id,
          conversationId,
          isTyping: true,
        });
      }
    });

    socket.on("typing:stop", ({ conversationId }) => {
      if (conversationId) {
        socket.to(conversationId).emit("typing:update", {
          userId: (socket as any).user.id,
          conversationId,
          isTyping: false,
        });
      }
    });
  });

  return io;
}