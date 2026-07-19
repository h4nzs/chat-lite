import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config.js'
import { AuthPayload } from '../types/auth.js'
import { redisClient } from '../lib/redis.js'
import { prisma } from '../lib/prisma.js'

// === Middleware untuk REST API ===
export async function requireAuth (req: Request, res: Response, next: NextFunction) {
  // Prioritaskan pembacaan token dari cookie
  const token = req.cookies?.at || // access token dari cookie
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null)

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload

    // ========== REDIS TOKEN BLACKLIST CHECK ==========
    if (payload.jti) {
      try {
        const blacklisted = await redisClient.get(`revoked_jti:${payload.jti}`)
        if (blacklisted) {
          return res.status(401).json({ error: 'Token revoked. Please login again.' })
        }
      } catch (_redisErr) {
        console.warn('[Auth] Redis unavailable — skipping token blacklist check')
      }
    }

    // ========== BAN CHECK (with Redis caching) ==========
    try {
      const banCacheKey = `ban_status:${payload.id}`
      const cachedStatus = await redisClient.get(banCacheKey)

      if (cachedStatus === 'BANNED') {
        return res.status(403).json({ error: 'ACCESS DENIED: Your account has been suspended.' })
      }

      if (!cachedStatus) {
        // Cache miss — query database
        const user = await prisma.user.findUnique({
          where: { id: payload.id },
          select: { bannedAt: true, banReason: true }
        })

        if (user?.bannedAt) {
          // Cache ban status for 60 seconds
          await redisClient.setEx(banCacheKey, 60, 'BANNED').catch(() => {})
          return res.status(403).json({
            error: 'ACCESS DENIED: Your account has been suspended.',
            reason: user.banReason || undefined
          })
        }

        // Cache non-ban status for 60 seconds
        await redisClient.setEx(banCacheKey, 60, 'OK').catch(() => {})
      }
    } catch (_cacheErr) {
      console.warn('[Auth] Ban cache unavailable — falling back to direct DB query')
      // Redis unavailable — fallback to direct DB query
      try {
        const user = await prisma.user.findUnique({
          where: { id: payload.id },
          select: { bannedAt: true, banReason: true }
        })
        if (user?.bannedAt) {
          return res.status(403).json({
            error: 'ACCESS DENIED: Your account has been suspended.',
            reason: user.banReason || undefined
          })
        }
      } catch (_dbErr) {
        console.error('[Auth] Redis AND DB unavailable — skipping ban check entirely')
        // DB also unavailable — degrade gracefully (allow through)
      }
    }

    req.user = payload
    if (payload.deviceId) {
      req.deviceId = payload.deviceId
    }
    next()
  } catch (err) {
    console.error('Authentication error:', err)
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access Denied: Admins Only' })
    }
    next()
  } catch (_error) {
    res.status(403).json({ error: 'Forbidden' })
  }
}

// === Helper untuk verifikasi token ===
export function verifyAuth (token?: string): AuthPayload | null {
  if (!token) return null
  try {
    return jwt.verify(token, env.jwtSecret) as AuthPayload
  } catch {
    return null
  }
}
