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

    socket.on("presence:update", async (data) => {
      try {
        // Broadcast presence status to all users
        io.emit("presence:update", {
          userId: socket.user.id,
          online: true,
        });
      } catch (error) {
        console.error("Presence update error:", error);
      }
    });

    socket.on("typing", async (data) => {
      try {
        const { conversationId, isTyping } = data;
        if (!conversationId) return;
        
        // Broadcast typing status to all users in the conversation except sender
        socket.to(conversationId).emit("typing", {
          userId: socket.user.id,
          isTyping,
          conversationId,
        });
      } catch (error) {
        console.error("Typing event error:", error);
      }
    });

    socket.on("group:create", async (data, cb) => {
      try {
        const { title, participantIds } = data;
        
        // Validate input
        if (!title || !Array.isArray(participantIds) || participantIds.length === 0) {
          return cb?.({ ok: false, error: "Title and participant IDs are required" });
        }

        // Verify all participants exist
        const participants = await prisma.user.findMany({
          where: {
            id: { in: [socket.user.id, ...participantIds] }, // Include the creator
          },
          select: { id: true },
        });

        // Check if all requested participants exist
        const foundIds = participants.map(p => p.id);
        const allRequiredIds = [socket.user.id, ...participantIds];
        const missingIds = allRequiredIds.filter(id => !foundIds.includes(id));
        
        if (missingIds.length > 0) {
          return cb?.({ ok: false, error: `Users not found: ${missingIds.join(', ')}` });
        }

        // Create the group conversation
        const conversation = await prisma.conversation.create({
          data: {
            isGroup: true,
            title: title.trim(),
            participants: {
              create: allRequiredIds.map(userId => ({ userId }))
            }
          },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        });

        // Transform response to match frontend expectations
        const transformed = {
          id: conversation.id,
          isGroup: conversation.isGroup,
          title: conversation.title,
          updatedAt: conversation.updatedAt,
          participants: conversation.participants.map((p) => ({
            id: p.user.id,
            username: p.user.username,
            name: p.user.name,
            avatarUrl: p.user.avatarUrl,
          })),
          lastMessage: null,
        };

        // Notify all participants about the new group
        conversation.participants.forEach(participant => {
          if (participant.userId !== socket.user.id) {
            // Only notify other participants
            io.to(`user:${participant.userId}`).emit("conversation:new", transformed);
          }
        });

        cb?.({ ok: true, id: conversation.id });
      } catch (error) {
        console.error("Group creation error:", error);
        cb?.({ ok: false, error: "Failed to create group" });
      }
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
      
      // Update user's online status to false when they disconnect
      io.emit("presence:update", {
        userId: socket.user?.id,
        online: false,
      });
    });
  });

  return io;
}
