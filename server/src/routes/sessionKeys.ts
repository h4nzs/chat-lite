
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import sodium from "libsodium-wrappers";

const router = Router();
router.use(requireAuth);

// Helper function to create and distribute session keys for a conversation
async function createAndDistributeSessionKeys(conversationId: string, participantUserIds: string[]) {
  await sodium.ready;

  const sessionKey = sodium.crypto_secretbox_keygen();
  const sessionId = sodium.to_hex(sodium.randombytes_buf(16)); // Generate a random session ID

  const participants = await prisma.user.findMany({
    where: {
      id: { in: participantUserIds },
      publicKey: { not: null },
    },
    select: { id: true, publicKey: true },
  });

  if (participants.length === 0) return;

  const sessionKeyData = participants.map(p => {
    if (!p.publicKey) return null;
    const encryptedKey = sodium.crypto_box_seal(sessionKey, sodium.from_base64(p.publicKey, sodium.base64_variants.ORIGINAL));
    return {
      conversationId,
      sessionId, // Include the generated session ID
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
}

// GET the encrypted session key for a conversation
router.get("/:conversationId", async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    let sessionKey = await prisma.sessionKey.findFirst({
      where: { conversationId, userId },
    });

    // If key doesn't exist (e.g., for a legacy conversation), create it on-the-fly
    if (!sessionKey) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          participants: { some: { userId } },
        },
        include: {
          participants: { select: { userId: true } },
        },
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found or you are not a participant." });
      }

      const participantIds = conversation.participants.map(p => p.userId);
      await createAndDistributeSessionKeys(conversationId, participantIds);

      // Retry fetching the key
      sessionKey = await prisma.sessionKey.findFirst({
        where: { conversationId, userId },
      });

      if (!sessionKey) {
        return res.status(500).json({ error: "Failed to create and retrieve session key." });
      }
    }

    res.json({ encryptedKey: sessionKey.encryptedKey });
  } catch (error) {
    next(error);
  }
});

export default router;
