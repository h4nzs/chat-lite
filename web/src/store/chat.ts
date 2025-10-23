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

function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const merged = [...existing];
  
  for (const m of incoming ?? []) {
    // Relaxed validation to prevent missing messages
    if (!m?.id) continue;
    // Use normalizeMessageContent to properly handle structured content
    m.content = normalizeMessageContent(m.content);
    
    console.log("Merging message:", m);
    
    if (!merged.find((x) => x.id === m.id)) merged.push(m);
  }
  
  // Sort if messages have timestamps
  merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  return merged;
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

function normalizeMessage(m: any) {
  if (!m) return m;
  // Use normalizeMessageContent to properly handle structured content
  m.content = normalizeMessageContent(m.content);
  return m;
}

function sortConversations(list: Conversation[]) {
  return [...list].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// Helper → kasih preview kalau ada file/gambar
function withPreview(msg: Message): Message {
  // Normalize content to ensure it's a string
  const normalizedContent = normalizeMessageContent(msg.content);
  if (msg.imageUrl) return { ...msg, content: normalizedContent, preview: "📷 Photo" };
  if (msg.fileUrl) return { ...msg, content: normalizedContent, preview: `📎 ${msg.fileName || "File"}` };
  return { ...msg, content: normalizedContent };
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
        // Check if we already have messages for this conversation and preserve them
        if (get().activeId === id && get().messages[id] && get().messages[id].length > 0) {
          console.log("Preserving current messages for conversation:", id);
          return; // Skip resetting messages
        }
        
        try {
          const res = await api<{ items: Message[]; nextCursor: string | null }>(
            `/api/messages/${id}`
          );

          const decryptedItems = await Promise.all(
            res.items.map(async (m) => {
              // Add validation for message object
              if (!m || typeof m !== 'object' || !m.id || !m.senderId) {
                console.warn('Skipping invalid message during load:', m);
                return null; // This will be filtered out below
              }
              
              // Normalize content before processing
              m.content = normalizeMessageContent(m.content);
              
              // Don't filter out messages with empty content - just process them normally
              try {
                // Check if this is the new format with session keys
                if (m.sessionId && m.encryptedSessionKey) {
                  const decryptedContent = await decryptMessage(m.content, m.conversationId);
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
          
          // Filter out any null messages that failed validation
          const validDecryptedItems = decryptedItems.filter(item => item !== null) as Message[];

          // Don't reverse - keep chronological order (oldest first, newest last)
          const messages = validDecryptedItems;
          set((s) => {
            const existing = s.messages[id] ?? [];
            const merged = [...existing];

            for (const m of messages) {
              if (!merged.find((x) => x.id === m.id)) merged.push(m);
            }

            console.log("Messages updated:", existing.length, "→", merged.length);
            return { 
              messages: { ...s.messages, [id]: merged },
              cursors: { ...s.cursors, [id]: res.nextCursor },
            };
          });
          setCachedMessages(id, get().messages[id] || []);
        } catch (error) {
          // Handle case where conversation doesn't exist
          if (error instanceof Error && (error.message.includes('404') || error.message.includes('Not Found'))) {
            console.warn(`[ChatStore] Conversation ${id} not found, clearing from localStorage`);
            localStorage.removeItem("activeId");
            set({ activeId: null });
            // Reload conversations to get fresh data
            await get().loadConversations();
            return;
          }
          throw error;
        }
      }
    } finally {
      get().setLoading(id, false);
    }

    set({ activeId: id });

    const socket = getSocket();
    socket.emit("conversation:join", id);

    // === Socket events ===
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
        // Add validation for message object
        if (!m || typeof m !== 'object' || !m.id || !m.senderId) {
          console.warn('Skipping invalid message during older messages load:', m);
          return null; // This will be filtered out below
        }
        
        // Normalize message before processing
        m = normalizeMessage(m);
        
        // Normalize content before processing
        m.content = normalizeMessageContent(m.content);
        
        // Don't filter out messages with empty content - just process them normally
        // Check if this is the new format with session keys
        if (m.sessionId && m.encryptedSessionKey) {
          const decryptedContent = await decryptMessage(m.content, m.conversationId);
          return withPreview({ ...m, content: decryptedContent });
        } else {
          // This is an old message, might need legacy decryption
          // For now, return as is but in the future we'd implement migration
          return withPreview({ ...m, content: m.content });
        }
      })
    );
    
    // Filter out any null messages that failed validation
    const validDecryptedItems = decryptedItems.filter(item => item !== null) as Message[];

    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [
          ...validDecryptedItems, // Don't reverse - prepend older messages in chronological order
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
        .then((encryptedContent) => {
          socket.emit(
            "message:send",
            { conversationId, content: encryptedContent, tempId },
            (ack: { ok: boolean; msg?: Message }) => {
              if (ack?.ok && ack.msg) {
                // The message:new handler will receive this and update the state
                // The ack is just for confirmation and error handling
                resolve();
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
    const normalizedMsg = normalizeMessageForMerge(msg);
    if (!normalizedMsg || !normalizedMsg.senderId) {
      console.warn('Skipping invalid optimistic message:', msg);
      return;
    }
    
    console.log("📥 Adding optimistic message:", { conversationId, msg: normalizedMsg });
    
    // Ensure optimistic message has a stable temporary id & id
    const tempId = normalizedMsg.tempId ?? Date.now();
    const optimistic: Message = withPreview({
      ...normalizedMsg,
      conversationId, // Ensure conversationId is present
      tempId,
      id: normalizedMsg.id && normalizedMsg.id.length > 0 ? normalizedMsg.id : `temp-${tempId}`,
      optimistic: true,
      error: false,
    });

    set((s) => {
      const updatedMessages = [...(s.messages[conversationId] || []), optimistic];
      console.log(`📤 Added optimistic message to conversation ${conversationId}. Total messages:`, updatedMessages.length, "Message:", optimistic);
      return {
        messages: {
          ...s.messages,
          [conversationId]: updatedMessages,
        },
      };
    });
  },

  markMessageError(conversationId, tempId) {
    set((s) => {
      const conversationMessages = s.messages[conversationId] || [];
      // Check if there's actually a message to mark as error
      const hasMessageToMark = conversationMessages.some(m => 
        (m as any).tempId === tempId || m.id === `temp-${tempId}`
      );
      
      if (!hasMessageToMark) {
        console.warn(`No message found with tempId ${tempId} to mark as error in conversation ${conversationId}`);
        return {}; // Return empty update if no message to mark
      }
      
      console.log(`❌ Marking message as error in conversation ${conversationId}:`, { tempId });
      
      return {
        messages: {
          ...s.messages,
          [conversationId]: conversationMessages.map((m) => {
            if ((m as any).tempId === tempId || m.id === `temp-${tempId}`) {
              console.log("🚫 Marking message as error:", m);
              return { ...m, error: true };
            }
            return m;
          }),
        },
      };
    });
  },

  replaceMessageTemp(conversationId, tempId, msg) {
    const normalizedMsg = normalizeMessageForMerge(msg);
    if (!normalizedMsg || !normalizedMsg.id || !normalizedMsg.senderId) {
      console.warn('Skipping invalid replacement message:', msg);
      return;
    }
    
    console.log("📥 Replacing temporary message:", { conversationId, tempId, msg: normalizedMsg });
    
    set((s) => {
      const conversationMessages = s.messages[conversationId] || [];
      const updatedMessages = conversationMessages.map((m) =>
        (m as any).tempId === tempId || m.id === `temp-${tempId}` ? { 
          ...normalizedMsg,
          conversationId, // Ensure conversationId is present
          tempId: normalizedMsg.tempId // Preserve tempId if it exists
        } : m
      );
      
      console.log(`📤 Replaced temporary message in conversation ${conversationId}. Total messages:`, updatedMessages.length);
      
      return {
        messages: {
          ...s.messages,
          [conversationId]: updatedMessages,
        },
      };
    });
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
      }/api/uploads/${conversationId}/upload-image`,
      { method: "POST", body: form, credentials: "include" }
    );
    if (!res.ok) throw new Error("Upload failed");
    const data = (await res.json()) as { imageUrl: string };

    const socket = getSocket();
    socket.emit("message:send", {
      conversationId,
      imageUrl: data.imageUrl,
      preview: "📷 Photo",
    }, () => {}); // Add empty callback to match expected signature
  },

  async uploadFile(conversationId, file) {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(
      `${
        import.meta.env.VITE_API_URL || "http://localhost:4000"
      }/api/uploads/${conversationId}/upload`,
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
    }, () => {}); // Add empty callback to match expected signature
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
