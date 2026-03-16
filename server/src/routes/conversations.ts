// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../utils/errors.js';
import {
  listConversations,
  createConversation,
  getConversationDetails,
  updateConversationDetails,
  addParticipants,
  updateParticipantRole,
  removeParticipant,
  leaveConversation,
  deleteConversation,
  togglePinStatus,
  markAsRead,
  recordKeyRotation
} from '../services/conversation.service.js';

const router: Router = Router();
router.use(requireAuth);

// ==================== LIST Conversations ====================
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    const conversations = await listConversations(req.user.id);
    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

// ==================== CREATE Conversation ====================
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    
    const result = await createConversation(req.body, req.user.id);
    
    if (!result.created) {
      return res.status(200).json(result.conversation);
    }

    const io = await import('../socket.js').then(m => m.getIo());
    io.to(result.allUserIds.filter((uid: string) => uid !== req.user!.id))
      .emit('conversation:new', result.conversation);
    
    res.status(201).json({ ...result.conversation, unreadCount: 0 });
  } catch (error) {
    next(error);
  }
});

// ==================== GET Conversation Details ====================
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    const conversation = await getConversationDetails(req.params.id, req.user.id);
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

// ==================== UPDATE Conversation Details ====================
router.put('/:id/details', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    
    const updatedConversation = await updateConversationDetails(
      req.params.id,
      req.user.id,
      req.body
    );
    
    const io = await import('../socket.js').then(m => m.getIo());
    io.to(req.params.id).emit('conversation:updated', {
      id: req.params.id,
      title: updatedConversation.title,
      description: updatedConversation.description
    });
    
    res.json(updatedConversation);
  } catch (error) {
    next(error);
  }
});

// ==================== ADD Participants ====================
router.post('/:id/participants', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    
    const newParticipants = await addParticipants(
      req.params.id,
      req.user.id,
      req.body.userIds
    );
    
    res.status(201).json(newParticipants);
  } catch (error) {
    next(error);
  }
});

// ==================== UPDATE Participant Role ====================
router.put('/:id/participants/:userId/role', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    
    const result = await updateParticipantRole(
      req.params.id,
      req.user.id,
      req.params.userId,
      req.body.role
    );
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== REMOVE Participant ====================
router.delete('/:id/participants/:userId', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    
    await removeParticipant(
      req.params.id,
      req.user.id,
      req.params.userId
    );
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ==================== LEAVE Conversation ====================
router.delete('/:id/leave', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    
    await leaveConversation(req.params.id, req.user.id);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ==================== DELETE Conversation ====================
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    
    await deleteConversation(req.params.id, req.user.id);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ==================== TOGGLE Pin ====================
router.post('/:id/pin', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    
    const result = await togglePinStatus(req.params.id, req.user.id);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== MARK AS READ ====================
router.post('/:id/read', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    
    await markAsRead(req.params.id, req.user.id);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ==================== RECORD Key Rotation ====================
router.post('/:id/key-rotation', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    
    const result = await recordKeyRotation(req.params.id, req.user.id);
    
    res.json(result);
  } catch (error) {
    console.error('Failed to record key rotation:', error);
    next(error);
  }
});

export default router;
