import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";
import { zodValidate } from "../utils/validate.js";

const router = Router();

// === POST: Upload/update a user's pre-key bundle ===
router.post(
  "/prekey-bundle",
  requireAuth,
  zodValidate({
    body: z.object({
      identityKey: z.string(),
      signedPreKey: z.object({
        key: z.string(),
        signature: z.string(),
      }),
    }),
  }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { identityKey, signedPreKey } = req.body;

      await prisma.preKeyBundle.upsert({
        where: { userId },
        update: {
          identityKey,
          key: signedPreKey.key,
          signature: signedPreKey.signature,
        },
        create: {
          userId,
          identityKey,
          key: signedPreKey.key,
          signature: signedPreKey.signature,
        },
      });

      res.status(201).json({ message: "Pre-key bundle updated successfully." });
    } catch (e) {
      next(e);
    }
  }
);

// === GET: Get a pre-key bundle for another user ===
router.get(
  "/prekey-bundle/:userId",
  requireAuth,
  zodValidate({ params: z.object({ userId: z.string().cuid() }) }),
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      const userWithBundle = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          signingKey: true, // Needed by the recipient to verify the signature
          preKeyBundle: true,
        },
      });

      if (!userWithBundle?.preKeyBundle || !userWithBundle.signingKey) {
        throw new Error("User does not have a valid pre-key bundle available.");
      }
      
      const { preKeyBundle, signingKey } = userWithBundle;

      // Assemble the response bundle
      const responseBundle = {
        identityKey: preKeyBundle.identityKey,
        signedPreKey: {
          key: preKeyBundle.key,
          signature: preKeyBundle.signature,
        },
        signingKey: signingKey, // Include the public signing key for verification
      };

      res.json(responseBundle);
    } catch (e: any) {
      if (e.message.includes("pre-key bundle")) {
        return res.status(404).json({ error: e.message });
      }
      next(e);
    }
  }
);

export default router;