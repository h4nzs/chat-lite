import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config.js';
import { Request } from 'express';
import { ApiError } from './errors.js';

// Extend the Express Request interface to include our custom property
declare global {
  namespace Express {
    interface Request {
      requiresEncryptionValidation?: boolean;
    }
  }
}

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
  'audio/webm': 'audio',
  'audio/mp4': 'audio',
  // Archives
  'application/zip': 'archives',
  'application/x-rar-compressed': 'archives',
  // Binary files (including encrypted files) - need additional validation
  'application/octet-stream': 'binary',
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
  // Check if it's an allowed MIME type first
  const category = ALLOWED_TYPES[file.mimetype];
  if (!category) {
    // Tolak file dengan tipe yang tidak diizinkan
    return cb(new ApiError(400, `File type not allowed: ${file.mimetype}`));
  }

  // For application/octet-stream files, we need additional validation
  if (file.mimetype === 'application/octet-stream') {
    // This flag will be checked after the file is uploaded
    req.requiresEncryptionValidation = true; // Flag to indicate this file needs encryption validation
  }

  // Allow the file for now, validation happens after upload
  cb(null, true);
};

// Export the validation function so it can be used in route handlers
export const validateEncryptedFileAfterUpload = (filePath: string): boolean => {
  try {
    // Read the beginning of the file to check for encryption signatures
    const fileSize = fs.statSync(filePath).size;

    if (fileSize < 24) {
      // Encrypted files typically need at least 24 bytes for the nonce
      return false;
    }

    // Read first 32 bytes to check for sodium encryption format
    const fileBuffer = fs.readFileSync(filePath, null);

    // Check if this looks like a properly encrypted file (with a nonce)
    // In libsodium's crypto_secretbox_easy, first 24 bytes are the nonce
    if (fileBuffer.length >= 24) {
      // For now, just check that it's a binary file of appropriate size
      // In a more sophisticated implementation, we'd verify the encryption format
      return true;
    }

    return false;
  } catch (err) {
    console.error('Error validating encrypted file:', err);
    return false;
  }
};

// Export the validation function so it can be used in route handlers
export const validateEncryptedFileAfterUpload = (filePath: string): boolean => {
  try {
    // Read the beginning of the file to check for encryption signatures
    const fileSize = fs.statSync(filePath).size;

    if (fileSize < 24) {
      // Encrypted files typically need at least 24 bytes for the nonce
      return false;
    }

    // Read first 32 bytes to check for sodium encryption format
    const fileBuffer = fs.readFileSync(filePath, null);

    // Check if this looks like a properly encrypted file (with a nonce)
    // In libsodium's crypto_secretbox_easy, first 24 bytes are the nonce
    if (fileBuffer.length >= 24) {
      // For now, just check that it's a binary file of appropriate size
      // In a more sophisticated implementation, we'd verify the encryption format
      return true;
    }

    return false;
  } catch (err) {
    console.error('Error validating encrypted file:', err);
    return false;
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

// Export the getFileCategory function for use in routes if needed
export { getFileCategory };
