import { createWithEqualityFn } from "zustand/traditional";
import { api } from "@lib/api";
import { getSocket, emitSessionKeyRequest } from "@lib/socket";
import { encryptMessage, decryptMessage, ensureAndRatchetSession } from "@utils/crypto";
import toast from "react-hot-toast";
import { useAuthStore, type User } from "./auth";
import type { Message } from "./conversation"; // Import type from conversation store

// --- Helper Functions ---

export async function decryptMessageObject(message: Message): Promise<Message> {
  const decryptedMsg = { ...message };
  if (decryptedMsg.content) {
    // Store original ciphertext before attempting decryption
    decryptedMsg.ciphertext = decryptedMsg.content;
    decryptedMsg.content = await decryptMessage(decryptedMsg.content, decryptedMsg.conversationId, decryptedMsg.sessionId);
  }
  // Also handle repliedTo content if it exists
  if (decryptedMsg.repliedTo?.content) {
    // No need to store ciphertext for replies, they are just for display
    decryptedMsg.repliedTo.content = await decryptMessage(decryptedMsg.repliedTo.content, decryptedMsg.conversationId, decryptedMsg.repliedTo.sessionId);
  }
  return decryptedMsg;
}

// --- State Type ---

type State = {
  messages: Record<string, Message[]>;
  isFetchingMore: Record<string, boolean>;
  hasMore: Record<string, boolean>;
  hasLoadedHistory: Record<string, boolean>;
  
  // Actions
  loadMessagesForConversation: (id: string) => Promise<void>;
  loadPreviousMessages: (conversationId: string) => Promise<void>;
  addOptimisticMessage: (conversationId: string, message: Message) => void;
  addIncomingMessage: (conversationId: string, message: Message) => void;
  replaceOptimisticMessage: (conversationId: string, tempId: number, newMessage: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  addReaction: (conversationId: string, messageId: string, reaction: any) => void;
  removeReaction: (conversationId: string, messageId: string, reactionId: string) => void;
  updateSenderDetails: (user: Partial<User>) => void;
  updateMessageStatus: (conversationId: string, messageId: string, userId: string, status: string) => void;
  clearMessagesForConversation: (conversationId: string) => void;
  addSystemMessage: (conversationId: string, content: string) => void;
};

// --- Zustand Store ---

export const useMessageStore = createWithEqualityFn<State>((set, get) => ({
  messages: {},
  isFetchingMore: {},
  hasMore: {},
  hasLoadedHistory: {},

  addSystemMessage: (conversationId, content) => {
    const systemMessage: Message = {
      id: `system_${Date.now()}`,
      type: 'SYSTEM',
      conversationId,
      content,
      createdAt: new Date().toISOString(),
      senderId: 'system', // Assign a special senderId
    };
    set(state => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), systemMessage],
      },
    }));
  },

  loadMessagesForConversation: async (id) => {
    if (get().hasLoadedHistory[id]) return;

    try {
      await ensureAndRatchetSession(id);
    } catch (ratchetError) {
      console.error("Failed to establish session, decryption may fail:", ratchetError);
      toast.error("Could not establish a secure session. Messages may not decrypt.");
    }

    try {
      set(state => ({ 
        hasMore: { ...state.hasMore, [id]: true },
        isFetchingMore: { ...state.isFetchingMore, [id]: false },
      }));
      const res = await api<{ items: Message[] }>(`/api/messages/${id}`);
      const fetchedMessages = res.items || [];
      
      const processedMessages = await Promise.all(fetchedMessages.map(async (message) => {
        try {
          return await decryptMessageObject(message);
        } catch (e) {
          console.error(`Decryption failed for message ${message.id} during initial load.`, e);
          if (message.sessionId) {
            emitSessionKeyRequest(message.conversationId, message.sessionId);
          }
          return { ...message, content: '[Requesting key to decrypt...]' };
        }
      }));
      
      set(state => {
        const existingMessages = state.messages[id] || [];
        const messageMap = new Map(existingMessages.map(m => [m.id, m]));
        processedMessages.forEach(m => messageMap.set(m.id, m));
        
        const allMessages = Array.from(messageMap.values());
        allMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        const newState = {
          ...state,
          messages: {
            ...state.messages,
            [id]: allMessages,
          },
          hasMore: {
            ...state.hasMore,
            [id]: fetchedMessages.length >= 50,
          },
          hasLoadedHistory: {
            ...state.hasLoadedHistory,
            [id]: true,
          }
        };

        if (fetchedMessages.length >= 50) {
          get().loadPreviousMessages(id);
        }
        
        return newState;
      });

    } catch (error) {
      console.error(`Failed to load messages for ${id}`, error);
      set(state => ({ 
        messages: { ...state.messages, [id]: [] },
        hasLoadedHistory: { ...state.hasLoadedHistory, [id]: false },
      }));
    }
  },

  loadPreviousMessages: async (conversationId) => {
    const { isFetchingMore, hasMore, messages } = get();
    if (isFetchingMore[conversationId] || !hasMore[conversationId]) return;

    const currentMessages = messages[conversationId] || [];
    const oldestMessage = currentMessages[0];
    if (!oldestMessage) return;

    set(state => ({ isFetchingMore: { ...state.isFetchingMore, [conversationId]: true } }));

    try {
      const res = await api<{ items: Message[] }>(`/api/messages/${conversationId}?cursor=${oldestMessage.id}`);
      const decryptedItems = await Promise.all((res.items || []).map(decryptMessageObject));
      decryptedItems.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (decryptedItems.length < 50) {
        set(state => ({ hasMore: { ...state.hasMore, [conversationId]: false } }));
      }

      set(state => ({
        messages: {
          ...state.messages,
          [conversationId]: [...decryptedItems, ...currentMessages],
        },
      }));
    } catch (error) {
      console.error("Failed to load previous messages", error);
    } finally {
      set(state => ({ isFetchingMore: { ...state.isFetchingMore, [conversationId]: false } }));
    }
  },

  addOptimisticMessage: (conversationId, message) => {
    set(state => ({ 
      messages: { 
        ...state.messages, 
        [conversationId]: [...(state.messages[conversationId] || []), message]
      }
    }));
  },

  addIncomingMessage: (conversationId, message) => {
    set(state => {
      const currentMessages = state.messages[conversationId] || [];
      if (currentMessages.some(m => m.id === message.id)) return state;
      const messageWithPreview = {
        ...message,
        linkPreview: message.linkPreview,
      };
      return {
        messages: { 
          ...state.messages, 
          [conversationId]: [...currentMessages, messageWithPreview]
        }
      };
    });
  },

  replaceOptimisticMessage: (conversationId, tempId, newMessage) => {
    set(state => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map(m => {
          if (m.tempId === tempId) {
            return { 
              ...m, 
              id: newMessage.id,
              createdAt: newMessage.createdAt,
              optimistic: false, 
              error: false, 
              linkPreview: newMessage.linkPreview
            };
          }
          return m;
        })
      }
    }));
  },

  updateMessage: (conversationId, messageId, updates) => {
    set(state => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map(m => 
          m.id === messageId ? { ...m, ...updates } : m
        )
      }
    }));
  },

  removeMessage: (conversationId, messageId) => {
    set(state => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).filter(m => m.id !== messageId),
      },
    }));
  },

  addReaction: (conversationId, messageId, reaction) => {
    set(state => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map(m => {
          if (m.id === messageId) {
            return { ...m, reactions: [...(m.reactions || []), reaction] };
          }
          return m;
        })
      }
    }));
  },

  removeReaction: (conversationId, messageId, reactionId) => {
    set(state => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map(m => {
          if (m.id === messageId) {
            return { ...m, reactions: (m.reactions || []).filter(r => r.id !== reactionId) };
          }
          return m;
        })
      }
    }));
  },

  updateSenderDetails: (user) => {
    set(state => {
      const newMessages = { ...state.messages };
      for (const convoId in newMessages) {
        newMessages[convoId] = newMessages[convoId].map(m => {
          if (m.sender?.id === user.id) {
            return { ...m, sender: { ...m.sender, ...user } };
          }
          return m;
        });
      }
      return { messages: newMessages };
    });
  },

  updateMessageStatus: (conversationId, messageId, userId, status) => {
    set(state => {
      const newMessages = { ...state.messages };
      const convoMessages = newMessages[conversationId];
      if (!convoMessages) return state;

      newMessages[conversationId] = convoMessages.map(m => {
        if (m.id === messageId) {
          const existingStatus = m.statuses?.find(s => s.userId === userId);
          if (existingStatus) {
            return { ...m, statuses: m.statuses!.map(s => s.userId === userId ? { ...s, status } : s) };
          } else {
            return { ...m, statuses: [...(m.statuses || []), { userId, status, messageId, id: `temp-status-${Date.now()}` }] };
          }
        }
        return m;
      });

      return { messages: newMessages };
    });
  },

  clearMessagesForConversation: (conversationId) => {
    set(state => {
      const newMessages = { ...state.messages };
      delete newMessages[conversationId];

      const newHasLoadedHistory = { ...state.hasLoadedHistory };
      delete newHasLoadedHistory[conversationId];

      const newHasMore = { ...state.hasMore };
      delete newHasMore[conversationId];

      const newIsFetchingMore = { ...state.isFetchingMore };
      delete newIsFetchingMore[conversationId];

      return { 
        messages: newMessages,
        hasLoadedHistory: newHasLoadedHistory,
        hasMore: newHasMore,
        isFetchingMore: newIsFetchingMore,
      };
    });
  },
}));