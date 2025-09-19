import { create } from "zustand";
import { api } from "@lib/api";
import { getSocket } from "@lib/socket";
import { encryptMessage, decryptMessage } from "@utils/crypto";

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
  createdAt: string;
  error?: boolean;
  preview?: string;
};

type State = {
  loading: Record<string, boolean>;
  conversations: Conversation[];
  activeId: string | null;
  messages: Record<string, Message[]>;
  cursors: Record<string, string | null>;
  typing: Record<string, string[]>;
  presence: Record<string, boolean>;

  loadConversations: () => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  loadOlderMessages: (conversationId: string) => Promise<void>;

  sendMessage: (
    conversationId: string,
    content: string,
    tempId?: number
  ) => Promise<void>;
  addOptimisticMessage: (conversationId: string, msg: Message) => void;
  markMessageError: (conversationId: string, tempId: number) => void;

  searchUsers: (
    q: string
  ) => Promise<
    { id: string; username: string; name: string; avatarUrl?: string | null }[]
  >;
  startConversation: (peerId: string) => Promise<string>;
  uploadImage: (conversationId: string, file: File) => Promise<void>;
  uploadFile: (conversationId: string, file: File) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;

  setLoading: (id: string, val: boolean) => void;
};

// Add a simple LRU cache for messages
const MESSAGE_CACHE_SIZE = 100;
const messageCache = new Map<string, Message[]>();

function getCachedMessages(conversationId: string): Message[] | undefined {
  return messageCache.get(conversationId);
}

function setCachedMessages(conversationId: string, messages: Message[]): void {
  // If cache is at max size, remove the oldest entry
  if (messageCache.size >= MESSAGE_CACHE_SIZE) {
    const firstKey = messageCache.keys().next().value;
    if (firstKey) {
      messageCache.delete(firstKey);
    }
  }
  
  messageCache.set(conversationId, messages);
}

function clearCachedMessages(conversationId: string): void {
  messageCache.delete(conversationId);
}

