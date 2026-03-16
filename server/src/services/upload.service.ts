// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/errors.js';
import { env } from '../config.js';
import { nanoid } from 'nanoid';
import { getPresignedUploadUrl, deleteR2File } from '../utils/r2.js';
import { deleteFromSupabase } from '../utils/supabase.js';
import { getIo } from '../socket.js';

// ==================== DTOs ====================

export interface GeneratePresignedUrlDTO {
  fileName: string;
  fileType: string;
  folder: string;
  fileSize?: number;
  urlTtl?: number;
  fileRetention?: number;
  userId: string;
}

export interface UploadGroupAvatarDTO {
  groupId: string;
  userId: string;
  fileUrl: string;
}

// ==================== Upload Service Functions ====================

/**
 * Helper: Delete old file (Support R2 & Legacy Supabase)
 */
const deleteOldFile = async (url: string) => {
  try {
    if (!url) {
      return;
    }
    // [FIX] Ensure r2PublicDomain is valid before checking includes.
    // If r2PublicDomain is empty string, url.includes('') is always true!
    if (env.r2PublicDomain && env.r2PublicDomain.length > 0 && url.includes(env.r2PublicDomain)) {
      const key = url.replace(`${env.r2PublicDomain}/`, '');
      await deleteR2File(key);
    } else {
      await deleteFromSupabase(url);
    }
  } catch (error) {
    console.error('[Delete File Error]', error);
  }
};

/**
 * Generate presigned upload URL
 */
export const generatePresignedUrl = async (data: GeneratePresignedUrlDTO) => {
  const { fileName, fileType, folder, fileSize, urlTtl = 300, fileRetention = 0, userId } = data;

  const allowedFolders = ['avatars', 'attachments', 'groups'];
  const targetFolder = allowedFolders.includes(folder) ? folder : 'misc';

  // ZERO-KNOWLEDGE PROTOCOL ENFORCEMENT
  // The server must only accept encrypted binary blobs.
  // Allowing specific mime-types leaks metadata about the communication patterns.
  if (fileType !== 'application/octet-stream') {
    throw new ApiError(400, "Protocol violation: Only encrypted 'application/octet-stream' payloads are permitted.");
  }

  if (fileSize && fileSize > 0) {
    // Unified Zero-Knowledge Limits (in Bytes) based purely on destination folder
    const AVATAR_LIMIT = 5 * 1024 * 1024;      // 5 MB for avatars
    const ATTACHMENT_LIMIT = 100 * 1024 * 1024; // 100 MB max for chat attachments (HD Images, Videos, Files)

    const maxSize = (targetFolder === 'avatars' || targetFolder === 'groups') ? AVATAR_LIMIT : ATTACHMENT_LIMIT;

    // Encryption Overhead Buffer (IV + Auth Tag + Margin)
    // AES-GCM adds ~28 bytes. We add 1KB to be safe.
    const ENCRYPTION_OVERHEAD = 1024;
    const allowedMax = maxSize + ENCRYPTION_OVERHEAD;

    if (fileSize > allowedMax) {
      const allowedMaxMB = (maxSize / (1024 * 1024)).toFixed(0);
      throw new ApiError(400, `Payload too large. Maximum size for ${targetFolder} is ${allowedMaxMB}MB.`);
    }
  }

  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) {
    throw new ApiError(400, 'File extension not found in filename');
  }

  // fileRetention: How long the FILE lives before expiration (optional, seconds)
  // Used for Disappearing Messages or temporary transfers
  let deleteAt: Date | undefined;
  if (fileRetention > 0) {
    deleteAt = new Date();
    deleteAt.setSeconds(deleteAt.getSeconds() + fileRetention);
  }

  const key = `${targetFolder}/${userId}-${nanoid()}.${ext}`;

  // [FIX] Force Content-Type to octet-stream because file is ENCRYPTED
  // We pass both urlTtl (link expiry) and deleteAt (file metadata expiry)
  const uploadUrl = await getPresignedUploadUrl(key, 'application/octet-stream', urlTtl, deleteAt);

  return {
    uploadUrl,
    key,
    publicUrl: `${env.r2PublicDomain}/${key}`
  };
};

/**
 * Upload group avatar
 */
export const uploadGroupAvatar = async (data: UploadGroupAvatarDTO) => {
  const { groupId, userId, fileUrl } = data;

  const participant = await prisma.participant.findFirst({
    where: { userId, conversationId: groupId }
  });
  if (!participant || participant.role !== 'ADMIN') {
    throw new ApiError(403, 'Forbidden: Only admin can change group avatar');
  }

  const oldGroup = await prisma.conversation.findUnique({
    where: { id: groupId },
    select: { avatarUrl: true }
  });

  if (oldGroup?.avatarUrl) {
    deleteOldFile(oldGroup.avatarUrl).catch(console.error);
  }

  const updatedConversation = await prisma.conversation.update({
    where: { id: groupId },
    data: { avatarUrl: fileUrl },
    include: {
      participants: {
        include: {
          user: { select: { id: true, encryptedProfile: true, publicKey: true } }
        }
      }
    }
  });

  const transformedConversation = {
    ...updatedConversation,
    participants: updatedConversation.participants.map((p: { user: Record<string, unknown>; role: string }) => ({ ...p.user, role: p.role }))
  };

  const io = getIo();
  io.to(groupId).emit('conversation:updated', {
    id: groupId,
    avatarUrl: fileUrl,
    lastUpdated: updatedConversation.updatedAt
  });

  return transformedConversation;
};
