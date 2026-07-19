// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import * as Sentry from '@sentry/react';
import { transportClient, emitSessionKeyRequest } from './transportClient';
import { useMessageStore } from '../store/message';
import { useConversationStore } from '../store/conversation';
import { useAuthStore } from '../store/auth';
import { captureAndLog } from '@utils/feedback';
import { useConnectionStore } from '../store/connection';
import { usePresenceStore } from '../store/presence';
import { RawServerMessageSchema, type RawServerMessage, type Message, type Participant, type User, type BinaryPayload, type Conversation, asMessageId, asConversationId, asUserId } from '@nyx/shared';

let isInitialized = false;

// Module-level state for offline sync (lives across reconnects)
let syncCompleted = false;
let unsubConversation: (() => void) | null = null;

// Shared sync function — accessible from both connect handler and subscription
async function doSyncMessages() {
  if (syncCompleted) return;
  try {
    const conversations = useConversationStore.getState().conversations;
    if (conversations.length === 0) return;

    syncCompleted = true;
    const messageStore = useMessageStore.getState();
    let syncedCount = 0;
    for (const conv of conversations) {
      if (conv.id.startsWith('burner_')) continue;
      if (conv.isGroup && !conv.decryptedMetadata) continue;
      await messageStore.loadMessagesForConversation(conv.id);
      syncedCount++;
    }
    console.log(`[Offline Sync] Fetched pending messages for ${syncedCount} conversations`);
  } catch (e) {
    console.error('[Offline Sync] Failed to sync messages on connect:', e);
  }
}

