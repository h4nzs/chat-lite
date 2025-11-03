import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";
import { zodValidate } from "../utils/validate.js";
import sodium from "libsodium-wrappers";
import bcrypt from "bcrypt";

const router = Router();

// === POST: Upload user's public key ===
router.post("/public", 
  requireAuth, 
  zodValidate({ body: z.object({ publicKey: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { publicKey } = req.body; // Correctly extract publicKey from body

      await prisma.user.update({
        where: { id: userId },
        data: { publicKey }, // Use the extracted variable
      });

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

// === POST: Verify public key for account recovery ===
router.post("/verify",
  async (req, res, next) => {
    try {
      // Manual validation
      const schema = z.object({ 
        username: z.string().min(1), 
        publicKey: z.string().min(1),
        newPassword: z.string().min(6, "Password must be at least 6 characters long"),
      });
      const { username, publicKey, newPassword } = schema.parse(req.body);

      const user = await prisma.user.findFirst({
        where: { username: { equals: username, mode: 'insensitive' } },
      });

      if (!user || !user.publicKey) {
        return res.status(404).json({ error: "User not found or no public key on record." });
      }

      // Constant-time comparison to prevent timing attacks
      const serverKey = Buffer.from(user.publicKey, 'base64');
      const providedKey = Buffer.from(publicKey, 'base64');

      if (serverKey.length !== providedKey.length || !sodium.compare(serverKey, providedKey)) {
        return res.status(403).json({ error: "Invalid recovery phrase for this user." });
      }

      // If key is verified, update the user's password and public key
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: { 
          passwordHash: hashedPassword,
          publicKey: publicKey, // Update the public key as well
        },
      });

      res.json({ ok: true, message: "Public key verified and password updated successfully." });
    } catch (e) {
      next(e);
    }
  }
);

// === GET: Get user's public key ===
router.get("/public/:userId",
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
