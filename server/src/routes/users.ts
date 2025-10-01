import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// === GET: User yang sedang login ===
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    console.log(`[Users Controller] Mencoba mengambil data user untuk userId: ${userId}`);

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

    if (!user) {
      console.error(`[Users Controller] User dengan ID ${userId} tidak ditemukan.`);
      return res.status(404).json({ error: "User not found" });
    }
    
    console.log(`[Users Controller] Data user ditemukan untuk userId: ${userId}`);
    res.json(user); // Direct user object, consistent with frontend expectations
  } catch (e) {
    console.error("[Users Controller] Error:", e);
    next(e);
  }
});

// === GET: Search users by query ===
router.get("/search", requireAuth, async (req, res, next) => {
  try {
    const { q } = req.query as { q?: string };
    console.log(`[Users Controller] Searching users with query: ${q}`);

    if (!q || q.trim().length === 0) {
      return res.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatarUrl: true,
      },
      take: 20, // Limit results
    });

    console.log(`[Users Controller] Found ${users.length} users matching query: ${q}`);
    res.json(users);
  } catch (e) {
    console.error("[Users Controller] Search Error:", e);
    next(e);
  }
});

// === GET: Semua user (public list) ===
router.get("/", requireAuth, async (req, res, next) => {
  try {
    console.log(`[Users Controller] Mengambil daftar semua user (public)`);
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatarUrl: true,
      },
    });
    console.log(`[Users Controller] Menemukan ${users.length} user`);
    res.json({ users }); // 🔥 konsisten wrap array
  } catch (e) {
    console.error("[Users Controller] Error:", e);
    next(e);
  }
});

export default router;
