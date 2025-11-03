
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getIo } from "../socket.js";
import { createAndDistributeSessionKeys } from "../utils/sessionKeys.js";

const router = Router();
router.use(requireAuth);

// GET all encrypted session keys for a user in a conversation
router.get("/:conversationId", async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const sessionKeys = await prisma.sessionKey.findMany({
      where: { conversationId, userId },
      select: { sessionId: true, encryptedKey: true },
      orderBy: { createdAt: 'asc' },
    });

    // This endpoint is now primarily for fetching historical keys.
    // If no keys exist, it's not necessarily an error, the client can ratchet a new one.
    res.json({ keys: sessionKeys });

  } catch (error) {
    next(error);
  }
});

// POST: Force create a new session key for a conversation (ratcheting)
router.post("/:conversationId/ratchet", async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

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
    const newSessionInfo = await createAndDistributeSessionKeys(conversationId, participantIds);

    if (!newSessionInfo) {
      return res.status(500).json({ error: "Failed to create new session key." });
    }

    // Find the specific encrypted key for the requesting user
    const userEncryptedKey = newSessionInfo.sessionKeyData.find(d => d.userId === userId);

    // Proactively send the new encrypted session key to all other participants
    const io = getIo();
    newSessionInfo.sessionKeyData.forEach(keyData => {
      if (keyData.userId !== userId) { // Don't send to the user who initiated the ratchet
        io.to(keyData.userId).emit('session:new_key', {
          conversationId: keyData.conversationId,
          sessionId: newSessionInfo.sessionId,
          encryptedKey: keyData.encryptedKey,
        });
      }
    });

    res.status(201).json({
      sessionId: newSessionInfo.sessionId,
      encryptedKey: userEncryptedKey?.encryptedKey,
    });

  } catch (error) {
    next(error);
  }
});

export default router;
