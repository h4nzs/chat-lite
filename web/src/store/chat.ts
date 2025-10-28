import { create } from "zustand";
import { api } from "@lib/api";
import { getSocket } from "@lib/socket";
import { encryptMessage, decryptMessage } from "@utils/crypto";
import toast from "react-hot-toast";
import { useAuthStore } from "./auth";

// ... (Tipe data tetap sama)
export type Conversation = {
  id: string;
  isGroup: boolean;
  title?: string | null;
  creatorId?: string | null;
  participants: { id: string; username: string; name: string; avatarUrl?: string | null }[];
  lastMessage: (Message & { preview?: string }) | null;
  updatedAt: string;
  unreadCount: number; // Tambahkan ini
};
export type Message = {
  id: string;
  tempId?: number;
  conversationId: string;
  senderId: string;
  sender?: { id: string; name: string; username: string; avatarUrl?: string | null };
  content?: string | null;
  imageUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string;
  fileSize?: number;
  sessionId?: string | null;
  encryptedSessionKey?: string | null;
  createdAt: string;
  error?: boolean;
  preview?: string;
  reactions?: { id: string; emoji: string; userId: string }[];
  optimistic?: boolean;
};

type State = {
  conversations: Conversation[];
  activeId: string | null;
  isSidebarOpen: boolean;
  messages: Record<string, Message[]>;
  presence: string[];
  typing: Record<string, string[]>;
  error: string | null; // Tambahkan state error
  searchResults: Message[];
  highlightedMessageId: string | null;
  searchQuery: string;
  loadConversations: () => Promise<void>;
  openConversation: (id: string) => void;
  sendMessage: (conversationId: string, data: Partial<Message>) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  toggleSidebar: () => void;
  searchUsers: (q: string) => Promise<any[]>;
  startConversation: (peerId: string) => Promise<string>;
  uploadFile: (conversationId: string, file: File) => Promise<void>;
  initSocketListeners: () => void;
  loadMessagesForConversation: (id: string) => Promise<void>;
  searchMessages: (query: string, conversationId: string) => Promise<void>;
  setHighlightedMessageId: (messageId: string | null) => void;
  clearSearch: () => void;
  markConversationAsRead: (id: string) => void; // Tambahkan ini
};

const sortConversations = (list: Conversation[]) =>
  [...list].sort((a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt).getTime() - new Date(a.lastMessage?.createdAt || a.updatedAt).getTime());

const withPreview = (msg: Message): Message => {
  // Prioritaskan konten teks jika ada
  if (msg.content) {
    return { ...msg, preview: msg.content };
  }
  // Jika tidak ada konten teks, baru tampilkan pratinjau file
  if (msg.fileUrl) {
    if (msg.fileType?.startsWith('image/')) return { ...msg, preview: "📷 Image" };
    if (msg.fileType?.startsWith('video/')) return { ...msg, preview: "🎥 Video" };
    return { ...msg, preview: `📎 ${msg.fileName || "File"}` };
  }
  return msg;
};

const initialActiveId = typeof window !== 'undefined' ? localStorage.getItem("activeId") : null;

