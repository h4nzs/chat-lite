import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth.js'
import { z } from 'zod'
import { zodValidate } from '../utils/validate.js'
import multer from 'multer'

const prisma = new PrismaClient()
const router = Router()

// ✅ GET messages with cursor pagination (infinite scroll)
const getSchema = {
  params: z.object({ conversationId: z.string().min(1) }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
    cursor: z.string().datetime().optional() // pakai createdAt ISO string
  })
}

router.get('/:conversationId', requireAuth, zodValidate(getSchema), async (req, res) => {
  const me = req.user.id
  const { conversationId } = req.params
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50)
  const cursor = req.query.cursor ? new Date(req.query.cursor.toString()) : null

  const member = await prisma.participant.findFirst({ where: { conversationId, userId: me } })
  if (!member) return res.status(403).json({ error: 'Forbidden' })

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(cursor ? { createdAt: { lt: cursor } } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1
  })

  const hasMore = messages.length > limit
  if (hasMore) messages.pop()

  const nextCursor = hasMore ? messages[messages.length - 1].createdAt.toISOString() : null

  res.json({ items: messages, nextCursor })
})

// ✅ POST new message
const postSchema = {
  body: z.object({
    conversationId: z.string().min(1),
    content: z.string().max(4000).optional(),
    imageUrl: z.string().url().optional()
  }).refine(v => v.content || v.imageUrl, { message: 'content or imageUrl required' })
}

router.post('/', requireAuth, zodValidate(postSchema), async (req, res) => {
  const me = req.user.id
  const { conversationId, content, imageUrl } = req.body

  const member = await prisma.participant.findFirst({ where: { conversationId, userId: me } })
  if (!member) return res.status(403).json({ error: 'Forbidden' })

  const msg = await prisma.message.create({
    data: {
      conversationId,
      senderId: me,
      content: content || null,
      imageUrl: imageUrl || null
    }
  })

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() }
  })

  res.json(msg)
})

export default router
