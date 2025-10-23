import { create } from "zustand";
import { api } from "@lib/api";
import { getSocket } from "@lib/socket";
import { encryptMessage, decryptMessage } from "@utils/crypto";
import toast from "react-hot-toast";

export type Conversation = {
  id: string;
  isGroup: boolean;
  title?: string | null;
  participants: {
    id: string;
    username: string;
    name: string;
    avatarUrl?: string | null;
  }[];
  lastMessage: (Message & { preview?: string }) | null;
  updatedAt: string;
};

export type Message = {
  id: string;
  tempId?: number;
  conversationId: string;
  senderId: string;
  content?: string | null;
  imageUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string;
  fileSize?: number;
  sessionId?: string | null; // New field for session key ID
  encryptedSessionKey?: string | null; // New field for encrypted session key
  createdAt: string;
  error?: boolean;
  preview?: string;
  reactions?: { emoji: string; userIds: string[] }[];
  readBy?: string[];
  // optional optimistic marker
  optimistic?: boolean;
};

type State = {
  loading: Record<string, boolean>;
  conversations: Conversation[];
  activeId: string | null;
  messages: Record<string, Message[]>;
  cursors: Record<string, string | null>;
  typing: Record<string, string[]>;
  presence: Record<string, boolean>;
  deleteLoading: Record<string, boolean>;

  loadConversations: () => Promise<void>;
  openConversation: (id: string | null | undefined) => Promise<void>;
  loadOlderMessages: (conversationId: string) => Promise<void>;

  sendMessage: (
    conversationId: string,
    messageData: Partial<Message>,
    tempId?: number
  ) => Promise<void>;
  addOptimisticMessage: (conversationId: string, msg: Message) => void;
  markMessageError: (conversationId: string, tempId: number) => void;

  uploadFile: (conversationId: string, file: File) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  searchUsers: (q: string) => Promise<{ id: string; username: string; name: string; avatarUrl?: string | null }[]>;
  startConversation: (peerId: string) => Promise<string>;

  setLoading: (id: string, val: boolean) => void;
};

// Helper to generate a preview string for different file types
function getFilePreview(fileName?: string | null, fileType?: string): string {
    if (!fileType) return '📎 File';
    if (fileType.startsWith('image/')) return '📷 Image';
    if (fileType.startsWith('video/')) return '🎥 Video';
    if (fileType.startsWith('audio/')) return '🎵 Audio';
    return `📎 ${fileName || 'File'}`;
}


function normalizeMessageForMerge(m: any) {
  if (!m) return null
  return {
    id: m.id,
    content: normalizeMessageContent(m.content),
    senderId: m.senderId,
    createdAt: m.createdAt ?? new Date().toISOString(),
    tempId: m.tempId
  }
}

function normalizeMessageContent(raw: any): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && "content" in raw) {
    const val = raw.content;
    return typeof val === "string" ? val : "";
  }
  return String(raw ?? "");
}

function withPreview(msg: Message): Message {
  if (msg.imageUrl || msg.fileUrl) {
      return { ...msg, preview: getFilePreview(msg.fileName, msg.fileType) };
  }
  return msg;
}

