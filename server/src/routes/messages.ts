import { Router, Request } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../utils/errors.js";

const router = Router();

// === GET: semua pesan dalam conversation (user harus anggota) ===
router.get("/:conversationId", requireAuth, async (req: Request, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = (req as any).user.id;
    const { cursor } = req.query;

    // console.log(`[Messages Controller] Mencoba mengambil pesan untuk conversationId: ${conversationId}`);
    // console.log(`[Messages Controller] ID pengguna yang meminta: ${userId}`);
    if (cursor) {
      // console.log(`[Messages Controller] Cursor: ${cursor}`);
    }

    // cek user anggota
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (!conversation) {
      console.error(`[Messages Controller] Percakapan dengan ID ${conversationId} tidak ditemukan.`);
      throw new ApiError(404, "Conversation not found");
    }

    const isParticipant = conversation.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      console.error(`[Messages Controller] Otorisasi GAGAL. Pengguna ${userId} bukan partisipan di percakapan ${conversationId}.`);
      throw new ApiError(403, "Forbidden: You are not a participant of this conversation.");
    }

    console.log(`[Messages Controller] Otorisasi BERHASIL.`);

    // Query dengan pagination
    const whereClause = {
      conversationId,
      ...(cursor ? { createdAt: { lt: new Date(cursor as string) } } : {}),
    };

    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // --- 🔑 Tambahkan preview berdasarkan fileUrl / imageUrl ---
    const items = messages
      .map((m) => {
        let preview: string | undefined = undefined;
        if (m.imageUrl) preview = "📷 Photo";
        else if (m.fileUrl) preview = `📎 ${m.fileName || "File"}`;

        return { ...m, preview };
      })
      .reverse(); // urutkan dari lama ke baru

    const nextCursor = items.length > 0 ? items[0]?.createdAt : null;

    res.json({
      items,
      nextCursor,
    });
  } catch (e) {
    console.error("[Messages Controller] Error:", e);
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
