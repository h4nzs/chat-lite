// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../utils/errors.js';
import { z } from 'zod';
import { zodValidate } from '../utils/validate.js';
import {
  getMessages,
  getMessageContext,
  sendMessage,
  deleteMessage,
  deleteMessages,
  updateMessage,
  markMessageAsRead,
  deleteViewOnceMessage
} from '../services/message.service.js';

const router: Router = Router();
router.use(requireAuth);

// ==================== GET Messages ====================
router.get('/:conversationId', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');

    const result = await getMessages({
      conversationId: req.params.conversationId,
      userId: req.user.id,
      cursor: req.query.cursor as string | undefined
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== GET Message Context ====================
router.get('/context/:id', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');

    const result = await getMessageContext({
      messageId: req.params.id as string,
      userId: req.user.id
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== SEND Message ====================
router.post('/', zodValidate({
  body: z.object({
    conversationId: z.string().min(1),
    content: z.string().max(20000).optional().nullable(),
    sessionId: z.string().optional().nullable(),
    repliedToId: z.string().optional().nullable(),
    tempId: z.union([z.string(), z.number()]).optional(),
    expiresIn: z.number().optional().nullable(),
    isViewOnce: z.boolean().optional(),
    pushPayloads: z.record(z.string(), z.string()).optional()
  }).refine(data => data.content, {
    message: "Message must contain content"
  })
}), async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');

    const message = await sendMessage({
      ...req.body,
      senderId: req.user.id
    });

    res.status(201).json({ msg: message });
  } catch (error) {
    next(error);
  }
});

// ==================== DELETE Message ====================
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');

    await deleteMessage({
      messageId: req.params.id as string,
      userId: req.user.id
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ==================== DELETE Multiple Messages ====================
router.post('/delete-bulk', zodValidate({
  body: z.object({
    messageIds: z.array(z.string())
  })
}), async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');

    const result = await deleteMessages({
      messageIds: req.body.messageIds,
      userId: req.user.id
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== UPDATE Message (Edit) ====================
router.put('/:id', zodValidate({
  body: z.object({
    content: z.string().min(1).max(20000)
  })
}), async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');

    const message = await updateMessage({
      messageId: req.params.id as string,
      userId: req.user.id,
      content: req.body.content
    });

    res.json(message);
  } catch (error) {
    next(error);
  }
});

// ==================== MARK AS READ ====================
router.post('/:messageId/read', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');

    const { conversationId } = req.body;

    if (!conversationId) {
      throw new ApiError(400, 'Conversation ID required');
    }

    await markMessageAsRead(req.params.messageId, req.user.id, conversationId);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ==================== MARK VIEW ONCE AS VIEWED ====================
router.put('/:id/viewed', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');

    await deleteViewOnceMessage(req.params.id as string, req.user.id);

    res.json({ success: true, message: 'View once message deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
