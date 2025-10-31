import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getIo } from "../socket.js";
import { upload } from "../utils/upload.js";

const router = Router();
router.use(requireAuth);

// GET all conversations for the current user
router.get("/", async (req, res, next) => {
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

    // Fetch unread counts in a single efficient query
    const unreadCounts: { conversationId: string; unreadCount: number }[] = await prisma.$queryRaw`
      SELECT
        p."conversationId" AS "conversationId",
        COUNT(m.id)::int AS "unreadCount"
      FROM "Participant" p
      LEFT JOIN "Message" last_read_message ON p."lastReadMsgId" = last_read_message.id
      JOIN "Message" m ON m."conversationId" = p."conversationId"
      WHERE
        p."userId" = ${req.user.id}
        AND m."senderId" != ${req.user.id}
        AND m."createdAt" > COALESCE(last_read_message."createdAt", p."joinedAt")
      GROUP BY p."conversationId";
    `;

    const unreadMap = new Map(unreadCounts.map(item => [item.conversationId, item.unreadCount]));

    // Combine conversation data with unread counts
    const conversations = conversationsData.map(convo => ({
      ...convo,
      unreadCount: unreadMap.get(convo.id) || 0,
    }));

    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

// GET a single conversation by ID
router.get("/:id", async (req, res, next) => {
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
              select: { id: true, username: true, name: true, avatarUrl: true },
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

// --- Admin Routes for Group Management ---

// UPDATE group conversation details
router.put("/:id/details", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const userId = req.user.id;

    const participant = await prisma.participant.findFirst({
      where: { conversationId: id, userId: userId },
    });

    if (!participant || participant.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: You are not an admin of this group." });
    }

    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: { title, description },
    });

    const io = getIo();
    io.to(id).emit("conversation:updated", {
      id,
      title: updatedConversation.title,
      description: updatedConversation.description,
    });

    res.json(updatedConversation);
  } catch (error) {
    next(error);
  }
});

// UPLOAD group avatar
router.post("/:id/avatar", upload.single('avatar'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const participant = await prisma.participant.findFirst({
      where: { conversationId: id, userId: userId },
    });

    if (!participant || participant.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: You are not an admin of this group." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No avatar file provided." });
    }

    const avatarUrl = `/uploads/images/${req.file.filename}`;

    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: { avatarUrl },
    });

    const io = getIo();
    io.to(id).emit("conversation:updated", {
      id,
      avatarUrl: updatedConversation.avatarUrl,
    });

    res.json({ avatarUrl: updatedConversation.avatarUrl });
  } catch (error) {
    next(error);
  }
});

// ADD new members to a group
router.post("/:id/participants", async (req, res, next) => {
  try {
    const { id: conversationId } = req.params;
    const { userIds } = req.body;
    const currentUserId = req.user.id;

    const adminParticipant = await prisma.participant.findFirst({
      where: { conversationId, userId: currentUserId },
    });
    if (!adminParticipant || adminParticipant.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: You are not an admin of this group." });
    }

    const newParticipantsData = userIds.map((userId: string) => ({
      conversationId,
      userId,
    }));

    await prisma.participant.createMany({
      data: newParticipantsData,
      skipDuplicates: true,
    });

    const newParticipants = await prisma.participant.findMany({
      where: { conversationId, userId: { in: userIds } },
      include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } },
    });

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { include: { user: true } }, creator: true },
    });

    const io = getIo();
    io.to(conversationId).emit("conversation:participants_added", { conversationId, newParticipants });

    newParticipants.forEach(p => {
      io.to(p.userId).emit("conversation:new", conversation);
    });

    res.status(201).json(newParticipants);
  } catch (error) {
    next(error);
  }
});

// UPDATE a member's role in a group
router.put("/:id/participants/:userId/role", async (req, res, next) => {
  try {
    const { id: conversationId, userId: userToModifyId } = req.params;
    const { role } = req.body;
    const currentUserId = req.user.id;

    if (role !== "ADMIN" && role !== "MEMBER") {
      return res.status(400).json({ error: "Invalid role specified." });
    }

    const adminParticipant = await prisma.participant.findFirst({
      where: { conversationId, userId: currentUserId },
    });
    if (!adminParticipant || adminParticipant.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: You are not an admin of this group." });
    }

    if (currentUserId === userToModifyId) {
      return res.status(400).json({ error: "You cannot change your own role." });
    }

    const updatedParticipant = await prisma.participant.updateMany({
      where: { conversationId, userId: userToModifyId },
      data: { role },
    });

    if (updatedParticipant.count === 0) {
      return res.status(404).json({ error: "Participant not found." });
    }

    const io = getIo();
    io.to(conversationId).emit("conversation:participant_updated", {
      conversationId,
      userId: userToModifyId,
      role,
    });

    res.json({ userId: userToModifyId, role });
  } catch (error) {
    next(error);
  }
});

