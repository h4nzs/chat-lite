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

// === POST: Create new group conversation ===
router.post("/group", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { title, participantIds } = req.body;

    // Validate input
    if (!title || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: "Title and participant IDs are required" });
    }

    // Verify all participants exist and are different from the creator
    const participants = await prisma.user.findMany({
      where: {
        id: { in: participantIds },
      },
      select: { id: true },
    });

    // Check if all requested participants exist
    const foundIds = participants.map(p => p.id);
    const missingIds = participantIds.filter((id: string) => !foundIds.includes(id));
    
    if (missingIds.length > 0) {
      return res.status(400).json({ error: `Users not found: ${missingIds.join(', ')}` });
    }

    // Create the group conversation
    const conversation = await prisma.conversation.create({
      data: {
        isGroup: true,
        title: title.trim(),
        participants: {
          create: [
            { userId }, // Add the creator
            ...participantIds.map((id: string) => ({ userId: id })) // Add other participants
          ]
        }
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
      },
    });

    // Transform response to match frontend expectations
    const transformed = {
      id: conversation.id,
      isGroup: conversation.isGroup,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      participants: conversation.participants.map((p) => ({
        id: p.user.id,
        username: p.user.username,
        name: p.user.name,
        avatarUrl: p.user.avatarUrl,
      })),
      lastMessage: null,
    };

    res.status(201).json(transformed);
  } catch (e) {
    console.error("[Conversations Controller - Group Creation] Error:", e);
    next(e);
  }
});

export default router;
