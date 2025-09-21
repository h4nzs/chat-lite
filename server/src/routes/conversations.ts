import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// === GET: Semua conversation user ===
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { cursor } = req.query as { cursor?: string };
    console.log(`[Conversations Controller] Mencoba mengambil daftar percakapan untuk userId: ${userId}`, cursor ? `with cursor: ${cursor}` : '');

    // Parse cursor if provided
    const cursorDate = cursor ? new Date(cursor) : undefined;

    const whereClause = {
      participants: {
        some: { userId },
      },
      ...(cursorDate && {
        updatedAt: {
          lt: cursorDate,
        },
      }),
    };

    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      orderBy: {
        updatedAt: "desc",
      },
      take: 20, // Pagination limit
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

    // Transform agar sesuai dengan frontend
    const transformedConversations = conversations.map(conv => {
      const lastMessage = conv.messages.length > 0 ? conv.messages[0] : null;
      return {
        id: conv.id, // pastikan ada id
        isGroup: conv.isGroup,
        title: conv.title,
        updatedAt: conv.updatedAt,
        lastMessage,
        participants: conv.participants.map(p => ({
          id: p.user.id,
          username: p.user.username,
          name: p.user.name,
          avatarUrl: p.user.avatarUrl,
        })),
      };
    });

    console.log(`[Conversations Controller] Menemukan ${transformedConversations.length} percakapan untuk pengguna ${userId}`);
    
    // Return in the format expected by frontend: { items, nextCursor }
    const nextCursor = transformedConversations.length === 20 
      ? transformedConversations[transformedConversations.length - 1].updatedAt
      : null;
      
    res.json({
      items: transformedConversations,
      nextCursor
    });
  } catch (e) {
    console.error("[Conversations Controller] Error:", e);
    next(e);
  }
});

export default router;
