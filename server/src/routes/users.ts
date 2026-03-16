// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Router, CookieOptions } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { z } from 'zod';
import { zodValidate } from '../utils/validate.js';
import { ApiError } from '../utils/errors.js';
import {
  searchUsers,
  getUserProfile,
  updateProfile,
  updateKeys,
  getUserById,
  completeOnboarding,
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportUser,
  deleteAccount
} from '../services/user.service.js';

const router = Router();
router.use(requireAuth);

// ==================== SEARCH Users ====================
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.json([]);
    }

    const users = await searchUsers(q, req.user!.id);
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// ==================== GET Current User Profile ====================
router.get('/me', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    
    const user = await getUserProfile(req.user.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// ==================== UPDATE User Profile ====================
router.put('/me',
  zodValidate({
    body: z.object({
      encryptedProfile: z.string().min(1).optional(),
      autoDestructDays: z.number().int().min(1).nullable().optional()
    }).refine(data => data.encryptedProfile !== undefined || data.autoDestructDays !== undefined, {
      message: "Body cannot be empty"
    })
  }),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { encryptedProfile, autoDestructDays } = req.body;

      const updatedUser = await updateProfile(userId, {
        encryptedProfile,
        autoDestructDays
      });

      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== UPDATE User Keys ====================
const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
router.put('/me/keys',
  zodValidate({
    body: z.object({
      publicKey: z.string().min(43).max(256).regex(base64UrlRegex, { message: 'Invalid public key format.' }),
      signingKey: z.string().min(43).max(256).regex(base64UrlRegex, { message: 'Invalid signing key format.' })
    })
  }),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required.');
      
      const result = await updateKeys(req.user.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== GET User by ID ====================
router.get('/:userId', async (req, res, next) => {
  try {
    const user = await getUserById(req.params.userId);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// ==================== COMPLETE Onboarding ====================
router.post('/me/complete-onboarding', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    
    const result = await completeOnboarding(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== BLOCK User ====================
router.post('/:id/block', async (req, res, next) => {
  try {
    const blockerId = req.user!.id;
    const blockedId = req.params.id;
    
    const result = await blockUser(blockerId, blockedId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== UNBLOCK User ====================
router.delete('/:id/block', async (req, res, next) => {
  try {
    const blockerId = req.user!.id;
    const blockedId = req.params.id;
    
    const result = await unblockUser(blockerId, blockedId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== GET Blocked Users ====================
router.get('/me/blocked', async (req, res, next) => {
  try {
    const blocked = await getBlockedUsers(req.user!.id);
    res.json(blocked);
  } catch (error) {
    next(error);
  }
});

// ==================== REPORT User ====================
router.post('/report', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    
    const { userId, reason } = req.body;
    const result = await reportUser(req.user.id, userId, reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== DELETE Account ====================
router.delete('/me',
  zodValidate({
    body: z.object({
      password: z.string().min(1),
      fileKeys: z.array(z.string()).max(1000).optional()
    })
  }),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required.');
      
      const result = await deleteAccount({
        userId: req.user.id,
        password: req.body.password,
        fileKeys: req.body.fileKeys
      });

      // Clear cookies
      const { env } = await import('../config.js');
      const isProd = env.nodeEnv === 'production';
      const cookieOpts: CookieOptions = {
        path: '/',
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax'
      };
      res.clearCookie('at', cookieOpts);
      res.clearCookie('rt', cookieOpts);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
