import { Router, Request } from "express";
import multer from 'multer';
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../utils/upload.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/errors.js";
import path from 'path';

const router = Router();

// Endpoint generik untuk upload file
router.post("/:conversationId/upload", requireAuth, (req: Request, res, next) => {
  const uploader = upload.single("file");

  uploader(req, res, async (err) => {
    if (err) {
      // Tangani error dari multer (misal: file terlalu besar, tipe salah)
      if (err instanceof multer.MulterError) {
        return next(new ApiError(400, err.message));
      }
      // Tangani error dari fileFilter kustom kita
      return next(err);
    }

    try {
      const { conversationId } = req.params;
      const userId = (req as any).user.id;
      const file = req.file;

      if (!file) {
        throw new ApiError(400, "No file uploaded or file type is not allowed.");
      }

      // Verifikasi bahwa user adalah partisipan percakapan
      const isParticipant = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          participants: { some: { userId } },
        },
      });

      if (!isParticipant) {
        throw new ApiError(403, "Forbidden: You are not a participant of this conversation");
      }

      // Buat URL yang bisa diakses client
      const relativePath = path.relative(path.resolve(process.cwd(), 'uploads'), file.path);
      const fileUrl = `/uploads/${relativePath.replace(/\\/g, '/')}`;

      // Kirim response sukses dengan metadata file
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
});

export default router;