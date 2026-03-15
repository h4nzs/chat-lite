// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Server, Socket } from 'socket.io';
import { prisma } from '../../lib/prisma.js';
import { redisClient } from '../../lib/redis.js';
import type { AuthPayload } from '../../types/auth.js';

interface TypingPayload {
  conversationId: string;
}

interface AuthenticatedSocket extends Socket {
  user?: AuthPayload & { publicKey: string | null };
}

const checkRateLimit = async (userId: string, event: string, limit: number, windowSeconds: number): Promise<boolean> => {
  const key = `rate_limit:socket:${event}:${userId}`;
  const current = await redisClient.incr(key);
  if (current === 1) {
    await redisClient.expire(key, windowSeconds);
  }
  return current <= limit;
};

export const registerPresenceHandlers = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user?.id;
  if (!userId) return;

  // Join Conversation Room
  socket.on("conversation:join", async (conversationId: string) => {
    if (!await checkRateLimit(userId, 'join', 10, 60)) {
      return socket.emit("error", { message: "Rate limit exceeded" });
    }

    try {
      const participant = await prisma.participant.findUnique({
        where: {
          userId_conversationId: {
            userId,
            conversationId
          }
        }
      });

      if (participant) {
        socket.join(conversationId);
      }
    } catch (e) {
      console.error("Error joining conversation:", e);
    }
  });

  // Typing Indicators
  socket.on("typing:start", async ({ conversationId }: TypingPayload) => {
    if (!await checkRateLimit(userId, 'typing', 20, 10)) return;

    if (conversationId && socket.user) {
      socket.to(conversationId).emit("typing:update", { 
        userId: socket.user.id, 
        conversationId, 
        isTyping: true 
      });
    }
  });

  socket.on("typing:stop", ({ conversationId }: TypingPayload) => {
    if (conversationId && socket.user) {
      socket.to(conversationId).emit("typing:update", { 
        userId: socket.user.id, 
        conversationId, 
        isTyping: false 
      });
    }
  });

  // User Away Status
  socket.on("user:away", async () => {
    if (!userId) return;
    const userSocketsKey = `user:${userId}:sockets`;
    await redisClient.sRem(userSocketsKey, socket.id);

    const remainingSockets = await redisClient.sCard(userSocketsKey);
    if (remainingSockets === 0) {
      await redisClient.sRem('online_users', userId);
      socket.broadcast.emit("presence:user_left", userId);
    }
  });

  // User Active Status
  socket.on("user:active", async () => {
    if (!userId) return;
    const userSocketsKey = `user:${userId}:sockets`;
    const added = await redisClient.sAdd(userSocketsKey, socket.id);
    const currentCount = await redisClient.sCard(userSocketsKey);

    if (added === 1 && currentCount === 1) {
      await redisClient.sAdd('online_users', userId);
      socket.broadcast.emit("presence:user_joined", userId);
    }
  });

  // Disconnect Handler
  socket.on("disconnect", async () => {
    const userSocketsKey = `user:${userId}:sockets`;
    await redisClient.sRem(userSocketsKey, socket.id);

    setTimeout(async () => {
      const remainingSockets = await redisClient.sCard(userSocketsKey);
      if (remainingSockets === 0) {
        await redisClient.sRem('online_users', userId);
        io.emit("presence:user_left", userId);
      }
    }, 5000);
  });
};
