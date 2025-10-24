import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { io } from "../socket.js";
import { ApiError } from "../utils/errors.js";
import fs from "fs/promises";
import path from "path"; // Impor path // Impor ApiError

const router = Router();

// === GET: Semua conversation user ===
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    // console.log(`[Conversations Controller] Mencoba mengambil daftar percakapan untuk userId: ${userId}`);

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
        NOT: {
          hiddenBy: {
            some: { userId },
          },
        },
      },
      select: {
        id: true,
        isGroup: true,
        title: true,
        creatorId: true,
        updatedAt: true,
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
        creatorId: conv.creatorId, // FIX: Tambahkan creatorId
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

    // console.log(`[Conversations Controller] Menemukan ${transformed.length} percakapan`);
    res.json(transformed);
  } catch (e) {
    console.error("[Conversations Controller] Error:", e);
    next(e);
  }
});

// === GET: Public keys of participants in a conversation ===
router.get("/:conversationId/participants/keys", requireAuth, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = (req as any).user.id;

    // Verify user is a participant of the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true }
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const isParticipant = conversation.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      return res.status(403).json({ error: "You are not a participant of this conversation" });
    }

    // Get public keys of all participants
    const participantIds = conversation.participants.map(p => p.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: participantIds } },
      select: { id: true, username: true, publicKey: true }
    });

    // Filter out users without public keys
    const participantsWithKeys = users.filter(u => u.publicKey);

    res.json({ participants: participantsWithKeys });
  } catch (e) {
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
        creatorId: userId, // Set creatorId
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

    // Broadcast ke semua anggota grup yang baru dibuat
    const allParticipantIds = [userId, ...participantIds];
      allParticipantIds.forEach(participantId => {
        io.to(participantId).emit("conversation:new", transformed);
      });
    res.status(201).json(transformed);
  } catch (e) {
    console.error("[Conversations Controller - Group Creation] Error:", e);
    next(e);
  }
});

// === POST: Start a new 1-on-1 conversation ===
router.post("/start", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { peerId } = req.body;

    if (!peerId) {
      return res.status(400).json({ error: "Peer ID is required" });
    }

    if (userId === peerId) {
      return res.status(400).json({ error: "Cannot start conversation with yourself" });
    }

    // Check if a conversation already exists between these users
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        participants: {
          every: {
            userId: { in: [userId, peerId] }
          }
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

    if (existingConversation) {
      // Return existing conversation
      const lastMessage = await prisma.message.findFirst({
        where: { conversationId: existingConversation.id },
        orderBy: { createdAt: 'desc' },
      });

      const transformed = {
        id: existingConversation.id,
        isGroup: existingConversation.isGroup,
        title: existingConversation.title,
        updatedAt: existingConversation.updatedAt,
        participants: existingConversation.participants.map((p) => ({
          id: p.user.id,
          username: p.user.username,
          name: p.user.name,
          avatarUrl: p.user.avatarUrl,
        })),
        lastMessage: lastMessage || null,
      };

      return res.json(transformed);
    }

    // Create a new 1-on-1 conversation
    const conversation = await prisma.conversation.create({
      data: {
        isGroup: false, // 1-on-1 conversation
        participants: {
          create: [
            { userId: userId }, // Creator
            { userId: peerId }  // The other participant
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
      console.error("[Conversations Controller - Start 1-on-1] Error:", e);
      next(e);
    }
  });
// Endpoint untuk menghapus grup (Hard Delete)
router.delete("/group/:id", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const conversation = await prisma.conversation.findFirst({
      where: { id, creatorId: userId, isGroup: true },
      include: { participants: true },
    });

    if (!conversation) {
      return next(new ApiError(403, "Group not found or you are not the creator."));
    }

    // Ambil semua pesan untuk menghapus file terkait
    const messagesToDelete = await prisma.message.findMany({
      where: { conversationId: id },
      select: { fileUrl: true, imageUrl: true },
    });

    // Hapus file fisik dari server
    for (const msg of messagesToDelete) {
      const url = msg.fileUrl || msg.imageUrl;
      if (url) {
        try {
          const filePath = path.join(process.cwd(), 'uploads', path.basename(url));
          await fs.unlink(filePath);
        } catch (fileError: any) {
          // Abaikan error jika file tidak ditemukan, tapi log error lainnya
          if (fileError.code !== 'ENOENT') {
            console.error(`Failed to delete file: ${url}`, fileError);
          }
        }
      }
    }

    // Hapus semua relasi dan percakapan
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { conversationId: id } }),
      prisma.participant.deleteMany({ where: { conversationId: id } }),
      prisma.userHiddenConversation.deleteMany({ where: { conversationId: id } }),
      prisma.conversation.delete({ where: { id } }),
    ]);

    // Beri tahu semua anggota bahwa grup telah dihapus
    conversation.participants.forEach(p => {
      io.to(p.userId).emit("conversation:deleted", { id });
    });

    res.status(200).json({ message: "Group deleted successfully." });
  } catch (e) {
    next(e);
  }
});

// Endpoint untuk menyembunyikan percakapan pribadi (Soft Delete)
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    // Pastikan percakapan ada dan user adalah partisipan
    const participant = await prisma.participant.findFirst({
      where: { conversationId: id, userId },
    });

    if (!participant) {
      return next(new ApiError(404, "Conversation not found or you are not a participant."));
    }

    // Tambahkan record untuk menyembunyikan percakapan bagi user ini
    await prisma.userHiddenConversation.upsert({
      where: { userId_conversationId: { userId, conversationId: id } },
      update: {},
      create: { userId, conversationId: id },
    });

    // Beri tahu hanya user yang menghapus untuk menghapus dari UI-nya
    io.to(userId).emit("conversation:deleted", { id });

    res.status(200).json({ message: "Conversation hidden successfully." });
  } catch (e) {
    next(e);
  }
});

export default router;
