import { create } from 'zustand'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'

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
  lastMessage: Message | null
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
}

type State = {
  loading: Record<string, boolean>
  conversations: Conversation[]
  activeId: string | null
  messages: Record<string, Message[]>
  cursors: Record<string, string | null>
  typing: Record<string, string[]>

  loadConversations: () => Promise<void>
  openConversation: (id: string) => Promise<void>
  loadOlderMessages: (conversationId: string) => Promise<void>

  sendMessage: (
    conversationId: string,
    content: string,
    tempId?: number
  ) => Promise<void>
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

// 🔧 helper untuk sort conversations berdasarkan updatedAt desc
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

  async loadConversations() {
    const items = await api<Conversation[]>('/api/conversations')
    set({ conversations: sortConversations(items) })
  },

  async openConversation(id) {
    get().setLoading(id, true)
    try {
      // fetch messages
      const res = await api<{ items: Message[]; nextCursor: string | null }>(
        `/api/messages/${id}`
      )
      set((s) => ({
        messages: { ...s.messages, [id]: res.items.reverse() },
        cursors: { ...s.cursors, [id]: res.nextCursor }
      }))
    } finally {
      get().setLoading(id, false)
    }

    set({ activeId: id })

    const socket = getSocket()
    socket.emit('conversation:join', id)

    // =====================
    // SOCKET: MESSAGE NEW
    // =====================
    socket.off('message:new')
    socket.on('message:new', (msg: Message & { tempId?: number; preview?: string }) => {
    set((s) => {
    const { conversations, messages } = s
    const curr = messages[msg.conversationId] || []

    // 1️⃣ hapus pesan optimistic kalau ada
    let next = msg.tempId
      ? curr.filter((m) => m.tempId !== msg.tempId)
      : curr

    // 2️⃣ hindari duplikat
    if (next.some((m) => m.id === msg.id)) {
      return {}
    }

    // 3️⃣ update conversations langsung dari msg.preview
    let updated = conversations.map((c) =>
      c.id === msg.conversationId
        ? {
            ...c,
            lastMessage: msg, // msg sudah ada preview dari server
            updatedAt: new Date().toISOString()
          }
        : c
    )

    // kalau percakapan belum ada (misal baru), tambahkan
    if (!updated.find((c) => c.id === msg.conversationId)) {
      updated.push({
        id: msg.conversationId,
        isGroup: false,
        title: null,
        participants: [],
        lastMessage: msg,
        updatedAt: new Date().toISOString()
      })
    }

    // 4️⃣ sort desc by updatedAt
    updated.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

    return {
      messages: { ...messages, [msg.conversationId]: [...next, msg] },
      conversations: updated
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
  },

  async loadOlderMessages(conversationId) {
    const cursor = get().cursors[conversationId]
    if (!cursor) return

    const url = `/api/messages/${conversationId}?cursor=${encodeURIComponent(
      cursor
    )}`
    const res = await api<{ items: Message[]; nextCursor: string | null }>(url)

    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [
          ...res.items.reverse(),
          ...(s.messages[conversationId] || [])
        ]
      },
      cursors: {
        ...s.cursors,
        [conversationId]: res.nextCursor
      }
    }))
  },

  async sendMessage(conversationId, content, tempId) {
    const socket = getSocket()
    return new Promise((resolve, reject) => {
      socket.emit(
        'message:send',
        { conversationId, content, tempId },
        (ack: { ok: boolean; msg?: Message }) => {
          if (ack?.ok && ack.msg) {
  set((s) => {
    const { conversations, messages } = s

    let updated = conversations.map((c) =>
      c.id === conversationId
        ? {
            ...c,
            lastMessage: ack.msg, // sudah ada preview
            updatedAt: new Date().toISOString()
          }
        : c
    )

    if (!updated.find((c) => c.id === conversationId)) {
      updated.push({
        id: conversationId,
        isGroup: false,
        title: null,
        participants: [],
        lastMessage: ack.msg,
        updatedAt: new Date().toISOString()
      })
    }

    updated.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

    return {
      messages: {
        ...messages,
        [conversationId]: (messages[conversationId] || []).map((m) =>
          m.tempId === tempId ? ack.msg! : m
        )
      },
      conversations: updated
    }
  })
  resolve()
}
 else {
            get().markMessageError(conversationId, tempId!)
            reject(new Error('Send failed'))
          }
        }
      )
    })
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
      `${
        import.meta.env.VITE_API_URL || 'http://localhost:4000'
      }/api/conversations/${conversationId}/upload-image`,
      {
        method: 'POST',
        body: form,
        credentials: 'include'
      }
    )
    if (!res.ok) throw new Error('Upload failed')
    const data = (await res.json()) as { imageUrl: string }

    const socket = getSocket()
    socket.emit('message:send', { conversationId, imageUrl: data.imageUrl })

    set((s) => ({
      conversations: sortConversations(
        s.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessage: {
                  id: '',
                  conversationId,
                  senderId: 'me',
                  imageUrl: data.imageUrl,
                  createdAt: new Date().toISOString()
                } as Message,
                updatedAt: new Date().toISOString()
              }
            : c
        )
      )
    }))
  },

  async uploadFile(conversationId, file) {
    const form = new FormData()
    form.append('file', file)

    const res = await fetch(
      `${
        import.meta.env.VITE_API_URL || 'http://localhost:4000'
      }/api/conversations/${conversationId}/upload`,
      {
        method: 'POST',
        body: form,
        credentials: 'include'
      }
    )
    if (!res.ok) throw new Error('Upload failed')

    const data = (await res.json()) as { fileUrl: string; fileName: string }

    const socket = getSocket()
    socket.emit('message:send', {
      conversationId,
      fileUrl: data.fileUrl,
      fileName: data.fileName
    })

    set((s) => ({
      conversations: sortConversations(
        s.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessage: {
                  id: '',
                  conversationId,
                  senderId: 'me',
                  fileUrl: data.fileUrl,
                  fileName: data.fileName,
                  createdAt: new Date().toISOString()
                } as Message,
                updatedAt: new Date().toISOString()
              }
            : c
        )
      )
    }))
  },

  setLoading: (id, val) =>
    set((s) => ({
      loading: { ...s.loading, [id]: val }
    }))
}))
