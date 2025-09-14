import { io, Socket } from 'socket.io-client'
const WS_URL = (import.meta.env.VITE_WS_URL as string) || 'http://localhost:4000'
let socket: Socket | null = null
export function getSocket() {
  if (!socket) socket = io(WS_URL, { withCredentials: true })
  return socket
}
export function disconnectSocket() { if (socket) { socket.disconnect(); socket = null } }
