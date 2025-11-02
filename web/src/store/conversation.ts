import { createWithEqualityFn } from "zustand/traditional";
import { api, authFetch } from "@lib/api";
import { decryptMessage } from "@utils/crypto";
import { getSocket } from "@lib/socket";

// --- Type Definitions ---

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
  createdAt: string;
  error?: boolean;
  preview?: string;
  reactions?: { id: string; emoji: string; userId: string }[];
  optimistic?: boolean;
  repliedTo?: Message;
  repliedToId?: string;
  linkPreview?: any; // For link preview data
};

export type Participant = {
  id: string;
  username: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  role: "ADMIN" | "MEMBER";
};

export type Conversation = {
  id: string;
  isGroup: boolean;
  title?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  creatorId?: string | null;
  participants: Participant[];
  lastMessage: (Message & { preview?: string }) | null;
  updatedAt: string;
  unreadCount: number;
  lastUpdated?: number;
};

// --- Helper Functions ---

const sortConversations = (list: Conversation[]) =>
  [...list].sort((a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt).getTime() - new Date(a.lastMessage?.createdAt || a.updatedAt).getTime());

const withPreview = (msg: Message): Message => {
  if (msg.content) {
    return { ...msg, preview: msg.content };
  }
  if (msg.fileUrl) {
    if (msg.fileType?.startsWith('image/')) return { ...msg, preview: "📷 Image" };
    if (msg.fileType?.startsWith('video/')) return { ...msg, preview: "🎥 Video" };
    return { ...msg, preview: `📎 ${msg.fileName || "File"}` };
  }
  return msg;
};

// --- State Type ---

type State = {
  conversations: Conversation[];
  activeId: string | null;
  isSidebarOpen: boolean;
  error: string | null;

  // Actions
  loadConversations: () => Promise<void>;
  openConversation: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  toggleSidebar: () => void;
  startConversation: (peerId: string) => Promise<string>;
  addOrUpdateConversation: (conversation: Conversation) => void;
  removeConversation: (conversationId: string) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  updateParticipantDetails: (user: Partial<User>) => void;
  addParticipants: (conversationId: string, participants: Participant[]) => void;
  removeParticipant: (conversationId: string, userId: string) => void;
  updateParticipantRole: (conversationId: string, userId: string, role: "ADMIN" | "MEMBER") => void;
};

const initialActiveId = typeof window !== 'undefined' ? localStorage.getItem("activeId") : null;

// --- Zustand Store ---

export const useConversationStore = createWithEqualityFn<State>((set, get) => ({
  conversations: [],
  activeId: initialActiveId,
  isSidebarOpen: false,
  error: null,

  loadConversations: async () => {
    try {
      set({ error: null });
      const rawConversations = await api<any[]>("/api/conversations");
      const conversations: Conversation[] = rawConversations.map(c => ({
        ...c,
        lastMessage: c.messages?.[0] || null,
        participants: c.participants.map((p: any) => ({ ...p.user, description: p.user.description, role: p.role })),
      }));

      // Safely decrypt messages one by one to prevent a single failure from stopping the entire load
      for (const c of conversations) {
        if (c.lastMessage?.content) {
          try {
            c.lastMessage.content = await decryptMessage(c.lastMessage.content, c.id);
          } catch (e) {
            console.warn(`Could not decrypt last message for convo ${c.id}:`, e);
            c.lastMessage.content = "[Encrypted Message]";
          }
        }
        if (c.lastMessage) {
          c.lastMessage = withPreview(c.lastMessage);
        }
      }

      set({ conversations: sortConversations(conversations) });

      // After loading conversations, join their respective socket rooms
      const socket = getSocket();
      conversations.forEach(c => {
        socket.emit("conversation:join", c.id);
      });
    } catch (error) {
      console.error("Failed to load conversations", error);
      set({ error: "Failed to load conversations." });
    }
  },

  openConversation: (id: string) => {
    // Optimistically update UI
    set(state => ({
      activeId: id,
      isSidebarOpen: false,
      conversations: state.conversations.map(c => 
        c.id === id ? { ...c, unreadCount: 0 } : c
      ),
    }));
    localStorage.setItem("activeId", id);

    // Inform the backend that the conversation has been read
    authFetch(`/api/conversations/${id}/read`, { method: 'POST' }).catch(console.error);
  },

  deleteConversation: async (id) => { await api(`/api/conversations/${id}`, { method: 'DELETE' }); },
  deleteGroup: async (id) => { await api(`/api/conversations/${id}`, { method: 'DELETE' }); },
  toggleSidebar: () => set(s => ({ isSidebarOpen: !s.isSidebarOpen })),

  startConversation: async (peerId) => {
    const conv = await api<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ userIds: [peerId], isGroup: false }),
    });
    get().addOrUpdateConversation(conv);
    set({ activeId: conv.id, isSidebarOpen: false });
    return conv.id;
  },

  // --- Actions to be called by socket store ---
  addOrUpdateConversation: (conversation) => {
    set(state => ({ 
      conversations: sortConversations([conversation, ...state.conversations.filter(c => c.id !== conversation.id)])
    }));
  },

  removeConversation: (conversationId) => {
    set(state => {
      const wasActive = state.activeId === conversationId;
      if (wasActive) {
        localStorage.removeItem("activeId");
        return {
          conversations: state.conversations.filter(c => c.id !== conversationId),
          activeId: null,
          isSidebarOpen: true,
        };
      }
      return { conversations: state.conversations.filter(c => c.id !== conversationId) };
    });
  },

  updateConversation: (conversationId, updates) => {
    set(state => ({
      conversations: state.conversations.map(c => 
        c.id === conversationId ? { ...c, ...updates } : c
      )
    }));
  },

  updateParticipantDetails: (user) => {
    set(state => ({
      conversations: state.conversations.map(c => ({
        ...c,
        participants: c.participants.map(p => 
          p.id === user.id ? { ...p, ...user } : p
        ),
      }))
    }));
  },

  addParticipants: (conversationId, participants) => {
    set(state => ({
      conversations: state.conversations.map(c => {
        if (c.id === conversationId) {
          // Map the incoming participants to the correct frontend structure
          const newParticipants = participants.map((p: any) => ({ ...p.user, description: p.user.description, role: p.role }));
          return {
            ...c,
            participants: [...c.participants, ...newParticipants],
          };
        }
        return c;
      }),
    }));
  },

  removeParticipant: (conversationId, userId) => {
    set(state => ({
      conversations: state.conversations.map(c => {
        if (c.id === conversationId) {
          return {
            ...c,
            participants: c.participants.filter(p => p.id !== userId),
          };
        }
        return c;
      }),
    }));
  },

  updateParticipantRole: (conversationId, userId, role) => {
    set(state => ({
      conversations: state.conversations.map(c => {
        if (c.id === conversationId) {
          return {
            ...c,
            participants: c.participants.map(p => 
              p.id === userId ? { ...p, role } : p
            ),
          };
        }
        return c;
      }),
    }));
  },
}));
