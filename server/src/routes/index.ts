// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Router } from 'express';
import authRouter from './auth.js';
import usersRouter from './users.js';
import conversationsRouter from './conversations.js';
import messagesRouter from './messages.js';
import uploadsRouter from './uploads.js';
import keysRouter from './keys.js';
import previewsRouter from './previews.js';
import sessionKeysRouter from './sessionKeys.js';
import sessionsRouter from './sessions.js';
import aiRoutes from './ai.js';
import adminRouter from './admin.js';
import storiesRoutes from './stories.js';
import { reportRoutes } from './reports.js';

const router = Router();

// ==================== ROUTE REGISTRATIONS ====================
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/conversations', conversationsRouter);
router.use('/messages', messagesRouter);
router.use('/uploads', uploadsRouter);
router.use('/previews', previewsRouter);
router.use('/session-keys', sessionKeysRouter);
router.use('/reports', reportRoutes);
router.use('/admin', adminRouter);
router.use('/sessions', sessionsRouter);
router.use('/ai', aiRoutes);
router.use('/stories', storiesRoutes);

// Keys route is registered at root level in app.ts for E2EE
// router.use('/keys', keysRouter);

// ==================== HEALTH CHECK ====================
router.get('/health', (_req, res) => {
  res.json({ status: 'ok bang' });
});

export default router;
