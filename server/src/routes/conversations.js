import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth.js'
import { upload as imageUpload, saveUpload } from '../utils/upload.js'
import { z } from 'zod'
import { zodValidate } from '../utils/validate.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const prisma = new PrismaClient()
const router = Router()

// ======================
// STORAGE UNTUK FILE UMUM
// ======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads'
    if (!fs.existsSync(dir)) fs.mkdirSync(dir) // buat folder kalau belum ada
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + path.extname(file.originalname))
  }
})
const fileUpload = multer({ storage })

// ======================
// GET CONVERSATIONS
// ======================
router.get('/', requireAuth, async (req, res) => {
  const me = req.user.id
  const parts = await prisma.participant.findMany({
    where: { userId: me },
    include: {
      conversation: {
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          participants: {
            include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } }
          }
        }
      }
    },
    orderBy: { conversation: { lastMessageAt: 'desc' } }
  })

  const items = parts.map((p) => {
    const last = p.conversation.messages[0] || null
    return {
      id: p.conversationId,
      isGroup: p.conversation.isGroup,
      title: p.conversation.title,
      participants: p.conversation.participants.map((pp) => pp.user),
      lastMessage: last
        ? {
            id: last.id,
            content: last.content,
            imageUrl: last.imageUrl,
            fileUrl: last.fileUrl,
            fileName: last.fileName,
            createdAt: last.createdAt,
            senderId: last.senderId,
            preview:
              last.content ||
              (last.imageUrl ? '📷 Photo' : last.fileName ? `📎 ${last.fileName}` : '')
          }
        : null,
      updatedAt: p.conversation.updatedAt
    }
  })

  res.json(items) // 🔑 jangan lupa return
})

// ======================
// START CONVERSATION
// ======================
const startSchema = { body: z.object({ peerId: z.string().min(1) }) }

router.post('/start', requireAuth, zodValidate(startSchema), async (req, res) => {
  const me = req.user.id
  const { peerId } = req.body

  const existing = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      participants: { every: { userId: { in: [me, peerId] } } }
    },
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

// ======================
// UPLOAD FILE UMUM
// ======================
router.post('/:conversationId/upload', requireAuth, fileUpload.single('file'), async (req, res) => {
  const me = req.user.id
  const { conversationId } = req.params

  const member = await prisma.participant.findFirst({
    where: { conversationId, userId: me }
  })
  if (!member) return res.status(403).json({ error: 'Forbidden' })

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const fileUrl = `/uploads/${req.file.filename}`

  const msg = await prisma.message.create({
    data: {
      conversationId,
      senderId: me,
      fileUrl,
      fileName: req.file.originalname
    }
  })

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() }
  })

  // Emit ke socket biar lawan bicara langsung lihat
  if (req.app.get('io')) {
    req.app.get('io').to(`conv:${conversationId}`).emit('message:new', msg)
  }

  res.json({ fileUrl, fileName: req.file.originalname, msg })
})

// ======================
// UPLOAD IMAGE
// ======================
router.post('/:id/upload-image', requireAuth, imageUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' })
  const { url } = await saveUpload(req.file)

  const me = req.user.id
  const { id: conversationId } = req.params

  const msg = await prisma.message.create({
    data: {
      conversationId,
      senderId: me,
      imageUrl: url
    }
  })

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() }
  })

  if (req.app.get('io')) {
    req.app.get('io').to(`conv:${conversationId}`).emit('message:new', msg)
  }

  res.json({ imageUrl: url, conversationId, msg })
})

export default router