import { create } from 'zustand'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'

export type Conversation = { id: string
  isGroup: boolean
  title?: string | null
  participants: { id: string; username: string; name: string; avatarUrl?: string | null }[]
  lastMessage: Message | null
  updatedAt: string }
export type Message = { id: string
  conversationId: string
  senderId: string
  content?: string | null
  imageUrl?: string | null
  createdAt: string }

type State = {
  conversations: Conversation[]
  activeId: string | null
  messages: Record<string, Message[]>
  typing: Record<string, string[]>
  loadConversations: () => Promise<void>
  openConversation: (id: string) => Promise<void>
  sendMessage: (conversationId: string, content: string) => void
  searchUsers: (q: string) => Promise<{ id: string; username: string; name: string; avatarUrl?: string | null }[]>
  startConversation: (peerId: string) => Promise<string>
}

export const useChatStore = create<State>((set, get) => ({
  conversations: [],
  activeId: null,
  messages: {},
  typing: {},
  async loadConversations() {
    const items = await api<Conversation[]>('/api/conversations')
    set({ conversations: items })
  },
  async openConversation(id) {
    set({ activeId: id })
    const res = await api<{ items: Message[]; nextCursor: string | null }>(`/api/messages/${id}`)
    set((s) => ({ messages: { ...s.messages, [id]: res.items.reverse() } }))
    const socket = getSocket()
    socket.emit('conversation:join', id)
    socket.off('message:new') // hindari duplikasi handler
    socket.on('message:new', (msg: Message) => {
      if (msg.conversationId === id) {
        set((s) => ({ messages: { ...s.messages, [id]: [...(s.messages[id] || []), msg] } }))
      }
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
  sendMessage(conversationId, content) {
    const socket = getSocket()
    socket.emit('message:send', { conversationId, content })
  },
  async searchUsers(q) 
  { return api(`/api/users/search?q=${encodeURIComponent(q)}`) },
  async startConversation(peerId) {
    const r = await api<{ id: string }>('/api/conversations/start', { method: 'POST', body: JSON.stringify({ peerId }) })
    await get().loadConversations()
    return r.id
  },

  uploadImage: async (conversationId: string, file: File) => {
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
  }
}))