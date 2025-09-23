import { Router, Request } from "express";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../utils/upload.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/errors.js";

const router = Router();

// === POST: Upload image for a conversation ===
router.post("/:conversationId/upload-image", requireAuth, upload.single("image"), async (req: Request, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = (req as any).user.id;
    const file = req.file;

    if (!file) {
      throw new ApiError(400, "No file uploaded");
    }

    // Verify user is a participant of the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    const isParticipant = conversation.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new ApiError(403, "Forbidden: You are not a participant of this conversation");
    }

    // Save the uploaded file info and return the URL
    const result = await saveUpload(file);
    
    res.json({ imageUrl: result.url });
  } catch (e) {
    next(e);
  }
});

// === POST: Upload file for a conversation ===
router.post("/:conversationId/upload", requireAuth, upload.single("file"), async (req: Request, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = (req as any).user.id;
    const file = req.file;

    if (!file) {
      throw new ApiError(400, "No file uploaded");
    }

    // Verify user is a participant of the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    const isParticipant = conversation.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new ApiError(403, "Forbidden: You are not a participant of this conversation");
    }

    // Save the uploaded file info and return the URL and filename
    const result = await saveUpload(file);
    
    res.json({ 
      fileUrl: result.url,
      fileName: file.originalname
    });
  } catch (e) {
    next(e);
  }
});

// Helper function to save upload info (currently just returns the URL)
async function saveUpload(file: Express.Multer.File) {
  return { url: `/uploads/${file.filename}` };
}

export default router;