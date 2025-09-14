import express from 'express'
import cookieParser from 'cookie-parser'
import logger from 'morgan'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { env } from './config.js'
import path from 'path'

import authRouter from './routes/auth.js'
import usersRouter from './routes/users.js'
import conversationsRouter from './routes/conversations.js'
import messagesRouter from './routes/messages.js'

const app = express()

// === SECURITY ===
app.use(helmet())
app.use(cors({ origin: env.corsOrigin, credentials: true }))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }))

// === MIDDLEWARE ===
app.use(logger('dev'))
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

// === SERVE STATIC FILES ===
app.use('/uploads', express.static(path.resolve(process.cwd(), env.uploadDir)))

// === ROUTES ===
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/conversations', conversationsRouter)
app.use('/api/messages', messagesRouter)

// === ERROR HANDLING ===
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' })
  }
  next(err)
})

export default app
