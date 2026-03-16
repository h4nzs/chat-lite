// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { api, authFetch } from '@lib/api';
import { hashUsername } from '@lib/crypto-worker-proxy';
import type { Conversation, Participant } from '@store/conversation';

/**
 * Search users by usernameHash
 */
export const searchUsersApi = async (query: string) => {
  if (!query.trim()) return [];

  // Check if query is already a usernameHash (base64url format, exactly 43 chars)
  const trimmedQuery = query.trim();
  const isAlreadyHash = /^[A-Za-z0-9_-]{43}$/.test(trimmedQuery);

  const searchQuery = isAlreadyHash
    ? trimmedQuery
    : await hashUsername(trimmedQuery);

  const safeQuery = encodeURIComponent(searchQuery);
  const users = await api<Array<{
    id: string;
    encryptedProfile?: string | null;
    isVerified?: boolean;
    publicKey?: string;
  }>>(`/api/users/search?q=${safeQuery}`);
  
  return users;
};

/**
 * Create a new 1-on-1 conversation
 */
export const createConversationApi = async (
  peerId: string,
  optimisticProfile?: { name: string; username: string }
) => {
  const conv = await authFetch<Conversation>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({
      userIds: [peerId],
      isGroup: false,
      initialSession: null,
    }),
  });

  // Inject Optimistic Profile
  if (optimisticProfile) {
    conv.participants = conv.participants.map(p => {
      if (p.id === peerId) {
        return { ...p, ...optimisticProfile };
      }
      return p;
    });
  }

  return conv;
};

/**
 * Create a new group conversation
 */
export const createGroupConversationApi = async (
  title: string,
  participantIds: string[],
  encryptedProfile?: string
) => {
  const conv = await authFetch<Conversation>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({
      userIds: participantIds,
      isGroup: true,
      title,
      encryptedProfile,
    }),
  });

  return conv;
};

/**
 * Update conversation details
 */
export const updateConversationApi = async (
  conversationId: string,
  data: Partial<Conversation>
) => {
  const response = await authFetch<Conversation>(`/api/conversations/${conversationId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  return response;
};

/**
 * Delete a conversation or group
 */
export const deleteConversationApi = async (
  conversationId: string,
  isGroup: boolean
) => {
  const response = await authFetch(`/api/conversations/${conversationId}`, {
    method: 'DELETE',
  });

  return response;
};

/**
 * Add participants to a group
 */
export const addParticipantsApi = async (
  conversationId: string,
  userIds: string[]
) => {
  const response = await authFetch<Participant[]>(
    `/api/conversations/${conversationId}/participants`,
    {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    }
  );

  return response;
};

/**
 * Remove a participant from a group
 */
export const removeParticipantApi = async (
  conversationId: string,
  targetUserId: string
) => {
  const response = await authFetch(
    `/api/conversations/${conversationId}/participants/${targetUserId}`,
    {
      method: 'DELETE',
    }
  );

  return response;
};

/**
 * Update a participant's role in a group
 */
export const updateParticipantRoleApi = async (
  conversationId: string,
  targetUserId: string,
  role: 'ADMIN' | 'MEMBER'
) => {
  const response = await authFetch(
    `/api/conversations/${conversationId}/participants/${targetUserId}/role`,
    {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }
  );

  return response;
};

/**
 * Toggle pinned status for a conversation
 */
export const togglePinnedConversationApi = async (
  conversationId: string,
  isPinned: boolean
) => {
  const response = await authFetch<{ isPinned: boolean }>(
    `/api/conversations/${conversationId}/pin`,
    {
      method: 'POST',
    }
  );

  return response;
};

/**
 * Mark conversation as read
 */
export const markConversationAsReadApi = async (conversationId: string) => {
  const response = await authFetch(`/api/conversations/${conversationId}/read`, {
    method: 'POST',
  });

  return response;
};

/**
 * Load all conversations for the current user
 */
export const loadConversationsApi = async () => {
  const rawConversations = await api<Array<Record<string, unknown>>>('/api/conversations');
  
  if (!Array.isArray(rawConversations)) {
    throw new Error('Invalid data from server.');
  }

  return rawConversations;
};