export function initSocketListeners() {
  if (isInitialized) return;
  isInitialized = true;

  console.log('[Socket] Initializing listeners...');

  // Register Zustand subscription ONCE (no leak on reconnect)
  unsubConversation = useConversationStore.subscribe((state, prevState) => {
    if (!syncCompleted && state.conversations.length > 0 && prevState.conversations.length === 0) {
      doSyncMessages();
    }
  });

  transportClient.on('connect', () => {
    Sentry.addBreadcrumb({ category: 'socket', message: 'Connected', level: 'info' });
    console.log('[Socket] Connected');
    useConnectionStore.getState().setStatus('connected');
    
    // User is active by default on connect
    transportClient.sendEvent('user:active');

    // Offline Sync: fetch pending messages for all active conversations
    // Reset sync flag on each connect so new messages are fetched
    syncCompleted = false;

    // Uses polling + Zustand subscription for reliable init regardless of load order
    let syncAttempts = 0;
    const maxSyncAttempts = 8;
    const pollSyncMessages = async () => {
      if (syncCompleted) return;
      const conversations = useConversationStore.getState().conversations;
      if (conversations.length === 0) {
        if (syncAttempts < maxSyncAttempts) {
          syncAttempts++;
          setTimeout(pollSyncMessages, 500);
        }
        return;
      }
      await doSyncMessages();
    };
    // Polling fallback: start after a short delay
    setTimeout(pollSyncMessages, 300);
  });

  transportClient.on('disconnect', (reason) => {
    Sentry.addBreadcrumb({ category: 'socket', message: `Disconnected: ${reason}`, level: 'warning' });
    console.log('[Socket] Disconnected:', reason);
    useConnectionStore.getState().setStatus('disconnected');

    if (reason === 'Logged in on another device') {
      const { logout } = useAuthStore.getState();
      logout().then(() => {
        window.location.href = `/login?reason=kicked&msg=${encodeURIComponent(reason)}`;
      });
    }
  });

  // 1. MESSAGES
  transportClient.on('message:new', async (payload: BinaryPayload | RawServerMessage) => {
    let rawMsg: RawServerMessage;
    if (payload instanceof Uint8Array) {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(payload));
        rawMsg = RawServerMessageSchema.parse(parsed);
      } catch (e) {
        console.error("[Socket] Failed to decode message:new payload", e);
        return;
      }
    } else {
      rawMsg = RawServerMessageSchema.parse(payload);
    }

    Sentry.addBreadcrumb({
      category: 'message',
      message: `Incoming message in conv=${rawMsg.conversationId.slice(0, 8)}`,
      level: 'info',
      data: { conversationId: rawMsg.conversationId },
    });

    try {
      // Convert RawServerMessage to Message by applying branded types
      const msgForStore = {
        ...rawMsg,
        id: asMessageId(rawMsg.id),
        conversationId: asConversationId(rawMsg.conversationId),
        senderId: asUserId(rawMsg.senderId),
        createdAt: rawMsg.createdAt,
        reactions: [] as Message['reactions'],
        sender: rawMsg.sender ? { ...rawMsg.sender, id: asUserId(rawMsg.sender.id) } : undefined,
        repliedToId: rawMsg.repliedToId ? asMessageId(rawMsg.repliedToId) : undefined,
      } as Message;
      
      const msg = await useMessageStore.getState().addIncomingMessage(rawMsg.conversationId, msgForStore);
      if (msg) {
        useConversationStore.getState().updateConversationLastMessage(rawMsg.conversationId, msg);
      }
    } catch (e) {
      console.error("[Socket] Error handling message:new:", e);
    }
  });

  transportClient.on('message:updated', (data: Partial<RawServerMessage> & { id: string, conversationId: string }) => {
    useMessageStore.getState().updateMessage(data.conversationId, data.id, data as Partial<Message>);
  });

  transportClient.on('message:deleted', (data: { conversationId: string; id: string }) => {
    useMessageStore.getState().updateMessage(data.conversationId, data.id, { isDeletedLocal: true, content: null });
  });

  transportClient.on('message:status_updated', (data: { conversationId: string; messageId: string; userId: string; status: string }) => {
    useMessageStore.getState().updateMessageStatus(data.conversationId, data.messageId, data.userId, data.status);
  });

  // 2. CONVERSATIONS
  transportClient.on('conversation:new', (conversation: Conversation) => {
    useConversationStore.getState().addOrUpdateConversation(conversation);
  });

  transportClient.on('conversation:updated', (data: Partial<Conversation> & { id: string }) => {
    useConversationStore.getState().updateConversation(data.id, data);
  });

  transportClient.on('conversation:deleted', (data: { id: string }) => {
    useConversationStore.getState().removeConversation(data.id);
  });

  transportClient.on('conversation:participants_added', (data: { conversationId: string; participants: Participant[] }) => {
    useConversationStore.getState().addParticipants(data.conversationId, data.participants);
  });

  transportClient.on('conversation:participant_removed', (data: { conversationId: string; userId: string }) => {
    useConversationStore.getState().removeParticipant(data.conversationId, data.userId);
  });

  transportClient.on('conversation:participant_updated', (data: { conversationId: string; userId: string; role: 'ADMIN' | 'MEMBER' | 'admin' | 'member' }) => {
    useConversationStore.getState().updateParticipantRole(data.conversationId, data.userId, data.role.toUpperCase() as 'ADMIN' | 'MEMBER');
  });

  // 3. USERS
  transportClient.on('user:updated', (user: Partial<User>) => {
    useConversationStore.getState().updateParticipantDetails(user);
    useMessageStore.getState().updateSenderDetails(user);
  });

  // 4. PRESENCE
  transportClient.on('presence:update', (payload: BinaryPayload) => {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(payload)) as unknown;
      const data = typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
      if (data.type === 'bulk' && Array.isArray(data.userIds)) {
        usePresenceStore.getState().setOnlineUsers(Array.from(data.userIds as unknown[], id => String(id)));
      } else if (data.type === 'join' && typeof data.userId === 'string') {
        usePresenceStore.getState().userJoined(data.userId);
      } else if (data.type === 'leave' && typeof data.userId === 'string') {
        usePresenceStore.getState().userLeft(data.userId);
      } else if (data.type === 'typing' && typeof data.userId === 'string') {
        usePresenceStore.getState().addOrUpdate({
          id: data.userId,
          conversationId: typeof data.conversationId === 'string' ? data.conversationId : '',
          isTyping: Boolean(data.isTyping)
        });
      }
    } catch (e) {}
  });

  // 5. SECURITY & SESSIONS
  transportClient.on('force_logout', async (data: { jti: string }) => {
     Sentry.addBreadcrumb({ category: 'auth', message: 'Force logout (session revoked)', level: 'warning', data: { jti: data.jti } });
     // Check if current session is revoked
     const { logout } = useAuthStore.getState();
     await logout();
     window.location.href = '/login?reason=revoked';
  });

  transportClient.on('auth:banned', async (data: { reason: string }) => {
     Sentry.captureMessage('User banned from platform', { level: 'warning', tags: { reason: data.reason } });
     const { logout } = useAuthStore.getState();
     await logout();
     window.location.href = `/login?reason=banned&msg=${encodeURIComponent(data.reason)}`;
  });

  // 6. KEY MANAGEMENT
  transportClient.on('session:request_key_fulfillment', (data: unknown) => {
    // This is handled in transportClient helpers usually, but we can hook it here if needed
  });

  transportClient.on('session:new_key', (data: { conversationId: string; sessionId?: string; encryptedKey: string; type?: 'GROUP_KEY' | 'SESSION_KEY'; senderId?: string; senderDeviceKey?: string }) => {
    import('../utils/crypto').then(m => m.storeReceivedSessionKey(data))
      .then(() => {
        import('../store/keychain').then(m => m.useKeychainStore.getState().keysUpdated());
        // storeReceivedSessionKey already schedules reDecryptPendingMessages internally
        // when metadata is decrypted. Don't call it here unconditionally — it would
        // advance the sender key ratchet (CK N=0→N=1) before group metadata decrypts.
      })
      .catch(captureAndLog);
  });
  
  transportClient.on('session:fulfill_request', (data: { conversationId: string; sessionId: string; requesterId: string; requesterPublicKey: string; requesterPqPublicKey: string }) => {
    import('../utils/crypto').then(m => m.fulfillKeyRequest(data).catch(captureAndLog));
  });

  transportClient.on('group:fulfill_key_request', (data: { conversationId: string; requesterId: string; requesterPublicKey: string; requesterPqPublicKey: string; requesterDeviceId?: string }) => {
    import('../utils/crypto').then(m => m.fulfillGroupKeyRequest(data).catch(captureAndLog));
  });

  transportClient.on('group:key_request_failed', (data: { conversationId: string; reason: string }) => {
    Sentry.captureMessage('Group key request failed', { level: 'warning', tags: { conversationId: data.conversationId, reason: data.reason } });
    console.error(`Group Key Request Failed for ${data.conversationId}:`, data.reason);
  });

  transportClient.on('session:request_key_failed', (data: { sessionId: string; targetId: string; reason: string }) => {
    Sentry.captureMessage('Session key request failed', { level: 'warning', tags: { sessionId: data.sessionId, targetId: data.targetId, reason: data.reason } });
    console.error(`Session Key Request Failed for ${data.sessionId}:`, data.reason);
  });

  // 7. BURNER CHATS
  transportClient.on("burner:receive", async (payload: { roomId?: string, ciphertext: string }) => {
    const { useBurnerStore } = await import('../store/burner');
    const roomId = payload.roomId || Object.keys(useBurnerStore.getState().activeSessions)[0];
    if (roomId) {
      await useBurnerStore.getState().receiveMessage(roomId, payload.ciphertext);
    }
  });

  transportClient.on("burner:terminated", async (payload: { roomId: string }) => {
    const { useBurnerStore } = await import('../store/burner');
    if (payload?.roomId) {
      useBurnerStore.getState().terminateSession('This secure session has been terminated by the host.');
      useConversationStore.getState().removeConversation(payload.roomId);
    }
  });
}

