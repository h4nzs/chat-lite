import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { env } from '../config.js'

const ACCESS_TTL = '15m'
const REFRESH_TTL_SEC = 60 * 60 * 24 * 30 // 30d

export function signAccessToken (payload, opts = {}) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: ACCESS_TTL, ...opts })
}

export function verifyJwt (token) {
  try { return jwt.verify(token, env.jwtSecret) } catch { return null }
}

export function newJti () {
  return crypto.randomUUID()
}

export function refreshExpiryDate () {
  return new Date(Date.now() + REFRESH_TTL_SEC * 1000)
}
