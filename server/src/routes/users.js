import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth.js'
import { z } from 'zod'
import { zodValidate } from '../utils/validate.js'

const prisma = new PrismaClient()
const router = Router()

router.get('/me', requireAuth, async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, username: true, name: true, avatarUrl: true } })
  res.json(me)
})

const searchSchema = { query: z.object({ q: z.string().min(1).max(64) }) }

router.get('/search', requireAuth, zodValidate(searchSchema), async (req, res) => {
  const q = req.query.q.toString()
  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: req.user.id } },
        {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } }
          ]
        }
      ]
    },
    take: 20,
    select: { id: true, username: true, name: true, avatarUrl: true }
  })
  res.json(users)
})

export default router