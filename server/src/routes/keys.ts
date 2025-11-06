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
      const providedPhraseHash = sodium.crypto_generichash(64, recoveryPhrase);
      const serverHash = sodium.from_base64(user.recoveryPhraseHash, sodium.base64_variants.ORIGINAL);

      // Constant-time comparison to prevent timing attacks
      if (serverHash.length !== providedPhraseHash.length || !sodium.compare(serverHash, providedPhraseHash)) {
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


export default router;
