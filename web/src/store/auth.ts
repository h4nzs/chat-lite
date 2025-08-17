import { create } from 'zustand'
import { api } from '../lib/api'
import { getSocket, disconnectSocket } from '../lib/socket'

type User = { id: string; email: string; username: string; name: string; avatarUrl?: string | null }

type State = {
  user: User | null
  theme: 'light' | 'dark'
  bootstrap: () => Promise<void>
  login: (emailOrUsername: string, password: string) => Promise<void>
  register: (data: { email: string; username: string; password: string; name: string }) => Promise<void>
  logout: () => Promise<void>
  ensureSocket: () => void
  setTheme: (t: 'light' | 'dark') => void
}

export const useAuthStore = create<State>((set, get) => ({
  user: null,
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  async bootstrap() {
    try {
      const me = await api<User>('/api/users/me')
      set({ user: me })
      get().ensureSocket()
    } catch { /* not logged in */ }
  },
  async login(emailOrUsername, password) {
    const res = await api<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrUsername, password })
    })
    set({ user: res.user })
    get().ensureSocket()
  },
  async register(data) {
    const res = await api<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    })
    set({ user: res.user }); get().ensureSocket()
  },
  async logout() {
    await api('/api/auth/logout', { method: 'POST' })
    set({ user: null }); disconnectSocket()
  },
  ensureSocket() { getSocket() },
  setTheme(t) { localStorage.setItem('theme', t); set({ theme: t }) }
}))