function sortConversations(list: Conversation[]) {
  return [...list].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export const useChatStore = create<State>((set, get) => ({
  conversations: [],
  activeId: null,
  messages: {},
  cursors: {},
  typing: {},
  loading: {},
  presence: {},

  async loadConversations() {
    const items = await api<Conversation[]>("/api/conversations");
    set({ conversations: sortConversations(items) });

    const socket = getSocket();

    // ✅ Listener untuk conversation baru
    socket.off("conversation:new");
    socket.on("conversation:new", (conv: Conversation) => {
      set((s) => {
        if (s.conversations.some((c) => c.id === conv.id)) return {};
        return { conversations: sortConversations([...s.conversations, conv]) };
      });
    });
  },

  async openConversation(id) {
    get().setLoading(id, true);
    try {
      // Check cache first
      const cachedMessages = getCachedMessages(id);
      if (cachedMessages) {
        set((s) => ({
          messages: { ...s.messages, [id]: cachedMessages },
        }));
      } else {
        const res = await api<{ items: Message[]; nextCursor: string | null }>(
          `/api/messages/${id}`
        );
        const decryptedItems = res.items.map((m) => {
          // Jika content tidak ada atau kosong, kembalikan null
          if (!m.content) {
            return { ...m, content: null };
          }
          
          // Coba decrypt pesan
          try {
            const decryptedContent = decryptMessage(m.content, m.conversationId);
            return { ...m, content: decryptedContent };
          } catch (error) {
            console.error('Decryption failed for message:', m.id, error);
            // Kembalikan content asli jika decryption gagal
            return { ...m, content: m.content };
          }
        });
        const messages = decryptedItems.reverse();
        set((s) => ({
          messages: { ...s.messages, [id]: messages },
          cursors: { ...s.cursors, [id]: res.nextCursor },
        }));
        
        // Cache the messages
        setCachedMessages(id, messages);
      }
    } finally {
      get().setLoading(id, false);
    }

    set({ activeId: id });

    const socket = getSocket();
    socket.emit("conversation:join", id);

    socket.off("message:new");
    socket.on(
      "message:new",
      (msg: Message & { tempId?: number; preview?: string }) => {
        set((s) => {
          const { conversations, messages } = s;
          const curr = messages[msg.conversationId] || [];

          let next = msg.tempId
            ? curr.filter((m) => m.tempId !== msg.tempId)
            : curr;
          if (next.some((m) => m.id === msg.id)) return {};

          const decryptedMsg = {
            ...msg,
            content: msg.content ? decryptMessage(msg.content, msg.conversationId) : null,
          };

          let updated = conversations.map((c) =>
            c.id === msg.conversationId
              ? {
                  ...c,
                  lastMessage: decryptedMsg,
                  updatedAt: new Date().toISOString(),
                }
              : c
          );

          if (!updated.find((c) => c.id === msg.conversationId)) {
            updated.push({
              id: msg.conversationId,
              isGroup: false,
              title: null,
              participants: [],
              lastMessage: decryptedMsg,
              updatedAt: new Date().toISOString(),
            });
          }

          updated = sortConversations(updated);

          return {
            messages: {
              ...messages,
              [msg.conversationId]: [...next, decryptedMsg],
            },
            conversations: updated,
          };
        });
      }
    );

    socket.off("message:deleted");
    socket.on("message:deleted", ({ id, conversationId }) => {
      set((s) => {
        const updatedMessages = (s.messages[conversationId] || []).map((m) =>
          m.id === id
            ? {
                ...m,
                content: "[deleted]",
                imageUrl: null,
                fileUrl: null,
                fileName: null,
              }
            : m
        );

        const updatedConversations = s.conversations.map((c) => {
          if (c.id === conversationId && c.lastMessage?.id === id) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                content: "[deleted]",
                imageUrl: null,
                fileUrl: null,
                fileName: null,
                preview: undefined,
              },
            };
          }
          return c;
        });

        return {
          messages: { ...s.messages, [conversationId]: updatedMessages },
          conversations: updatedConversations,
        };
      });
    });

    socket.off("typing");
    socket.on("typing", ({ userId, isTyping, conversationId }) => {
      if (conversationId !== id) return;
      set((s) => {
        const curr = new Set(s.typing[id] || []);
        if (isTyping) curr.add(userId);
        else curr.delete(userId);
        return { typing: { ...s.typing, [id]: Array.from(curr) } };
      });
    });

    socket.off("presence:update");
    socket.on("presence:update", ({ userId, online }) => {
      set((s) => ({
        presence: { ...s.presence, [userId]: online },
      }));
    });
  },

  async loadOlderMessages(conversationId) {
    const cursor = get().cursors[conversationId];
    if (!cursor) return;

    const url = `/api/messages/${conversationId}?cursor=${encodeURIComponent(
      cursor
    )}`;
    const res = await api<{ items: Message[]; nextCursor: string | null }>(
      url
    );

    const decryptedItems = res.items.map((m) => ({
      ...m,
      content: m.content ? decryptMessage(m.content, m.conversationId) : null,
    }));

    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [
          ...decryptedItems.reverse(),
          ...(s.messages[conversationId] || []),
        ],
      },
      cursors: { ...s.cursors, [conversationId]: res.nextCursor },
    }));
    
    // Update cache
    const currentMessages = get().messages[conversationId] || [];
    setCachedMessages(conversationId, currentMessages);
  },

  async sendMessage(conversationId, content, tempId) {
    const socket = getSocket();
    return new Promise((resolve, reject) => {
      encryptMessage(content, conversationId).then(encrypted => {
        socket.emit(
          "message:send",
          { conversationId, content: encrypted, tempId },
          (ack: { ok: boolean; msg?: Message }) => {
            if (ack?.ok && ack.msg) {
              decryptMessage(ack.msg.content || "", ack.msg.conversationId).then(decryptedContent => {
                const decryptedAck = {
                  ...ack.msg,
                  content: decryptedContent,
                };

                set((s) => {
                  let updated = s.conversations.map((c) =>
                    c.id === conversationId
                      ? {
                          ...c,
                          lastMessage: decryptedAck,
                          updatedAt: new Date().toISOString(),
                        }
                      : c
                  );

                  if (!updated.find((c) => c.id === conversationId)) {
                    updated.push({
                      id: conversationId,
                      isGroup: false,
                      title: null,
                      participants: [],
                      lastMessage: decryptedAck,
                      updatedAt: new Date().toISOString(),
                    });
                  }

                  updated = sortConversations(updated);

                  return {
                    messages: {
                      ...s.messages,
                      [conversationId]: (s.messages[conversationId] || []).map(
                        (m) => (m.tempId === tempId ? decryptedAck : m)
                      ),
                    },
                    conversations: updated,
                  };
                });
                resolve();
              }).catch(() => {
                const decryptedAck = {
                  ...ack.msg,
                  content: "[Failed to decrypt]",
                };

                set((s) => {
                  let updated = s.conversations.map((c) =>
                    c.id === conversationId
                      ? {
                          ...c,
                          lastMessage: decryptedAck,
                          updatedAt: new Date().toISOString(),
                        }
                      : c
                  );

                  if (!updated.find((c) => c.id === conversationId)) {
                    updated.push({
                      id: conversationId,
                      isGroup: false,
                      title: null,
                      participants: [],
                      lastMessage: decryptedAck,
                      updatedAt: new Date().toISOString(),
                    });
                  }

                  updated = sortConversations(updated);

                  return {
                    messages: {
                      ...s.messages,
                      [conversationId]: (s.messages[conversationId] || []).map(
                        (m) => (m.tempId === tempId ? decryptedAck : m)
                      ),
                    },
                    conversations: updated,
                  };
                });
                resolve();
              });
            } else {
              get().markMessageError(conversationId, tempId!);
              reject(new Error("Send failed"));
            }
          }
        );
      }).catch(error => {
        console.error("Encryption failed:", error);
        get().markMessageError(conversationId, tempId!);
        reject(new Error("Failed to encrypt message"));
      });
    });
  },

  addOptimisticMessage(conversationId, msg) {
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] || []), msg],
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

  async searchUsers(q) {
    return api(`/api/users/search?q=${encodeURIComponent(q)}`);
  },

  async startConversation(peerId) {
    const r = await api<{ id: string }>("/api/conversations/start", {
      method: "POST",
      body: JSON.stringify({ peerId }),
    });

    // ✅ langsung trigger loadConversations agar sinkron
    await get().loadConversations();

    return r.id;
  },

  async uploadImage(conversationId, file) {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch(
      `${
        import.meta.env.VITE_API_URL || "http://localhost:4000"
      }/api/conversations/${conversationId}/upload-image`,
      { method: "POST", body: form, credentials: "include" }
    );
    if (!res.ok) throw new Error("Upload failed");
    const data = (await res.json()) as { imageUrl: string };

    const socket = getSocket();
    socket.emit("message:send", {
      conversationId,
      imageUrl: data.imageUrl,
      preview: "📷 Photo",
    });
  },

  async uploadFile(conversationId, file) {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(
      `${
        import.meta.env.VITE_API_URL || "http://localhost:4000"
      }/api/conversations/${conversationId}/upload`,
      { method: "POST", body: form, credentials: "include" }
    );
    if (!res.ok) throw new Error("Upload failed");

    const data = (await res.json()) as { fileUrl: string; fileName: string };

    const socket = getSocket();
    socket.emit("message:send", {
      conversationId,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      preview: `📎 ${data.fileName}`,
    });
  },

  async deleteMessage(conversationId, messageId) {
    const res = await fetch(
      `${
        import.meta.env.VITE_API_URL || "http://localhost:4000"
      }/api/conversations/${conversationId}/messages/${messageId}`,
      { method: "DELETE", credentials: "include" }
    );
    if (!res.ok) throw new Error("Delete failed");
  },

  setLoading: (id, val) =>
    set((s) => ({
      loading: { ...s.loading, [id]: val },
    })),
}));