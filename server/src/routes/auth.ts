// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Router, Request, Response, CookieOptions } from 'express';
import { ApiError } from '../utils/errors.js';
import { z } from 'zod';
import { zodValidate } from '../utils/validate.js';
import { env } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  registerUser,
  loginUser,
  generateWebAuthnRegistrationOptions,
  verifyWebAuthnRegistration,
  generateWebAuthnAuthenticationOptions,
  verifyWebAuthnAuthentication,
  changePassword,
  getUserById,
  logoutUser,
  logoutAllSessions,
  refreshSession
} from '../services/auth.service.js';
import { verifyJwt } from '../utils/jwt.js';

const router: Router = Router();

const setAuthCookies = (res: Response, { accessToken, refreshToken }: { accessToken: string; refreshToken: string }) => {
  const isProd = env.nodeEnv === 'production';

  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/'
  };

  res.cookie('at', accessToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 15
  });

  res.cookie('rt', refreshToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 30
  });
};

// ==================== REGISTRATION ====================
router.post('/register', authLimiter, zodValidate({
  body: z.object({
    usernameHash: z.string().min(10),
    password: z.string().min(8),
    encryptedProfile: z.string(),
    turnstileToken: z.string().optional()
  })
}), async (req, res, next) => {
  try {
    const result = await registerUser(req.body, req.ip || '', req.headers['user-agent'] || '');

    setAuthCookies(res, result);

    res.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
      needVerification: result.needVerification
    });
  } catch (error) {
    next(error);
  }
});

// ==================== LOGIN ====================
router.post('/login', authLimiter, zodValidate({
  body: z.object({
    usernameHash: z.string().min(10),
    password: z.string().min(8)
  })
}), async (req, res, next) => {
  try {
    const result = await loginUser(req.body, req.ip || '', req.headers['user-agent'] || '');

    setAuthCookies(res, result);

    res.json({
      user: result.user,
      accessToken: result.accessToken,
      needVerification: result.needVerification,
      encryptedPrivateKey: result.encryptedPrivateKey
    });
  } catch (error) {
    next(error);
  }
});

// ==================== REFRESH TOKEN ====================
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.rt || req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.clearCookie('at');
      res.clearCookie('rt');
      throw new ApiError(401, 'No refresh token provided');
    }

    const result = await refreshSession(token, req.ip || '', req.headers['user-agent'] || '');
    setAuthCookies(res, result);
    
    res.json({ ok: true, accessToken: result.accessToken });
  } catch (error) {
    res.clearCookie('at');
    res.clearCookie('rt');
    next(error);
  }
});

// ==================== LOGOUT ====================
router.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.rt || req.headers.authorization?.split(' ')[1];

    if (refreshToken) {
      const payload = verifyJwt(refreshToken);
      if (payload && typeof payload === 'object') {
        const jti = (payload as { jti?: string }).jti;
        const endpoint = req.body?.endpoint;
        if (jti) {
          await logoutUser(jti, endpoint);
        }
      }
    }

    res.clearCookie('at');
    res.clearCookie('rt');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ==================== LOGOUT ALL ====================
router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required');

    const endpoint = req.body?.endpoint;
    await logoutAllSessions(req.user.id, endpoint);

    res.clearCookie('at');
    res.clearCookie('rt');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ==================== PASSWORD CHANGE ====================
router.post('/change-password', requireAuth, zodValidate({
  body: z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8)
  })
}), async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required');

    await changePassword({
      userId: req.user.id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

// ==================== WEB AUTHN REGISTRATION ====================
router.get('/webauthn/register/options', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required');

    const forceNew = req.query.force === 'true';
    const options = await generateWebAuthnRegistrationOptions({
      userId: req.user.id,
      usernameHash: req.user.usernameHash,
      forceNew
    });

    res.json(options);
  } catch (error) {
    next(error);
  }
});

router.post('/webauthn/register/verify', async (req, res, next) => {
  try {
    const verification = await verifyWebAuthnRegistration({
      userId: req.body.id,
      verificationResponse: req.body,
      expectedOrigin: env.corsOrigin || 'https://nyx-app.my.id',
      expectedRPID: env.nodeEnv === 'production' ? new URL(env.corsOrigin).hostname : 'localhost'
    });

    res.json({ verified: true });
  } catch (error) {
    next(error);
  }
});

// ==================== WEB AUTHN LOGIN ====================
router.get('/webauthn/login/options', async (req, res, next) => {
  try {
    const options = await generateWebAuthnAuthenticationOptions({
      userId: req.query.userId as string
    });

    res.json(options);
  } catch (error) {
    next(error);
  }
});

router.post('/webauthn/login/verify', async (req, res, next) => {
  try {
    const result = await verifyWebAuthnAuthentication({
      verificationResponse: req.body,
      expectedOrigin: env.corsOrigin || 'https://nyx-app.my.id',
      expectedRPID: env.nodeEnv === 'production' ? new URL(env.corsOrigin).hostname : 'localhost'
    });

    res.json({ verified: true, user: result.user, encryptedPrivateKey: result.encryptedPrivateKey });
  } catch (error) {
    next(error);
  }
});

// ==================== GET CURRENT USER ====================
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required');

    const user = await getUserById(req.user.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
