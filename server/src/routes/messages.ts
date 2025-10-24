import { Router, Request } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../utils/errors.js";
import { io } from "../socket.js";
import fs from "fs/promises";
import path from "path";

const router = Router();

// ... (GET and DELETE message routes remain the same)

// === GET: semua pesan dalam conversation (user harus anggota) ===
router.get("/:conversationId", requireAuth, async (req: Request, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = (req as any).user.id;
    const { cursor } = req.query;

    const isParticipant = await prisma.conversation.findFirst({
        where: { id: conversationId, participants: { some: { userId } } },
    });

    if (!isParticipant) {
      throw new ApiError(403, "Forbidden: You are not a participant of this conversation.");
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { createdAt: { lt: new Date(cursor as string) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { 
        reactions: { 
          include: { user: { select: { id: true, username: true } } } 
        } 
      },
    });

    const items = messages.map(m => ({ ...m })).reverse();
    const nextCursor = items.length > 0 ? items[0]?.createdAt.toISOString() : null;

    res.json({ items, nextCursor });
  } catch (e) {
    next(e);
  }
});

// === DELETE: hanya sender boleh hapus pesannya ===
router.delete("/:messageId", requireAuth, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = (req as any).user.id;

    const message = await prisma.message.findFirst({
      where: { id: messageId, senderId: userId },
      select: { conversationId: true, fileUrl: true, imageUrl: true },
    });

    if (!message) {
      throw new ApiError(404, "Message not found or you do not have permission to delete it");
    }

    // Hapus file fisik jika ada
    const urlToDelete = message.fileUrl || message.imageUrl;
    if (urlToDelete) {
      try {
        const filePath = path.join(process.cwd(), 'uploads', path.basename(urlToDelete));
        await fs.unlink(filePath);
      } catch (fileError: any) {
        if (fileError.code !== 'ENOENT') {
          console.error(`Failed to delete file: ${urlToDelete}`, fileError);
        }
      }
    }

    await prisma.message.delete({ where: { id: messageId } });

    io.to(message.conversationId).emit("message:deleted", { messageId, conversationId: message.conversationId });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});


// === REACTION ROUTES ===

router.post("/:messageId/reactions", requireAuth, async (req: Request, res, next) => {
  try {
    const { emoji } = req.body;
    const userId = (req as any).user.id;
    const { messageId } = req.params;

    const message = await prisma.message.findUnique({ where: { id: messageId }, select: { conversationId: true } });
    if (!message) throw new ApiError(404, "Message not found");

    const reaction = await prisma.messageReaction.create({
      data: { emoji, messageId, userId },
      include: { user: { select: { id: true, username: true } } },
    });

    io.to(message.conversationId).emit("reaction:new", reaction);
    res.status(201).json(reaction);
  } catch (e) {
    next(e);
  }
});

router.delete("/reactions/:reactionId", requireAuth, async (req: Request, res, next) => {
  try {
    const { reactionId } = req.params;
    const userId = (req as any).user.id;

    const reaction = await prisma.messageReaction.findFirst({
      where: { id: reactionId, userId },
      select: { id: true, message: { select: { conversationId: true, id: true } } },
    });

    if (!reaction) {
      throw new ApiError(404, "Reaction not found or you do not have permission to delete it");
    }

    await prisma.messageReaction.delete({ where: { id: reactionId } });

    io.to(reaction.message.conversationId).emit("reaction:remove", { reactionId, messageId: reaction.message.id });
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default router;