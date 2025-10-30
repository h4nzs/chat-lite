import { Router, Request } from "express";
import multer from 'multer';
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../utils/upload.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/errors.js";
import path from 'path';
import { z } from "zod";
import { zodValidate } from "../utils/validate.js";

const router = Router();

// Endpoint generik untuk upload file
router.post("/:conversationId/upload", 
  requireAuth, 
  zodValidate({ params: z.object({ conversationId: z.string().cuid() }) }),
  (req: Request, res, next) => {
    const uploader = upload.single("file");

    uploader(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          return next(new ApiError(400, err.message));
        }
        return next(err);
      }

      try {
        const { conversationId } = req.params;
        const userId = (req as any).user.id;
        const file = req.file;

        if (!file) {
          throw new ApiError(400, "No file uploaded or file type is not allowed.");
        }

        const isParticipant = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            participants: { some: { userId } },
          },
        });

        if (!isParticipant) {
          throw new ApiError(403, "Forbidden: You are not a participant of this conversation");
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const relativePath = path.relative(path.resolve(process.cwd(), 'uploads'), file.path);
        const fileUrl = `${baseUrl}/uploads/${relativePath.replace(/\\/g, '/')}`;

        res.status(201).json({
          message: "File uploaded successfully",
          file: {
            url: fileUrl,
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          },
        });

      } catch (e) {
        next(e);
      }
    });
  }
);

export default router;
