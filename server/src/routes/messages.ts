import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../utils/errors.js";

const router = Router();

// === GET: semua pesan dalam conversation (user harus anggota) ===
router.get("/:conversationId", requireAuth, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = (req as any).user.id;

    // cek user anggota
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (!conversation) throw new ApiError(404, "Conversation not found");
    if (!conversation.participants.some((p) => p.id === userId)) {
      throw new ApiError(403, "Forbidden");
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    res.json(messages);
  } catch (e) {
    next(e);
  }
});

// === DELETE: hanya sender boleh hapus pesannya ===
router.delete("/:conversationId/messages/:messageId", requireAuth, async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    const userId = (req as any).user.id;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new ApiError(404, "Message not found");
    if (message.conversationId !== conversationId) {
      throw new ApiError(400, "Message not in conversation");
    }
    if (message.senderId !== userId) {
      throw new ApiError(403, "Cannot delete other user's message");
    }

    await prisma.message.delete({ where: { id: messageId } });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
