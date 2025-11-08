
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getIo } from "../socket.js";
import { createAndDistributeSessionKeys } from "../utils/sessionKeys.js";

const router = Router();
router.use(requireAuth);

// GET all encrypted session keys for a user across ALL conversations
router.get("/sync", async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Find all conversations the user is a participant in
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId } },
      },
      select: { id: true },
    });

    const conversationIds = conversations.map(c => c.id);

    // 2. Fetch all session keys for this user in those conversations
    const allKeys = await prisma.sessionKey.findMany({
      where: {
        userId,
        conversationId: { in: conversationIds },
      },
      select: {
        conversationId: true,
        sessionId: true,
        encryptedKey: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 3. Group keys by conversationId
    const groupedKeys = allKeys.reduce((acc, key) => {
      if (!acc[key.conversationId]) {
        acc[key.conversationId] = [];
      }
      acc[key.conversationId].push({
        sessionId: key.sessionId,
        encryptedKey: key.encryptedKey,
      });
      return acc;
    }, {} as Record<string, { sessionId: string; encryptedKey: string }[]>);

    res.json(groupedKeys);

  } catch (error) {
    next(error);
  }
});

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
