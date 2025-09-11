import { create } from 'zustand'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'

export type Conversation = { 
  id: string
  isGroup: boolean
  title?: string | null
  participants: { id: string; username: string; name: string; avatarUrl?: string | null }[]
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
  loading: any
  conversations: Conversation[]
  activeId: string | null
  messages: Record<string, Message[]>
  cursors: Record<string, string | null>   // 🔑 simpan nextCursor per conversation
  typing: Record<string, string[]>
  uploadFile: (conversationId: string, file: File) => Promise<void>


  loadConversations: () => Promise<void>
  openConversation: (id: string) => Promise<void>
  loadOlderMessages: (conversationId: string) => Promise<void>

  sendMessage: (conversationId: string, content: string, tempId?: number) => Promise<void>
  addOptimisticMessage: (conversationId: string, msg: Message) => void
  markMessageError: (conversationId: string, tempId: number) => void

  searchUsers: (q: string) => Promise<{ id: string; username: string; name: string; avatarUrl?: string | null }[]>
  startConversation: (peerId: string) => Promise<string>
  uploadImage: (conversationId: string, file: File) => Promise<void>
}

export const useChatStore = create<State>((set, get) => ({
  conversations: [],
  activeId: null,
  messages: {},
  cursors: {},           // 🔑 init cursors
  typing: {},

  async loadConversations() {
    const items = await api<Conversation[]>('/api/conversations')
    set({ conversations: items })
  },

  async openConversation(id) {
    get().setLoading(id, true)
try {
  // fetch messages...
} finally {
  get().setLoading(id, false)
}

    set({ activeId: id })
    const res = await api<{ items: Message[]; nextCursor: string | null }>(`/api/messages/${id}`)
    set((s) => ({
      messages: { ...s.messages, [id]: res.items.reverse() },
      cursors: { ...s.cursors, [id]: res.nextCursor }
    }))

    const socket = getSocket()
    socket.emit('conversation:join', id)

    socket.off('message:new')
    socket.on('message:new', (msg: Message & { tempId?: number }) => {
      if (msg.conversationId !== id) return
      set((s) => {
         const curr = s.messages[id] || []

    // hapus pesan optimistic yang punya tempId sama (jika server mengirim tempId)
          const withoutTemp = msg.tempId ? curr.filter(m => m.tempId !== msg.tempId) : curr

    // kalau sudah ada id yang sama, jangan duplikasi
          if (withoutTemp.some(m => m.id === msg.id)) {
        return { messages: s.messages }
    }

    return {
      messages: { ...s.messages, [id]: [...withoutTemp, msg] }
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
    if (!cursor) return  // 🚫 tidak ada lagi data

    const url = `/api/messages/${conversationId}?cursor=${encodeURIComponent(cursor)}`
    const res = await api<{ items: Message[]; nextCursor: string | null }>(url)

    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...res.items.reverse(), ...(s.messages[conversationId] || [])]
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
      socket.emit('message:send', { conversationId, content, tempId }, (ack: { ok: boolean, msg?: Message }) => {
        if (ack?.ok && ack.msg) {
          set((s) => ({
            messages: {
              ...s.messages,
              [conversationId]: (s.messages[conversationId] || []).map(m =>
                m.tempId === tempId ? ack.msg! : m
              )
            }
          }))
          resolve()
        } else {
          get().markMessageError(conversationId, tempId!)
          reject(new Error('Send failed'))
        }
      })
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
        [conversationId]: (s.messages[conversationId] || []).map(m =>
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
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/conversations/${conversationId}/upload`, {
      method: 'POST',
      body: form,
      credentials: 'include'
    })
    if (!res.ok) throw new Error('Upload failed')
    const data = await res.json() as { imageUrl: string }

    const socket = getSocket()
    socket.emit('message:send', { conversationId, imageUrl: data.imageUrl })
  },
  loading: {}, // { [conversationId]: boolean }

setLoading: (id, val) => set(s => ({
  loading: { ...s.loading, [id]: val }
})),

async uploadFile(conversationId, file) {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/conversations/${conversationId}/upload`, {
    method: 'POST',
    body: form,
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Upload failed')

  const data = await res.json() as { fileUrl: string; fileName: string }

  const socket = getSocket()
  socket.emit('message:send', { 
    conversationId, 
    fileUrl: data.fileUrl, 
    fileName: data.fileName 
  })
}

}))
