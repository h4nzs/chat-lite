import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { io } from "../socket.js"; // Impor io

const router = Router();

// Konfigurasi Multer untuk upload avatar
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), "uploads", "avatars");
    // Buat direktori jika belum ada
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).user.id;
    const extension = path.extname(file.originalname);
    cb(null, `${userId}${extension}`);
  },
});

const uploadAvatar = multer({ 
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const mimeType = allowedTypes.test(file.mimetype);
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimeType && extName) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpeg, jpg, png, gif) are allowed!'));
  }
});

// === GET: User data diri ===
router.get("/me", requireAuth, (req, res) => {
  res.json((req as any).user);
});

// === PUT: Update user profile (e.g., name) ===
router.put("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
      select: { id: true, email: true, username: true, name: true, avatarUrl: true },
    });

    io.emit('user:updated', updatedUser); // Siarkan pembaruan
    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

// === POST: Update user avatar ===
router.post("/me/avatar", requireAuth, uploadAvatar.single('avatar'), async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, email: true, username: true, name: true, avatarUrl: true },
    });

    io.emit('user:updated', updatedUser); // Siarkan pembaruan
    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

// === GET: Cari user berdasarkan query ===
router.get("/search", requireAuth, async (req, res, next) => {
  try {
    const query = req.query.q as string;
    const meId = (req as any).user.id;

    if (!query) {
      return res.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: meId } },
          {
            OR: [
              { username: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
            ],
          },
        ],
      },
      take: 10,
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
      },
    });

    res.json(users);
  } catch (e) {
    next(e);
  }
});

export default router;
