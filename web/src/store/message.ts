import { createWithEqualityFn } from "zustand/traditional";
import { api } from "@lib/api";
import { getSocket } from "@lib/socket";
import { encryptMessage, decryptMessage, ensureAndRatchetSession } from "@utils/crypto";
import toast from "react-hot-toast";
import { useAuthStore, type User } from "./auth";
import type { Message } from "./conversation"; // Import type from conversation store
import axios from 'axios';
import useDynamicIslandStore from './dynamicIsland';

const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000";

// --- Helper Functions ---

export async function decryptMessageObject(message: Message): Promise<Message> {
  try {
    if (message.content) {
      message.content = await decryptMessage(message.content, message.conversationId, (message as any).sessionId);
    }
    if (message.repliedTo?.content) {
      message.repliedTo.content = await decryptMessage(message.repliedTo.content, message.conversationId, (message.repliedTo as any).sessionId);
    }
    return message;
  } catch {
    message.content = '[Failed to decrypt message]';
    return message;
  }
}

// --- State Type ---

type State = {
  messages: Record<string, Message[]>;
  replyingTo: Message | null;
  searchResults: Message[];
  highlightedMessageId: string | null;
  searchQuery: string;
  isFetchingMore: Record<string, boolean>;
  hasMore: Record<string, boolean>;
  typingLinkPreview: any | null; // For live link previews
  
  // Actions
  setReplyingTo: (message: Message | null) => void;
  fetchTypingLinkPreview: (text: string) => void;
  clearTypingLinkPreview: () => void;
  sendMessage: (conversationId: string, data: Partial<Message>) => Promise<void>;
  uploadFile: (conversationId: string, file: File) => Promise<void>;
  loadMessagesForConversation: (id: string) => Promise<void>;
  loadPreviousMessages: (conversationId: string) => Promise<void>;
  searchMessages: (query: string, conversationId: string) => Promise<void>;
  setHighlightedMessageId: (messageId: string | null) => void;
  clearSearch: () => void;
  addOptimisticMessage: (conversationId: string, message: Message) => void;
  addIncomingMessage: (conversationId: string, message: Message) => void;
  replaceOptimisticMessage: (conversationId: string, tempId: number, newMessage: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  addReaction: (conversationId: string, messageId: string, reaction: any) => void;
  removeReaction: (conversationId, string, reactionId: string) => void;
  updateSenderDetails: (user: Partial<User>) => void;
  updateMessageStatus: (conversationId: string, messageId: string, userId: string, status: string) => void;
  clearMessagesForConversation: (conversationId: string) => void;
  retrySendMessage: (message: Message) => void;
};

// --- Zustand Store ---

export const useMessageStore = createWithEqualityFn<State>((set, get) => ({
  messages: {},
  replyingTo: null,
  searchResults: [],
  highlightedMessageId: null,
  searchQuery: '',
  isFetchingMore: {},
  hasMore: {},
  typingLinkPreview: null,

  setReplyingTo: (message) => set({ replyingTo: message }),

  fetchTypingLinkPreview: async (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);
    if (urls && urls.length > 0) {
      try {
        const preview = await api("/api/previews", {
          method: "POST",
          body: JSON.stringify({ url: urls[0] }),
        });
        set({ typingLinkPreview: preview });
      } catch (error) {
        set({ typingLinkPreview: null });
      }
    } else {
      set({ typingLinkPreview: null });
    }
  },

  clearTypingLinkPreview: () => set({ typingLinkPreview: null }),

  sendMessage: async (conversationId, data) => {
    const tempId = Date.now();
    const me = useAuthStore.getState().user;
    const { replyingTo, addOptimisticMessage, setReplyingTo } = get();

    let payload: Partial<Message> = { ...data };

    if (data.content) {
      try {
        const { ciphertext, sessionId } = await encryptMessage(data.content, conversationId);
        payload.content = ciphertext;
        payload.sessionId = sessionId;
      } catch (e: any) {
        toast.error(`Encryption failed: ${e.message}`);
        return;
      }
    }

    const optimisticMessage: Message = {
      id: `temp-${tempId}`,
      tempId,
      conversationId,
      senderId: me!.id,
      sender: me!,
      createdAt: new Date().toISOString(),
      optimistic: true,
      ...data, // Use original, unencrypted content for optimistic UI
      repliedTo: replyingTo || undefined,
    };

    addOptimisticMessage(conversationId, optimisticMessage);
    
    const socket = getSocket();
    const finalPayload = { 
      ...payload, 
      repliedToId: replyingTo?.id,
    };

    socket.emit("message:send", { conversationId, tempId, ...finalPayload }, (ack: { ok: boolean, error?: string }) => {
      if (!ack.ok) {
        toast.error(`Failed to send message: ${ack.error || 'Unknown error'}`);
        set(state => ({
          messages: {
            ...state.messages,
            [conversationId]: state.messages[conversationId].map(m =>
              m.tempId === tempId ? { ...m, error: true, optimistic: false } : m
            ),
          },
        }));
      }
    });

    setReplyingTo(null);
  },

  uploadFile: async (conversationId, file) => {
    const { addActivity, updateActivity, removeActivity } = useDynamicIslandStore.getState();
    
    const activityId = addActivity({
      type: 'upload',
      fileName: file.name,
      progress: 0,
    });

    try {
      // 1. Fetch the CSRF token first
      const { data: csrfData } = await axios.get<{ csrfToken: string }>(
        `${API_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const csrfToken = csrfData.csrfToken;

      if (!csrfToken) {
        throw new Error('Could not retrieve CSRF token.');
      }

      // 2. Perform the upload with the token
      const form = new FormData();
      form.append("file", file);

      const response = await axios.post<{ file: any }>(
        `${API_URL}/api/uploads/${conversationId}/upload`,
        form,
        {
          withCredentials: true,
          headers: {
            'CSRF-Token': csrfToken,
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
            updateActivity(activityId, { progress });
          },
        }
      );

      const { file: fileData } = response.data;
      
      updateActivity(activityId, { progress: 100 });
      setTimeout(() => removeActivity(activityId), 1000); // Keep it for a second to show 100%

      get().sendMessage(conversationId, { fileUrl: fileData.url, fileName: fileData.filename, fileType: fileData.mimetype, fileSize: fileData.size, content: '' });
    } catch (uploadError: any) {
      const errorMsg = uploadError.response?.data?.error || uploadError.message || "Upload failed";
      toast.error(`Upload failed: ${errorMsg}`);
      removeActivity(activityId);
    }
  },

  loadMessagesForConversation: async (id) => {
    if (get().messages[id]?.length > 0) return;

    // Ensure a session key exists before fetching messages
    try {
      await ensureAndRatchetSession(id);
    } catch (ratchetError) {
      console.error("Failed to establish session, decryption may fail:", ratchetError);
      toast.error("Could not establish a secure session. Messages may not decrypt.");
      // We can still try to load messages, they will just fail to decrypt individually
    }

    try {
      set(state => ({ 
        hasMore: { ...state.hasMore, [id]: true },
        isFetchingMore: { ...state.isFetchingMore, [id]: false },
      }));
      const res = await api<{ items: Message[] }>(`/api/messages/${id}`);
      const decryptedItems = await Promise.all((res.items || []).map(decryptMessageObject));
      
      set(state => {
        const existingMessages = state.messages[id] || [];
        const messageMap = new Map(existingMessages.map(m => [m.id, m]));
        decryptedItems.forEach(m => messageMap.set(m.id, m));
        
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
            [id]: decryptedItems.length >= 50,
          }
        };

        // Immediately try to load the previous page if the screen isn't full
        if (decryptedItems.length >= 50) {
          get().loadPreviousMessages(id);
        }
        
        return newState;
      });

    } catch (error) {
      console.error(`Failed to load messages for ${id}`, error);
      set(state => ({ messages: { ...state.messages, [id]: [] } }));
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

  searchMessages: async (query, conversationId) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    const allMessages = get().messages[conversationId] || [];
    const results = allMessages.filter(m => m.content && m.content.toLowerCase().includes(query.toLowerCase()));
    set({ searchResults: results });
  },

  setHighlightedMessageId: (messageId) => set({ highlightedMessageId: messageId }),
  clearSearch: () => set({ searchResults: [], searchQuery: '', highlightedMessageId: null }),

  // --- Actions to be called by socket store ---
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
      if (currentMessages.some(m => m.id === message.id)) return state; // Prevent duplicates
      // Explicitly build the message object to ensure all properties are kept
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
            // Preserve optimistic data but update with server confirmation
            return { 
              ...m, 
              id: newMessage.id,
              createdAt: newMessage.createdAt,
              optimistic: false, 
              error: false, 
              linkPreview: newMessage.linkPreview // Explicitly carry over the preview
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
      return { messages: newMessages };
    });
  },

  retrySendMessage: (message: Message) => {
    const { conversationId, tempId, content, fileUrl, fileName, fileType, fileSize, repliedToId } = message;
    
    // Hapus pesan yang gagal dari state
    set(state => ({
      messages: {
        ...state.messages,
        [conversationId]: state.messages[conversationId]?.filter(m => m.tempId !== tempId) || [],
      },
    }));

    // Kirim ulang pesan
    get().sendMessage(conversationId, { content, fileUrl, fileName, fileType, fileSize, repliedToId });
  },
}));
