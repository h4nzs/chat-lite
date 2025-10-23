import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config.js';
import { Request } from 'express';
import { ApiError } from './errors.js';

const UPLOAD_DIR = path.resolve(process.cwd(), env.uploadDir || 'uploads');

// Pastikan direktori upload utama ada
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Definisikan tipe file yang diizinkan dan subdirektorinya
const ALLOWED_TYPES: Record<string, string> = {
  // Images
  'image/jpeg': 'images',
  'image/png': 'images',
  'image/gif': 'images',
  'image/webp': 'images',
  // Documents
  'application/pdf': 'documents',
  'application/msword': 'documents',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'documents',
  'application/vnd.ms-powerpoint': 'documents',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'documents',
  'application/vnd.ms-excel': 'documents',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'documents',
  'text/plain': 'documents',
  // Media
  'video/mp4': 'videos',
  'video/quicktime': 'videos',
  'video/x-msvideo': 'videos',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  // Archives
  'application/zip': 'archives',
  'application/x-rar-compressed': 'archives',
};

const getFileCategory = (mimetype: string): string => {
  return ALLOWED_TYPES[mimetype] || 'others';
};

// Konfigurasi storage Multer
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const category = getFileCategory(file.mimetype);
    const categoryPath = path.join(UPLOAD_DIR, category);

    // Buat subdirektori jika belum ada
    fs.mkdirSync(categoryPath, { recursive: true });
    
    cb(null, categoryPath);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Sanitasi nama file asli untuk keamanan
    const sanitizedOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const extension = path.extname(sanitizedOriginalName) || path.extname(file.originalname);
    
    // Buat nama file yang unik dan aman
    const finalFilename = `${path.basename(sanitizedOriginalName, extension)}-${uniqueSuffix}${extension}`;
    
    cb(null, finalFilename);
  }
});

// Filter file untuk validasi MIME type
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    // Tolak file dengan tipe yang tidak diizinkan
    cb(new ApiError(400, `File type not allowed: ${file.mimetype}`));
  }
};

// Instance Multer dengan konfigurasi lengkap
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Batas 10MB
  },
});
