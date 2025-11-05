import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { socketAuthMiddleware } from "./middleware/auth.js";
import { prisma } from "./lib/prisma.js";
import { getLinkPreview } from "link-preview-js";
import { sendPushNotification } from "./utils/sendPushNotification.js";
import crypto from "crypto";

export let io: Server;

const onlineUsers = new Set<string>();

// Map<token, { userId: string, expiry: Date }>
export const linkingTokens = new Map<string, { userId: string, expiry: Date }>();

export function getIo() {
  if (!io) {
    throw new Error("Socket.IO not initialized!");
  }
  return io;
}

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

    // Handle authenticated users
    if (userId) {
      socket.join(userId);
      console.log(`[Socket Connect] User connected: ${userId}`);
      onlineUsers.add(userId);
      socket.emit("presence:init", Array.from(onlineUsers));
      socket.broadcast.emit("presence:user_joined", userId);
    } else {
      console.log(`[Socket Connect] Guest connected: ${socket.id}`);
    }

    // Handle device linking
    socket.on("linking:join_room", (roomId: string) => {
      if (!userId) { // Only non-authenticated sockets can join linking rooms
        socket.join(roomId);
        console.log(`[Linking] Guest ${socket.id} joined room ${roomId}`);
      }
    });

    socket.on("linking:send_payload", async (data: { roomId: string, encryptedMasterKey: string }) => {
      // This event must be from an authenticated user
      if (!userId) return;

      console.log(`[Linking Server] Received payload from ${userId} for room ${data.roomId}`);

      // Generate a single-use token for finalization
      const linkingToken = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
      linkingTokens.set(linkingToken, { userId, expiry });

      // Relay the payload to the new device in the specific room
      console.log(`[Linking Server] Relaying payload to room ${data.roomId}`);
      io.to(data.roomId).emit("linking:receive_payload", { 
        encryptedMasterKey: data.encryptedMasterKey,
        linkingToken: linkingToken, // Send the token to the new device
      });
    });

    socket.on("disconnect", () => {
      if (userId) {
        console.log(`[Socket Disconnect] User disconnected: ${userId}`);
        onlineUsers.delete(userId);
        io.emit("presence:user_left", userId);
      } else {
        console.log(`[Socket Disconnect] Guest disconnected: ${socket.id}`);
      }
    });

    socket.on("conversation:join", (conversationId: string) => {
      socket.join(conversationId);
    });

    socket.on("message:send", async (data, cb) => {
      try {
        const participants = await prisma.participant.findMany({
          where: { conversationId: data.conversationId },
          select: { userId: true },
        });

        let linkPreviewData: any = null;
        if (data.content) {
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const urls = data.content.match(urlRegex);
          if (urls && urls.length > 0) {
            try {
              const preview = await getLinkPreview(urls[0]);
              if ('title' in preview && 'description' in preview && 'images' in preview) {
                linkPreviewData = {
                  url: preview.url,
                  title: preview.title,
                  description: preview.description,
                  image: preview.images[0],
                  siteName: preview.siteName,
                };
              }
            } catch (e) {
              console.error("Failed to get link preview:", e);
            }
          }
        }

        const newMessage = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderId: socket.user.id,
            content: data.content,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileType: data.fileType,
            fileSize: data.fileSize,
            sessionId: data.sessionId, // Add session ID for E2EE
            repliedToId: data.repliedToId,
            linkPreview: linkPreviewData,
            statuses: {
              create: participants.map(p => ({
                userId: p.userId,
                status: p.userId === socket.user.id ? 'READ' : 'SENT',
              })),
            },
          },
          include: { 
            sender: true, 
            reactions: { include: { user: true } },
            statuses: true,
            repliedTo: { 
              include: {
                sender: { select: { id: true, name: true, username: true } }
              }
            }
          }, 
        });

        const messageToBroadcast = {
          id: newMessage.id,
          conversationId: newMessage.conversationId,
          senderId: newMessage.senderId,
          content: newMessage.content,
          fileUrl: newMessage.fileUrl,
          fileName: newMessage.fileName,
          fileType: newMessage.fileType,
          fileSize: newMessage.fileSize,
          createdAt: newMessage.createdAt,
          sender: newMessage.sender,
          reactions: newMessage.reactions,
          statuses: newMessage.statuses,
          repliedTo: newMessage.repliedTo,
          linkPreview: newMessage.linkPreview, // Explicitly include linkPreview
          sessionId: newMessage.sessionId, // Broadcast the session ID
          tempId: data.tempId,
        };

        io.to(data.conversationId).emit("message:new", messageToBroadcast);

        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: { lastMessageAt: newMessage.createdAt },
        });

        const pushRecipients = await prisma.participant.findMany({
          where: { conversationId: data.conversationId, userId: { not: socket.user.id } },
          select: { userId: true },
        });
        const payload = { title: `New message from ${socket.user.username}`, body: data.content || 'File received' };
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

        await prisma.messageStatus.upsert({
          where: { messageId_userId: { messageId, userId } },
          update: { status: 'READ' },
          create: { messageId, userId, status: 'READ' },
        });

        const message = await prisma.message.findUnique({
          where: { id: messageId },
          select: { senderId: true, conversationId: true },
        });

        if (message && message.senderId !== userId) {
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
