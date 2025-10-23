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
      // Broadcast daftar lengkap user online ke SEMUA klien
      io.emit("presence:update", Array.from(onlineUsers));
    }

    socket.on("disconnect", () => {
      if (userId) {
        console.log(`[Socket Disconnect] User disconnected: ${userId}`);
        onlineUsers.delete(userId);
        // Broadcast daftar lengkap user online lagi setelah ada yang keluar
        io.emit("presence:update", Array.from(onlineUsers));
      }
    });

    // --- Event handlers lainnya ---
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
          include: { sender: true, reactions: { include: { user: true } } },
        });

        const broadcastData = JSON.parse(JSON.stringify({ ...newMessage, tempId: data.tempId }));
        io.to(data.conversationId).emit("message:new", broadcastData);

        // Update a conversation's lastMessageAt timestamp
        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: { lastMessageAt: newMessage.createdAt },
        });

        const participants = await prisma.participant.findMany({
          where: { conversationId: data.conversationId, userId: { not: socket.user.id } },
          select: { userId: true },
        });
        const payload = { title: `New message from ${socket.user.username}`, body: sanitizedContent || 'File received' };
        participants.forEach(p => sendPushNotification(p.userId, payload));

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
  });

  return io;
}