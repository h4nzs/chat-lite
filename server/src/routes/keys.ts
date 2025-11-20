import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";
import { zodValidate } from "../utils/validate.js";
import sodium from "libsodium-wrappers";
import bcrypt from "bcrypt";
import { getIo } from "../socket.js"; // Import getIo

const router = Router();

// === POST: Upload user's public key ===
router.post("/public", 
  requireAuth, 
  zodValidate({ body: z.object({ publicKey: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { publicKey } = req.body;

      await prisma.user.update({
        where: { id: userId },
        data: { publicKey },
      });

      // --- BEGIN: Notify contacts about the key change ---
      const io = getIo();

      // 1. Find all conversations the user is in
      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            some: {
              userId: userId,
            },
          },
        },
        include: {
          participants: {
            select: {
              userId: true,
            },
          },
        },
      });

      // 2. Collect all unique participant IDs, excluding the user themselves
      const contactIds = new Set<string>();
      conversations.forEach(convo => {
        convo.participants.forEach(p => {
          if (p.userId !== userId) {
            contactIds.add(p.userId);
          }
        });
      });

      // 3. Broadcast the identity change event to each contact
      const payload = { userId: userId, name: req.user.name || req.user.username };
      contactIds.forEach(contactId => {
        io.to(contactId).emit("user:identity_changed", payload);
      });
      // --- END: Notify contacts ---

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
        recoveryPhrase: z.string().min(1),
        newPassword: z.string().min(8, "Password must be at least 8 characters long"),
      });
      const { username, recoveryPhrase, newPassword } = schema.parse(req.body);

      const user = await prisma.user.findFirst({
        where: { username: { equals: username, mode: 'insensitive' } },
      });

      if (!user || !user.recoveryPhraseHash) {
        return res.status(404).json({ error: "User not found or no recovery method on record." });
      }

      // Hash the provided phrase on the server
      await sodium.ready;
      const normalizedPhrase = recoveryPhrase.trim().split(/\s+/).join(' ');
      const providedPhraseHash = sodium.crypto_generichash(64, normalizedPhrase);
      const generatedHashB64 = sodium.to_base64(providedPhraseHash, sodium.base64_variants.ORIGINAL);

      // Workaround: Compare base64 strings directly since sodium.compare is failing unexpectedly
      if (user.recoveryPhraseHash !== generatedHashB64) {
        return res.status(403).json({ error: "Invalid recovery phrase for this user." });
      }

      // If phrase is verified, update the user's password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: { 
          passwordHash: hashedPassword,
        },
      });

      res.json({ ok: true, message: "Recovery phrase verified and password updated successfully." });
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

// === NEW: Endpoint to upload pre-keys ===
router.post("/prekeys",
  requireAuth,
  zodValidate({
    body: z.object({
      signedPreKey: z.object({
        key: z.string(),
        signature: z.string(),
      }),
      oneTimePreKeys: z.array(z.object({
        key: z.string(),
      })),
    }),
  }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { signedPreKey, oneTimePreKeys } = req.body;

      // Use a transaction to ensure all keys are updated atomically
      await prisma.$transaction([
        // Delete old keys
        prisma.signedPreKey.deleteMany({ where: { userId } }),
        prisma.oneTimePreKey.deleteMany({ where: { userId } }),
        // Create new signed pre-key
        prisma.signedPreKey.create({
          data: {
            userId,
            key: signedPreKey.key,
            signature: signedPreKey.signature,
          },
        }),
        // Create new one-time pre-keys
        prisma.oneTimePreKey.createMany({
          data: oneTimePreKeys.map(k => ({
            userId,
            key: k.key,
          })),
        }),
      ]);

      res.json({ ok: true, message: "Pre-keys uploaded successfully." });
    } catch (e) {
      next(e);
    }
  }
);

// === NEW: Endpoint to get a pre-key bundle for a user ===
router.get("/prekey-bundle/:userId",
  requireAuth,
  zodValidate({ params: z.object({ userId: z.string().cuid() }) }),
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      // Use a transaction to fetch and then delete the one-time key
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          include: { // Use 'include' instead of 'select' to fetch the relation
            signedPreKey: true,
          },
        });

        if (!user || !user.publicKey || user.publicKey.length === 0 || !user.signedPreKey || user.signedPreKey.key.length === 0) {
          throw new Error("User does not have a valid pre-key bundle.");
        }

        // Get one available one-time pre-key
        const oneTimeKey = await tx.oneTimePreKey.findFirst({
          where: { userId },
        });

        if (oneTimeKey) {
          // IMPORTANT: Delete the key after fetching it to ensure it's only used once
          await tx.oneTimePreKey.delete({
            where: { id: oneTimeKey.id, userId: userId }, // More specific where clause
          });
        }

        return {
          identityKey: user.publicKey,
          signedPreKey: {
            id: user.signedPreKey.id,
            key: user.signedPreKey.key,
            signature: user.signedPreKey.signature,
          },
          oneTimeKey: oneTimeKey ? { id: oneTimeKey.id, key: oneTimeKey.key } : null,
        };
      });

      res.json(result);
    } catch (e) {
      // Custom error handling for this specific case
      if (e instanceof Error && e.message.includes("pre-key bundle")) {
        return res.status(404).json({ error: e.message });
      }
      next(e);
    }
  }
);

export default router;
