import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth.js'
import { upload, saveUpload } from '../utils/upload.js'
import { z } from 'zod'
import { zodValidate } from '../utils/validate.js'

const prisma = new PrismaClient()
const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const me = req.user.id
  const parts = await prisma.participant.findMany({
    where: { userId: me },
    include: {
      conversation: {
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          participants: { include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } } }
        }
      }
    },
    orderBy: { conversation: { lastMessageAt: 'desc' } }
  })
  const items = parts.map((p) => ({
    id: p.conversationId,
    isGroup: p.conversation.isGroup,
    title: p.conversation.title,
    participants: p.conversation.participants.map((pp) => pp.user),
    lastMessage: p.conversation.messages[0] || null,
    updatedAt: p.conversation.updatedAt
  }))
  res.json(items)
})

const startSchema = { body: z.object({ peerId: z.string().min(1) }) }

router.post('/start', requireAuth, zodValidate(startSchema), async (req, res) => {
  const me = req.user.id
  const { peerId } = req.body

  const existing = await prisma.conversation.findFirst({
    where: { isGroup: false, participants: { every: { userId: { in: [me, peerId] } } } },
    select: { id: true }
  })
  if (existing) return res.json({ id: existing.id })

  const conv = await prisma.conversation.create({
    data: {
      participants: { create: [{ userId: me }, { userId: peerId }] },
      lastMessageAt: new Date()
    }
  })
  res.json({ id: conv.id })
})

router.post('/:id/upload', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' })
  const { url } = await saveUpload(req.file)
  res.json({ imageUrl: url, conversationId: req.params.id })
})

export default router
