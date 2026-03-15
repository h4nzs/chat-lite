// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Server, Socket } from 'socket.io';
import { prisma } from '../../lib/prisma.js';
import { redisClient } from '../../lib/redis.js';
import { sendPushNotification } from '../../utils/sendPushNotification.js';
import type { Message } from '@prisma/client';
import type { AuthPayload } from '../../types/auth.js';

interface MessageSendPayload {
  conversationId: string;
  content: string;
  sessionId?: string;
  tempId: number;
  expiresAt?: string;
  pushPayloads?: Record<string, string>;
  repliedToId?: string;
}

interface DistributeKeysPayload {
  conversationId: string;
  keys: { userId: string; key: string }[];
}

interface MarkAsReadPayload {
  messageId: string;
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

export const registerMessageHandlers = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user?.id;
  if (!userId) return;

  // Message Distribution Keys
  socket.on('messages:distribute_keys', async ({ conversationId, keys }: DistributeKeysPayload) => {
    if (!await checkRateLimit(userId, 'keys', 50, 60)) return;
    if (!keys || !Array.isArray(keys) || !conversationId) return;

    try {
      const participant = await prisma.participant.findFirst({
        where: { conversationId, userId },
      });
      if (!participant) return;

      keys.forEach(keyPackage => {
        if (keyPackage.userId && keyPackage.key) {
          io.to(keyPackage.userId).emit('session:new_key', {
            conversationId,
            encryptedKey: keyPackage.key,
            type: 'GROUP_KEY',
            senderId: userId
          });
        }
      });
    } catch (error) {
      console.error(`[Key Distribution] Error:`, error);
    }
  });

  // Send Message
  socket.on('message:send', async (message: MessageSendPayload, callback: (res: { ok: boolean, msg?: Message, error?: string }) => void) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isVerified: true } });

    if (!user?.isVerified) {
      try {
        const key = `sandbox:msg:${userId}`;
        const luaScript = `
          local c = redis.call("INCR", KEYS[1]);
          if c == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end;
          return c;
        `;

        const count = await redisClient.eval(luaScript, {
          keys: [key],
          arguments: ['60']
        }) as number;

        if (count > 5) {
          return callback?.({ ok: false, error: "SANDBOX_LIMIT_REACHED: Max 5 messages per minute. Verify account to unlock." });
        }
      } catch (redisError) {
        console.error(`[SANDBOX] Redis error:`, redisError);
        return callback?.({ ok: false, error: "Service unavailable. Try again later." });
      }
    }

    if (!await checkRateLimit(userId, 'message', 15, 60)) {
      return callback?.({ ok: false, error: "Rate limit exceeded. Slow down." });
    }

    const messageData = message as unknown as Record<string, unknown>;
    const conversationId = messageData.conversationId as string;
    const content = messageData.content as string;
    const sessionId = messageData.sessionId as string | undefined;
    const tempId = messageData.tempId as number | undefined;
    const expiresAt = messageData.expiresAt as Date | undefined;
    const isViewOnce = messageData.isViewOnce as boolean | undefined;
    const pushPayloads = messageData.pushPayloads as Record<string, string> | undefined;
    const repliedToId = messageData.repliedToId as string | undefined;

    if (!content || typeof content !== 'string' || content.length > 10000) {
      return callback?.({ ok: false, error: "Invalid message content." });
    }

    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { participants: { select: { userId: true } } },
      });
      if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
        return callback?.({ ok: false, error: "Conversation not found." });
      }

      if (repliedToId) {
        const targetMessage = await prisma.message.findUnique({
          where: { id: repliedToId },
          select: { conversationId: true }
        });

        if (!targetMessage || targetMessage.conversationId !== conversationId) {
          return callback?.({ ok: false, error: "Invalid reply target." });
        }
      }

      const newMessage = await prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          content,
          sessionId,
          repliedToId,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          isViewOnce: isViewOnce === true
        },
        include: {
          sender: { select: { id: true, encryptedProfile: true } },
          repliedTo: true
        }
      });

      const finalMessage = { ...newMessage, tempId };

      conversation.participants.forEach(participant => {
        io.to(participant.userId).emit('message:new', finalMessage);

        if (participant.userId !== userId) {
          const encryptedPushPayload = pushPayloads ? pushPayloads[participant.userId] : null;
          sendPushNotification(participant.userId, {
            type: encryptedPushPayload ? 'ENCRYPTED_MESSAGE' : 'GENERIC_MESSAGE',
            data: { conversationId, messageId: newMessage.id, encryptedPushPayload }
          }).catch(console.error);
        }
      });

      callback?.({ ok: true, msg: finalMessage });
    } catch (error) {
      console.error("Failed to process message:", error);
      callback?.({ ok: false, error: "Failed to send." });
    }
  });

  // Mark as Read
  socket.on('message:mark_as_read', async ({ messageId, conversationId }: MarkAsReadPayload) => {
    if (!messageId || !socket.user) return;
    const socketUserId = socket.user.id;

    try {
      const msg = await prisma.message.findUnique({ 
        select: { id: true, conversationId: true }, 
        where: { id: messageId } 
      });
      if (!msg || msg.conversationId !== conversationId) return;

      const isParticipant = await prisma.participant.findFirst({ 
        where: { conversationId, userId: socketUserId } 
      });
      if (!isParticipant) return;

      await prisma.messageStatus.upsert({
        where: { messageId_userId: { messageId, userId: socketUserId } },
        update: { status: 'READ' },
        create: { messageId, userId: socketUserId, status: 'READ' },
      });

      await prisma.participant.update({
        where: { userId_conversationId: { userId: socketUserId, conversationId } },
        data: { lastReadMsgId: messageId }
      });

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { senderId: true, conversationId: true },
      });

      if (message && message.senderId !== socketUserId) {
        io.to(message.senderId).emit('message:status_updated', {
          messageId,
          conversationId: message.conversationId,
          readBy: socketUserId,
          status: 'READ',
        });
      }
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  });
};
