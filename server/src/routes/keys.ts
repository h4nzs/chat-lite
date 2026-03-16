// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { z } from 'zod';
import { zodValidate } from '../utils/validate.js';
import {
  uploadPreKeyBundle,
  uploadOTPKs,
  countOTPKs,
  clearOTPKs,
  getPreKeyBundle,
  getInitialSession,
  generateTURNCredentials
} from '../services/key.service.js';

const router: Router = Router();

// ==================== UPLOAD Pre-Key Bundle ====================
router.post(
  '/prekey-bundle',
  requireAuth,
  zodValidate({
    body: z.object({
      identityKey: z.string(),
      signingKey: z.string().optional(),
      signedPreKey: z.object({
        key: z.string(),
        signature: z.string()
      })
    })
  }),
  async (req, res, next) => {
    try {
      if (!req.user) throw new Error('Authentication required.');
      
      const result = await uploadPreKeyBundle(req.user.id, req.body);
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  }
);

// ==================== UPLOAD OTPKs ====================
router.post(
  '/upload-otpk',
  requireAuth,
  zodValidate({
    body: z.object({
      keys: z.array(z.object({
        keyId: z.number(),
        publicKey: z.string()
      })).min(1).max(100)
    })
  }),
  async (req, res, next) => {
    try {
      if (!req.user) throw new Error('Authentication required.');
      
      const result = await uploadOTPKs(req.user.id, req.body.keys);
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  }
);

// ==================== COUNT OTPKs ====================
router.get('/count-otpk', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw new Error('Authentication required.');
    
    const result = await countOTPKs(req.user.id);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// ==================== CLEAR OTPKs ====================
router.delete('/otpk', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw new Error('Authentication required.');
    
    await clearOTPKs(req.user.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// ==================== GET Pre-Key Bundle ====================
router.get(
  '/prekey-bundle/:userId',
  requireAuth,
  zodValidate({ params: z.object({ userId: z.string().cuid() }) }),
  async (req, res, next) => {
    try {
      const result = await getPreKeyBundle(req.params.userId as string);
      res.json(result);
    } catch (e: unknown) {
      next(e as Error);
    }
  }
);

// ==================== GET Initial Session ====================
router.get(
  '/initial-session/:conversationId/:sessionId',
  requireAuth,
  zodValidate({
    params: z.object({
      conversationId: z.string(),
      sessionId: z.string()
    })
  }),
  async (req, res, next) => {
    try {
      if (!req.user) throw new Error('Authentication required.');
      
      const result = await getInitialSession({
        userId: req.user.id,
        conversationId: req.params.conversationId as string,
        sessionId: req.params.sessionId as string
      });
      res.json(result);
    } catch (e) {
      next(e as Error);
    }
  }
);

// ==================== GET TURN Credentials ====================
router.get('/turn', requireAuth, async (req, res) => {
  try {
    const result = await generateTURNCredentials();
    res.json(result);
  } catch (error) {
    console.error('[TURN] Failed to fetch credentials:', error);
    res.json({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  }
});

export default router;
