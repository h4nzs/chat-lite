// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { ApiError } from '../utils/errors.js';
import { newJti, refreshExpiryDate, signAccessToken } from '../utils/jwt.js';
import { env } from '../config.js';
import crypto from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticatorTransport,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { Buffer } from 'buffer';
import { redisClient } from '../lib/redis.js';

const rpName = 'NYX';
const getRpID = () => {
  try {
    return env.nodeEnv === 'production' ? new URL(env.corsOrigin).hostname : 'localhost';
  } catch {
    return 'localhost';
  }
};
const rpID = getRpID();
const expectedOrigin = env.corsOrigin || 'https://nyx-app.my.id';

// ==================== DTOs ====================

export interface RegisterDTO {
  usernameHash: string;
  password: string;
  encryptedProfile: string;
  turnstileToken?: string;
}

export interface LoginDTO {
  usernameHash: string;
  password: string;
}

export interface WebAuthnRegistrationOptionsDTO {
  userId: string;
  usernameHash?: string;
  forceNew?: boolean;
}

export interface WebAuthnRegistrationVerificationDTO {
  userId: string;
  verificationResponse: RegistrationResponseJSON;
  expectedOrigin: string;
  expectedRPID: string;
}

export interface WebAuthnAuthenticationOptionsDTO {
  userId: string;
}

export interface WebAuthnAuthenticationVerificationDTO {
  verificationResponse: AuthenticationResponseJSON;
  expectedOrigin: string;
  expectedRPID: string;
}

export interface PasswordChangeDTO {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

// ==================== Helper Functions ====================

async function verifyTurnstileToken(token: string): Promise<boolean> {
  if (env.nodeEnv !== 'production' && !process.env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;

  const formData = new FormData();
  formData.append('secret', process.env.TURNSTILE_SECRET_KEY || '');
  formData.append('response', token);

  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });
    const outcome = await result.json();
    return outcome.success;
  } catch (e) {
    console.error('Turnstile error:', e);
    return false;
  }
}

// ==================== Auth Service Functions ====================

/**
 * Register a new user
 */
export const registerUser = async (data: RegisterDTO, reqIp: string, userAgent: string) => {
  const { usernameHash, password, encryptedProfile, turnstileToken } = data;

  // Verify Turnstile
  const isHuman = await verifyTurnstileToken(turnstileToken || '');
  if (!isHuman) {
    throw new ApiError(403, 'Captcha verification failed');
  }

  // Check if username is taken
  const existing = await prisma.user.findUnique({
    where: { usernameHash }
  });

  if (existing) {
    throw new ApiError(409, 'Username already taken');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      usernameHash,
      passwordHash,
      encryptedProfile,
      isVerified: false
    },
    select: {
      id: true,
      usernameHash: true,
      encryptedProfile: true,
      role: true,
      isVerified: true
    }
  });

  // Create refresh token
  const access = signAccessToken({
    id: user.id,
    role: user.role
  });
  const jti = newJti();
  const refresh = signAccessToken({ sub: user.id, jti }, { expiresIn: '30d' });

  const ipAddress = crypto.createHash('sha256').update(reqIp || '').digest('hex').substring(0, 16);

  await prisma.refreshToken.create({
    data: { jti, userId: user.id, expiresAt: refreshExpiryDate(), ipAddress, userAgent }
  });

  return {
    user,
    accessToken: access,
    refreshToken: refresh,
    needVerification: true
  };
};

/**
 * Login user
 */
export const loginUser = async (data: LoginDTO, reqIp: string, userAgent: string) => {
  const { usernameHash, password } = data;

  const user = await prisma.user.findUnique({
    where: { usernameHash }
  });

  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const access = signAccessToken({
    id: user.id,
    role: user.role
  });
  const jti = newJti();
  const refresh = signAccessToken({ sub: user.id, jti }, { expiresIn: '30d' });

  const ipAddress = crypto.createHash('sha256').update(reqIp || '').digest('hex').substring(0, 16);

  await prisma.refreshToken.create({
    data: { jti, userId: user.id, expiresAt: refreshExpiryDate(), ipAddress, userAgent }
  });

  return {
    user: {
      id: user.id,
      usernameHash: user.usernameHash,
      encryptedProfile: user.encryptedProfile,
      role: user.role,
      isVerified: user.isVerified
    },
    accessToken: access,
    refreshToken: refresh,
    needVerification: false
  };
};

/**
 * Generate WebAuthn registration options
 */