function sortConversations(list: Conversation[]) {
  return [...list].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

const initialActiveId = localStorage.getItem("activeId");

export const useChatStore = create<State>((set, get) => ({
  conversations: [],
  activeId: initialActiveId,
  messages: {},
  cursors: {},
  typing: {},
  loading: {},
  presence: {},
  deleteLoading: {},

  async loadConversations() {
    const items = await api<Conversation[]>("/api/conversations");
    const safeItems = items.map((c) => ({
      ...c,
      lastMessage: c.lastMessage ? withPreview(c.lastMessage) : null,
    }));
    set({ conversations: sortConversations(safeItems) });

    const socket = getSocket();
    socket.off("conversation:new");
    socket.on("conversation:new", (conv: Conversation) => {
      const convSafe = {
        ...conv,
        lastMessage: conv.lastMessage ? withPreview(conv.lastMessage) : null,
      };
      set((s) => {
        if (s.conversations.some((c) => c.id === convSafe.id)) return {};
        return {
          conversations: sortConversations([...s.conversations, convSafe]),
        };
      });
    });
  },

  async openConversation(id) {
    if (!id) {
      console.warn("[ChatStore] openConversation called without id");
      return;
    }
    localStorage.setItem("activeId", id);
    get().setLoading(id, true);
    try {
      const res = await api<{ items: Message[]; nextCursor: string | null }>(
        `/api/messages/${id}`
      );
      const decryptedItems = await Promise.all(
        res.items.map(async (m) => {
          if (!m || typeof m !== 'object' || !m.id || !m.senderId) {
            console.warn('Skipping invalid message during load:', m);
            return null;
          }
          try {
            m.content = await decryptMessage(m.content || '', m.conversationId);
            return withPreview(m);
          } catch (err) {
            console.error("Decrypt failed:", m.id, err);
            m.content = '[Failed to decrypt message]';
            return withPreview(m);
          }
        })
      );
      const validDecryptedItems = decryptedItems.filter(Boolean) as Message[];
      set((s) => ({
        messages: { ...s.messages, [id]: validDecryptedItems },
        cursors: { ...s.cursors, [id]: res.nextCursor },
      }));
    } finally {
      get().setLoading(id, false);
    }

    set({ activeId: id });
    const socket = getSocket();
    socket.emit("conversation:join", id);

    socket.off("message:new");
    socket.on("message:new", async (msg: Message) => {
        if (!msg || !msg.conversationId) return;

        try {
            msg.content = await decryptMessage(msg.content || "", msg.conversationId);
        } catch (e) {
            console.error("Failed to decrypt message:", e);
            msg.content = "[Failed to decrypt message]";
        }

        set((s) => {
            const conversationId = msg.conversationId;
            const messages = s.messages[conversationId] || [];
            let messageExists = false;

            const updatedMessages = messages.map((m) => {
                if ((msg.tempId && m.tempId === msg.tempId) || (msg.id && m.id === msg.id)) {
                    messageExists = true;
                    return withPreview(msg);
                }
                return m;
            });

            if (!messageExists) {
                updatedMessages.push(withPreview(msg));
            }

            const updatedConversations = s.conversations.map((c) =>
                c.id === conversationId
                    ? {
                        ...c,
                        lastMessage: withPreview(msg),
                        updatedAt: new Date().toISOString(),
                    }
                    : c
            );

            return {
                messages: {
                    ...s.messages,
                    [conversationId]: updatedMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
                },
                conversations: sortConversations(updatedConversations),
            };
        });
    });
  },

  async sendMessage(conversationId, messageData, tempId) {
    const socket = getSocket();
    const finalData = { ...messageData };

    if (finalData.content) {
        finalData.content = await encryptMessage(finalData.content, conversationId);
    }

    return new Promise((resolve, reject) => {
        socket.emit(
            "message:send",
            { conversationId, ...finalData, tempId },
            (ack: { ok: boolean; msg?: Message }) => {
                if (ack?.ok) {
                    resolve();
                } else {
                    get().markMessageError(conversationId, tempId!);
                    reject(new Error("Send failed"));
                }
            }
        );
    });
  },

  addOptimisticMessage(conversationId, msg) {
    const tempId = msg.tempId ?? Date.now();
    const optimisticMsg: Message = withPreview({
        ...msg,
        id: `temp-${tempId}`,
        tempId,
        conversationId,
        optimistic: true,
        error: false,
        createdAt: new Date().toISOString(),
    });

    set((s) => ({
        messages: {
            ...s.messages,
            [conversationId]: [...(s.messages[conversationId] || []), optimisticMsg],
        },
    }));
  },

  markMessageError(conversationId, tempId) {
    set((s) => ({
        messages: {
            ...s.messages,
            [conversationId]: (s.messages[conversationId] || []).map((m) =>
                m.tempId === tempId ? { ...m, error: true } : m
            ),
        },
    }));
  },

  async uploadFile(conversationId, file) {
    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
        const form = new FormData();
        form.append("file", file);

        // Gunakan api() wrapper yang sudah menangani CSRF
        const { file: fileData } = await api<{ file: any }>(
            `/api/uploads/${conversationId}/upload`,
            { method: "POST", body: form }
        );

        toast.success("File uploaded!", { id: toastId });

        // Kirim file sebagai pesan chat
        const tempId = Date.now();
        get().addOptimisticMessage(conversationId, {
            senderId: "", // Akan diisi oleh server
            fileUrl: fileData.url,
            fileName: fileData.filename,
            fileType: fileData.mimetype,
            fileSize: fileData.size,
            content: '', // FIX: Set content to empty
        } as Message);

        await get().sendMessage(conversationId, {
            fileUrl: fileData.url,
            fileName: fileData.filename,
            fileType: fileData.mimetype,
            fileSize: fileData.size,
            content: '', // FIX: Ensure content is empty
        }, tempId);

    } catch (error: any) {
        console.error("Upload failed:", error);
        const errorMessage = error.details ? JSON.parse(error.details).error : error.message;
        toast.error(`Upload failed: ${errorMessage}`, { id: toastId });
    }
  },

  async searchUsers(q) {
    return api(`/api/users/search?q=${encodeURIComponent(q)}`);
  },

  async startConversation(peerId) {
    const r = await api<{ id: string }>("/api/conversations/start", {
      method: "POST",
      body: JSON.stringify({ peerId }),
    });
    await get().loadConversations();
    return r.id;
  },

  async loadOlderMessages(conversationId) {
    const cursor = get().cursors[conversationId];
    if (!cursor) return;

    const url = `/api/messages/${conversationId}?cursor=${encodeURIComponent(cursor)}`;
    const res = await api<{ items: Message[]; nextCursor: string | null }>(url);

    const decryptedItems = await Promise.all(
      res.items.map(async (m) => {
        if (!m || typeof m !== 'object' || !m.id || !m.senderId) {
          return null;
        }
        try {
          m.content = await decryptMessage(m.content || '', m.conversationId);
          return withPreview(m);
        } catch (err) {
          m.content = '[Failed to decrypt message]';
          return withPreview(m);
        }
      })
    );
    const validDecryptedItems = decryptedItems.filter(Boolean) as Message[];

    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...validDecryptedItems, ...(s.messages[conversationId] || [])],
      },
      cursors: { ...s.cursors, [conversationId]: res.nextCursor },
    }));
  },

  async deleteMessage(conversationId, messageId) {
    await api(`/api/messages/${conversationId}/${messageId}`, { method: 'DELETE' });
    // The socket event 'message:deleted' will handle the UI update
  },

  setLoading: (id, val) =>
    set((s) => ({
      loading: { ...s.loading, [id]: val },
    })),
}));