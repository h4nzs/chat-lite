import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getIo } from "../socket.js";

const router = Router();
router.use(requireAuth);

// GET all conversations for the current user
router.get("/", async (req: any, res, next) => {
  try {
    const conversationsData = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: req.user.id,
          },
        },
        // Exclude conversations hidden by the user
        hiddenBy: {
          none: {
            userId: req.user.id,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, name: true, avatarUrl: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: true },
        },
        creator: {
          select: { id: true, username: true },
        },
      },
      orderBy: {
        lastMessageAt: "desc",
      },
    });

    // Manually fetch unread counts
    const conversations = await Promise.all(
      conversationsData.map(async (convo) => {
        const participant = convo.participants.find(p => p.userId === req.user.id);
        let unreadCount = 0;

        if (participant) {
          let lastReadTimestamp: Date | null = null;

          if (participant.lastReadMsgId) {
            const lastReadMessage = await prisma.message.findUnique({
              where: { id: participant.lastReadMsgId },
              select: { createdAt: true },
            });
            lastReadTimestamp = lastReadMessage?.createdAt ?? null;
          }

          // If there's no last read message, all messages since the user joined are unread
          const sinceDate = lastReadTimestamp || participant.joinedAt;

          unreadCount = await prisma.message.count({
            where: {
              conversationId: convo.id,
              createdAt: {
                gt: sinceDate,
              },
              senderId: {
                not: req.user.id,
              },
            },
          });
        }

        return {
          ...convo,
          unreadCount,
        };
      })
    );

    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

// GET a single conversation by ID
router.get("/:id", async (req: any, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        participants: {
          some: {
            userId: req.user.id,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true },
            },
          },
        },
        creator: {
          select: { id: true, username: true },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

// CREATE a new conversation (private or group)
router.post("/", async (req: any, res, next) => {
  try {
    const { title, userIds, isGroup } = req.body;
    const creatorId = req.user.id;

    if (!isGroup) {
      // Handle private conversation
      const otherUserId = userIds.find((id: string) => id !== creatorId);
      if (!otherUserId) {
        return res.status(400).json({ error: "Another user ID is required for a private chat." });
      }

      // Check if a private conversation already exists
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { participants: { some: { userId: creatorId } } },
            { participants: { some: { userId: otherUserId } } },
          ],
        },
      });

      if (existingConversation) {
        return res.status(200).json(existingConversation);
      }
    }

    const allUserIds = Array.from(new Set([...userIds, creatorId]));

    const newConversation = await prisma.conversation.create({
      data: {
        title: isGroup ? title : null,
        isGroup,
        creatorId: isGroup ? creatorId : null,
        participants: {
          create: allUserIds.map((userId: string) => ({
            user: { connect: { id: userId } },
          })),
        },
      },
      include: {
        participants: { include: { user: { select: { id: true, username: true, avatarUrl: true, name: true } } } },
        creator: true,
      },
    });

    // Broadcast the new conversation to all participants
    if (isGroup) {
      const io = getIo();
      allUserIds.forEach(userId => {
        // Exclude the creator from the real-time event to avoid duplicates on their end
        if (userId !== creatorId) {
          io.to(userId).emit("conversation:new", newConversation);
        }
      });
    }

    res.status(201).json(newConversation);
  } catch (error) {
    next(error);
  }
});


// DELETE a conversation (group or 1-on-1)
router.delete("/:id", async (req: any, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { participants: { select: { userId: true } } },
    });

    if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
      return res.status(404).json({ error: "Conversation not found or you are not a participant." });
    }

    const io = getIo(); // Get the io instance safely

    if (conversation.isGroup) {
      // Group chat: Use deleteMany for an atomic check and delete
      const deleteResult = await prisma.conversation.deleteMany({
        where: {
          id: id,
          creatorId: userId, // The check is now in the query itself
        },
      });

      if (deleteResult.count === 0) {
        return res.status(403).json({ error: "You are not the creator of this group." });
      }
      
      // Notify all participants that the group was deleted
      conversation.participants.forEach(p => {
        io.to(p.userId).emit("conversation:deleted", { id });
      });

    } else {
      // 1-on-1 chat: soft delete (hide for the current user)
      await prisma.userHiddenConversation.create({
        data: {
          userId,
          conversationId: id,
        },
      });
      // Notify only the user who deleted it
      io.to(userId).emit("conversation:deleted", { id });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;