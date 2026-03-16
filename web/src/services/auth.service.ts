// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { api, authFetch, apiUpload } from '@lib/api';
import { uploadToR2 } from '@lib/r2';
import { compressImage } from '@lib/fileUtils';
import type { User } from '@store/auth';

/**
 * Login user
 */
export const loginApi = async (
  usernameHash: string,
  password: string
) => {
  const response = await api<{
    user: User;
    accessToken: string;
    encryptedPrivateKey?: string;
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ usernameHash, password }),
  });

  return response;
};

/**
 * Register new user
 */
export const registerApi = async (data: {
  usernameHash: string;
  password: string;
  encryptedProfile: string;
  publicKey: string;
  signingKey: string;
  encryptedPrivateKeys: string;
  turnstileToken?: string;
}) => {
  const response = await api<{
    accessToken: string;
    user: User;
  }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response;
};

/**
 * Logout user
 */
export const logoutApi = async (endpoint?: string) => {
  const response = await api('/api/auth/logout', {
    method: 'POST',
    body: endpoint ? JSON.stringify({ endpoint }) : undefined,
  });

  return response;
};

/**
 * Logout all sessions
 */
export const logoutAllSessionsApi = async () => {
  const response = await api('/api/auth/logout-all', {
    method: 'POST',
  });

  return response;
};

/**
 * Refresh access token
 */
export const refreshTokenApi = async () => {
  const response = await api<{
    ok: boolean;
    accessToken?: string;
  }>('/api/auth/refresh', {
    method: 'POST',
  });

  return response;
};

/**
 * Get current user profile
 */
export const getCurrentUserApi = async () => {
  const response = await authFetch<User>('/api/users/me');

  return response;
};

/**
 * Update user profile
 */
export const updateProfileApi = async (data: { encryptedProfile: string }) => {
  const response = await authFetch<User>('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  return response;
};

/**
 * Upload avatar to R2
 */
export const uploadAvatarApi = async (avatar: File) => {
  const toast = await import('react-hot-toast').then(m => m.default);
  
  let fileToProcess = avatar;
  if (avatar.type.startsWith('image/')) {
    try {
      fileToProcess = await compressImage(avatar);
    } catch {
      // Ignore compression errors, use original file
    }
  }

  const toastId = toast.loading('Uploading to Cloud...');
  
  try {
    const fileUrl = await uploadToR2(fileToProcess, 'avatars', () => {});
    toast.success('Avatar uploaded! (Profile update required)', { id: toastId });
    return fileUrl as string;
  } catch (e: unknown) {
    toast.error(`Update failed: ${(e as Error).message}`, { id: toastId });
    throw e;
  }
};

/**
 * Block a user
 */
export const blockUserApi = async (userId: string) => {
  const response = await authFetch(`/api/users/${userId}/block`, {
    method: 'POST',
  });

  return response;
};

/**
 * Unblock a user
 */
export const unblockUserApi = async (userId: string) => {
  const response = await authFetch(`/api/users/${userId}/block`, {
    method: 'DELETE',
  });

  return response;
};

/**
 * Get blocked users list
 */
export const getBlockedUsersApi = async () => {
  const response = await authFetch<Array<{ id: string }>>('/api/users/me/blocked');

  return response;
};

/**
 * Upload pre-key bundle to server
 */
export const uploadPreKeyBundleApi = async (bundle: {
  identityKey: string;
  signingKey: string;
  signedPreKey: {
    key: string;
    signature: string;
  };
}) => {
  const response = await authFetch('/api/keys/prekey-bundle', {
    method: 'POST',
    body: JSON.stringify(bundle),
  });

  return response;
};

/**
 * Reset one-time pre-keys
 */
export const resetOneTimePreKeysApi = async () => {
  const response = await authFetch('/api/keys/otpk', {
    method: 'DELETE',
  });

  return response;
};
