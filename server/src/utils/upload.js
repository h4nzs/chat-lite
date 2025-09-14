import multer from 'multer'
import fs from 'node:fs'
import path from 'node:path'
import { env } from '../config.js'

const uploadPath = path.resolve(process.cwd(), env.uploadDir)
fs.mkdirSync(uploadPath, { recursive: true })

const ALLOWED = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif'
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadPath),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${unique}${ext}`)
  }
})

function fileFilter (_req, file, cb) {
  if (!ALLOWED[file.mimetype]) return cb(new Error('Invalid file type'))
  cb(null, true)
}

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
})

// helper kalau nanti mau ke S3
export async function saveUpload (file) {
  return { url: `/uploads/${file.filename}` }
}
