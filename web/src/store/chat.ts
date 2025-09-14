import { create } from 'zustand'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import { encryptMessage, decryptMessage } from "../utils/crypto"

export type Conversation = {
  id: string
  isGroup: boolean
  title?: string | null
  participants: {
    id: string
    username: string
    name: string
    avatarUrl?: string | null
  }[]
  lastMessage: (Message & { preview?: string }) | null
  updatedAt: string
}

export type Message = {
  id: string
  tempId?: number
  conversationId: string
  senderId: string
  content?: string | null
  imageUrl?: string | null
  fileUrl?: string | null
  fileName?: string | null
  createdAt: string
  error?: boolean
  preview?: string
}

type State = {
  loading: Record<string, boolean>
  conversations: Conversation[]
  activeId: string | null
  messages: Record<string, Message[]>
  cursors: Record<string, string | null>
  typing: Record<string, string[]>
  presence: Record<string, boolean>

  loadConversations: () => Promise<void>
  openConversation: (id: string) => Promise<void>
  loadOlderMessages: (conversationId: string) => Promise<void>
  sendMessage: (conversationId: string, content: string, tempId?: number) => Promise<void>
  deleteMessage: (conversationId: string, messageId: string) => void
  addOptimisticMessage: (conversationId: string, msg: Message) => void
  markMessageError: (conversationId: string, tempId: number) => void
  searchUsers: (
    q: string
  ) => Promise<
    { id: string; username: string; name: string; avatarUrl?: string | null }[]
  >
  startConversation: (peerId: string) => Promise<string>
  uploadImage: (conversationId: string, file: File) => Promise<void>
  uploadFile: (conversationId: string, file: File) => Promise<void>
  setLoading: (id: string, val: boolean) => void
}

