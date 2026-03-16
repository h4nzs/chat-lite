// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/errors.js';
import { redisClient } from '../lib/redis.js';
import { rotateAndDistributeSessionKeys } from '../utils/sessionKeys.js';
import { getIo } from '../socket.js';

// ==================== Constants ====================
const MAX_GROUP_MEMBERS = 100;

// ==================== DTOs ====================

export interface CreateConversationDTO {
  title?: string;
  userIds: string[];
  isGroup?: boolean;
  initialSession?: {
    sessionId: string;
    initialKeys: { userId: string; key: string }[];
    ephemeralPublicKey: string;
  };
}

export interface UpdateConversationDetailsDTO {
  title?: string;
  description?: string;
}

export interface AddParticipantsDTO {
  userIds: string[];
}

export interface UpdateParticipantRoleDTO {
  role: 'ADMIN' | 'MEMBER';
}

// ==================== Conversation Service Functions ====================

/**
 * List all conversations for a user
 */
export const listConversations = async (userId: string) => {
  const conversationsData = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId } },
      hiddenBy: { none: { userId } }
    },
    include: {
      participants: {
        select: {
          user: {
            select: { id: true, encryptedProfile: true, publicKey: true, signingKey: true }
          },
          isPinned: true,
          role: true
        }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          sender: {
            select: { id: true, encryptedProfile: true, publicKey: true, signingKey: true }
          }
        }
      },
      creator: {
        select: { id: true, publicKey: true, signingKey: true, encryptedProfile: true }
      }
    },
    orderBy: {
      lastMessageAt: 'desc'
    }
  });

  const unreadCounts: { conversationId: string; unreadCount: number }[] = await prisma.$queryRaw`
    SELECT
      p."conversationId" AS "conversationId",
      COUNT(m.id)::int AS "unreadCount"
    FROM "Participant" p
    LEFT JOIN "Message" last_read_message ON p."lastReadMsgId" = last_read_message.id
    JOIN "Message" m ON m."conversationId" = p."conversationId"
    WHERE
      p."userId" = ${userId}
      AND m."senderId" != ${userId}
      AND m."createdAt" > COALESCE(last_read_message."createdAt", p."joinedAt")
    GROUP BY p."conversationId";
  `;

  const unreadMap = new Map(unreadCounts.map(item => [item.conversationId, item.unreadCount]));
  const conversations = conversationsData.map(convo => ({
    ...convo,
    unreadCount: unreadMap.get(convo.id) || 0
  }));

  return conversations;
};

/**
 * Create a new conversation
 */
export const createConversation = async (data: CreateConversationDTO, creatorId: string) => {
  const { title, userIds, isGroup = false, initialSession } = data;

  if (!Array.isArray(userIds)) {
    throw new ApiError(400, 'userIds must be an array.');
  }

  // Sandbox check
  const user = await prisma.user.findUnique({ where: { id: creatorId }, select: { isVerified: true } });
  const isVerified = user?.isVerified ?? false;

  if (!isVerified && isGroup) {
    throw new ApiError(403, 'SANDBOX_GROUP_RESTRICTION: Unverified users cannot create groups.');
  }

  if (userIds.length > MAX_GROUP_MEMBERS) {
    throw new ApiError(400, `Group cannot have more than ${MAX_GROUP_MEMBERS} members.`);
  }

  if (!isGroup) {
    const otherUserId = userIds.find((id: string) => id !== creatorId);
    if (!otherUserId) {
      throw new ApiError(400, 'Another user ID is required for a private chat.');
    }

    const existingConversation = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId: creatorId } } },
          { participants: { some: { userId: otherUserId } } }
        ]
      },
      include: { participants: { include: { user: true } }, creator: true }
    });

    if (existingConversation) {
      return {
        conversation: existingConversation,
        created: false,
        allUserIds: [creatorId, otherUserId]
      };
    }

    // Sandbox DM limit check
    if (!isVerified) {
      const today = new Date().toISOString().split('T')[0];
      const key = `sandbox:newchat:${creatorId}:${today}`;

      const count = await redisClient.eval(
        "local c = redis.call('INCR', KEYS[1]); if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return c",
        {
          keys: [key],
          arguments: ['86400']
        }
      ) as number;

      if (count > 3) {
        throw new ApiError(429, 'SANDBOX_NEW_CHAT_LIMIT: Max 3 new conversations per day.');
      }
    }
  }

  const allUserIds = Array.from(new Set([...userIds, creatorId]));

  let newConversation;
  try {
    newConversation = await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          title: isGroup ? title : null,
          isGroup,
          creatorId: isGroup ? creatorId : null,
          participants: {
            create: allUserIds.map((userId: string) => ({
              user: { connect: { id: userId } },
              role: userId === creatorId ? 'ADMIN' : 'MEMBER'
            }))
          }
        },
        include: {
          participants: {
            select: {
              role: true,
              user: { select: { id: true, encryptedProfile: true, publicKey: true, signingKey: true } }
            }
          },
          creator: {
            select: { id: true, encryptedProfile: true, publicKey: true, signingKey: true }
          }
        }
      });

      if (initialSession) {
        const { sessionId, initialKeys, ephemeralPublicKey } = initialSession;
        if (!sessionId || !initialKeys || !ephemeralPublicKey) {
          throw new Error('Incomplete initial session data provided.');
        }
        const keyRecords = initialKeys.map((ik: { userId: string; key: string }) => ({
          sessionId,
          encryptedKey: ik.key,
          userId: ik.userId,
          conversationId: conversation.id,
          initiatorEphemeralKey: ephemeralPublicKey,
          isInitiator: ik.userId === creatorId
        }));
        await tx.sessionKey.createMany({ data: keyRecords });
      } else if (isGroup) {
        await rotateAndDistributeSessionKeys(conversation.id, creatorId, tx);
      }

      return conversation;
    });
  } catch (dbError) {
    // Rollback atomic counter if db fails
    if (!isVerified && !isGroup) {
      const today = new Date().toISOString().split('T')[0];
      const key = `sandbox:newchat:${creatorId}:${today}`;
      try { await redisClient.decr(key); } catch { /* ignore */ }
    }
    throw dbError;
  }

  const transformedConversation = {
    ...newConversation,
    isGroup: newConversation.isGroup,
    participants: newConversation.participants.map(p => ({ ...p.user, role: p.role })),
    unreadCount: 1,
    lastMessage: null
  };

  return {
    conversation: transformedConversation,
    created: true,
    allUserIds
  };
};

