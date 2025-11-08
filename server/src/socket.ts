import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { socketAuthMiddleware } from "./middleware/auth.js";
import { prisma } from "./lib/prisma.js";
import { getLinkPreview } from "link-preview-js";
import { sendPushNotification } from "./utils/sendPushNotification.js";
import crypto from "crypto";
import { redisClient } from "./lib/redis.js";

export let io: Server;

const onlineUsers = new Set<string>();



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
      await redisClient.set(linkingToken, userId, { EX: 300 }); // 5 minutes expiry

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
      if (!socket.user) {
        return cb?.({ ok: false, error: "User not authenticated" });
      }

      try {
        const senderId = socket.user.id;
        let conversationId = data.conversationId;
        let conversation;

        // If no conversationId, find or create a 1-on-1 chat
        if (!conversationId && data.recipientId) {
          const recipientId = data.recipientId;

          // Find existing 1-on-1 conversation
          const existingConvo = await prisma.conversation.findFirst({
            where: {
              isGroup: false,
              participants: {
                every: {
                  userId: { in: [senderId, recipientId] },
                },
              },
            },
          });

          if (existingConvo) {
            conversationId = existingConvo.id;
            conversation = existingConvo;
          } else {
            // Or create a new one
            const newConversation = await prisma.conversation.create({
              data: {
                isGroup: false,
                participants: {
                  create: [
                    { userId: senderId, role: "MEMBER" },
                    { userId: recipientId, role: "MEMBER" },
                  ],
                },
              },
              include: { 
                participants: { include: { user: true } },
                creator: true,
              },
            });
            conversationId = newConversation.id;
            conversation = newConversation;

            // --- THIS IS THE FIX ---
            // Notify the recipient that a new conversation has been created for them
            io.to(recipientId).emit("conversation:new", newConversation);
          }
        } else if (!conversationId) {
          throw new Error("Missing conversationId or recipientId");
        }

        const participants = await prisma.participant.findMany({
          where: { conversationId: conversationId },
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
            conversationId: conversationId,
            senderId: senderId,
            content: data.content,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileType: data.fileType,
            fileSize: data.fileSize,
            sessionId: data.sessionId,
            repliedToId: data.repliedToId,
            linkPreview: linkPreviewData,
            statuses: {
              create: participants.map(p => ({
                userId: p.userId,
                status: p.userId === senderId ? 'READ' : 'SENT',
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
          ...newMessage,
          tempId: data.tempId,
        };

        io.to(conversationId).emit("message:new", messageToBroadcast);

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: newMessage.createdAt },
        });

        const pushRecipients = participants.filter(p => p.userId !== senderId);
        const payload = { title: `New message from ${socket.user.username}`, body: data.content || 'File received' };
        pushRecipients.forEach(p => sendPushNotification(p.userId, payload));

        cb?.({ ok: true, msg: newMessage });
      } catch (error) {
        console.error("Message send error:", error);
        cb?.({ ok: false, error: "Failed to save or send message" });
      }
    });

    socket.on("typing:start", ({ conversationId }) => {
      if (conversationId && socket.user) {
        socket.to(conversationId).emit("typing:update", { userId: socket.user.id, conversationId, isTyping: true });
      }
    });

    socket.on("typing:stop", ({ conversationId }) => {
      if (conversationId && socket.user) {
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

    // --- Handlers for E2EE Key Recovery ---

    socket.on('session:request_key', async ({ conversationId, sessionId }) => {
      if (!userId || !conversationId || !sessionId) return;

      try {
        // 1. Find other online participants in the same conversation
        const participants = await prisma.participant.findMany({
          where: {
            conversationId,
            userId: { not: userId }, // Exclude the requester
          },
          select: { userId: true },
        });

        const onlineParticipants = participants.filter(p => onlineUsers.has(p.userId));

        if (onlineParticipants.length === 0) {
          console.log(`[Key Request] No online users found in convo ${conversationId} to fulfill key request for ${sessionId}`);
          // Optional: could emit an event back to the requester indicating failure
          return;
        }

        // 2. Pick one online user to be the fulfiller (e.g., the first one)
        const fulfillerId = onlineParticipants[0].userId;

        // 3. Get the requester's public key
        const requester = await prisma.user.findUnique({
          where: { id: userId },
          select: { publicKey: true },
        });

        if (!requester?.publicKey) {
          console.error(`[Key Request] Requester ${userId} has no public key.`);
          return;
        }

        // 4. Emit an event to the fulfiller, asking them to re-encrypt the key
        console.log(`[Key Request] Asking ${fulfillerId} to fulfill key request for ${userId} (session: ${sessionId})`);
        io.to(fulfillerId).emit('session:fulfill_request', {
          conversationId,
          sessionId,
          requesterId: userId,
          requesterPublicKey: requester.publicKey,
        });

      } catch (error) {
        console.error('[Key Request] Error processing session:request_key', error);
      }
    });

    socket.on('session:fulfill_response', ({ requesterId, conversationId, sessionId, encryptedKey }) => {
      if (!userId || !requesterId || !encryptedKey) return;

      // The fulfiller (current socket user) is sending a key for the requester.
      // Simply relay it to the requester.
      console.log(`[Key Fulfill] Relaying key for session ${sessionId} from ${userId} to ${requesterId}`);
      io.to(requesterId).emit('session:new_key', {
        conversationId,
        sessionId,
        encryptedKey,
      });
    });

  });

  return io;
}
