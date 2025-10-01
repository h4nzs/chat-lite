import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// === POST: Upload user's public key ===
router.post("/keys/public", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({ error: "Public key is required" });
    }

    // Update user's public key
    await prisma.user.update({
      where: { id: userId },
      data: { publicKey }
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// === GET: Get user's public key ===
router.get("/keys/public/:userId", requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { publicKey: true }
    });

    if (!user || !user.publicKey) {
      return res.status(404).json({ error: "User or public key not found" });
    }

    res.json({ publicKey: user.publicKey });
  } catch (e) {
    next(e);
  }
});

// === POST: Store encrypted session key ===
router.post("/keys/session", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { conversationId, sessionId, encryptedKey } = req.body;

    if (!conversationId || !sessionId || !encryptedKey) {
      return res.status(400).json({ error: "conversationId, sessionId, and encryptedKey are required" });
    }

    // Store the encrypted session key
    const sessionKey = await prisma.sessionKey.create({
      data: {
        conversationId,
        sessionId,
        userId,
        encryptedKey
      }
    });

    res.json({ ok: true, id: sessionKey.id });
  } catch (e) {
    next(e);
  }
});

// === GET: Get encrypted session keys for a conversation ===
router.get("/keys/session/:conversationId", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { conversationId } = req.params;

    // Verify user is a participant of the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true }
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const isParticipant = conversation.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      return res.status(403).json({ error: "You are not a participant of this conversation" });
    }

    // Get all encrypted session keys for this conversation
    const sessionKeys = await prisma.sessionKey.findMany({
      where: {
        conversationId,
        userId
      },
      select: {
        sessionId: true,
        encryptedKey: true,
        createdAt: true
      }
    });

    res.json({ sessionKeys });
  } catch (e) {
    next(e);
  }
});

export default router;