export const generateWebAuthnRegistrationOptions = async (data: WebAuthnRegistrationOptionsDTO) => {
  const { userId, usernameHash, forceNew = false } = data;

  const userAuthenticators = await prisma.authenticator.findMany({
    where: { userId }
  });

  const forceNewCredential = forceNew;
  const excludeCredentials = forceNewCredential ? [] : userAuthenticators.reduce((acc: Array<{ id: string; type: 'public-key'; transports?: AuthenticatorTransport[] }>, auth) => {
    try {
      if (!auth.credentialID) return acc;
      const base64 = String(auth.credentialID).replace(/-/g, '+').replace(/_/g, '/');
      const idBuffer = Buffer.from(base64, 'base64');
      acc.push({
        id: idBuffer.toString('hex'),
        type: 'public-key' as const,
        transports: auth.transports ? auth.transports.split(',').filter((t: string): t is AuthenticatorTransport => ['ble', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'].includes(t)) : undefined
      });
    } catch (e) {
      console.warn(`Skipping invalid credential ID: ${auth.credentialID}`, e);
    }
    return acc;
  }, []);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new Uint8Array(Buffer.from(userId)),
    userName: usernameHash || 'Anonymous User',
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      requireResidentKey: false
    },
    extensions: {
      prf: {
        eval: {
          first: crypto.randomBytes(32)
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  });

  await redisClient.setEx(`reg_challenge:${userId}`, 300, options.challenge);

  return options;
};

/**
 * Verify WebAuthn registration response
 */
export const verifyWebAuthnRegistration = async (data: WebAuthnRegistrationVerificationDTO) => {
  const { verificationResponse, expectedOrigin, expectedRPID } = data;

  const verification = await verifyRegistrationResponse({
    response: verificationResponse,
    expectedChallenge: verificationResponse.response.clientDataJSON,
    expectedOrigin,
    expectedRPID
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new ApiError(400, 'Registration verification failed');
  }

  const { credential, aaguid } = verification.registrationInfo;
  const credentialID = credential.id;
  const credentialPublicKey = credential.publicKey;
  const counter = credential.counter;

  await prisma.authenticator.create({
    data: {
      id: credentialID,
      userId: verificationResponse.id,
      credentialID,
      credentialPublicKey: isoBase64URL.fromBuffer(credentialPublicKey),
      counter: BigInt(counter),
      credentialDeviceType: 'singleDevice',
      credentialBackedUp: false,
      transports: verificationResponse.response.transports?.join(',')
    }
  });

  return { verified: true };
};

/**
 * Generate WebAuthn authentication options
 */
export const generateWebAuthnAuthenticationOptions = async (data: WebAuthnAuthenticationOptionsDTO) => {
  const { userId } = data;

  const userAuthenticators = await prisma.authenticator.findMany({
    where: { userId }
  });

  if (userAuthenticators.length === 0) {
    throw new ApiError(404, 'No authenticators found for user');
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: userAuthenticators.map(auth => ({
      id: auth.credentialID,
      type: 'public-key',
      transports: auth.transports ? auth.transports.split(',') as AuthenticatorTransport[] : undefined
    }))
  });

  await redisClient.setEx(`auth_challenge:${userId}`, 300, options.challenge);

  return options;
};

/**
 * Verify WebAuthn authentication response
 */
export const verifyWebAuthnAuthentication = async (data: WebAuthnAuthenticationVerificationDTO) => {
  const { verificationResponse, expectedOrigin, expectedRPID } = data;

  const user = await prisma.user.findUnique({
    where: { id: verificationResponse.id },
    include: { authenticators: true }
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const authenticator = user.authenticators.find(auth => auth.credentialID === verificationResponse.id);

  if (!authenticator) {
    throw new ApiError(404, 'Authenticator not found');
  }

  const verification = await verifyAuthenticationResponse({
    response: verificationResponse,
    expectedChallenge: verificationResponse.response.clientDataJSON,
    expectedOrigin,
    expectedRPID,
    authenticator: {
      credentialID: authenticator.credentialID,
      credentialPublicKey: isoBase64URL.toBuffer(authenticator.credentialPublicKey),
      counter: Number(authenticator.counter),
      transports: authenticator.transports ? authenticator.transports.split(',') as AuthenticatorTransport[] : undefined
    },
    requireUserVerification: false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  if (!verification.verified) {
    throw new ApiError(400, 'Authentication verification failed');
  }

  const { authenticationInfo } = verification;

  await prisma.authenticator.update({
    where: { id: authenticator.id },
    data: { counter: BigInt(authenticationInfo.newCounter) }
  });

  return {
    verified: true,
    user: {
      id: user.id,
      usernameHash: user.usernameHash,
      encryptedProfile: user.encryptedProfile,
      role: user.role,
      isVerified: user.isVerified
    }
  };
};

/**
 * Change user password
 */
export const changePassword = async (data: PasswordChangeDTO) => {
  const { userId, currentPassword, newPassword } = data;

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  const newPasswordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash }
  });

  return { success: true };
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      usernameHash: true,
      encryptedProfile: true,
      role: true,
      isVerified: true,
      hasCompletedOnboarding: true
    }
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
};

/**
 * Logout user (invalidate refresh token)
 */
export const logoutUser = async (jti: string, endpoint?: string) => {
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint }
    });
  }

  await prisma.refreshToken.updateMany({
    where: { jti },
    data: { revokedAt: new Date() }
  });

  return { success: true };
};

/**
 * Logout all user sessions
 */
export const logoutAllSessions = async (userId: string, endpoint?: string) => {
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint }
    });
  }

  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revokedAt: new Date() }
  });

  return { success: true };
};
