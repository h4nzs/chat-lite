// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Server, Socket } from 'socket.io';
import { prisma } from '../../lib/prisma.js';
import { redisClient } from '../../lib/redis.js';
import type { AuthPayload } from '../../types/auth.js';

interface KeyRequestPayload {
  conversationId: string;
  sessionId: string;
}

interface GroupKeyRequestPayload {
  conversationId: string;
}

interface KeyFulfillmentPayload {
  requesterId: string;
  conversationId: string;
  sessionId?: string;
  encryptedKey: string;
}

interface AuthenticatedSocket extends Socket {
  user?: AuthPayload & { publicKey: string | null };
}

export const registerSessionHandlers = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user?.id;
  if (!userId) return;

  // Group Key Request
  socket.on('group:request_key', async ({ conversationId }: GroupKeyRequestPayload) => {
    if (!conversationId) return;

    const isParticipant = await prisma.participant.findFirst({
      where: { conversationId, userId: socket.user!.id }
    });
    if (!isParticipant) {
      console.warn(`[Socket] Unauthorized key request from ${socket.user!.id}`);
      return;
    }

    try {
      const participants = await prisma.participant.findMany({
        where: { conversationId, userId: { not: userId } },
        select: { userId: true },
      });
      const allOnlineUsers = await redisClient.sMembers('online_users');
      const onlineParticipants = participants.filter(p => allOnlineUsers.includes(p.userId));

      if (onlineParticipants.length > 0) {
        const fulfillerId = onlineParticipants[0].userId;
        const requesterPublicKey = socket.user?.publicKey;

        if (requesterPublicKey) {
          io.to(fulfillerId).emit('group:fulfill_key_request', {
            conversationId,
            requesterId: userId,
            requesterPublicKey: requesterPublicKey,
          });
        }
      }
    } catch (error) {
      console.error(`Error processing group key request`, error);
    }
  });

  // Group Key Fulfillment
  socket.on('group:fulfilled_key', ({ requesterId, conversationId, encryptedKey }: KeyFulfillmentPayload) => {
    if (!requesterId || !conversationId || !encryptedKey) return;
    io.to(requesterId).emit('session:new_key', {
      conversationId,
      encryptedKey,
      type: 'GROUP_KEY',
      senderId: userId
    });
  });

  // Session Missing Key Request
  socket.on("session:request_missing", async ({ conversationId, sessionId }: KeyRequestPayload) => {
    try {
      if (!userId) return;

      socket.to(conversationId).emit("session:key_requested", {
        requesterId: userId,
        conversationId,
        sessionId
      });
    } catch (error) {
      console.error("Error handling session request:", error);
    }
  });

  // Session Key Request (Targeted or Broadcast)
  socket.on('session:request_key', async (data: Record<string, unknown>) => {
    const { conversationId, sessionId, targetId } = data as { 
      conversationId?: string; 
      sessionId?: string; 
      targetId?: string 
    };
    
    if (!conversationId) return;

    // Targeted Key Request (Auto-Heal Relay)
    if (targetId) {
      try {
        const participants = await prisma.participant.findMany({
          where: {
            conversationId,
            userId: { in: [userId!, targetId] }
          },
          select: { userId: true }
        });

        const participantIds = participants.map(p => p.userId);
        if (!participantIds.includes(userId!) || !participantIds.includes(targetId)) {
          socket.emit('error', { error: 'Unauthorized key request relay' });
          return;
        }

        io.to(targetId).emit('session:request_key', {
          conversationId,
          requesterId: userId,
          sessionId
        });
      } catch (error) {
        console.error("Error in targeted session:request_key:", error);
      }
      return;
    }

    // Legacy/Broadcast Fallback
    if (!sessionId) return;

    const isParticipant = await prisma.participant.findFirst({
      where: { conversationId, userId: socket.user!.id }
    });
    if (!isParticipant) {
      console.warn(`[Socket] Unauthorized key request from ${socket.user!.id}`);
      return;
    }

    try {
      const participants = await prisma.participant.findMany({
        where: { conversationId, userId: { not: userId } },
        select: { userId: true },
      });
      const allOnlineUsers = await redisClient.sMembers('online_users');
      const onlineParticipants = participants.filter(p => allOnlineUsers.includes(p.userId));

      if (onlineParticipants.length > 0) {
        const fulfillerId = onlineParticipants[0].userId;
        const requesterPublicKey = socket.user?.publicKey;

        if (requesterPublicKey) {
          io.to(fulfillerId).emit('session:fulfill_request', {
            conversationId,
            sessionId,
            requesterId: userId,
            requesterPublicKey: requesterPublicKey,
          });
        }
      }
    } catch (error) {
      console.error('Error processing session key request', error);
    }
  });

  // Session Key Fulfillment Response
  socket.on('session:fulfill_response', ({ requesterId, conversationId, sessionId, encryptedKey }: KeyFulfillmentPayload) => {
    if (!requesterId || !encryptedKey) return;
    io.to(requesterId).emit('session:new_key', {
      conversationId,
      sessionId,
      encryptedKey,
      type: 'SESSION_KEY',
      senderId: userId
    });
  });
};
