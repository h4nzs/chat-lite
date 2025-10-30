import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";
import { zodValidate } from "../utils/validate.js";

const router = Router();

// === POST: Upload user's public key ===
router.post("/keys/public", 
  requireAuth, 
  zodValidate({ body: z.object({ publicKey: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      await prisma.user.update({
        where: { id: userId },
        data: { publicKey }
      });

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

// === GET: Get user's public key ===
router.get("/keys/public/:userId",
  requireAuth,
  zodValidate({ params: z.object({ userId: z.string().cuid() }) }),
  async (req, res, next) => {
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
  }
);

// === POST: Store encrypted session key ===
router.post("/keys/session",
  requireAuth,
  zodValidate({
    body: z.object({
      conversationId: z.string().cuid(),
      sessionId: z.string().min(1),
      encryptedKey: z.string().min(1),
    })
  }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { conversationId, sessionId, encryptedKey } = req.body;

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
  }
);

// === GET: Get encrypted session keys for a conversation ===
router.get("/keys/session/:conversationId",
  requireAuth,
  zodValidate({ params: z.object({ conversationId: z.string().cuid() }) }),
  async (req, res, next) => {
      try {
        const userId = req.user.id;      const { conversationId } = req.params;

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
  }
);

export default router;
