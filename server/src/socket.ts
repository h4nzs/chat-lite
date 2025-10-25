import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { socketAuthMiddleware } from "./middleware/auth.js";
import { prisma } from "./lib/prisma.js";
import xss from 'xss';
import { sendPushNotification } from "./utils/sendPushNotification.js";

export let io: Server;

// Gunakan Set untuk melacak user yang online secara efisien
const onlineUsers = new Set<string>();

export function registerSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket: any) => {
    const userId = socket.user?.id;
    if (userId) {
      socket.join(userId); // Join room personal
      console.log(`[Socket Connect] User connected: ${userId}`);
      onlineUsers.add(userId);

      // Kirim daftar lengkap hanya ke user yang baru connect
      socket.emit("presence:init", Array.from(onlineUsers));
      
      // Broadcast ke semua user lain bahwa user ini telah bergabung
      socket.broadcast.emit("presence:user_joined", userId);
    }

    socket.on("disconnect", () => {
      if (userId) {
        console.log(`[Socket Disconnect] User disconnected: ${userId}`);
        onlineUsers.delete(userId);
        // Broadcast ke semua user bahwa user ini telah keluar
        io.emit("presence:user_left", userId);
      }
    });

    // --- Event handlers lainnya ---
    socket.on("conversation:join", (conversationId: string) => {
      socket.join(conversationId);
    });

    socket.on("message:send", async (data, cb) => {
      try {
        const sanitizedContent = data.content != null ? xss(data.content) : null;

        // 1. Ambil semua partisipan
        const participants = await prisma.participant.findMany({
          where: { conversationId: data.conversationId },
          select: { userId: true },
        });

        // 2. Buat pesan dan statusnya dalam satu transaksi
        const newMessage = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderId: socket.user.id,
            content: sanitizedContent,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileType: data.fileType,
            fileSize: data.fileSize,
            // Buat status untuk setiap partisipan
            statuses: {
              create: participants.map(p => ({
                userId: p.userId,
                // Status untuk pengirim langsung READ, untuk yang lain SENT
                status: p.userId === socket.user.id ? 'READ' : 'SENT',
              })),
            },
          },
          include: { 
            sender: true, 
            reactions: { include: { user: true } },
            statuses: true, // 3. Sertakan status saat mengambil pesan baru
          }, 
        });

        const broadcastData = JSON.parse(JSON.stringify({ ...newMessage, tempId: data.tempId }));
        io.to(data.conversationId).emit("message:new", broadcastData);

        // Update a conversation's lastMessageAt timestamp
        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: { lastMessageAt: newMessage.createdAt },
        });

        const pushRecipients = await prisma.participant.findMany({
          where: { conversationId: data.conversationId, userId: { not: socket.user.id } },
          select: { userId: true },
        });
        const payload = { title: `New message from ${socket.user.username}`, body: sanitizedContent || 'File received' };
        pushRecipients.forEach(p => sendPushNotification(p.userId, payload));

        cb?.({ ok: true, msg: newMessage });
      } catch (error) {
        cb?.({ ok: false, error: "Failed to save message" });
      }
    });

    socket.on("typing:start", ({ conversationId }) => {
      if (conversationId) {
        socket.to(conversationId).emit("typing:update", { userId: socket.user.id, conversationId, isTyping: true });
      }
    });

    socket.on("typing:stop", ({ conversationId }) => {
      if (conversationId) {
        socket.to(conversationId).emit("typing:update", { userId: socket.user.id, conversationId, isTyping: false });
      }
    });

    socket.on("push:subscribe", async (data) => {
      try {
        const { endpoint, keys } = data;
        if (!userId || !endpoint || !keys?.p256dh || !keys?.auth) return;
        await prisma.pushSubscription.upsert({
          where: { endpoint },
          update: { p256dh: keys.p256dh, auth: keys.auth },
          create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId },
        });
      } catch (error) {
        console.error("Failed to save push subscription:", error);
      }
    });

    socket.on('message:mark_as_read', async ({ messageId, conversationId }) => {
      try {
        if (!userId || !messageId) return;

        // Update status pesan menjadi READ
        await prisma.messageStatus.upsert({
          where: { messageId_userId: { messageId, userId } },
          update: { status: 'READ' },
          create: { messageId, userId, status: 'READ' },
        });

        // Dapatkan pengirim pesan asli untuk memberitahunya
        const message = await prisma.message.findUnique({
          where: { id: messageId },
          select: { senderId: true, conversationId: true },
        });

        if (message && message.senderId !== userId) {
          // Kirim event pembaruan status hanya ke pengirim
          io.to(message.senderId).emit('message:status_updated', {
            messageId,
            conversationId: message.conversationId,
            readBy: userId,
            status: 'READ',
          });
        }
      } catch (error) {
        console.error('Failed to mark message as read:', error);
      }
    });
  });

  return io;
}