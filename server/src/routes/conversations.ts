import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// === GET: Semua conversation user ===
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    console.log(`[Conversations Controller] Mencoba mengambil daftar percakapan untuk userId: ${userId}`);

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // hanya ambil pesan terakhir
        },
      },
    });

    // Transform data agar sesuai frontend
    const transformed = conversations.map((conv) => {
      // Ambil pesan terakhir
      const lastMsg = conv.messages[0] || null;
      let preview: string | undefined = undefined;
      if (lastMsg?.imageUrl) preview = "📷 Photo";
      else if (lastMsg?.fileUrl) preview = `📎 ${lastMsg.fileName || "File"}`;

      return {
        id: conv.id,
        isGroup: conv.isGroup,
        title: conv.title,
        updatedAt: conv.updatedAt,
        participants: conv.participants.map((p) => ({
          id: p.user.id,
          username: p.user.username,
          name: p.user.name,
          avatarUrl: p.user.avatarUrl,
        })),
        lastMessage: lastMsg
          ? {
              ...lastMsg,
              preview,
            }
          : null,
      };
    });

    console.log(`[Conversations Controller] Menemukan ${transformed.length} percakapan`);
    res.json(transformed);
  } catch (e) {
    console.error("[Conversations Controller] Error:", e);
    next(e);
  }
});

export default router;
