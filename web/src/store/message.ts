// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { createWithEqualityFn } from 'zustand/traditional';
import { api } from '@lib/api';
import { emitSessionKeyRequest, emitGroupKeyDistribution } from '@lib/socket';
import { addToQueue, getQueueItems, removeFromQueue, updateQueueAttempt } from '@lib/offlineQueueDb';
import { useAuthStore, type User } from '@store/auth';
import { useConversationStore } from '@store/conversation';
import { shadowVault, saveStoryKey } from '@lib/shadowVaultDb';
import toast from 'react-hot-toast';
import type { Message, Participant } from '@store/conversation';
import useDynamicIslandStore, { UploadActivity } from './dynamicIsland';
import { decryptMessageObject, processMessagesAndReactions, enrichMessagesWithSenderProfile } from '@services/messageDecryption.service';
import {
  sendMessageLogic,
  fetchMessagesLogic,
  handleIncomingMessage,
  handleReactionLogic,
  processOfflineQueue
} from '@services/messageHandler.service';

const incomingMessageLocks = new Map<string, Promise<void>>();

type State = {
  messages: Record<string, Message[]>;
  replyingTo: Message | null;
  isFetchingMore: Record<string, boolean>;
  hasMore: Record<string, boolean>;
  typingLinkPreview: Record<string, unknown> | null;
  hasLoadedHistory: Record<string, boolean>;
  selectedMessageIds: string[];
};

type Actions = {
  setReplyingTo: (message: Message | null) => void;
  fetchTypingLinkPreview: (text: string) => void;
  clearTypingLinkPreview: () => void;
  sendReaction: (conversationId: string, messageId: string, emoji: string) => Promise<void>;
  uploadFile: (conversationId: string, file: File) => Promise<void>;
  loadMessagesForConversation: (id: string) => Promise<void>;
  loadPreviousMessages: (conversationId: string) => Promise<void>;
  loadMessageContext: (messageId: string) => Promise<void>;
  addOptimisticMessage: (conversationId: string, message: Message) => void;
  addIncomingMessage: (conversationId: string, message: Message) => Promise<Message | null>;
  doAddIncomingMessage: (conversationId: string, message: Message) => Promise<Message | null>;
  replaceOptimisticMessage: (conversationId: string, tempId: number, newMessage: Partial<Message>) => Promise<void>;
  removeMessage: (conversationId: string, messageId: string) => void;
  removeMessages: (conversationId: string, messageIds: string[]) => Promise<void>;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  addLocalReaction: (conversationId: string, messageId: string, reaction: { id: string; emoji: string; tempId?: string }) => void;
  removeLocalReaction: (conversationId: string, messageId: string, reactionId: string) => void;
  replaceOptimisticReaction: (conversationId: string, messageId: string, tempId: string, finalReaction: { id: string; emoji: string }) => void;
  updateSenderDetails: (user: Partial<User>) => void;
  updateMessageStatus: (conversationId: string, messageId: string, userId: string, status: string) => void;
  clearMessagesForConversation: (conversationId: string) => void;
  retrySendMessage: (message: Message) => void;
  addSystemMessage: (conversationId: string, content: string) => void;
  reDecryptPendingMessages: (conversationId: string) => Promise<void>;
  failPendingMessages: (conversationId: string, reason: string) => void;
  processOfflineQueue: () => Promise<void>;
  reset: () => void;
  resendPendingMessages: () => void;
  sendMessage: (conversationId: string, data: Partial<Message>, tempId?: number, isSilent?: boolean) => Promise<void>;
  toggleMessageSelection: (id: string) => void;
  clearMessageSelection: () => void;
  repairSecureSession: (conversationId: string, isGroup: boolean, isAuto?: boolean) => Promise<void>;
};

let tempIdCounter = 0;
const generateTempId = () => Date.now() * 1000 + (++tempIdCounter) + Math.floor(Math.random() * 1000);

const initialState: State = {
  messages: {},
  isFetchingMore: {},
  hasMore: {},
  hasLoadedHistory: {},
  replyingTo: null,
  typingLinkPreview: null,
  selectedMessageIds: [],
};

