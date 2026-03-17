// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/errors.js';
import { sendPushNotification } from '../utils/sendPushNotification.js';
import { deleteR2File } from '../utils/r2.js';
import { env } from '../config.js';
import { getIo } from '../socket.js';

// ==================== DTOs ====================

export interface GetMessagesDTO {
  conversationId: string;
  userId: string;
  cursor?: string;
}

export interface GetMessageContextDTO {
  messageId: string;
  userId: string;
}

export interface SendMessageDTO {
  conversationId: string;
  senderId: string;
  content?: string | null;
  sessionId?: string | null;
  repliedToId?: string | null;
  tempId?: string | number;
  expiresIn?: number | null;
  isViewOnce?: boolean;
  pushPayloads?: Record<string, string>;
}

export interface DeleteMessageDTO {
  messageId: string;
  userId: string;
}

export interface DeleteMessagesDTO {
  messageIds: string[];
  userId: string;
}

export interface UpdateMessageDTO {
  messageId: string;
  userId: string;
  content: string;
}

// ==================== Message Service Functions ====================

/**
 * Get messages for a conversation
 */
export const getMessages = async (data: GetMessagesDTO) => {
  const { conversationId, userId, cursor } = data;

  const participant = await prisma.participant.findUnique({
    where: {
      userId_conversationId: {
        userId,
        conversationId
      }
    }
  });

  if (!participant) {
    throw new ApiError(403, 'You are not a member of this conversation.');
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      createdAt: { gte: participant.joinedAt }
    },
    take: 50,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      sender: {
        select: { id: true, encryptedProfile: true }
      },
      statuses: true,
      repliedTo: {
        include: {
          sender: { select: { id: true, encryptedProfile: true } }
        }
      }
    }
  });

  return { items: messages.reverse() };
};

/**
 * Get message context (surrounding messages)
 */
export const getMessageContext = async (data: GetMessageContextDTO) => {
  const { messageId, userId } = data;

  const targetMsg = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      sender: { select: { id: true, encryptedProfile: true } },
      repliedTo: true,
      statuses: true
    }
  });

  if (!targetMsg) {
    throw new ApiError(404, 'Message not found');
  }

  const participation = await prisma.participant.findUnique({
    where: {
      userId_conversationId: {
        userId,
        conversationId: targetMsg.conversationId
      }
    }
  });

  if (!participation) {
    throw new ApiError(403, 'Not a participant');
  }

  const older = await prisma.message.findMany({
    where: {
      conversationId: targetMsg.conversationId,
      createdAt: { lt: targetMsg.createdAt, gte: participation.joinedAt }
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      sender: { select: { id: true, encryptedProfile: true } },
      repliedTo: true,
      statuses: true
    }
  });

  const newer = await prisma.message.findMany({
    where: {
      conversationId: targetMsg.conversationId,
      createdAt: { gt: targetMsg.createdAt, gte: participation.joinedAt }
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
    include: {
      sender: { select: { id: true, encryptedProfile: true } },
      repliedTo: true,
      statuses: true
    }
  });

  const allMessages = [...older.reverse(), targetMsg, ...newer];

  return { items: allMessages, conversationId: targetMsg.conversationId };
};

/**
 * Send a message
 */
export const sendMessage = async (data: SendMessageDTO) => {
  const {
    conversationId,
    senderId,
    content,
    sessionId,
    repliedToId,
    tempId,
    expiresIn,
    isViewOnce,
    pushPayloads
  } = data;

  const participants = await prisma.participant.findMany({
    where: { conversationId },
    select: { userId: true }
  });

  if (!participants.some(p => p.userId === senderId)) {
    throw new ApiError(403, 'You are not a participant.');
  }

  let expiresAt: Date | undefined;
  if (expiresIn && typeof expiresIn === 'number' && expiresIn > 0) {
    expiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  if (repliedToId) {
    const targetMessage = await prisma.message.findUnique({
      where: { id: repliedToId },
      select: { conversationId: true }
    });

    if (!targetMessage || targetMessage.conversationId !== conversationId) {
      throw new ApiError(400, 'Invalid reply target.');
    }
  }

  const newMessage = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
      sessionId,
      repliedToId,
      expiresAt,
      isViewOnce: isViewOnce === true
    },
    include: {
      sender: { select: { id: true, encryptedProfile: true } },
      repliedTo: true
    }
  });

  const finalMessage = { ...newMessage, tempId };

  const io = getIo();
  participants.forEach(participant => {
    io.to(participant.userId).emit('message:new', finalMessage);

    if (participant.userId !== senderId) {
      const encryptedPushPayload = pushPayloads ? pushPayloads[participant.userId] : null;
      sendPushNotification(participant.userId, {
        type: encryptedPushPayload ? 'ENCRYPTED_MESSAGE' : 'GENERIC_MESSAGE',
        data: { conversationId, messageId: newMessage.id, encryptedPushPayload }
      }).catch(console.error);
    }
  });

  return finalMessage;
};

