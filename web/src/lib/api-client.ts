// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
//
// Fully-typed API client generated from OpenAPI 3.0.3 spec.
// Uses existing api() / authFetch() from @lib/api under the hood.
//
// Usage:
//   import { apiClient } from '@lib/api-client';
//   const user = await apiClient.users.getMe();
//   const msgs = await apiClient.messages.get('conv123');

import { api, authFetch } from '@lib/api';
import type { User, Conversation, Message, ConversationUi } from '@nyx/shared';

// =========================================================
// GENERIC HELPERS
// =========================================================

/** POST (optionally authenticated, with extra headers) */
function post<T = unknown>(path: string, body?: unknown, auth = false, headers?: Record<string, string>): Promise<T> {
  const opts: RequestInit = { method: 'POST' };
  if (body !== undefined) opts.body = JSON.stringify(body);
  if (headers) opts.headers = headers;
  return auth ? authFetch<T>(path, opts) : api<T>(path, opts);
}

/** PUT (authenticated, with extra headers) */
function put<T = unknown>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const opts: RequestInit = { method: 'PUT' };
  if (body !== undefined) opts.body = JSON.stringify(body);
  if (headers) opts.headers = headers;
  return authFetch<T>(path, opts);
}

/** DELETE (authenticated, with extra headers) */
function del<T = unknown>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const opts: RequestInit = { method: 'DELETE' };
  if (body !== undefined) opts.body = JSON.stringify(body);
  if (headers) opts.headers = headers;
  return authFetch<T>(path, opts);
}

/** GET (authenticated) */
function get<T = unknown>(path: string): Promise<T> {
  return authFetch<T>(path);
}

// =========================================================
// RESPONSE TYPES
// =========================================================

export interface RegisterResponse {
  message: string;
  user: User;
  accessToken: string;
  deviceId: string;
  needVerification: boolean;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  deviceId: string;
  encryptedPrivateKey?: string;
}

export interface BurnerResponse {
  accessToken: string;
  user: { id: string; role: string; usernameHash: string };
  deviceId: string;
}

export interface RefreshResponse {
  ok: boolean;
  accessToken: string;
}

export interface CsrfTokenResponse {
  csrfToken: string;
}

export interface TransportTicketResponse {
  ticket: string;
}

export interface PowChallengeResponse {
  salt: string;
  difficulty: number;
}

export interface PowVerifyResponse {
  success: boolean;
  message: string;
}

export interface RecoveryChallengeResponse {
  nonce: string;
}

export interface RecoveryResponse {
  message: string;
  accessToken: string;
}

export interface SessionInfo {
  id: string;
  jti: string;
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  isCurrent: boolean;
  deviceInfo: string;
  lastUsedAt: string;
  createdAt: string;
}

export interface SessionsResponse {
  sessions: SessionInfo[];
}