function sortConversations(list: Conversation[]) {
  return [...list].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
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
    const items = await api<Conversation[]>('/api/conversations')
    // Decrypt last message content if it's encrypted
    const decryptedItems = items.map(conversation => {
      if (conversation.lastMessage && conversation.lastMessage.content) {
        try {
          // Check if content is encrypted (starts with 'U2FsdGVkX1' which is base64 prefix for CryptoJS)
          if (conversation.lastMessage.content.startsWith('U2FsdGVkX1')) {
            return {
              ...conversation,
              lastMessage: {
                ...conversation.lastMessage,
                content: decryptMessage(conversation.lastMessage.content),
                preview: decryptMessage(conversation.lastMessage.content)
              }
            }
          }
        } catch (e) {
          // If decryption fails, keep original content
          return {
            ...conversation,
            lastMessage: {
              ...conversation.lastMessage,
              content: '[Failed to decrypt]',
              preview: '[Failed to decrypt]'
            }
          }
        }
      }
      return conversation
    })
    set({ conversations: sortConversations(decryptedItems) })
  },

  async openConversation(id) {
    get().setLoading(id, true)
    try {
      const res = await api<{ items: Message[]; nextCursor: string | null }>(
        `/api/messages/${id}`
      )
      const decryptedItems = res.items.map((m) => ({
        ...m,
        content: m.content ? decryptMessage(m.content) : null,
      }))
      set((s) => ({
        messages: { ...s.messages, [id]: decryptedItems.reverse() },
        cursors: { ...s.cursors, [id]: res.nextCursor }
      }))
    } finally {
      get().setLoading(id, false)
    }

    set({ activeId: id })

    const socket = getSocket()
    socket.emit('conversation:join', id)

    socket.off('message:new')
    socket.on('message:new', (msg: Message & { tempId?: number; preview?: string }) => {
      set((s) => {
        const { conversations, messages } = s
        const curr = messages[msg.conversationId] || []

        let next = msg.tempId ? curr.filter((m) => m.tempId !== msg.tempId) : curr
        if (next.some((m) => m.id === msg.id)) return {}

        const decryptedMsg = {
          ...msg,
          content: msg.content ? decryptMessage(msg.content) : null,
          preview: msg.content ? decryptMessage(msg.content) : msg.preview
        }

        // Log message for debugging
        console.log('Received message:', decryptedMsg);

        let updated = conversations.map((c) =>
          c.id === msg.conversationId
            ? { ...c, lastMessage: decryptedMsg, updatedAt: new Date().toISOString() }
            : c
        )

        if (!updated.find((c) => c.id === msg.conversationId)) {
          updated.push({
            id: msg.conversationId,
            isGroup: false,
            title: null,
            participants: [],
            lastMessage: decryptedMsg,
            updatedAt: new Date().toISOString()
          })
        }

        updated = sortConversations(updated)

        return {
          messages: { ...messages, [msg.conversationId]: [...next, decryptedMsg] },
          conversations: updated
        }
      })
    })

    // ✅ listener untuk pesan dihapus
    socket.off('message:deleted')
    socket.on('message:deleted', ({ id, conversationId }) => {
      set((s) => {
        const updatedMessages = (s.messages[conversationId] || []).map(m =>
          m.id === id ? { ...m, content: '[deleted]', imageUrl: null, fileUrl: null, fileName: null } : m
        )

        const updatedConversations = s.conversations.map(c => {
          if (c.id === conversationId && c.lastMessage?.id === id) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                content: '[deleted]',
                imageUrl: null,
                fileUrl: null,
                fileName: null,
                preview: undefined
              }
            }
          }
          return c
        })

        return {
          messages: { ...s.messages, [conversationId]: updatedMessages },
          conversations: updatedConversations
        }
      })
    })

    socket.off('typing')
    socket.on('typing', ({ userId, isTyping, conversationId }) => {
      if (conversationId !== id) return
      set((s) => {
        const curr = new Set(s.typing[id] || [])
        if (isTyping) curr.add(userId)
        else curr.delete(userId)
        return { typing: { ...s.typing, [id]: Array.from(curr) } }
      })
    })

    socket.off('presence:update')
    socket.on('presence:update', ({ userId, online }) => {
      set((s) => ({
        presence: { ...s.presence, [userId]: online }
      }))
    })
  },

  async loadOlderMessages(conversationId) {
    const cursor = get().cursors[conversationId]
    if (!cursor) return

    const url = `/api/messages/${conversationId}?cursor=${encodeURIComponent(cursor)}`
    const res = await api<{ items: Message[]; nextCursor: string | null }>(url)

    const decryptedItems = res.items.map((m) => ({
      ...m,
      content: m.content ? decryptMessage(m.content) : null,
    }))

    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...decryptedItems.reverse(), ...(s.messages[conversationId] || [])]
      },
      cursors: { ...s.cursors, [conversationId]: res.nextCursor }
    }))
  },

  async sendMessage(conversationId, content, tempId) {
    const socket = getSocket()
    return new Promise((resolve, reject) => {
      const encrypted = encryptMessage(content)
      socket.emit('message:send', { conversationId, content: encrypted, tempId }, (ack: { ok: boolean; msg?: Message }) => {
        if (ack?.ok && ack.msg) {
          const decryptedAck = {
            ...ack.msg,
            content: ack.msg.content ? decryptMessage(ack.msg.content) : null,
            preview: ack.msg.content ? decryptMessage(ack.msg.content) : ack.msg.preview
          }

          // Log message for debugging
          console.log('Acknowledged message:', decryptedAck);

          set((s) => {
            let updated = s.conversations.map((c) =>
              c.id === conversationId
                ? { ...c, lastMessage: decryptedAck, updatedAt: new Date().toISOString() }
                : c
            )

            if (!updated.find((c) => c.id === conversationId)) {
              updated.push({
                id: conversationId,
                isGroup: false,
                title: null,
                participants: [],
                lastMessage: decryptedAck,
                updatedAt: new Date().toISOString()
              })
            }

            updated = sortConversations(updated)

            return {
              messages: {
                ...s.messages,
                [conversationId]: (s.messages[conversationId] || []).map((m) =>
                  m.tempId === tempId ? decryptedAck : m
                )
              },
              conversations: updated
            }
          })
          resolve()
        } else {
          get().markMessageError(conversationId, tempId!)
          reject(new Error('Send failed'))
        }
      })
    })
  },

  // ✅ fungsi untuk hapus pesan
  deleteMessage(conversationId, messageId) {
    const socket = getSocket()
    socket.emit('message:delete', { conversationId, messageId })
  },

  addOptimisticMessage(conversationId, msg) {
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] || []), msg]
      }
    }))
  },

  markMessageError(conversationId, tempId) {
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] || []).map((m) =>
          m.tempId === tempId ? { ...m, error: true } : m
        )
      }
    }))
  },

  async searchUsers(q) {
    return api(`/api/users/search?q=${encodeURIComponent(q)}`)
  },

  async startConversation(peerId) {
    const r = await api<{ id: string }>('/api/conversations/start', {
      method: 'POST',
      body: JSON.stringify({ peerId })
    })
    await get().loadConversations()
    return r.id
  },

  async uploadImage(conversationId, file) {
    const form = new FormData()
    form.append('image', file)
    const res = await fetch(
      `${import.meta.env.VITE_API_URL as string || 'http://localhost:4000'}/api/conversations/${conversationId}/upload-image`,
      { method: 'POST', body: form, credentials: 'include' }
    )
    if (!res.ok) throw new Error('Upload failed')
    const data = (await res.json()) as { imageUrl: string }

    const socket = getSocket()
    socket.emit('message:send', {
      conversationId,
      imageUrl: data.imageUrl,
      preview: '📷 Photo'
    })
  },

  async uploadFile(conversationId, file) {
    // Check if file is an image
    const isImage = file.type.startsWith('image/');
    
    if (isImage) {
      // Upload image through image endpoint
      const form = new FormData();
      form.append('image', file);
      const res = await fetch(
        `${import.meta.env.VITE_API_URL as string || 'http://localhost:4000'}/api/conversations/${conversationId}/upload-image`,
        { method: 'POST', body: form, credentials: 'include' }
      );
      if (!res.ok) throw new Error('Upload failed');
      const data = (await res.json()) as { imageUrl: string };

      const socket = getSocket();
      socket.emit('message:send', {
        conversationId,
        imageUrl: data.imageUrl,
        preview: '📷 Photo'
      });
    } else {
      // Upload file through file endpoint
      const form = new FormData();
      form.append('file', file);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL as string || 'http://localhost:4000'}/api/conversations/${conversationId}/upload`,
        { method: 'POST', body: form, credentials: 'include' }
      );
      if (!res.ok) throw new Error('Upload failed');

      const data = (await res.json()) as { fileUrl: string; fileName: string };

      const socket = getSocket();
      socket.emit('message:send', {
        conversationId,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        preview: `📎 ${data.fileName}`
      });
    }
  },

  setLoading: (id, val) =>
    set((s) => ({
      loading: { ...s.loading, [id]: val }
    }))
}))