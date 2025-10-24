import { create } from "zustand";
import { api } from "@lib/api";
import { getSocket } from "@lib/socket";
import { encryptMessage, decryptMessage } from "@utils/crypto";
import toast from "react-hot-toast";
import { useAuthStore } from "./auth";

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
  loadConversations: () => Promise<void>;
  openConversation: (id: string) => void;
  sendMessage: (conversationId: string, data: Partial<Message>) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  toggleSidebar: () => void;
  searchUsers: (q: string) => Promise<any[]>;
  startConversation: (peerId: string) => Promise<string>;
  uploadFile: (conversationId: string, file: File) => Promise<void>; // Tambahkan ini
  initSocketListeners: () => void;
  loadMessagesForConversation: (id: string) => Promise<void>;
};

const sortConversations = (list: Conversation[]) =>
  [...list].sort((a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt).getTime() - new Date(a.lastMessage?.createdAt || a.updatedAt).getTime());

const withPreview = (msg: Message): Message => {
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

  loadConversations: async () => {
    try {
      const conversations = await api<Conversation[]>("/api/conversations");
      set({ conversations: sortConversations(conversations) });
    } catch (error) {
      console.error("Failed to load conversations", error);
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
    const optimisticMessage: Message = {
      id: `temp-${tempId}`,
      tempId,
      conversationId,
      senderId: me!.id,
      sender: me!,
      createdAt: new Date().toISOString(),
      optimistic: true,
      ...data,
    };

    set(state => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), optimisticMessage],
      },
    }));

    const socket = getSocket();
    socket.emit("message:send", { conversationId, tempId, ...data }, (ack: { ok: boolean, msg: Message }) => {
      if (ack.ok) {
        set(state => ({
          messages: {
            ...state.messages,
            [conversationId]: state.messages[conversationId].map(m => m.tempId === tempId ? ack.msg : m),
          },
        }));
      }
    });
  },

  deleteConversation: async (id) => {
    await api(`/api/conversations/${id}`, { method: 'DELETE' });
  },

  deleteGroup: async (id) => {
    await api(`/api/conversations/group/${id}`, { method: 'DELETE' });
  },

  toggleSidebar: () => set(s => ({ isSidebarOpen: !s.isSidebarOpen })),

  searchUsers: async (q) => {
    return api(`/api/users/search?q=${q}`);
  },

  startConversation: async (peerId) => {
    const conv = await api<Conversation>("/api/conversations/start", {
      method: 'POST',
      body: JSON.stringify({ peerId }),
    });
    set(state => ({
      conversations: sortConversations([conv, ...state.conversations.filter(c => c.id !== conv.id)]),
      activeId: conv.id,
      isSidebarOpen: false,
    }));
    return conv.id;
  },

  uploadFile: async (conversationId, file) => {
    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      const form = new FormData();
      form.append("file", file);

      const { file: fileData } = await api<{ file: any }>(
        `/api/uploads/${conversationId}/upload`,
        { method: "POST", body: form }
      );

      toast.success("File uploaded!", { id: toastId });

      get().sendMessage(conversationId, {
        fileUrl: fileData.url,
        fileName: fileData.filename,
        fileType: fileData.mimetype,
        fileSize: fileData.size,
        content: '',
      });

    } catch (error: any) {
      const errorMsg = error.details ? JSON.parse(error.details).error : error.message;
      toast.error(`Upload failed: ${errorMsg}`, { id: toastId });
    }
  },

  loadMessagesForConversation: async (id: string) => {
    try {
      const res = await api<{ items: Message[] }>(`/api/messages/${id}`);
      const decryptedItems = await Promise.all(
        res.items.map(async (m) => {
          try {
            m.content = await decryptMessage(m.content || '', m.conversationId);
            return withPreview(m);
          } catch (err) {
            m.content = '[Failed to decrypt message]';
            return withPreview(m);
          }
        })
      );
      set(state => ({
        messages: { ...state.messages, [id]: decryptedItems },
      }));
    } catch (error) {
      console.error(`Failed to load messages for ${id}`, error);
      set(state => ({ messages: { ...state.messages, [id]: [] } })); // Kosongkan jika error
    }
  },

  initSocketListeners: () => {
    const socket = getSocket();
    socket.off("presence:update");
    socket.off("typing:update");
    socket.off("message:new");
    socket.off("conversation:deleted");
    socket.off("reaction:new");
    socket.off("reaction:remove");
    socket.off("message:deleted");

    socket.on("presence:update", (onlineUserIds: string[]) => {
      console.log("[Socket Event] presence:update", onlineUserIds);
      set({ presence: onlineUserIds });
    });

    socket.on("typing:update", ({ userId, conversationId, isTyping }) => {
      console.log("[Socket Event] typing:update", { userId, isTyping });
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

    socket.on("message:new", (newMessage: Message) => {
      console.log("[Socket Event] message:new", newMessage);
      set(state => {
        // FIX: Abaikan pesan dari diri sendiri untuk mencegah duplikasi
        if (newMessage.senderId === useAuthStore.getState().user?.id) return state;

        const conversationId = newMessage.conversationId;
        const messages = state.messages[conversationId] || [];
        if (messages.some(m => m.id === newMessage.id)) return state;

        const updatedConversations = state.conversations.map(c => 
          c.id === conversationId ? { ...c, lastMessage: withPreview(newMessage) } : c
        );

        return {
          messages: { ...state.messages, [conversationId]: [...messages, newMessage] },
          conversations: sortConversations(updatedConversations),
        };
      });
    });

    socket.on("conversation:new", (newConversation: Conversation) => {
      console.log("[Socket Event] conversation:new", newConversation);
      set(state => {
        const existingIndex = state.conversations.findIndex(c => c.id === newConversation.id);
        let newConversations = [...state.conversations];
        if (existingIndex !== -1) {
          newConversations[existingIndex] = newConversation;
        } else {
          newConversations.push(newConversation);
        }
        return { conversations: sortConversations(newConversations) };
      });
    });

    socket.on("message:deleted", ({ messageId, conversationId }) => {
      console.log("[Socket Event] message:deleted", { messageId, conversationId });
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
      console.log("[Socket Event] reaction:new", reaction);
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
            const newReactions = [...(m.reactions || []), reaction];
            return { ...m, reactions: newReactions };
          }
          return m;
        });

        return { ...state, messages: { ...state.messages, [conversationId]: updatedMessages } };
      });
    });

    socket.on("reaction:remove", ({ reactionId, messageId }) => {
      console.log("[Socket Event] reaction:remove", { reactionId, messageId });
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
            const newReactions = (m.reactions || []).filter(r => r.id !== reactionId);
            return { ...m, reactions: newReactions };
          }
          return m;
        });

        return { ...state, messages: { ...state.messages, [conversationId]: updatedMessages } };
      });
    });
  },
}));