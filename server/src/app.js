import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { env } from './config.js'
import { errorHandler } from './utils/errors.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import conversationRoutes from './routes/conversations.js'
import messageRoutes from './routes/messages.js'
import { fileTypeFromBuffer } from 'file-type' // optional; jika tidak ingin menambah dep, hapus blok magic-bytes

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// Security headers + CSP ringan
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'", env.corsOrigin],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"]
    }
  },
   crossOriginResourcePolicy: false
}))

// CORS dengan kredensial (cookie) – origin spesifik
app.use(cors({
  origin: env.corsOrigin,
  credentials: true
}))

app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use(morgan('dev'))

// Rate limiting dasar
app.use('/api/', rateLimit({ windowMs: 60_000, max: 120 }))

// Ensure upload dir exists (fallback local disk)
const uploadPath = path.resolve(__dirname, '..', env.uploadDir)
fs.mkdirSync(uploadPath, { recursive: true })

app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  next()
}, express.static(uploadPath))

// (Opsional) storage service untuk S3 – gunakan di route upload jika ENV tersedia
export async function saveUpload(file) {
  const useS3 = !!(env.s3Bucket && env.s3AccessKey && env.s3SecretKey)
  if (!useS3) {
    // local
    return { url: `/uploads/${file.filename}` }
  }
  // contoh S3 (pseudo, isi dengan AWS SDK v3 bila diaktifkan)
  // const client = new S3Client({ region: env.s3Region, credentials: { accessKeyId: env.s3AccessKey, secretAccessKey: env.s3SecretKey } })
  // await client.send(new PutObjectCommand({ Bucket: env.s3Bucket, Key: file.filename, Body: fs.createReadStream(file.path), ContentType: file.mimetype }))
  // fs.unlinkSync(file.path)
  // return { url: `https://${env.s3Bucket}.s3.${env.s3Region}.amazonaws.com/${file.filename}` }
  return { url: `/uploads/${file.filename}` } // fallback placeholder
}

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/messages', messageRoutes)

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Errors
app.use(errorHandler)

export default app