import { prisma } from '../lib/prisma.js';
import { getSodium } from '../lib/sodium.js';

const B64_VARIANT = 'URLSAFE_NO_PADDING';

/**
 * Creates a new session key from scratch on the server and encrypts it for all participants.
 * This is used for ratcheting sessions or as a fallback.
 */
export async function rotateAndDistributeSessionKeys(conversationId: string, initiatorId: string) {
  const sodium = await getSodium();
  const sessionKey = sodium.crypto_secretbox_keygen();
  const sessionId = `session_${sodium.to_hex(sodium.randombytes_buf(16))}`;

  const participants = await prisma.participant.findMany({
    where: { conversationId },
    include: { user: { select: { id: true, publicKey: true } } },
  });

  if (participants.length === 0) {
    throw new Error(`No participants found for conversation ${conversationId}`);
  }

  const keyRecords = participants.map(p => {
    if (!p.user.publicKey) {
      console.warn(`User ${p.user.id} in conversation ${conversationId} has no public key.`);
      return null;
    }
    
    try {
      const recipientPublicKey = sodium.from_base64(p.user.publicKey, sodium.base64_variants[B64_VARIANT]);
      const encryptedKey = sodium.crypto_box_seal(sessionKey, recipientPublicKey);
      
      return {
        sessionId,
        encryptedKey: sodium.to_base64(encryptedKey, sodium.base64_variants[B64_VARIANT]),
        userId: p.user.id,
        conversationId,
      };
    } catch (e: any) {
      console.error(`Failed to process public key for user ${p.user.id}. Key: "${p.user.publicKey}". Error: ${e.message}`);
      throw new Error(`Corrupted public key found for user ${p.user.id}. Cannot establish secure session.`);
    }
  }).filter(Boolean) as { sessionId: string; encryptedKey: string; userId: string; conversationId: string }[];

  if (keyRecords.length !== participants.length) {
    const participantsWithKeys = new Set(keyRecords.map(r => r.userId));
    const missingUserIds = participants.filter(p => !participantsWithKeys.has(p.user.id)).map(p => p.user.id);
    throw new Error(`Failed to create session keys for all participants in conversation ${conversationId}. Missing keys for users: ${missingUserIds.join(', ')}`);
  }

  // Find the initiator's key record BEFORE saving to the database
  const initiatorKeyRecord = keyRecords.find(k => k.userId === initiatorId);
  if (!initiatorKeyRecord) {
    // This will now fail early if the initiator has no public key
    throw new Error('Could not find the session key for the initiator.');
  }

  // Only create keys if the initiator's key was successfully generated
  await prisma.sessionKey.createMany({
    data: keyRecords,
  });

  return { sessionId, encryptedKey: initiatorKeyRecord.encryptedKey };
}