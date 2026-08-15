import { ZodError, ZodSchema } from 'zod'
import { ApiError } from './errors.js'
import { Request, Response, NextFunction } from 'express'
import type { ParsedQs } from 'qs'
import type { ParamsDictionary } from 'express-serve-static-core'
import crypto from 'crypto'

/**
 * Perbandingan string yang aman dari timing attack (constant-time).
 * Wajib dipakai untuk secret/token/HMAC. Panjang berbeda langsung false
 * (length check tidak bisa constant-time karena panjang adalah side channel
 * yang tidak bisa dihindari tanpa padding — sudah praktik standar).
 */
export function safeEqualStrings (a: string | undefined | null, b: string | undefined | null): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export function zodValidate (schema: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body)
      if (schema.query) req.query = schema.query.parse(req.query) as ParsedQs
      if (schema.params) req.params = schema.params.parse(req.params) as ParamsDictionary
      next()
    } catch (e: unknown) {
      if (e instanceof ZodError) {
        const msg = e.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
        next(new ApiError(400, msg))
      } else next(e)
    }
  }
}
