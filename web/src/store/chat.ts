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
  reactions?: { emoji: string; userIds: string[] }[];
  readBy?: string[];
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
  conversationCursor: string | null; // Tambahkan ini untuk paginasi conversations

  loadConversations: (cursor?: string) => Promise<void>;
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
  // Gunakan Intl.Collator untuk sorting yang lebih efisien
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  
  const sorted = [...list].sort((a, b) => {
    // Urutkan berdasarkan updatedAt terbaru
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  
  console.log("Sorting conversations:", list, "Result:", sorted); // Debug log
  return sorted;
}

export const useChatStore = create<State>((set, get) => ({
  conversations: [],
  activeId: null,
  messages: {},
  cursors: {},
  typing: {},
  loading: {},
  presence: {},
  deleteLoading: {},

async loadConversations(cursor?: string) {
  try {
    const url = cursor 
      ? `/api/conversations?cursor=${encodeURIComponent(cursor)}` 
      : "/api/conversations";
      
    const response = await api<{ items: Conversation[]; nextCursor: string | null }>(url);
    console.log("Conversations API response:", response); // Debug log
    const { items, nextCursor } = response;

    // 🔒 Normalisasi data agar selalu punya id
    const normalized = items
      .filter(c => !!c.id) // skip kalau id kosong
      .map(c => ({
        ...c,
        id: c.id || (c as any)._id || (c as any).conversationId,
      }));

    set((state) => {
      // Jika ada cursor, tambahkan ke daftar yang sudah ada, jika tidak timpa
      const conversations = cursor 
        ? [...state.conversations, ...normalized]
        : normalized;
        
      return { 
        conversations: sortConversations(conversations),
        conversationCursor: nextCursor
      };
    });

    const socket = getSocket();

    // ✅ Listener untuk conversation baru
    socket.off("conversation:new");
    socket.on("conversation:new", (conv: Conversation) => {
      set((s) => {
        if (!conv?.id) return {}; // skip invalid
        if (s.conversations.some((c) => c.id === conv.id)) return {};
        return { conversations: sortConversations([...s.conversations, conv]) };
      });
    });
  } catch (error) {
    console.error("Failed to load conversations:", error);
  }
},

  async openConversation(id) {
    // Fix: Add guard for undefined id
    if (!id) {
      console.warn("openConversation called with undefined id");
      return;
    }
    
    console.log("Opening conversation:", id); // Debug log
    get().setLoading(id, true);
  try {
    // Always fetch fresh messages from API to ensure completeness
    // This fixes the issue where cached messages were incomplete after refresh
    console.log("Fetching messages from API for conversation:", id); // Debug log
    
    // Load initial batch of messages
    const res = await api<{ items: Message[]; nextCursor: string | null }>(
      `/api/messages/${id}`
    );
    console.log("Messages API response:", res); // Debug log
    
    let allMessages: Message[] = [];
    let nextCursor = res.nextCursor;
    
    // Decrypt initial batch
    const decryptedItems = await Promise.all(res.items.map(async (m) => {
      console.log("Decrypting message:", m); // Debug log
      console.log("Message encrypted content:", m.content); // Debug log
      // Jika content tidak ada atau kosong, kembalikan null
      if (!m.content) {
        console.log("Message has no content, returning null"); // Debug log
        return { ...m, content: null };
      }
      
      // Coba decrypt pesan
      try {
        const decryptedContent = await decryptMessage(m.content, m.conversationId);
        console.log("Decrypted content:", decryptedContent); // Debug log
        return { ...m, content: decryptedContent };
      } catch (error) {
        console.error('Decryption failed for message:', m.id, error);
        // Kembalikan content asli jika decryption gagal
        return { ...m, content: `[Failed to decrypt: ${m.content}]` };
      }
    }));
    
    allMessages = [...decryptedItems.reverse()];
    
    // Load additional batches if there are more messages
    let batchCount = 0;
    const MAX_BATCHES = 10; // Prevent infinite loops
    
    while (nextCursor && batchCount < MAX_BATCHES) {
      console.log("Fetching additional messages with cursor:", nextCursor); // Debug log
      const nextRes = await api<{ items: Message[]; nextCursor: string | null }>(
        `/api/messages/${id}?cursor=${encodeURIComponent(nextCursor)}`
      );
      
      console.log("Next batch response:", nextRes);
      
      const nextDecryptedItems = await Promise.all(nextRes.items.map(async (m) => {
        if (!m.content) {
          return { ...m, content: null };
        }
        
        try {
          console.log("Decrypting message in batch:", m.id, "with content:", m.content);
          const decryptedContent = await decryptMessage(m.content, m.conversationId);
          console.log("Decrypted content in batch:", decryptedContent);
          return { ...m, content: decryptedContent };
        } catch (error) {
          console.error('Decryption failed for message in batch:', m.id, error);
          return { ...m, content: `[Failed to decrypt: ${m.content}]` };
        }
      }));
      
      allMessages = [...nextDecryptedItems.reverse(), ...allMessages];
      nextCursor = nextRes.nextCursor;
      batchCount++;
      
      console.log(`Loaded batch ${batchCount}, nextCursor:`, nextCursor);
    }
    
    if (batchCount >= MAX_BATCHES) {
      console.warn("Reached maximum batch limit, stopping pagination");
    }
    
    console.log("All decrypted messages:", allMessages); // Debug log
    console.log(`Loaded total of ${allMessages.length} messages`);
    
    set((s) => ({
      messages: { ...s.messages, [id]: allMessages },
      cursors: { ...s.cursors, [id]: nextCursor },
    }));
    
    // Cache all messages
    setCachedMessages(id, allMessages);
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
      console.log("=== NEW MESSAGE RECEIVED ===");
      console.log("Received message:", msg);
      console.log("Message content:", msg.content);
      console.log("Conversation ID:", msg.conversationId);
      console.log("=== END NEW MESSAGE RECEIVED ===");
      set((s) => {
        const { conversations, messages } = s;
        const curr = messages[msg.conversationId] || [];

        let next = msg.tempId
          ? curr.filter((m) => m.tempId !== msg.tempId)
          : curr;
        if (next.some((m) => m.id === msg.id)) return {};

        // Decrypt the message content asynchronously
        Promise.resolve().then(async () => {
          try {
            console.log("=== DECRYPTING NEW MESSAGE ===");
            console.log("Message to decrypt:", msg.content);
            console.log("Conversation ID:", msg.conversationId);
            const decryptedContent = msg.content 
              ? await decryptMessage(msg.content, msg.conversationId) 
              : null;
            console.log("Decrypted content:", decryptedContent);
            
            const decryptedMsg = {
              ...msg,
              content: decryptedContent,
            };

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
          } catch (error) {
            console.error('Decryption failed for new message:', msg.id, error);
            // Use the original message if decryption fails
            const decryptedMsg = {
              ...msg,
              content: msg.content ? `[Failed to decrypt: ${msg.content}]` : "[Failed to decrypt]",
            };

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
          }
        });
        
        // Return empty update for now, as the actual update will happen asynchronously
        return {};
      });
    }
  );

  socket.off("message:deleted");
  socket.on("message:deleted", ({ id: messageId, conversationId }) => {
    set((s) => {
      const updatedMessages = (s.messages[conversationId] || []).map((m) =>
        m.id === messageId
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
        if (c.id === conversationId && c.lastMessage?.id === messageId) {
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
    try {
      const cursor = get().cursors[conversationId];
      if (!cursor) return;

      const url = `/api/messages/${conversationId}?cursor=${encodeURIComponent(
        cursor
      )}`;
      console.log("Loading older messages with URL:", url);
      const res = await api<{ items: Message[]; nextCursor: string | null }>(
        url
      );
      console.log("Received older messages response:", res);

      const decryptedItems = await Promise.all(res.items.map(async (m) => {
        if (!m.content) {
          return { ...m, content: null };
        }
        
        try {
          console.log("Decrypting older message:", m.id);
          const decryptedContent = await decryptMessage(m.content, m.conversationId);
          console.log("Decrypted older message content:", decryptedContent);
          return { ...m, content: decryptedContent };
        } catch (error) {
          console.error('Decryption failed for older message:', m.id, error);
          return { ...m, content: `[Failed to decrypt: ${m.content}]` };
        }
      }));

      set((s) => {
        const updatedMessages = {
          ...s.messages,
          [conversationId]: [
            ...decryptedItems,
            ...(s.messages[conversationId] || []),
          ],
        };
        
        // Update cache with all messages for this conversation
        setCachedMessages(conversationId, updatedMessages[conversationId]);
        
        return {
          messages: updatedMessages,
          cursors: { ...s.cursors, [conversationId]: res.nextCursor },
        };
      });
    } catch (error) {
      console.error("Failed to load older messages:", error);
    }
  },

  async sendMessage(conversationId, content, tempId) {
    console.log("=== SEND MESSAGE ===");
    console.log("Input content:", content);
    console.log("Conversation ID:", conversationId);
    console.log("Temp ID:", tempId);
    const socket = getSocket();
    return new Promise((resolve, reject) => {
      encryptMessage(content, conversationId).then(encrypted => {
        console.log("Encrypted content:", encrypted);
        socket.emit(
          "message:send",
          { conversationId, content: encrypted, tempId },
          (ack: { ok: boolean; msg?: Message }) => {
            console.log("Received acknowledgment:", ack);
            if (ack?.ok && ack.msg) {
              console.log("Decrypting acknowledgment message content:", ack.msg.content);
              decryptMessage(ack.msg.content || "", ack.msg.conversationId).then(decryptedContent => {
                console.log("Decrypted acknowledgment content:", decryptedContent);
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
              }).catch((error) => {
                console.error("Decryption failed in sendMessage:", error);
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
              console.log("Acknowledgment failed, marking message error");
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
    console.log("Searching users with query:", q); // Debug log
    const result = await api(`/api/users/search?q=${encodeURIComponent(q)}`);
    console.log("Search users result:", result); // Debug log
    return result;
  },

  async startConversation(peerId) {
    console.log("Starting conversation with peer:", peerId); // Debug log
    const r = await api<{ id: string }>("/api/conversations/start", {
      method: "POST",
      body: JSON.stringify({ peerId }),
    });
    console.log("Start conversation result:", r); // Debug log

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