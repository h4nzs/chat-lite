import { verifyJwt } from '../utils/jwt.js'
import { ApiError } from '../utils/errors.js'

export function requireAuth (req, _res, next) {
  const header = req.headers.authorization || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null
  const cookieToken = req.cookies?.at // access token httpOnly
  const token = bearer || cookieToken
  const payload = token ? verifyJwt(token) : null
  if (!payload) return next(new ApiError(401, 'Unauthorized'))
  req.user = { id: payload.id, email: payload.email, username: payload.username }
  next()
}