// REMOVE a member from a group
router.delete("/:id/participants/:userId", async (req, res, next) => {
  try {
    const { id: conversationId, userId: userToRemoveId } = req.params;
    const currentUserId = req.user.id;

    const adminParticipant = await prisma.participant.findFirst({
      where: { conversationId, userId: currentUserId },
    });
    if (!adminParticipant || adminParticipant.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: You are not an admin of this group." });
    }

    if (currentUserId === userToRemoveId) {
      return res.status(400).json({ error: "You cannot remove yourself from the group." });
    }

    const deleteResult = await prisma.participant.deleteMany({
      where: { conversationId, userId: userToRemoveId },
    });

    if (deleteResult.count === 0) {
        return res.status(404).json({ error: "Participant not found in this group." });
    }

    const io = getIo();
    io.to(conversationId).emit("conversation:participant_removed", { conversationId, userId: userToRemoveId });
    io.to(userToRemoveId).emit("conversation:deleted", { id: conversationId });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// CREATE a new conversation (private or group)
router.post("/", async (req, res, next) => {
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
            role: userId === creatorId ? "ADMIN" : "MEMBER",
          })),
        },
      },
      include: {
        participants: { 
          include: { 
            user: { select: { id: true, username: true, name: true, avatarUrl: true } } 
          }
        },
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

// UPDATE group conversation details
router.put("/:id/details", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const userId = req.user.id;

    // 1. Check if user is an admin of the group
    const participant = await prisma.participant.findFirst({
      where: {
        conversationId: id,
        userId: userId,
      },
    });

    if (!participant || participant.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: You are not an admin of this group." });
    }

    // 2. Update conversation details
    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: {
        title,
        description,
      },
    });

    // 3. Broadcast the update to all participants
    const io = getIo();
    io.to(id).emit("conversation:updated", {
      id,
      title: updatedConversation.title,
      description: updatedConversation.description,
    });

    res.json(updatedConversation);
  } catch (error) {
    next(error);
  }
});

// ADD new members to a group
router.post("/:id/participants", async (req, res, next) => {
  try {
    const { id: conversationId } = req.params;
    const { userIds } = req.body;
    const currentUserId = req.user.id;

    // 1. Check if user is an admin
    const adminParticipant = await prisma.participant.findFirst({
      where: { conversationId, userId: currentUserId },
    });
    if (!adminParticipant || adminParticipant.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: You are not an admin of this group." });
    }

    // 2. Add new participants
    const newParticipantsData = userIds.map((userId: string) => ({
      conversationId,
      userId,
    }));

    await prisma.participant.createMany({
      data: newParticipantsData,
      skipDuplicates: true, // Don't throw error if user is already a participant
    });

    // 3. Get full data for broadcasting
    const newParticipants = await prisma.participant.findMany({
      where: { conversationId, userId: { in: userIds } },
      include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } },
    });

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { include: { user: true } }, creator: true },
    });

    // 4. Broadcast updates
    const io = getIo();
    io.to(conversationId).emit("conversation:participants_added", { conversationId, newParticipants });

    newParticipants.forEach(p => {
      io.to(p.userId).emit("conversation:new", conversation);
    });

    res.status(201).json(newParticipants);
  } catch (error) {
    next(error);
  }
});


// UPDATE a member's role in a group
router.put("/:id/participants/:userId/role", async (req, res, next) => {
  try {
    const { id: conversationId, userId: userToModifyId } = req.params;
    const { role } = req.body;
    const currentUserId = req.user.id;

    if (role !== "ADMIN" && role !== "MEMBER") {
      return res.status(400).json({ error: "Invalid role specified." });
    }

    // 1. Check if current user is an admin
    const adminParticipant = await prisma.participant.findFirst({
      where: { conversationId, userId: currentUserId },
    });
    if (!adminParticipant || adminParticipant.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: You are not an admin of this group." });
    }

    // 2. Prevent admin from changing their own role
    if (currentUserId === userToModifyId) {
      return res.status(400).json({ error: "You cannot change your own role." });
    }

    // 3. Update the participant's role
    const updatedParticipant = await prisma.participant.updateMany({
      where: { conversationId, userId: userToModifyId },
      data: { role },
    });

    if (updatedParticipant.count === 0) {
      return res.status(404).json({ error: "Participant not found." });
    }

    // 4. Broadcast the update
    const io = getIo();
    io.to(conversationId).emit("conversation:participant_updated", {
      conversationId,
      userId: userToModifyId,
      role,
    });

    res.json({ userId: userToModifyId, role });
  } catch (error) {
    next(error);
  }
});

    

    // UPLOAD group avatar

    router.post("/:id/avatar", upload.single('avatar'), async (req, res, next) => {

      try {

        const { id } = req.params;

        const userId = req.user.id;

    

        // 1. Check if user is an admin of the group

        const participant = await prisma.participant.findFirst({

          where: {

            conversationId: id,

            userId: userId,

          },

        });

    

        if (!participant || participant.role !== "ADMIN") {

          return res.status(403).json({ error: "Forbidden: You are not an admin of this group." });

        }

    

        if (!req.file) {

          return res.status(400).json({ error: "No avatar file provided." });

        }

    

        const avatarUrl = `/uploads/images/${req.file.filename}`;

    

        // 2. Update conversation avatarUrl

        const updatedConversation = await prisma.conversation.update({

          where: { id },

          data: {

            avatarUrl,

          },

        });

    

        // 3. Broadcast the update to all participants

        const io = getIo();

        io.to(id).emit("conversation:updated", {

          id,

          avatarUrl: updatedConversation.avatarUrl,

        });

    

        res.json({ avatarUrl: updatedConversation.avatarUrl });

      } catch (error) {

        next(error);

      }

    });

    

    // DELETE a conversation (group or 1-on-1)
router.delete("/:id", async (req, res, next) => {
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

// Mark a conversation as read
router.post("/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the latest message in the conversation
    const lastMessage = await prisma.message.findFirst({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
    });

    if (lastMessage) {
      // Update the participant's lastReadMsgId
      await prisma.participant.updateMany({
        where: {
          conversationId: id,
          userId: userId,
        },
        data: {
          lastReadMsgId: lastMessage.id,
        },
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;