/**
 * Delete a message
 */
export const deleteMessage = async (data: DeleteMessageDTO) => {
  const { messageId, userId } = data;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { sender: true }
  });

  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  if (message.senderId !== userId) {
    throw new ApiError(403, 'You can only delete your own messages');
  }

  await prisma.message.delete({
    where: { id: messageId }
  });

  const io = getIo();
  io.to(message.conversationId).emit('message:deleted', {
    id: messageId,
    conversationId: message.conversationId
  });

  return { success: true };
};

/**
 * Delete multiple messages
 */
export const deleteMessages = async (data: DeleteMessagesDTO) => {
  const { messageIds, userId } = data;

  const messages = await prisma.message.findMany({
    where: { id: { in: messageIds } },
    include: { sender: true }
  });

  const ownMessages = messages.filter(m => m.senderId === userId);

  if (ownMessages.length === 0) {
    throw new ApiError(403, 'No valid messages to delete');
  }

  await prisma.message.deleteMany({
    where: { id: { in: ownMessages.map(m => m.id) } }
  });

  const io = getIo();
  const conversationId = ownMessages[0]?.conversationId;
  if (conversationId) {
    io.to(conversationId).emit('message:deleted', {
      ids: ownMessages.map(m => m.id),
      conversationId
    });
  }

  return { success: true, deletedCount: ownMessages.length };
};

/**
 * Update a message (edit)
 */
export const updateMessage = async (data: UpdateMessageDTO) => {
  const { messageId, userId, content } = data;

  const message = await prisma.message.findUnique({
    where: { id: messageId }
  });

  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  if (message.senderId !== userId) {
    throw new ApiError(403, 'You can only edit your own messages');
  }

  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: {
      content
    },
    include: {
      sender: { select: { id: true, encryptedProfile: true } },
      repliedTo: true
    }
  });

  const io = getIo();
  io.to(message.conversationId).emit('message:updated', updatedMessage);

  return updatedMessage;
};

/**
 * Mark message as read
 */
export const markMessageAsRead = async (messageId: string, userId: string, conversationId: string) => {
  const msg = await prisma.message.findUnique({
    select: { id: true, conversationId: true },
    where: { id: messageId }
  });

  if (!msg || msg.conversationId !== conversationId) {
    throw new ApiError(404, 'Message not found');
  }

  const isParticipant = await prisma.participant.findFirst({
    where: { conversationId, userId }
  });

  if (!isParticipant) {
    throw new ApiError(403, 'Not a participant');
  }

  await prisma.messageStatus.upsert({
    where: { messageId_userId: { messageId, userId } },
    update: { status: 'READ' },
    create: { messageId, userId, status: 'READ' }
  });

  await prisma.participant.update({
    where: { userId_conversationId: { userId, conversationId } },
    data: { lastReadMsgId: messageId }
  });

  return { success: true };
};

/**
 * Delete View Once message (bypasses sender-only restriction)
 * Used when recipient views a view-once message
 */
export const deleteViewOnceMessage = async (messageId: string, userId: string) => {
  const message = await prisma.message.findUnique({
    where: { id: messageId }
  });

  if (!message) throw new ApiError(404, 'Message not found');
  if (!message.isViewOnce) throw new ApiError(400, 'Not a view once message');

  const participant = await prisma.participant.findUnique({
    where: { userId_conversationId: { userId, conversationId: message.conversationId } }
  });

  if (!participant) throw new ApiError(403, 'Not a participant');

  await prisma.message.delete({ where: { id: messageId } });

  const io = getIo();
  io.to(message.conversationId).emit('message:deleted', {
    id: messageId,
    conversationId: message.conversationId
  });

  return { success: true };
};