export const useMessageStore = createWithEqualityFn<State & Actions>((set, get) => ({
  ...initialState,

  reset: () => {
    set(initialState);
  },

  toggleMessageSelection: (id) =>
    set((state) => ({
      selectedMessageIds: state.selectedMessageIds.includes(id)
        ? state.selectedMessageIds.filter((x) => x !== id)
        : [...state.selectedMessageIds, id]
    })),

  clearMessageSelection: () => set({ selectedMessageIds: [] }),

  repairSecureSession: async (conversationId, isGroup, isAuto = false) => {
    try {
      if (isGroup) {
        const { forceRotateGroupSenderKey, rotateGroupKey } = await import('@utils/crypto');
        await forceRotateGroupSenderKey(conversationId);
        await rotateGroupKey(conversationId, 'periodic_rotation');
      } else {
        const { deleteRatchetSession } = await import('@utils/crypto');
        await deleteRatchetSession(conversationId);
        get().sendMessage(conversationId, { content: JSON.stringify({ type: 'GHOST_SYNC' }), isSilent: true });
      }
      if (!isAuto) {
        toast.success('Secure session state reset. Next message will negotiate new keys.');
      }
    } catch (error) {
      console.error('Failed to repair session:', error);
      if (!isAuto) toast.error('Failed to repair session.');
    }
  },

  removeMessages: async (conversationId, messageIds) => {
    const { user } = useAuthStore.getState();
    const currentMessages = get().messages[conversationId] || [];
    const selectedMessages = currentMessages.filter((m) => messageIds.includes(m.id));
    const allMine = user && selectedMessages.every((m) => m.senderId === user.id);

    // 1. Delete from Server (only if all are mine)
    if (allMine) {
      selectedMessages.forEach((message) => {
        let query = '';
        let targetUrl = message.fileUrl;
        try {
          if (message.content && message.content.startsWith('{')) {
            const metadata = JSON.parse(message.content);
            if (metadata.url) targetUrl = metadata.url;
          }
        } catch {
          // Ignore parse errors
        }

        if (targetUrl && !targetUrl.startsWith('blob:')) {
          try {
            const url = new URL(targetUrl);
            const key = url.pathname.substring(1);
            if (key) query = `?r2Key=${encodeURIComponent(key)}`;
          } catch {
            console.error('Failed to parse file URL for deletion:');
          }
        }

        api(`/api/messages/${message.id}${query}`, { method: 'DELETE' }).catch((error) => {
          console.error(`Failed to delete message ${message.id} from server:`, error);
        });
      });
    }

    // 2. TOMBSTONE in local vault & Wipe MK (Always)
    const tombstones: Message[] = [];
    for (const id of messageIds) {
      const existing = selectedMessages.find((m) => m.id === id);
      if (existing) {
        tombstones.push({ ...existing, content: null, fileUrl: undefined, isDeletedLocal: true });
      } else {
        tombstones.push({ id, conversationId, isDeletedLocal: true, createdAt: new Date().toISOString(), senderId: 'unknown' } as Message);
      }
      import('@utils/crypto')
        .then((m) => m.deleteMessageKeySecurely(id))
        .catch(console.error);
    }
    shadowVault.upsertMessages(tombstones).catch(console.error);

    // 3. Remove from active state
    set((state) => {
      const current = state.messages[conversationId] || [];
      return {
        messages: { ...state.messages, [conversationId]: current.filter((m) => !messageIds.includes(m.id)) },
        selectedMessageIds: []
      };
    });
  },

  setReplyingTo: (message: Message | null) => set({ replyingTo: message }),

  fetchTypingLinkPreview: async (text: string) => {
    try {
      const res = await api('/api/previews/link', { method: 'POST', body: JSON.stringify({ text }) });
      set({ typingLinkPreview: res });
    } catch {
      set({ typingLinkPreview: null });
    }
  },

  clearTypingLinkPreview: () => set({ typingLinkPreview: null }),

  sendReaction: async (conversationId, messageId, emoji) => {
    const result = await handleReactionLogic(conversationId, messageId, emoji);
    if (!result.success) {
      toast.error(result.error || 'Failed to send reaction');
    }
  },

  uploadFile: async (conversationId, file) => {
    const activityId = Date.now().toString();
    useDynamicIslandStore.getState().addActivity({
      id: activityId,
      type: 'upload',
      title: file.name,
      progress: 0
    } as unknown as UploadActivity);

    try {
      const { compressImage } = await import('@lib/fileUtils');
      const { encryptFile } = await import('@utils/crypto');
      let fileToUpload = file;

      if (file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file);
      }

      const { encryptedBlob, key: rawFileKey } = await encryptFile(fileToUpload);

      const presignedRes = await api<{ uploadUrl: string; publicUrl: string; key: string }>('/api/uploads/presigned', {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          fileType: 'application/octet-stream',
          folder: 'attachments',
          fileSize: encryptedBlob.size
        })
      });

      await fetch(presignedRes.uploadUrl, {
        method: 'PUT',
        body: encryptedBlob,
        headers: { 'Content-Type': 'application/octet-stream' }
      });

      const metadata = {
        type: 'file',
        url: presignedRes.publicUrl,
        key: rawFileKey,
        name: file.name,
        size: file.size,
        mimeType: file.type
      };

      get().sendMessage(conversationId, {
        content: JSON.stringify(metadata),
        fileUrl: presignedRes.publicUrl,
        fileKey: rawFileKey,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      useDynamicIslandStore.getState().updateActivity(activityId, { progress: 100 } as unknown as Partial<UploadActivity>);
      setTimeout(() => useDynamicIslandStore.getState().removeActivity(activityId), 1000);
    } catch (error) {
      console.error('Upload error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      toast.error(`File upload failed: ${errorMsg}`);
      useDynamicIslandStore.getState().removeActivity(activityId);
    }
  },

  loadMessagesForConversation: async (id) => {
    if (get().hasLoadedHistory[id]) return;

    set((state) => ({
      isFetchingMore: { ...state.isFetchingMore, [id]: true }
    }));

    try {
      const { messages, hasMore } = await fetchMessagesLogic(id);

      set((state) => ({
        messages: { ...state.messages, [id]: messages },
        hasMore: { ...state.hasMore, [id]: hasMore },
        hasLoadedHistory: { ...state.hasLoadedHistory, [id]: true },
        isFetchingMore: { ...state.isFetchingMore, [id]: false }
      }));
    } catch (error) {
      console.error('Failed to load messages:', error);
      set((state) => ({
        isFetchingMore: { ...state.isFetchingMore, [id]: false }
      }));
    }
  },

  loadPreviousMessages: async (conversationId) => {
    const state = get();
    if (state.isFetchingMore[conversationId] || !state.hasMore[conversationId]) return;

    const messages = state.messages[conversationId] || [];
    const oldestMessage = messages[0];
    if (!oldestMessage) return;

    set((state) => ({
      isFetchingMore: { ...state.isFetchingMore, [conversationId]: true }
    }));

    try {
      const { messages: newMessages, hasMore } = await fetchMessagesLogic(conversationId, oldestMessage.id);

      set((state) => {
        const existingMessages = state.messages[conversationId] || [];
        const combined = [...newMessages, ...existingMessages];
        const processed = processMessagesAndReactions(combined);

        return {
          messages: { ...state.messages, [conversationId]: processed },
          hasMore: { ...state.hasMore, [conversationId]: hasMore },
          isFetchingMore: { ...state.isFetchingMore, [conversationId]: false }
        };
      });
    } catch (error) {
      console.error('Failed to load previous messages:', error);
      set((state) => ({
        isFetchingMore: { ...state.isFetchingMore, [conversationId]: false }
      }));
    }
  },

  loadMessageContext: async (messageId) => {
    try {
      const res = await api<{ items: Message[]; conversationId: string }>(`/api/messages/context/${messageId}`);
      const decryptedItems: Message[] = [];

      for (const item of res.items) {
        const decrypted = await decryptMessageObject(item);
        decryptedItems.push(decrypted);
      }

      const enrichedMessages = enrichMessagesWithSenderProfile(res.conversationId, decryptedItems);
      const processedMessages = processMessagesAndReactions(enrichedMessages);

      set((state) => ({
        messages: { ...state.messages, [res.conversationId]: processedMessages }
      }));
    } catch (error) {
      console.error('Failed to load message context:', error);
    }
  },

  addOptimisticMessage: (conversationId, message) => {
    set((state) => {
      const current = state.messages[conversationId] || [];
      return {
        messages: { ...state.messages, [conversationId]: [...current, message] }
      };
    });
  },

  addIncomingMessage: async (conversationId, message) => {
    const state = get();
    const existingMessage = state.messages[conversationId]?.find((m) => m.id === message.id);
    if (existingMessage) {
      return null;
    }

    const lockKey = `${conversationId}:${message.id}`;
    const existingLock = incomingMessageLocks.get(lockKey);
    if (existingLock) {
      await existingLock;
      return null;
    }

    const lockPromise: Promise<Message | null> = (async () => {
      try {
        const processedMessage = await handleIncomingMessage(message);
        if (!processedMessage) return null;

        set((state) => {
          const current = state.messages[conversationId] || [];
          if (current.some((m) => m.id === processedMessage!.id)) {
            return state;
          }
          return {
            messages: { ...state.messages, [conversationId]: [...current, processedMessage!] }
          };
        });

        return processedMessage;
      } finally {
        incomingMessageLocks.delete(lockKey);
      }
    })();

    incomingMessageLocks.set(lockKey, lockPromise as unknown as Promise<void>);
    return lockPromise;
  },

  doAddIncomingMessage: async (conversationId, message) => {
    const processedMessage = await handleIncomingMessage(message);
    if (!processedMessage) return null;

    set((state) => {
      const current = state.messages[conversationId] || [];
      if (current.some((m) => m.id === processedMessage!.id)) {
        return state;
      }
      return {
        messages: { ...state.messages, [conversationId]: [...current, processedMessage!] }
      };
    });

    return processedMessage;
  },

  replaceOptimisticMessage: async (conversationId, tempId, newMessage) => {
    set((state) => {
      const current = state.messages[conversationId] || [];
      const index = current.findIndex((m) => m.tempId === tempId);
      if (index === -1) return state;

      const updated = [...current];
      updated[index] = { ...updated[index], ...newMessage };
      return {
        messages: { ...state.messages, [conversationId]: updated }
      };
    });
  },

  removeMessage: (conversationId, messageId) => {
    set((state) => {
      const current = state.messages[conversationId] || [];
      return {
        messages: { ...state.messages, [conversationId]: current.filter((m) => m.id !== messageId) }
      };
    });
  },

  updateMessage: (conversationId, messageId, updates) => {
    set((state) => {
      const current = state.messages[conversationId] || [];
      const index = current.findIndex((m) => m.id === messageId);
      if (index === -1) return state;

      const updated = [...current];
      updated[index] = { ...updated[index], ...updates };
      return {
        messages: { ...state.messages, [conversationId]: updated }
      };
    });
  },

  addLocalReaction: (conversationId, messageId, reaction) => {
    const userId = useAuthStore.getState().user?.id || '';
    set((state) => {
      const currentMessages = state.messages[conversationId] || [];
      const updatedMessages = currentMessages.map((m) => {
        if (m.id === messageId) {
          const newReactions = [...(m.reactions || [])];
          if (!newReactions.some((r) => r.id === reaction.id)) {
            newReactions.push({ ...reaction, userId, isMessage: true });
          }
          return { ...m, reactions: newReactions };
        }
        return m;
      });
      return {
        messages: { ...state.messages, [conversationId]: updatedMessages }
      };
    });
  },

  removeLocalReaction: (conversationId, messageId, reactionId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, reactions: (m.reactions || []).filter((r) => r.id !== reactionId) } : m
        )
      }
    })),

  replaceOptimisticReaction: (conversationId, messageId, tempId, finalReaction) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) => {
          if (m.id === messageId) {
            return {
              ...m,
              reactions: (m.reactions || []).map((r) => (r.id === tempId ? finalReaction : r))
            };
          }
          return m;
        })
      }
    })),

  updateSenderDetails: (user) =>
    set((state) => {
      const newMessages = { ...state.messages };
      for (const convoId in newMessages) {
        newMessages[convoId] = newMessages[convoId].map((m) =>
          m.sender?.id === user.id ? { ...m, sender: { id: user.id || m.sender!.id, encryptedProfile: user.encryptedProfile, name: user.name, username: user.username, avatarUrl: user.avatarUrl } } : m
        ) as Message[];
      }
      return { messages: newMessages as Record<string, Message[]> };
    }),

  updateMessageStatus: (conversationId, messageId, userId, status) => {
    set((state) => {
      const current = state.messages[conversationId] || [];
      const message = current.find((m) => m.id === messageId);
      if (!message) return state;

      const updatedStatuses = message.statuses || [];
      const existingIndex = updatedStatuses.findIndex((s) => s.userId === userId);
      const statusValue = status as 'SENT' | 'DELIVERED' | 'READ';
      
      if (existingIndex !== -1) {
        updatedStatuses[existingIndex] = { ...updatedStatuses[existingIndex], status: statusValue };
      } else {
        updatedStatuses.push({ id: `status_${Date.now()}`, messageId, userId, status: statusValue, updatedAt: new Date().toISOString() });
      }

      const updated = current.map((m) => (m.id === messageId ? { ...m, statuses: updatedStatuses } : m));
      return {
        messages: { ...state.messages, [conversationId]: updated }
      };
    });
  },

  clearMessagesForConversation: (conversationId) => {
    set((state) => ({
      messages: { ...state.messages, [conversationId]: [] }
    }));
  },

  retrySendMessage: async (message) => {
    const { user } = useAuthStore.getState();
    if (!user || message.senderId !== user.id) return;

    set((state) => {
      const current = state.messages[message.conversationId] || [];
      const updated = current.map((m) => (m.id === message.id ? { ...m, status: 'SENDING' as const, error: undefined } : m));
      return {
        messages: { ...state.messages, [message.conversationId]: updated } as Record<string, Message[]>
      };
    });

    const result = await sendMessageLogic(message.conversationId, message, message.tempId, message.isSilent);

    if (result.error) {
      set((state) => {
        const current = state.messages[message.conversationId] || [];
        const updated = current.map((m) => (m.tempId === message.tempId ? { ...m, status: 'FAILED' as const, error: true } : m));
        return {
          messages: { ...state.messages, [message.conversationId]: updated }
        };
      });
    }
  },

  addSystemMessage: (conversationId, content) => {
    const systemMessage: Message = {
      id: `system_${Date.now()}`,
      conversationId,
      senderId: 'system',
      sender: { id: 'system', name: 'System' },
      content,
      createdAt: new Date().toISOString(),
      type: 'SYSTEM'
    };

    set((state) => {
      const current = state.messages[conversationId] || [];
      return {
        messages: { ...state.messages, [conversationId]: [...current, systemMessage] }
      };
    });
  },

  reDecryptPendingMessages: async (conversationId) => {
    const state = get();
    const messages = state.messages[conversationId] || [];

    const pendingMessages = messages.filter(
      (m) => m.content === 'waiting_for_key' || m.content?.includes('[Requesting key')
    );

    for (const message of pendingMessages) {
      try {
        const decrypted = await decryptMessageObject(message);
        set((state) => {
          const current = state.messages[conversationId] || [];
          const updated = current.map((m) => (m.id === message.id ? decrypted : m));
          return {
            messages: { ...state.messages, [conversationId]: updated }
          };
        });
      } catch (error) {
        console.error('Failed to re-decrypt message:', error);
      }
    }
  },

  failPendingMessages: (conversationId, reason) => {
    set((state) => {
      const current = state.messages[conversationId] || [];
      const updated = current.map((m) =>
        m.content === 'waiting_for_key' || m.content?.includes('[Requesting key')
          ? { ...m, content: reason, error: true, type: 'SYSTEM' as const }
          : m
      );
      return {
        messages: { ...state.messages, [conversationId]: updated }
      };
    });
  },

  processOfflineQueue: async () => {
    await processOfflineQueue();
  },

  resendPendingMessages: async () => {
    const queueItems = await getQueueItems();
    for (const item of queueItems) {
      try {
        const queueItem = item as unknown as { tempId: number; message: Partial<Message> };
        await updateQueueAttempt(queueItem.tempId, 1);
        const result = await sendMessageLogic(queueItem.message.conversationId!, queueItem.message, queueItem.tempId, queueItem.message.isSilent);
        if (result.message) {
          await removeFromQueue(queueItem.tempId);
        }
      } catch (error) {
        console.error('Failed to resend queued message:', error);
      }
    }
  },

  sendMessage: async (conversationId, data, tempId, isSilent) => {
    const result = await sendMessageLogic(conversationId, data, tempId, isSilent);

    if (result.message) {
      set((state) => {
        const current = state.messages[conversationId] || [];
        const existingIndex = current.findIndex((m) => m.tempId === result.message!.tempId);

        if (existingIndex !== -1) {
          const updated = [...current];
          updated[existingIndex] = result.message!;
          return {
            messages: { ...state.messages, [conversationId]: updated }
          };
        }

        return {
          messages: { ...state.messages, [conversationId]: [...current, result.message!] }
        };
      });
    } else if (result.error === 'offline') {
      toast('Message queued. Will send when online.', { icon: '📭' });
    } else if (result.error) {
      set((state) => {
        const current = state.messages[conversationId] || [];
        const updated = current.map((m) =>
          m.tempId === tempId ? { ...m, status: 'FAILED' as const, error: result.error } : m
        );
        return {
          messages: { ...state.messages, [conversationId]: updated }
        };
      });
    }
  }
}));
