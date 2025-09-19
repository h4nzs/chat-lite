import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// === GET: User yang sedang login ===
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatarUrl: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user }); // 🔥 wrap pakai { user }
  } catch (e) {
    next(e);
  }
});

// === GET: Semua user (public list) ===
router.get("/", async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatarUrl: true,
      },
    });
    res.json({ users }); // 🔥 konsisten wrap array
  } catch (e) {
    next(e);
  }
});

export default router;
