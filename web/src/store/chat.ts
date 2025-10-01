import { create } from "zustand";
import { api } from "@lib/api";
import { getSocket } from "@lib/socket";
import { encryptMessage, decryptMessage } from "@utils/advancedCrypto";

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
    content: string,
    tempId?: number
  ) => Promise<void>;
  addOptimisticMessage: (conversationId: string, msg: Message) => void;
  markMessageError: (conversationId: string, tempId: number) => void;
  replaceMessageTemp: (conversationId: string, tempId: number, msg: Message) => void;

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

// === Cache sederhana untuk messages ===
const MESSAGE_CACHE_SIZE = 100;
const messageCache = new Map<string, Message[]>();

function getCachedMessages(conversationId: string): Message[] | undefined {
  return messageCache.get(conversationId);
}

function setCachedMessages(conversationId: string, messages: Message[]): void {
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

// Helper → kasih preview kalau ada file/gambar
function withPreview(msg: Message): Message {
  if (msg.imageUrl) return { ...msg, preview: "📷 Photo" };
  if (msg.fileUrl) return { ...msg, preview: `📎 ${msg.fileName || "File"}` };
  return msg;
}

// === Restore activeId dari localStorage saat init ===
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
      console.warn("[ChatStore] openConversation dipanggil tanpa id");
      return;
    }

    // 🔑 persist activeId ke localStorage
    localStorage.setItem("activeId", id);

    get().setLoading(id, true);
    try {
      const cachedMessages = getCachedMessages(id);
      if (cachedMessages) {
        set((s) => ({
          messages: { ...s.messages, [id]: cachedMessages },
        }));
      } else {
        const res = await api<{ items: Message[]; nextCursor: string | null }>(
          `/api/messages/${id}`
        );

        const decryptedItems = await Promise.all(
          res.items.map(async (m) => {
            if (!m.content) return withPreview({ ...m, content: null });
            try {
              // Check if this is the new format with session keys
              if (m.sessionId && m.encryptedSessionKey) {
                const decryptedContent = await decryptMessage({
                  content: m.content,
                  sessionId: m.sessionId,
                  encryptedSessionKey: m.encryptedSessionKey
                });
                return withPreview({ ...m, content: decryptedContent });
              } else {
                // This is an old message, might need legacy decryption
                // For now, return as is but in the future we'd implement migration
                return withPreview({ ...m, content: m.content });
              }
            } catch (err) {
              console.error("Decrypt failed:", m.id, err);
              return withPreview({ ...m, content: m.content });
            }
          })
        );

        const messages = decryptedItems.reverse();
        set((s) => ({
          messages: { ...s.messages, [id]: messages },
          cursors: { ...s.cursors, [id]: res.nextCursor },
        }));
        setCachedMessages(id, messages);
      }
    } finally {
      get().setLoading(id, false);
    }

    set({ activeId: id });

    const socket = getSocket();
    socket.emit("conversation:join", id);

    // === Socket events ===
    socket.off("message:new");
    socket.on("message:new", (msg: Message & { tempId?: number }) => {
      set((s) => {
        const curr = s.messages[msg.conversationId] || [];
        let next = msg.tempId
          ? curr.filter((m) => m.tempId !== msg.tempId)
          : curr;
        if (next.some((m) => m.id === msg.id)) return {};

        Promise.resolve()
          .then(async () => {
            let decryptedContent: string | null = null;
            try {
              // Check if this is the new format with session keys
              if (msg.sessionId && msg.encryptedSessionKey) {
                decryptedContent = msg.content
                  ? await decryptMessage({
                      content: msg.content,
                      sessionId: msg.sessionId,
                      encryptedSessionKey: msg.encryptedSessionKey
                    })
                  : null;
              } else {
                // This is an old message format
                decryptedContent = msg.content || "[Failed to decrypt]";
              }
            } catch (err) {
              console.error("Decrypt failed (new):", msg.id, err);
              decryptedContent = msg.content || "[Failed to decrypt]";
            }
            const decryptedMsg = withPreview({ ...msg, content: decryptedContent });

            set((state) => {
              let updated = state.conversations.map((c) =>
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
                  ...state.messages,
                  [msg.conversationId]: [...next, decryptedMsg],
                },
                conversations: updated,
              };
            });
          })
          .catch((e) => console.error("Async decrypt error", e));

        return {};
      });
    });

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
                preview: undefined,
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
    const res = await api<{ items: Message[]; nextCursor: string | null }>(url);

    const decryptedItems = await Promise.all(
      res.items.map(async (m) => {
        if (!m.content) return withPreview({ ...m, content: null });
        return withPreview({
          ...m,
          content: await decryptMessage(m.content, m.conversationId),
        });
      })
    );

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

    const currentMessages = get().messages[conversationId] || [];
    setCachedMessages(conversationId, currentMessages);
  },

  async sendMessage(conversationId, content, tempId) {
    const socket = getSocket();
    return new Promise((resolve, reject) => {
      encryptMessage(content, conversationId)
        .then(({ content: encryptedContent, sessionId, encryptedSessionKey }) => {
          socket.emit(
            "message:send",
            { conversationId, content: encryptedContent, sessionId, encryptedSessionKey, tempId },
            (ack: { ok: boolean; msg?: Message }) => {
              if (ack?.ok && ack.msg) {
                decryptMessage({
                  content: ack.msg.content || "",
                  sessionId: ack.msg.sessionId,
                  encryptedSessionKey: ack.msg.encryptedSessionKey
                })
                  .then((decryptedContent) => {
                    const decryptedAck = withPreview({
                      ...ack.msg,
                      content: decryptedContent,
                    });

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
                          [conversationId]: (
                            s.messages[conversationId] || []
                          ).map((m) =>
                            // replace by tempId if present
                            m.tempId === tempId || m.id === `temp-${tempId}`
                              ? decryptedAck
                              : m
                          ),
                        },
                        conversations: updated,
                      };
                    });
                    resolve();
                  })
                  .catch(() => {
                    const decryptedAck = withPreview({
                      ...ack.msg,
                      content: "[Failed to decrypt]",
                    });
                    set((s) => ({
                      messages: {
                        ...s.messages,
                        [conversationId]: (
                          s.messages[conversationId] || []
                        ).map((m) =>
                          m.tempId === tempId || m.id === `temp-${tempId}`
                            ? decryptedAck
                            : m
                        ),
                      },
                    }));
                    resolve();
                  });
              } else {
                get().markMessageError(conversationId, tempId!);
                reject(new Error("Send failed"));
              }
            }
          );
        })
        .catch((error) => {
          console.error("Encryption failed:", error);
          get().markMessageError(conversationId, tempId!);
          reject(new Error("Failed to encrypt message"));
        });
    });
  },

  addOptimisticMessage(conversationId, msg) {
    // Ensure optimistic message has a stable temporary id & id
    const tempId = msg.tempId ?? Date.now();
    const optimistic: Message = withPreview({
      ...msg,
      tempId,
      id: msg.id && msg.id.length > 0 ? msg.id : `temp-${tempId}`,
      optimistic: true,
      error: false,
    });

    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] || []), optimistic],
      },
    }));
  },

  markMessageError(conversationId, tempId) {
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] || []).map((m) =>
          m.tempId === tempId || m.id === `temp-${tempId}`
            ? { ...m, error: true }
            : m
        ),
      },
    }));
  },

  replaceMessageTemp(conversationId, tempId, msg) {
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] || []).map((m) =>
          m.tempId === tempId || m.id === `temp-${tempId}` ? { ...msg } : m
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
