// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/errors.js';
import { env } from '../config.js';

// ==================== DTOs ====================

export interface UploadPreKeyBundleDTO {
  identityKey: string;
  signingKey?: string;
  signedPreKey: {
    key: string;
    signature: string;
  };
}

export interface UploadOTPKDTO {
  keyId: number;
  publicKey: string;
}

export interface EstablishInitialSessionDTO {
  userId: string;
  conversationId: string;
  sessionId: string;
}

// ==================== Key Service Functions ====================

/**
 * Upload or update a user's pre-key bundle
 */
export const uploadPreKeyBundle = async (userId: string, data: UploadPreKeyBundleDTO) => {
  const { identityKey, signedPreKey, signingKey } = data;

  // Prepare user update data
  const userUpdateData: Record<string, string> = { publicKey: identityKey };
  if (signingKey) {
    userUpdateData.signingKey = signingKey;
  } else {
    // If not provided in request, ensure the user already has one.
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { signingKey: true }
    });
    if (!currentUser?.signingKey) {
      throw new ApiError(400, 'Signing key is required for initial bundle upload.');
    }
  }

  // Use a transaction to ensure both operations succeed or fail together
  await prisma.$transaction([
    // Purge old OTPKs on bundle update (New Identity/Session)
    // This prevents "Identity Crisis" where new identity is mixed with old OTPKs.
    prisma.oneTimePreKey.deleteMany({
      where: { userId }
    }),
    prisma.preKeyBundle.upsert({
      where: { userId },
      update: {
        identityKey,
        key: signedPreKey.key,
        signature: signedPreKey.signature
      },
      create: {
        userId,
        identityKey,
        key: signedPreKey.key,
        signature: signedPreKey.signature
      }
    }),
    prisma.user.update({
      where: { id: userId },
      data: userUpdateData
    })
  ]);

  return { message: 'Pre-key bundle updated successfully.' };
};

/**
 * Upload One-Time Pre-Keys (OTPK)
 */
export const uploadOTPKs = async (userId: string, keys: UploadOTPKDTO[]) => {
  // Use createMany for efficiency
  // Note: If keyId conflict exists (unique constraint), this might fail.
  // We assume client manages keyIds correctly (e.g. rolling counter).
  await prisma.oneTimePreKey.createMany({
    data: keys.map(k => ({
      userId,
      keyId: k.keyId,
      publicKey: k.publicKey
    })),
    skipDuplicates: true // Ignore duplicates if client retries
  });

  return { message: `Uploaded ${keys.length} One-Time Pre-Keys.` };
};

/**
 * Count One-Time Pre-Keys for a user
 */
export const countOTPKs = async (userId: string) => {
  const count = await prisma.oneTimePreKey.count({
    where: { userId }
  });

  return { count };
};

/**
 * Clear all One-Time Pre-Keys for a user
 */
export const clearOTPKs = async (userId: string) => {
  await prisma.oneTimePreKey.deleteMany({
    where: { userId }
  });
};

/**
 * Get a pre-key bundle for another user
 */
export const getPreKeyBundle = async (targetUserId: string) => {
  // 1. Fetch User and Bundle
  const userWithBundle = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      publicKey: true,
      signingKey: true,
      preKeyBundle: true
    }
  });

  if (!userWithBundle?.preKeyBundle || !userWithBundle.signingKey) {
    throw new ApiError(404, 'User does not have a valid pre-key bundle available.');
  }

  // 2. Atomic Pop: Fetch ONE OTPK and Delete it
  // We use a transaction: Find First -> Delete ID.
  const otpk = await prisma.$transaction(async (tx) => {
    const key = await tx.oneTimePreKey.findFirst({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'asc' }, // Use oldest first
      select: { id: true, keyId: true, publicKey: true }
    });

    if (key) {
      await tx.oneTimePreKey.delete({ where: { id: key.id } });
    }
    return key;
  });

  const { preKeyBundle, signingKey } = userWithBundle;

  // Assemble the response bundle
  const responseBundle: Record<string, unknown> = {
    identityKey: preKeyBundle.identityKey,
    signedPreKey: {
      key: preKeyBundle.key,
      signature: preKeyBundle.signature
    },
    signingKey // Include the public signing key for verification
  };

  // 3. Attach One-Time Pre-Key if available
  if (otpk) {
    responseBundle.oneTimePreKey = {
      keyId: otpk.keyId,
      key: otpk.publicKey
    };
  }

  return responseBundle;
};

/**
 * Get an initial session key record for a recipient
 */
export const getInitialSession = async (data: EstablishInitialSessionDTO) => {
  const { userId, conversationId, sessionId } = data;

  const keyRecord = await prisma.sessionKey.findFirst({
    where: {
      conversationId,
      sessionId,
      userId
    }
  });

  if (!keyRecord || !keyRecord.initiatorEphemeralKey) {
    throw new ApiError(404, 'Initial session data not found for this user.');
  }

  // Find the initiator to get their public identity key
  const initiatorRecord = await prisma.sessionKey.findFirst({
    where: {
      conversationId,
      sessionId,
      isInitiator: true
    },
    include: { user: { select: { id: true, publicKey: true } } }
  });

  if (!(initiatorRecord as { user?: { publicKey?: string } })?.user?.publicKey) {
    throw new ApiError(404, "Initiator's public key could not be found for this session.");
  }

  return {
    encryptedKey: keyRecord.encryptedKey,
    initiatorEphemeralKey: keyRecord.initiatorEphemeralKey,
    initiatorIdentityKey: (initiatorRecord as { user: { publicKey: string } }).user.publicKey
  };
};

/**
 * Generate TURN credentials for WebRTC
 */
export const generateTURNCredentials = async () => {
  if (!env.cfAccountId || !env.cfTurnKeyId || !env.cfTurnApiToken) {
    return { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }; // Fallback
  }

  const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${env.cfTurnKeyId}/credentials/generate-ice-servers`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.cfTurnApiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttl: 86400 }) // 24 hours validity
  });

  const data: Record<string, unknown> = await response.json();

  if (data.iceServers) {
    return { iceServers: data.iceServers };
  }

  return { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
};
