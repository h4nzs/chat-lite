// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/errors.js';
import { getIo } from '../socket.js';
import { deleteR2Files } from '../utils/r2.js';
import { verifyPassword } from '../utils/password.js';

// ==================== DTOs ====================

export interface SearchUsersDTO {
  query: string;
  currentUserId: string;
}

export interface GetUserProfileDTO {
  userId: string;
}

export interface UpdateProfileDTO {
  encryptedProfile?: string;
  autoDestructDays?: number | null;
}

export interface UpdateKeysDTO {
  publicKey: string;
  signingKey: string;
}

export interface BlockUserDTO {
  blockerId: string;
  blockedId: string;
}

export interface ReportUserDTO {
  reporterId: string;
  reportedId: string;
  reason: string;
}

export interface DeleteAccountDTO {
  userId: string;
  password: string;
  fileKeys?: string[];
}

// ==================== User Service Functions ====================

/**
 * Search users by usernameHash (Blind Index Exact Match)
 */
export const searchUsers = async (query: string, currentUserId: string) => {
  if (!query || typeof query !== 'string') {
    return [];
  }

  // Sandbox check
  const user = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { isVerified: true }
  });

  if (!user?.isVerified) {
    throw new ApiError(403, 'SANDBOX_SEARCH_RESTRICTION: Unverified users cannot search for other users.');
  }

  const limit = 20;

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: currentUserId } },
        { usernameHash: query }
      ]
    },
    select: {
      id: true,
      encryptedProfile: true,
      isVerified: true,
      publicKey: true
    },
    take: limit
  });

  return users;
};

/**
 * Get current user profile (with lastActiveAt update)
 */
export const getUserProfile = async (userId: string) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
    select: {
      id: true,
      usernameHash: true,
      encryptedProfile: true,
      isVerified: true,
      hasCompletedOnboarding: true,
      role: true,
      autoDestructDays: true
    }
  });

  return user;
};

/**
 * Update user profile
 */
export const updateProfile = async (userId: string, data: UpdateProfileDTO) => {
  const { encryptedProfile, autoDestructDays } = data;

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { encryptedProfile: true }
  });

  const dataToUpdate: { encryptedProfile?: string; autoDestructDays?: number | null } = {};
  if (encryptedProfile !== undefined) dataToUpdate.encryptedProfile = encryptedProfile;
  if (autoDestructDays !== undefined) dataToUpdate.autoDestructDays = autoDestructDays;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
    select: {
      id: true,
      encryptedProfile: true,
      isVerified: true,
      hasCompletedOnboarding: true,
      autoDestructDays: true
    }
  });

  // If encryptedProfile was updated, notify the user and their contacts
  if (encryptedProfile !== undefined && (!existingUser || encryptedProfile !== existingUser.encryptedProfile)) {
    const io = getIo();
    
    // Notify the user themselves (all their active devices)
    io.to(userId).emit('user:updated', {
      id: updatedUser.id,
      encryptedProfile: updatedUser.encryptedProfile
    });

    // Notify contacts
    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: { participants: { select: { userId: true } } }
    });

    const recipients = new Set<string>();
    for (const c of conversations) {
      for (const p of c.participants) {
        if (p.userId !== userId) {
          recipients.add(p.userId);
        }
      }
    }

    recipients.forEach(recipientId => {
      io.to(recipientId).emit('user:updated', {
        id: updatedUser.id,
        encryptedProfile: updatedUser.encryptedProfile
      });
    });
  }

  return updatedUser;
};

/**
 * Update user public keys (E2EE)
 */
export const updateKeys = async (userId: string, data: UpdateKeysDTO) => {
  const { publicKey, signingKey } = data;

  const user = await prisma.user.update({
    where: { id: userId },
    data: { publicKey, signingKey },
    select: { id: true }
  });

  // Notify contacts
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    include: { participants: { select: { userId: true } } }
  });

  const recipients = new Set<string>();
  conversations.forEach(c => c.participants.forEach(p => {
    if (p.userId !== userId) recipients.add(p.userId);
  }));

  const io = getIo();
  recipients.forEach(recipientId => {
    io.to(recipientId).emit('user:identity_changed', { userId: user.id });
  });

  return { message: 'Keys updated successfully.' };
};

/**
 * Get user profile by ID
 */
export const getUserById = async (targetUserId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      encryptedProfile: true,
      createdAt: true,
      publicKey: true,
      isVerified: true
    }
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
};

/**
 * Complete onboarding
 */
export const completeOnboarding = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { hasCompletedOnboarding: true }
  });

  return { success: true };
};

/**
 * Block a user
 */
export const blockUser = async (blockerId: string, blockedId: string) => {
  if (blockerId === blockedId) {
    throw new ApiError(400, 'You cannot block yourself');
  }

  try {
    await prisma.blockedUser.create({
      data: { blockerId, blockedId }
    });

    return { success: true, message: 'User blocked' };
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return { success: true, message: 'User already blocked' };
    }
    throw error;
  }
};

/**
 * Unblock a user
 */
export const unblockUser = async (blockerId: string, blockedId: string) => {
  await prisma.blockedUser.deleteMany({
    where: { blockerId, blockedId }
  });

  return { success: true, message: 'User unblocked' };
};

/**
 * Get blocked users list
 */
export const getBlockedUsers = async (userId: string) => {
  const blocked = await prisma.blockedUser.findMany({
    where: { blockerId: userId },
    include: { blocked: { select: { id: true, encryptedProfile: true } } }
  });

  return blocked.map(b => b.blocked);
};

/**
 * Report a user
 */
export const reportUser = async (_reporterId: string, _reportedId: string, _reason: string) => {
  // TODO: Implement reporting logic when reporting feature is added
  return { success: true, message: 'User reported' };
};

/**
 * Delete account (Self-Destruct)
 */
export const deleteAccount = async (data: DeleteAccountDTO) => {
  const { userId, password, fileKeys } = data;

  // 1. Re-verify password (Security Check)
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid password. Account deletion aborted.');
  }

  // 2. Cleanup Storage (R2)
  if (fileKeys && Array.isArray(fileKeys) && fileKeys.length > 0) {
    try {
      // VALIDATION: Ensure the user is only deleting their OWN files.
      // Our R2 object keys always start with: `${targetFolder}/${userId}-...`
      const validKeys = fileKeys.filter((key: string) => {
        if (typeof key !== 'string') return false;
        // Split by folder, e.g., "images/cl123456-abcdef.png" -> ["images", "cl123456-abcdef.png"]
        const parts = key.split('/');
        if (parts.length < 2) return false;
        const filename = parts[parts.length - 1];
        return filename.startsWith(`${userId}-`);
      });

      if (validKeys.length > 0) {
        await deleteR2Files(validKeys);
      } else {
        console.warn(`User ${userId} attempted to delete invalid or unauthorized R2 keys.`);
      }
    } catch (e) {
      console.error("Failed to cleanup R2 files:", e);
      // Continue deletion anyway
    }
  }

  // 3. Nuke Database
  await prisma.user.delete({ where: { id: userId } });

  return { message: 'Account permanently deleted.' };
};
