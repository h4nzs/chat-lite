import { verifyJwt } from './utils/jwt.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const onlineCount = new Map() // userId -> count sockets

export function registerSocket(io) {
  io.engine.on('headers', (headers, req) => {
    // pastikan cookie diteruskan ke WS
    headers['Access-Control-Allow-Credentials'] = 'true'
  })

  io.use((socket, next) => {
    const cookie = socket.request.headers.cookie || ''
    const at = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('at='))?.split('=')[1]
    const payload = at ? verifyJwt(at) : null
    if (!payload) return next(new Error('Unauthorized'))
    socket.user = { id: payload.id }
    next()
  })

  io.on('connection', async (socket) => {
    const userId = socket.user.id
    socket.join(`user:${userId}`)

    // online aggregation
    const c = (onlineCount.get(userId) || 0) + 1
    onlineCount.set(userId, c)
    if (c === 1) {
      // kabari hanya ke users yang punya conversation dengan user ini
      const convs = await prisma.participant.findMany({ where: { userId }, select: { conversationId: true } })
      const convIds = convs.map(x => x.conversationId)
      const peers = await prisma.participant.findMany({ where: { conversationId: { in: convIds }, userId: { not: userId } }, select: { userId: true } })
      const peerIds = Array.from(new Set(peers.map(p => p.userId)))
      peerIds.forEach(pid => io.to(`user:${pid}`).emit('presence:update', { userId, online: true }))
    }

    socket.on('conversation:join', (conversationId) => {
      socket.join(`conv:${conversationId}`)
    })

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conv:${conversationId}`)
    })

    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(`conv:${conversationId}`).emit('typing', { userId, isTyping, conversationId })
    })

    socket.on('message:send', async ({ conversationId, content, imageUrl }) => {
      if (!conversationId || (!content && !imageUrl)) return
      const member = await prisma.participant.findFirst({ where: { conversationId, userId } })
      if (!member) return
      const msg = await prisma.message.create({
        data: { conversationId, senderId: userId, content: content || null, imageUrl: imageUrl || null }
      })
      await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } })
      io.to(`conv:${conversationId}`).emit('message:new', {
        id: msg.id, conversationId, senderId: userId, content: msg.content, imageUrl: msg.imageUrl, createdAt: msg.createdAt
      })
    })

    socket.on('disconnect', async () => {
      const c = (onlineCount.get(userId) || 1) - 1
      if (c <= 0) {
        onlineCount.delete(userId)
        const convs = await prisma.participant.findMany({ where: { userId }, select: { conversationId: true } })
        const convIds = convs.map(x => x.conversationId)
        const peers = await prisma.participant.findMany({ where: { conversationId: { in: convIds }, userId: { not: userId } }, select: { userId: true } })
        const peerIds = Array.from(new Set(peers.map(p => p.userId)))
        peerIds.forEach(pid => io.to(`user:${pid}`).emit('presence:update', { userId, online: false }))
      } else {
        onlineCount.set(userId, c)
      }
    })
  })
}