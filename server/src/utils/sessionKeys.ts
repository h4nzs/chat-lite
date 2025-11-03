
import { prisma } from "../lib/prisma.js";
import sodium from "libsodium-wrappers";
import { getIo } from "../socket.js";

/**
 * Creates a new session key for a conversation, encrypts it for each participant,
 * stores it in the database, and returns the new session details.
 * @param conversationId The ID of the conversation.
 * @param participantUserIds An array of user IDs for all current participants.
 * @returns An object containing the new sessionId and the array of encrypted session key data.
 */
export async function createAndDistributeSessionKeys(conversationId: string, participantUserIds: string[]) {
  await sodium.ready;

  const sessionKey = sodium.crypto_secretbox_keygen();
  const sessionId = sodium.to_hex(sodium.randombytes_buf(16));

  const participants = await prisma.user.findMany({
    where: {
      id: { in: participantUserIds },
      publicKey: { not: null },
    },
    select: { id: true, publicKey: true },
  });

  if (participants.length === 0) return null;

  const sessionKeyData = participants.map(p => {
    if (!p.publicKey) return null;
    const encryptedKey = sodium.crypto_box_seal(sessionKey, sodium.from_base64(p.publicKey, sodium.base64_variants.ORIGINAL));
    return {
      conversationId,
      sessionId,
      userId: p.id,
      encryptedKey: sodium.to_base64(encryptedKey, sodium.base64_variants.ORIGINAL),
    };
  }).filter(Boolean) as any[];

  if (sessionKeyData.length > 0) {
    await prisma.sessionKey.createMany({
      data: sessionKeyData,
      skipDuplicates: true,
    });
  }

  return { sessionId, sessionKeyData };
}

/**
 * Rotates the session key for a conversation and distributes the new key to all participants.
 * This is the core function for ensuring forward and backward secrecy in groups.
 * @param conversationId The ID of the conversation to rotate keys for.
 * @param initiatorId The ID of the user initiating the rotation (to exclude from socket broadcast).
 */
export async function rotateAndDistributeSessionKeys(conversationId: string, initiatorId: string) {
  const currentParticipants = await prisma.participant.findMany({
    where: { conversationId },
    select: { userId: true },
  });

  const participantIds = currentParticipants.map(p => p.userId);
  if (participantIds.length === 0) return;

  const newSessionInfo = await createAndDistributeSessionKeys(conversationId, participantIds);

  if (newSessionInfo) {
    const io = getIo();
    newSessionInfo.sessionKeyData.forEach(keyData => {
      // Broadcast the new key to all participants, including the initiator this time
      io.to(keyData.userId).emit('session:new_key', {
        conversationId: keyData.conversationId,
        sessionId: newSessionInfo.sessionId,
        encryptedKey: keyData.encryptedKey,
      });
    });
  }
}