export interface DeviceInfo {
  id: string;
  name: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface PreKeyBundleUpload {
  identityKey: string;
  pqIdentityKey: string;
  signingKey: string;
  signedPreKey: {
    key: string;
    pqKey: string;
    signature: string;
    pqSignature: string;
  };
}

export interface OtpkUpload {
  keys: Array<{ keyId: number; publicKey: string; pqPublicKey?: string }>;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

export interface SmartReplyResponse {
  replies: string[];
}

export interface LinkPreviewResponse {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
}

export interface CreateConversationPayload {
  userIds: string[];
  isGroup?: boolean;
  encryptedMetadata?: string;
  initialSession?: {
    sessionId: string;
    initialKeysPerDevice: Record<string, string>;
    initiatorCiphertextsPerDevice: Record<string, string>;
  };
  targetRecipients?: string[];
}

export interface SendMessagePayload {
  conversationId: string;
  content: string;
  sessionId?: string;
  tempId?: number;
  expiresIn?: number;
  isViewOnce?: boolean;
  targetRecipients?: string[];
  deleteSecret?: string;
}

export interface MessagesResponse {
  items: Message[];
}

export interface ConversationCreateResponse extends Conversation {
  authSecret: string;
}

export interface SystemStatusResponse {
  maintenance: boolean;
  banner: {
    active: boolean;
    message: string;
    type: 'info' | 'warning' | 'error';
  };
}

export interface SubscriptionCreateResponse {
  checkout_url: string;
}

export interface CryptoInvoiceResponse {
  invoice_url: string;
}

export interface B2BRoomResponse {
  userAUrl: string;
  userBUrl: string;
}

export interface WebAuthnOptions {
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: Array<{ type: string; alg: number }>;
  authenticatorSelection?: {
    authenticatorAttachment?: string;
    residentKey?: string;
    userVerification?: string;
  };
  excludeCredentials?: Array<{ id: string; type: string; transports?: string[] }>;
  attestation?: string;
  [key: string]: unknown;
}

export interface WebAuthnLoginOptions {
  challenge: string;
  rpId: string;
  allowCredentials?: Array<{ id: string; type: string }>;
  userVerification?: string;
  [key: string]: unknown;
}

export interface HealthResponse {
  status: string;
}

// =========================================================
// API CLIENT
// =========================================================

export const apiClient = {
  // ==========================================
  // AUTH
  // ==========================================
  auth: {
    /** Register a new account with cryptographic keys */
    register(data: {
      usernameHash: string;
      password: string;
      encryptedProfile?: string;
      publicKey: string;
      pqPublicKey?: string;
      signingKey: string;
      encryptedPrivateKeys?: string;
      deviceName?: string;
      turnstileToken?: string;
    }): Promise<RegisterResponse> {
      return post<RegisterResponse>('/api/auth/register', data);
    },

    /** Login with credentials */
    login(data: {
      usernameHash: string;
      password: string;
      publicKey?: string;
      pqPublicKey?: string;
      signingKey?: string;
      encryptedPrivateKey?: string;
      deviceName?: string;
      deviceId?: string;
    }): Promise<LoginResponse> {
      return post<LoginResponse>('/api/auth/login', data);
    },

    /** Create anonymous burner/guest session */
    burner(): Promise<BurnerResponse> {
      return post<BurnerResponse>('/api/auth/burner');
    },

    /** Refresh access token (uses cookies) */
    refresh(): Promise<RefreshResponse> {
      return post<RefreshResponse>('/api/auth/refresh');
    },

    /** Logout current session */
    logout(endpoint?: string): Promise<{ ok: boolean }> {
      return post<{ ok: boolean }>('/api/auth/logout', endpoint ? { endpoint } : undefined);
    },

    /** Logout all sessions */
    logoutAll(): Promise<{ message: string }> {
      return post<{ message: string }>('/api/auth/logout-all', undefined, true);
    },

    /** Get WebTransport ticket */
    getTransportTicket(): Promise<TransportTicketResponse> {
      return get<TransportTicketResponse>('/api/auth/transport-ticket');
    },

    /** Get recovery challenge */
    getRecoveryChallenge(identifier: string): Promise<RecoveryChallengeResponse> {
      return api<RecoveryChallengeResponse>(`/api/auth/recover/challenge?identifier=${encodeURIComponent(identifier)}`);
    },

    /** Recover account with cryptographic proof */
    recover(data: {
      identifier: string;
      newPassword: string;
      newEncryptedKeys: string;
      publicKey: string;
      pqPublicKey?: string;
      signingKey: string;
      signature: string;
      timestamp: number;
      nonce: string;
    }): Promise<RecoveryResponse> {
      return post<RecoveryResponse>('/api/auth/recover', data);
    },

    /** Get PoW challenge */
    getPowChallenge(): Promise<PowChallengeResponse> {
      return get<PowChallengeResponse>('/api/auth/pow/challenge');
    },

    /** Verify PoW solution */
    verifyPow(nonce: number): Promise<PowVerifyResponse> {
      return post<PowVerifyResponse>('/api/auth/pow/verify', { nonce }, true);
    },

    /** Get CSRF token */
    getCsrfToken(): Promise<CsrfTokenResponse> {
      return api<CsrfTokenResponse>('/api/csrf-token');
    },

    // --- WebAuthn ---

    /** Get WebAuthn registration options */
    getWebAuthnRegisterOptions(force?: boolean): Promise<WebAuthnOptions> {
      const qs = force ? '?force=true' : '';
      return get<WebAuthnOptions>(`/api/auth/webauthn/register/options${qs}`);
    },

    /** Verify WebAuthn registration */
    verifyWebAuthnRegister(response: unknown): Promise<{ verified: boolean }> {
      return post<{ verified: boolean }>('/api/auth/webauthn/register/verify', response, true);
    },

    /** Get WebAuthn login options */
    getWebAuthnLoginOptions(): Promise<WebAuthnLoginOptions> {
      return api<WebAuthnLoginOptions>('/api/auth/webauthn/login/options');
    },

    /** Verify WebAuthn login */
    verifyWebAuthnLogin(response: unknown): Promise<{
      verified: boolean;
      user?: User;
      accessToken?: string;
      encryptedPrivateKey?: string;
    }> {
      return post('/api/auth/webauthn/login/verify', response);
    },
  },

  // ==========================================
  // USERS
  // ==========================================
  users: {
    /** Get current user profile */
    getMe(): Promise<User & { systemAlert?: { type: 'subscription_expiring'; daysLeft: number } }> {
      return get('/api/users/me');
    },

    /** Update profile */
    updateMe(data: { encryptedProfile?: string; autoDestructDays?: number }): Promise<User> {
      return put<User>('/api/users/me', data);
    },

    /** Delete account */
    deleteMe(data: { password: string; fileKeys?: string[] }): Promise<void> {
      return del<void>('/api/users/me', data);
    },

    /** Get devices */
    getDevices(): Promise<DeviceInfo[]> {
      return get<DeviceInfo[]>('/api/users/me/devices');
    },

    /** Revoke device */
    deleteDevice(deviceId: string): Promise<{ message: string }> {
      return del<{ message: string }>(`/api/users/me/devices/${deviceId}`);
    },

    /** Update E2EE public keys */
    updateKeys(data: {
      publicKey: string;
      pqPublicKey: string;
      signingKey: string;
      encryptedPrivateKeys?: string;
    }): Promise<{ message: string }> {
      return put<{ message: string }>('/api/users/me/keys', data);
    },

    /** Complete onboarding */
    completeOnboarding(): Promise<{ success: boolean }> {
      return post<{ success: boolean }>('/api/users/me/complete-onboarding', undefined, true);
    },

    /** Get blocked users */
    getBlocked(): Promise<Array<{ id: string; encryptedProfile?: string | null; isVerified?: boolean }>> {
      return get('/api/users/me/blocked');
    },

    /** Logout (device-level) */
    logoutDevice(): Promise<{ success: boolean }> {
      return post<{ success: boolean }>('/api/users/me/logout', undefined, true);
    },

    /** Search users by hash */
    search(q: string): Promise<Array<{
      id: string;
      encryptedProfile?: string | null;
      isVerified: boolean;
      hasCompletedOnboarding: boolean;
      publicKey: string | null;
      pqPublicKey: string | null;
      signingKey: string | null;
    }>> {
      return get(`/api/users/search?q=${encodeURIComponent(q)}`);
    },

    /** Get user by ID */
    getById(id: string): Promise<{ id: string; encryptedProfile?: string | null; isVerified: boolean }> {
      return get(`/api/users/${id}`);
    },

    /** Block user */
    block(userId: string): Promise<{ message: string }> {
      return post<{ message: string }>(`/api/users/${userId}/block`, undefined, true);
    },

    /** Unblock user */
    unblock(userId: string): Promise<{ message: string }> {
      return del<{ message: string }>(`/api/users/${userId}/block`);
    },
  },

  // ==========================================
  // CONVERSATIONS
  // ==========================================
  conversations: {
    /** Sync conversations (Opaque Mailbox) */
    sync(ids?: string[]): Promise<ConversationUi[]> {
      const qs = ids && ids.length > 0 ? `?ids=${ids.join(',')}` : '';
      return get<ConversationUi[]>(`/api/conversations/sync${qs}`);
    },

    /** Create conversation */
    create(data: CreateConversationPayload): Promise<ConversationCreateResponse> {
      return post<ConversationCreateResponse>('/api/conversations', data, true);
    },

    /** Get conversation by ID */
    getById(id: string): Promise<ConversationUi> {
      return get<ConversationUi>(`/api/conversations/${id}`);
    },

    /** Delete/hide conversation */
    delete(id: string): Promise<void> {
      return del<void>(`/api/conversations/${id}`);
    },

    /** Update group details */
    updateDetails(id: string, data: {
      encryptedMetadata: string;
      targetRecipients?: string[];
    }, groupToken?: string): Promise<unknown> {
      const headers = groupToken ? { 'x-group-token': groupToken } : undefined;
      return put(`/api/conversations/${id}/details`, data, headers);
    },

    /** Add participants to group */
    addParticipants(id: string, data: {
      userIds: string[];
      targetRecipients?: string[];
    }, groupToken?: string): Promise<Record<string, unknown>[]> {
      const headers = groupToken ? { 'x-group-token': groupToken } : undefined;
      return post<Record<string, unknown>[]>(`/api/conversations/${id}/participants`, data, true, headers);
    },

    /** Remove participant from group */
    removeParticipant(id: string, userId: string, groupToken?: string, targetRecipients?: string[]): Promise<void> {
      const headers = groupToken ? { 'x-group-token': groupToken } : undefined;
      return del<void>(`/api/conversations/${id}/participants/${userId}`, { targetRecipients }, headers);
    },

    /** Leave group */
    leave(id: string, groupToken?: string, targetRecipients?: string[]): Promise<void> {
      const headers = groupToken ? { 'x-group-token': groupToken } : undefined;
      return del<void>(`/api/conversations/${id}/leave`, { targetRecipients }, headers);
    },

    /** Pin/unpin conversation */
    pin(id: string): Promise<{ isPinned: boolean }> {
      return post<{ isPinned: boolean }>(`/api/conversations/${id}/pin`, undefined, true);
    },

    /** Record key rotation */
    recordKeyRotation(id: string): Promise<{ success: boolean; message: string; conversation: Conversation }> {
      return post(`/api/conversations/${id}/key-rotation`, undefined, true);
    },
  },

  // ==========================================
  // MESSAGES
  // ==========================================
  messages: {
    /** Send a message */
    send(data: SendMessagePayload): Promise<Message> {
      return post<Message>('/api/messages', data, true);
    },

    /** Get pending messages for conversation (offline catch-up) */
    get(conversationId: string): Promise<MessagesResponse> {
      return get<MessagesResponse>(`/api/messages/${conversationId}`);
    },

    /** Delete message + file cleanup */
    delete(messageId: string, r2Key?: string): Promise<void> {
      const qs = r2Key ? `?r2Key=${encodeURIComponent(r2Key)}` : '';
      return del<void>(`/api/messages/${messageId}${qs}`);
    },

    /** Mark view-once message as viewed */
    markViewed(messageId: string): Promise<{ success: boolean; message: string }> {
      return put<{ success: boolean; message: string }>(`/api/messages/${messageId}/viewed`);
    },
  },

  // ==========================================
  // ENCRYPTION KEYS
  // ==========================================
  keys: {
    /** Upload pre-key bundle */
    uploadPreKeyBundle(bundle: PreKeyBundleUpload): Promise<{ message: string }> {
      return post<{ message: string }>('/api/keys/prekey-bundle', bundle, true);
    },

    /** Get pre-key bundle for a user (consumes one OTPK) */
    getPreKeyBundle(userId: string): Promise<import('@nyx/shared').IPreKeyBundle> {
      return get<import('@nyx/shared').IPreKeyBundle>(`/api/keys/prekey-bundle/${userId}`);
    },

    /** Bulk fetch pre-key bundles for multiple users */
    getPreKeyBundles(userIds: string[]): Promise<Record<string, import('@nyx/shared').IPreKeyBundle[]>> {
      return post<Record<string, import('@nyx/shared').IPreKeyBundle[]>>('/api/keys/prekey-bundles', { userIds }, true);
    },

    /** Bulk fetch public keys (without consuming OTPKs) */
    getPublicKeys(userIds: string[]): Promise<Record<string, Array<Record<string, unknown>>>> {
      return post('/api/keys/public-keys', { userIds }, true);
    },

    /** Upload one-time pre-keys */
    uploadOtpk(keys: OtpkUpload['keys']): Promise<{ message: string }> {
      return post<{ message: string }>('/api/keys/upload-otpk', { keys }, true);
    },

    /** Count remaining OTPKs */
    countOtpk(): Promise<{ count: number }> {
      return get<{ count: number }>('/api/keys/count-otpk');
    },

    /** Clear all OTPKs */
    clearOtpk(): Promise<void> {
      return del<void>('/api/keys/otpk');
    },

    /** Get TURN credentials */
    getTurnCredentials(): Promise<{ iceServers: Array<{ urls: string; username?: string; credential?: string }> }> {
      return get('/api/keys/turn');
    },

    /** Get initial session key data */
    getInitialSession(conversationId: string, sessionId: string): Promise<{
      encryptedKey: string;
      initiatorCiphertextsStr: string;
      initiatorSigningKey: string;
    }> {
      return get(`/api/keys/initial-session/${conversationId}/${sessionId}`);
    },
  },

  // ==========================================
  // SESSION KEYS
  // ==========================================
  sessionKeys: {
    /** Get session keys for a conversation+device */
    get(conversationId: string, deviceId: string): Promise<Array<{
      sessionId: string;
      encryptedKey: string;
      initiatorCiphertexts: string | null;
    }>> {
      return get(`/api/session-keys/${conversationId}/devices/${deviceId}`);
    },

    /** Relay ratcheted session keys */
    ratchet(conversationId: string, data: {
      sessionId: string;
      keys: Array<{
        deviceId: string;
        encryptedKey: string;
        isInitiator?: boolean;
        encryptedOriginalKey?: string;
      }>;
    }): Promise<{ ok: boolean; sessionId: string }> {
      return post(`/api/session-keys/${conversationId}/ratchet`, data, true);
    },
  },

  // ==========================================
  // UPLOADS
  // ==========================================
  uploads: {
    /** Generate presigned upload URL (authenticated) */
    getPresignedUrl(data: {
      fileName: string;
      fileType: 'application/octet-stream';
      folder: 'avatars' | 'attachments' | 'groups';
      fileSize?: number;
      fileRetention?: number;
    }): Promise<PresignedUploadResponse> {
      return post<PresignedUploadResponse>('/api/uploads/presigned', data, true);
    },

    /** Generate burner presigned URL (no auth) */
    getBurnerPresignedUrl(data: {
      fileName: string;
      fileType: 'application/octet-stream';
      folder: 'attachments';
      fileSize?: number;
      fileRetention?: number;
    }): Promise<PresignedUploadResponse> {
      return post<PresignedUploadResponse>('/api/uploads/burner-presigned', data);
    },

    /** Upload group avatar */
    uploadGroupAvatar(groupId: string, fileUrl: string): Promise<{ fileUrl: string; fileKey?: string }> {
      return post<{ fileUrl: string; fileKey?: string }>(`/api/uploads/groups/${groupId}/avatar`, { fileUrl }, true);
    },
  },

  // ==========================================
  // SYSTEM
  // ==========================================
  system: {
    /** Get system status */
    getStatus(): Promise<SystemStatusResponse> {
      return api<SystemStatusResponse>('/api/system/status');
    },

    /** Get OpenAPI spec */
    getOpenApiSpec(): Promise<Record<string, unknown>> {
      return api<Record<string, unknown>>('/api/system/openapi.json');
    },

    /** Health check */
    health(): Promise<HealthResponse> {
      return api<HealthResponse>('/health');
    },
  },

  // ==========================================
  // SESSIONS
  // ==========================================
  sessions: {
    /** List active sessions */
    list(): Promise<SessionsResponse> {
      return get<SessionsResponse>('/api/sessions');
    },

    /** Revoke a specific session by JTI */
    revoke(jti: string): Promise<void> {
      return del<void>(`/api/sessions/${jti}`);
    },
  },

  // ==========================================
  // AI
  // ==========================================
  ai: {
    /** Generate smart replies */
    smartReply(message: string): Promise<SmartReplyResponse> {
      return post<SmartReplyResponse>('/api/ai/smart-reply', { message }, true);
    },
  },

  // ==========================================
  // LINK PREVIEWS
  // ==========================================
  previews: {
    /** Get link preview metadata */
    getLinkPreview(url: string): Promise<LinkPreviewResponse> {
      return post<LinkPreviewResponse>('/api/previews', { url }, true);
    },

    /** Proxy preview image (returns blob) */
    async getPreviewImage(url: string): Promise<Blob> {
      const res = await fetch(`/api/previews/image?url=${encodeURIComponent(url)}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to proxy image: ${res.status}`);
      return res.blob();
    },
  },

  // ==========================================
  // REPORTS
  // ==========================================
  reports: {
    /** Submit bug report */
    submitBug(data: { title: string; description: string; deviceInfo?: string }): Promise<{ success: boolean }> {
      return post<{ success: boolean }>('/api/reports', data, true);
    },

    /** Report a user */
    reportUser(reportedUserId: string, reason: string): Promise<{ success: boolean }> {
      return post<{ success: boolean }>('/api/reports/user', { reportedUserId, reason }, true);
    },
  },

  // ==========================================
  // SUBSCRIPTIONS
  // ==========================================
  subscriptions: {
    /** Create Tripay payment */
    createPayment(method?: string): Promise<SubscriptionCreateResponse> {
      return post<SubscriptionCreateResponse>('/api/subscriptions/create', { method }, true);
    },

    /** Create crypto invoice via NOWPayments */
    createCryptoInvoice(): Promise<CryptoInvoiceResponse> {
      return post<CryptoInvoiceResponse>('/api/subscriptions/create-crypto-transaction', undefined, true);
    },
  },

  // ==========================================
  // ENGINE (B2B)
  // ==========================================
  engine: {
    /** Create B2B encrypted conversation room */
    createRoom(data: {
      userA: { externalId: string; displayName?: string };
      userB: { externalId: string; displayName?: string };
      metadata?: Record<string, unknown>;
    }): Promise<B2BRoomResponse> {
      return post<B2BRoomResponse>('/api/engine/rooms', data, true);
    },
  },

  // ==========================================
  // STORIES
  // ==========================================
  stories: {
    /** Create a story */
    create(encryptedPayload: string): Promise<{ id: string; senderId: string; encryptedPayload: string; expiresAt: string }> {
      return post('/api/stories', { encryptedPayload }, true);
    },

    /** Get active stories for a user */
    getUserStories(userId: string): Promise<Array<{
      id: string; senderId: string; encryptedPayload: string; createdAt: string; expiresAt: string;
    }>> {
      return get(`/api/stories/user/${userId}`);
    },

    /** Get story by ID */
    getById(storyId: string): Promise<{
      id: string; senderId: string; encryptedPayload: string; createdAt: string; expiresAt: string;
    }> {
      return get(`/api/stories/${storyId}`);
    },

    /** Delete own story */
    delete(storyId: string): Promise<{ success: boolean }> {
      return del<{ success: boolean }>(`/api/stories/${storyId}`);
    },
  },
} as const;

export default apiClient;
