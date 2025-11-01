import { createWithEqualityFn } from "zustand/traditional";
import { api } from "@lib/api";
import { getSocket } from "@lib/socket";
import { encryptMessage, decryptMessage } from "@utils/crypto";
import toast from "react-hot-toast";
import { useAuthStore, type User } from "./auth";
import type { Message } from "./conversation"; // Import type from conversation store

// --- Helper Functions ---

export async function decryptMessageObject(message: Message): Promise<Message> {
  try {
    if (message.content) {
      message.content = await decryptMessage(message.content, message.conversationId);
    }
    if (message.repliedTo?.content) {
      message.repliedTo.content = await decryptMessage(message.repliedTo.content, message.conversationId);
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

    let encryptedContent = data.content;
    if (data.content) {
      try {
        encryptedContent = await encryptMessage(data.content, conversationId);
      } catch {
        toast.error("Failed to encrypt message.");
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
      ...data,
      repliedTo: replyingTo || undefined,
    };

    addOptimisticMessage(conversationId, optimisticMessage);
    
    const socket = getSocket();
    const payload = { 
      ...data, 
      content: encryptedContent,
      repliedToId: replyingTo?.id,
    };

    socket.emit("message:send", { conversationId, tempId, ...payload }, (ack: { ok: boolean, error?: string }) => {
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
    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      const form = new FormData();
      form.append("file", file);
      const { file: fileData } = await api<{ file: any }>(`/api/uploads/${conversationId}/upload`, { method: "POST", body: form });
      toast.success("File uploaded!", { id: toastId });
      get().sendMessage(conversationId, { fileUrl: fileData.url, fileName: fileData.filename, fileType: fileData.mimetype, fileSize: fileData.size, content: '' });
    } catch (uploadError: any) {
      const errorMsg = uploadError.details ? JSON.parse(uploadError.details).error : uploadError.message;
      toast.error(`Upload failed: ${errorMsg}`);
    }
  },

  loadMessagesForConversation: async (id) => {
    if (get().messages[id]) return;
    try {
      set(state => ({ 
        hasMore: { ...state.hasMore, [id]: true },
        isFetchingMore: { ...state.isFetchingMore, [id]: false },
      }));
      const res = await api<{ items: Message[] }>(`/api/messages/${id}`);
      const decryptedItems = await Promise.all((res.items || []).map(decryptMessageObject));
      decryptedItems.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      set({ messages: { [id]: decryptedItems } });
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
}));
