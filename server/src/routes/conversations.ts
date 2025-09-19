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
          take: 1,
        },
      },
    });
    
    // Transform participants data to match frontend expectations
    const transformedConversations = conversations.map(conv => ({
      ...conv,
      participants: conv.participants.map(p => ({
        id: p.user.id,
        username: p.user.username,
        name: p.user.name,
        avatarUrl: p.user.avatarUrl,
      }))
    }));
    
    console.log(`[Conversations Controller] Menemukan ${conversations.length} percakapan untuk pengguna ${userId}`);
    res.json(transformedConversations);
  } catch (e) {
    console.error("[Conversations Controller] Error:", e);
    next(e);
  }
});

export default router;
