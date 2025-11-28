import { PrismaClient } from '@prisma/client';
import { getSodium } from '../lib/sodium.js';

const prisma = new PrismaClient();
const B64_VARIANT = 'URLSAFE_NO_PADDING';

/**
 * Stores the initial session key that was already computed by the client via a pre-key handshake.
 */
export async function createAndDistributeInitialSessionKey(
  conversationId: string,
  initialSessionData: {
    sessionId: string;
    initialKeys: { userId: string; key: string }[];
  }
) {
  const { sessionId, initialKeys } = initialSessionData;

  const keyRecords = initialKeys.map(ik => ({
    sessionId,
    encryptedKey: ik.key,
    userId: ik.userId,
    conversationId,
  }));

  await prisma.sessionKey.createMany({
    data: keyRecords,
  });

  return { sessionId };
}


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
    console.error(`CRITICAL: Conversation ${conversationId} was created with missing session keys for some users.`);
  }

  await prisma.sessionKey.createMany({
    data: keyRecords,
  });

  const initiatorKeyRecord = keyRecords.find(k => k.userId === initiatorId);
  if (!initiatorKeyRecord) {
    throw new Error('Could not find the session key for the initiator.');
  }

  return { sessionId, encryptedKey: initiatorKeyRecord.encryptedKey };
}
