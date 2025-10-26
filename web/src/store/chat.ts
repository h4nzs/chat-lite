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

  // ... (fungsi-fungsi lain tetap sama)
  loadConversations: async () => {
    try {
      set({ error: null });
      const conversations = await api<Conversation[]>("/api/conversations");
      set({ conversations: sortConversations(conversations) });
    } catch (error) {
      console.error("Failed to load conversations", error);
      set({ error: "Failed to load conversations." });
    }
  },
  openConversation: (id: string) => {
    const socket = getSocket();
    socket.emit("conversation:join", id);
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
  deleteGroup: async (id) => { await api(`/api/conversations/group/${id}`, { method: 'DELETE' }); },
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
  loadMessagesForConversation: async (id: string) => {
    try {
      set({ error: null });
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

      // Sort messages by date ascending (oldest to newest)
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
        // Prevent processing if the sender is the current user, as optimistic update is used
        if (newMessage.senderId === useAuthStore.getState().user?.id) {
            // find the optimistic message and update it
            const optimisticMessageExists = (state.messages[newMessage.conversationId] || []).some(m => m.tempId === newMessage.tempId);
            if(optimisticMessageExists) {
                return {
                    messages: {
                        ...state.messages,
                        [newMessage.conversationId]: state.messages[newMessage.conversationId].map(m => m.tempId === newMessage.tempId ? withPreview(newMessage) : m)
                    }
                }
            }
        };

        const conversationId = newMessage.conversationId;
        const messages = state.messages[conversationId] || [];
        // Prevent duplicate messages
        if (messages.some(m => m.id === newMessage.id)) return state;

        const updatedConversations = state.conversations.map(c => 
          c.id === conversationId ? { ...c, lastMessage: withPreview(newMessage), updatedAt: newMessage.createdAt } : c
        );

        return {
          messages: { ...state.messages, [conversationId]: [...messages, withPreview(newMessage)] },
          conversations: sortConversations(updatedConversations),
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