export const useChatStore = create<State>((set, get) => ({
  conversations: [],
  activeId: initialActiveId,
  messages: {},
  presence: [],
  typing: {},
  isSidebarOpen: false,
  error: null,
  searchResults: [],
  highlightedMessageId: null,
  searchQuery: '',

  markConversationAsRead: (id: string) => {
    set(state => ({
      conversations: state.conversations.map(c =>
        c.id === id ? { ...c, unreadCount: 0 } : c
      ),
    }));
  },

  // ... (fungsi-fungsi lain tetap sama)
  loadConversations: async () => {
    try {
      set({ error: null });
      // Fetch raw conversations from the API
      const rawConversations = await api<any[]>("/api/conversations");

      // 1. Map server response to client-side Conversation type
      const conversations: Conversation[] = rawConversations.map(c => ({
        ...c,
        lastMessage: c.messages?.[0] || null, // Move messages[0] to lastMessage
        participants: c.participants.map((p: any) => p.user), // Flatten participants
      }));

      // 2. Decrypt the last message for each conversation
      const decryptedConversations = await Promise.all(
        conversations.map(async (c) => {
          if (c.lastMessage?.content) {
            try {
              const decryptedContent = await decryptMessage(c.lastMessage.content, c.id);
              c.lastMessage.content = decryptedContent;
            } catch (e) {
              c.lastMessage.content = "[Encrypted Message]";
            }
          }
          // 3. Generate preview after potential decryption
          if (c.lastMessage) {
            c.lastMessage = withPreview(c.lastMessage);
          }
          return c;
        })
      );

      set({ conversations: sortConversations(decryptedConversations) });
    } catch (error) {
      console.error("Failed to load conversations", error);
      set({ error: "Failed to load conversations." });
    }
  },
  openConversation: (id: string) => {
    const socket = getSocket();
    socket.emit("conversation:join", id);
    get().markConversationAsRead(id); // Reset unread count on open
    set({ activeId: id, isSidebarOpen: false });
    localStorage.setItem("activeId", id);
  },
  sendMessage: async (conversationId, data) => {
    const tempId = Date.now();
    const me = useAuthStore.getState().user;

    // Enkripsi konten sebelum dikirim
    let encryptedContent = data.content;
    if (data.content) {
      try {
        encryptedContent = await encryptMessage(data.content, conversationId);
      } catch (error) {
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
      ...data, // content di sini masih plain text untuk optimistic UI
    };

    set(state => ({ messages: { ...state.messages, [conversationId]: [...(state.messages[conversationId] || []), optimisticMessage] } }));
    
    const socket = getSocket();
    const payload = { ...data, content: encryptedContent };

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
      // Kasus sukses ditangani oleh listener 'message:new' untuk menjaga satu sumber kebenaran
    });
  },
  deleteConversation: async (id) => { await api(`/api/conversations/${id}`, { method: 'DELETE' }); },
  deleteGroup: async (id) => { await api(`/api/conversations/${id}`, { method: 'DELETE' }); },
  toggleSidebar: () => set(s => ({ isSidebarOpen: !s.isSidebarOpen })),
  searchUsers: async (q) => { return api(`/api/users/search?q=${q}`); },
  startConversation: async (peerId) => {
    const conv = await api<Conversation>("/api/conversations/start", { method: 'POST', body: JSON.stringify({ peerId }) });
    set(state => ({ conversations: sortConversations([conv, ...state.conversations.filter(c => c.id !== conv.id)]), activeId: conv.id, isSidebarOpen: false }));
    return conv.id;
  },
  uploadFile: async (conversationId, file) => {
    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      const form = new FormData();
      form.append("file", file);
      const { file: fileData } = await api<{ file: any }>(`/api/uploads/${conversationId}/upload`,{ method: "POST", body: form });
      toast.success("File uploaded!", { id: toastId });
      get().sendMessage(conversationId, { fileUrl: fileData.url, fileName: fileData.filename, fileType: fileData.mimetype, fileSize: fileData.size, content: '' });
    } catch (error: any) {
      const errorMsg = error.details ? JSON.parse(error.details).error : error.message;
      toast.error(`Upload failed: ${errorMsg}`);
    }
  },
  isFetchingMore: {} as Record<string, boolean>,
  hasMore: {} as Record<string, boolean>,

  loadMessagesForConversation: async (id: string) => {
    // Only fetch if messages aren't loaded yet
    if (get().messages[id]) return;

    try {
      set(state => ({ 
        error: null,
        hasMore: { ...state.hasMore, [id]: true },
        isFetchingMore: { ...state.isFetchingMore, [id]: false },
      }));
      const res = await api<{ items: Message[] }>(`/api/messages/${id}`);
      const decryptedItems = await Promise.all(
        (res.items || []).map(async (m) => {
          try {
            if (m.content) {
              m.content = await decryptMessage(m.content, m.conversationId);
            }
            return withPreview(m);
          } catch (err) {
            m.content = '[Failed to decrypt message]';
            return withPreview(m);
          }
        })
      );
      decryptedItems.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      set((state) => ({ messages: { ...state.messages, [id]: decryptedItems } }));
    } catch (error) {
      console.error(`Failed to load messages for ${id}`, error);
      set(state => ({ 
        messages: { ...state.messages, [id]: [] },
        error: `Failed to load messages for conversation.`
      }));
    }
  },

  loadPreviousMessages: async (conversationId: string) => {
    const { isFetchingMore, hasMore, messages } = get();
    if (isFetchingMore[conversationId] || !hasMore[conversationId]) {
      return;
    }

    const currentMessages = messages[conversationId] || [];
    const oldestMessage = currentMessages[0];
    if (!oldestMessage) return;

    set(state => ({ isFetchingMore: { ...state.isFetchingMore, [conversationId]: true } }));

    try {
      const res = await api<{ items: Message[] }>(`/api/messages/${conversationId}?cursor=${oldestMessage.id}`);
      const decryptedItems = await Promise.all(
        (res.items || []).map(async (m) => {
          try {
            if (m.content) {
              m.content = await decryptMessage(m.content, m.conversationId);
            }
            return withPreview(m);
          } catch (err) {
            m.content = '[Failed to decrypt message]';
            return withPreview(m);
          }
        })
      );
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
    if (query.length < 2) {
      set({ searchResults: [], searchQuery: query });
      return;
    }
    try {
      set({ searchQuery: query });
      const { results } = await api<{ results: Message[] }>(
        `/api/messages/search?q=${encodeURIComponent(query)}&conversationId=${conversationId}`
      );

      const decryptedResults = await Promise.all(
        results.map(async (m) => {
          try {
            if (m.content) {
              m.content = await decryptMessage(m.content, m.conversationId);
            }
            return m;
          } catch (err) {
            m.content = '[Failed to decrypt message]';
            return m;
          }
        })
      );

      set({ searchResults: decryptedResults });
    } catch (error) {
      console.error("Failed to search messages", error);
      toast.error("Failed to search messages.");
      set({ searchResults: [] });
    }
  },

  setHighlightedMessageId: (messageId) => {
    set({ highlightedMessageId: messageId });
  },

  clearSearch: () => {
    set({ searchResults: [], searchQuery: '', highlightedMessageId: null });
  },

  initSocketListeners: () => {
    const socket = getSocket();
    // Bersihkan semua listener lama untuk mencegah duplikasi
    socket.off("presence:init");
    socket.off("presence:user_joined");
    socket.off("presence:user_left");
    socket.off("typing:update");
    socket.off("message:new");
    socket.off("conversation:new");
    socket.off("conversation:deleted");
    socket.off("reaction:new");
    socket.off("reaction:remove");
    socket.off("message:deleted");
    socket.off("user:updated"); // Bersihkan listener
    socket.off("message:status_updated"); // Bersihkan listener

    // Daftarkan semua listener yang benar
    socket.on("presence:init", (onlineUserIds: string[]) => {
      set({ presence: onlineUserIds });
    });

    socket.on("presence:user_joined", (userId: string) => {
      set(state => ({ presence: [...state.presence, userId] }));
    });

    socket.on("presence:user_left", (userId: string) => {
      set(state => ({ presence: state.presence.filter(id => id !== userId) }));
    });

    socket.on('user:updated', (updatedUser: any) => {
      const meId = useAuthStore.getState().user?.id;
      if (updatedUser.id === meId) return; // Abaikan update untuk diri sendiri

      set(state => ({
        conversations: state.conversations.map(conv => ({
          ...conv,
          participants: conv.participants.map(p =>
            p.id === updatedUser.id ? { ...p, ...updatedUser } : p
          ),
        })),
      }));
    });

    socket.on('message:status_updated', ({ messageId, conversationId, readBy, status }) => {
      set(state => {
        const messages = state.messages[conversationId];
        if (!messages) return state;

        return {
          messages: {
            ...state.messages,
            [conversationId]: messages.map(msg => {
              if (msg.id === messageId) {
                const existingStatus = msg.statuses?.find(s => s.userId === readBy);
                if (existingStatus) {
                  // Update status yang ada
                  return {
                    ...msg,
                    statuses: msg.statuses?.map(s => s.userId === readBy ? { ...s, status } : s)
                  };
                } else {
                  // Tambahkan status baru
                  return {
                    ...msg,
                    statuses: [...(msg.statuses || []), { userId: readBy, status, messageId, id: 'temp-status' }]
                  };
                }
              }
              return msg;
            })
          }
        };
      });
    });

    socket.on("typing:update", ({ userId, conversationId, isTyping }) => {
      set(state => {
        const currentTyping = state.typing[conversationId] || [];
        if (isTyping && !currentTyping.includes(userId)) {
          return { typing: { ...state.typing, [conversationId]: [...currentTyping, userId] } };
        } else if (!isTyping && currentTyping.includes(userId)) {
          return { typing: { ...state.typing, [conversationId]: currentTyping.filter(id => id !== userId) } };
        }
        return state;
      });
    });

    socket.on("message:new", async (newMessage: Message) => {
      // We need to decrypt the content of the new message
      if (newMessage.content) {
        try {
          newMessage.content = await decryptMessage(newMessage.content, newMessage.conversationId);
        } catch (error) {
          newMessage.content = "[Failed to decrypt message]";
        }
      }
      
      set(state => {
        const conversationId = newMessage.conversationId;
        const isActive = state.activeId === conversationId;

        // Unify the update logic for both optimistic and new messages
        const updateConversationList = (currentState: State): Conversation[] => {
          const conversationExists = currentState.conversations.some(c => c.id === conversationId);
          if (!conversationExists) return currentState.conversations; // Should not happen, but as a safeguard

          const updatedConversations = currentState.conversations.map(c => {
            if (c.id === conversationId) {
              const newUnreadCount = !isActive && newMessage.senderId !== useAuthStore.getState().user?.id
                ? (c.unreadCount || 0) + 1
                : c.unreadCount;
              return { ...c, lastMessage: withPreview(newMessage), updatedAt: newMessage.createdAt, unreadCount: newUnreadCount };
            }
            return c;
          });
          return sortConversations(updatedConversations);
        };

        // Handle optimistic message replacement for the sender
        if (newMessage.senderId === useAuthStore.getState().user?.id) {
            const optimisticMessageExists = (state.messages[conversationId] || []).some(m => m.tempId === newMessage.tempId);
            if(optimisticMessageExists) {
                return {
                    ...state,
                    messages: {
                        ...state.messages,
                        [conversationId]: state.messages[conversationId].map(m => m.tempId === newMessage.tempId ? withPreview(newMessage) : m)
                    },
                    conversations: updateConversationList(state),
                }
            }
        };

        // Handle new message from other users
        const messages = state.messages[conversationId] || [];
        if (messages.some(m => m.id === newMessage.id)) return state; // Prevent duplicate messages

        return {
          ...state,
          messages: { ...state.messages, [conversationId]: [...messages, withPreview(newMessage)] },
          conversations: updateConversationList(state),
        };
      });
    });

    socket.on("conversation:new", (newConversation: Conversation) => {
      set(state => {
        if (state.conversations.some(c => c.id === newConversation.id)) return state;
        return { conversations: sortConversations([...state.conversations, newConversation]) };
      });
    });

    socket.on("conversation:deleted", ({ id }) => {
      set(state => {
        const wasActive = state.activeId === id;
        if (wasActive) {
          localStorage.removeItem("activeId");
          return {
            conversations: state.conversations.filter(c => c.id !== id),
            activeId: null,
            isSidebarOpen: true // Force sidebar open
          };
        }
        return {
          conversations: state.conversations.filter(c => c.id !== id)
        };
      });
    });

    socket.on("message:deleted", ({ messageId, conversationId }) => {
      set(state => {
        const messages = state.messages[conversationId] || [];
        return {
          messages: {
            ...state.messages,
            [conversationId]: messages.map(m => m.id === messageId ? { ...m, content: "[This message was deleted]", fileUrl: undefined, imageUrl: undefined, reactions: [] } : m)
          }
        }
      });
    });

    socket.on("reaction:new", (reaction) => {
      set(state => {
        let conversationId: string | undefined;
        for (const cid in state.messages) {
          if (state.messages[cid].some(m => m.id === reaction.messageId)) {
            conversationId = cid;
            break;
          }
        }
        if (!conversationId) return state;
        const updatedMessages = state.messages[conversationId].map(m => {
          if (m.id === reaction.messageId) {
            return { ...m, reactions: [...(m.reactions || []), reaction] };
          }
          return m;
        });
        return { ...state, messages: { ...state.messages, [conversationId]: updatedMessages } };
      });
    });

    socket.on("reaction:remove", ({ reactionId, messageId }) => {
      set(state => {
        let conversationId: string | undefined;
        for (const cid in state.messages) {
          if (state.messages[cid].some(m => m.id === messageId)) {
            conversationId = cid;
            break;
          }
        }
        if (!conversationId) return state;
        const updatedMessages = state.messages[conversationId].map(m => {
          if (m.id === messageId) {
            return { ...m, reactions: (m.reactions || []).filter(r => r.id !== reactionId) };
          }
          return m;
        });
        return { ...state, messages: { ...state.messages, [conversationId]: updatedMessages } };
      });
    });
  },
}));