/**
 * Get conversation details
 */
export const getConversationDetails = async (conversationId: string, userId: string) => {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId } }
    },
    include: {
      participants: {
        select: {
          user: { select: { id: true, encryptedProfile: true, publicKey: true, signingKey: true } },
          isPinned: true,
          role: true
        }
      },
      creator: { select: { id: true, publicKey: true, signingKey: true, encryptedProfile: true } }
    }
  });

  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  return conversation;
};

/**
 * Update conversation details
 */
export const updateConversationDetails = async (
  conversationId: string,
  userId: string,
  data: UpdateConversationDetailsDTO
) => {
  const { title, description } = data;

  const participant = await prisma.participant.findFirst({
    where: { conversationId, userId }
  });

  if (!participant || participant.role !== 'ADMIN') {
    throw new ApiError(403, 'Forbidden: You are not an admin of this group.');
  }

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: { title, description }
  });

  return updatedConversation;
};

/**
 * Add participants to a group
 */
export const addParticipants = async (conversationId: string, adminId: string, userIds: string[]) => {
  if (!Array.isArray(userIds)) {
    throw new ApiError(400, 'userIds must be an array.');
  }

  const adminParticipant = await prisma.participant.findFirst({
    where: { conversationId, userId: adminId, role: 'ADMIN' }
  });

  if (!adminParticipant) {
    throw new ApiError(403, 'Forbidden: You are not an admin of this group.');
  }

  const currentCount = await prisma.participant.count({ where: { conversationId } });
  if (currentCount + userIds.length > MAX_GROUP_MEMBERS) {
    throw new ApiError(400, `Group limit reached (${MAX_GROUP_MEMBERS} members max).`);
  }

  const newParticipants = await prisma.$transaction(async (tx) => {
    await Promise.all(userIds.map((userId: string) =>
      tx.participant.upsert({
        where: { userId_conversationId: { userId, conversationId } },
        create: { userId, conversationId, joinedAt: new Date() },
        update: { joinedAt: new Date() }
      })
    ));
    await rotateAndDistributeSessionKeys(conversationId, adminId, tx);
    return await tx.participant.findMany({
      where: { conversationId, userId: { in: userIds } },
      include: { user: { select: { id: true, encryptedProfile: true, publicKey: true, signingKey: true } } }
    });
  });

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { include: { user: true } }, creator: true }
  });

  // Emit socket events
  const io = getIo();
  io.to(conversationId).emit('conversation:participants_added', { conversationId, newParticipants });
  io.to(conversationId).emit('group:participants_changed', { conversationId });
  newParticipants.forEach(p => {
    if (conversation) io.to(p.userId).emit('conversation:new', conversation);
  });

  return newParticipants;
};

/**
 * Update participant role
 */
export const updateParticipantRole = async (
  conversationId: string,
  userId: string,
  userToModifyId: string,
  role: 'ADMIN' | 'MEMBER'
) => {
  const adminParticipant = await prisma.participant.findFirst({
    where: { conversationId, userId }
  });

  if (!adminParticipant || adminParticipant.role !== 'ADMIN') {
    throw new ApiError(403, 'Forbidden: You are not an admin of this group.');
  }

  if (userId === userToModifyId) {
    throw new ApiError(400, 'You cannot change your own role.');
  }

  const updatedParticipant = await prisma.participant.updateMany({
    where: { conversationId, userId: userToModifyId },
    data: { role }
  });

  if (updatedParticipant.count === 0) {
    throw new ApiError(404, 'Participant not found.');
  }

  const io = getIo();
  io.to(conversationId).emit('conversation:participant_updated', {
    conversationId,
    userId: userToModifyId,
    role
  });

  return { userId: userToModifyId, role };
};

/**
 * Remove participant from group
 */
export const removeParticipant = async (
  conversationId: string,
  userId: string,
  userToRemoveId: string
) => {
  const adminParticipant = await prisma.participant.findFirst({
    where: { conversationId, userId }
  });

  if (!adminParticipant || adminParticipant.role !== 'ADMIN') {
    throw new ApiError(403, 'Forbidden: You are not an admin of this group.');
  }

  if (userId === userToRemoveId) {
    throw new ApiError(400, 'You cannot remove yourself from the group.');
  }

  try {
    await prisma.participant.delete({
      where: { userId_conversationId: { userId: userToRemoveId, conversationId } }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new ApiError(404, 'Participant not found in this group.');
    }
    throw error;
  }

  const io = getIo();
  io.to(conversationId).emit('conversation:participant_removed', { conversationId, userId: userToRemoveId });
  io.to(conversationId).emit('group:participants_changed', { conversationId });
  io.to(userToRemoveId).emit('conversation:deleted', { id: conversationId });

  await rotateAndDistributeSessionKeys(conversationId, userId);
};

/**
 * Leave a group
 */
export const leaveConversation = async (conversationId: string, userId: string) => {
  const participant = await prisma.participant.findFirst({
    where: { conversationId, userId }
  });

  if (!participant) {
    throw new ApiError(404, 'You are not a member of this group.');
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (conversation?.creatorId === userId) {
    throw new ApiError(400, 'Group creator cannot leave; please delete it instead.');
  }

  await prisma.participant.delete({
    where: { userId_conversationId: { userId, conversationId } }
  });

  const io = getIo();
  io.to(conversationId).emit('conversation:participant_removed', { conversationId, userId });
  io.to(conversationId).emit('group:participants_changed', { conversationId });
  io.to(userId).emit('conversation:deleted', { id: conversationId });

  const remainingAdmin = await prisma.participant.findFirst({
    where: { conversationId, role: 'ADMIN', userId: { not: userId } }
  });

  if (remainingAdmin) {
    try {
      await rotateAndDistributeSessionKeys(conversationId, remainingAdmin.userId);
    } catch (error) {
      console.error('Failed to rotate keys for:', conversationId, 'after user', userId, 'left:', error);
    }
  } else {
    console.warn('Could not rotate keys for:', conversationId, 'after user left: no remaining admin found.');
  }
};

/**
 * Delete a conversation
 */
export const deleteConversation = async (conversationId: string, userId: string) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { select: { userId: true } } }
  });

  if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
    throw new ApiError(404, 'Conversation not found or you are not a participant.');
  }

  const io = getIo();

  if (conversation.isGroup) {
    if (conversation.creatorId !== userId) {
      throw new ApiError(403, 'Only the group creator can delete the group.');
    }
    await prisma.conversation.delete({ where: { id: conversationId } });
    io.to(conversation.participants.map(p => p.userId)).emit('conversation:deleted', { id: conversationId });
  } else {
    await prisma.userHiddenConversation.create({
      data: { userId, conversationId }
    });
    io.to(userId).emit('conversation:deleted', { id: conversationId });
  }
};

/**
 * Toggle pin status
 */
export const togglePinStatus = async (conversationId: string, userId: string) => {
  const participant = await prisma.participant.findUnique({
    where: { userId_conversationId: { userId, conversationId } }
  });

  if (!participant) {
    throw new ApiError(404, 'You are not a participant of this conversation.');
  }

  const updatedParticipant = await prisma.participant.update({
    where: { userId_conversationId: { userId, conversationId } },
    data: { isPinned: !participant.isPinned }
  });

  return { isPinned: updatedParticipant.isPinned };
};

/**
 * Mark conversation as read
 */
export const markAsRead = async (conversationId: string, userId: string) => {
  const lastMessage = await prisma.message.findFirst({
    where: { conversationId },
    orderBy: { createdAt: 'desc' }
  });

  if (lastMessage) {
    await prisma.participant.updateMany({
      where: { conversationId, userId },
      data: { lastReadMsgId: lastMessage.id }
    });
  }
};

/**
 * Record key rotation
 */
export const recordKeyRotation = async (conversationId: string, userId: string) => {
  const participant = await prisma.participant.findFirst({
    where: { conversationId, userId }
  });

  if (!participant) {
    throw new ApiError(404, "Conversation not found or you're not a participant");
  }

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      updatedAt: new Date()
    }
  });

  return {
    success: true,
    message: 'Key rotation recorded successfully',
    conversation: updatedConversation
  };
};
