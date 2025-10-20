import { Router, Response } from "express";
import { prisma } from "../lib/prisma.js";
import bcrypt from "bcrypt";
import { ApiError } from "../utils/errors.js";
import {
  newJti,
  refreshExpiryDate,
  signAccessToken,
  verifyJwt,
} from "../utils/jwt.js";
import { z } from "zod";
import { zodValidate } from "../utils/validate.js";
import { env } from "../config.js";
import { JwtPayload } from "jsonwebtoken";

const router = Router();

function setAuthCookies(
  res: Response,
  { access, refresh }: { access: string; refresh: string }
) {
  const isProd = env.nodeEnv === "production";

  res.cookie("at", access, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",  // Changed from conditional to strict
    path: "/",
    maxAge: 1000 * 60 * 15, // 15 menit
  });

  res.cookie("rt", refresh, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",  // Changed from conditional to strict
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 hari
  });
}

async function issueTokens(user: any) {
  const access = signAccessToken({
    id: user.id,
    email: user.email,
    username: user.username,
  });
  const jti = newJti();
  const refresh = signAccessToken({ sub: user.id, jti }, { expiresIn: "30d" });
  await prisma.refreshToken.create({
    data: { jti, userId: user.id, expiresAt: refreshExpiryDate() },
  });
  return { access, refresh };
}

// === REGISTER ===
router.post(
  "/register",
  zodValidate({
    body: z.object({
      email: z.string().email().max(200),
      username: z.string().min(3).max(32),
      password: z.string().min(8).max(128),
      name: z.string().min(1).max(80),
    }),
  }),
  async (req, res, next) => {
    try {
      const { email, username, password, name } = req.body;
      const hash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email, username, passwordHash: hash, name },
      });
      const tokens = await issueTokens(user);
      setAuthCookies(res, tokens);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (e: any) {
      if (e.code === "P2002")
        return next(new ApiError(400, "Email/username already used"));
      next(e);
    }
  }
);

// === LOGIN ===
router.post(
  "/login",
  zodValidate({
    body: z.object({
      emailOrUsername: z.string().min(1),
      password: z.string().min(8),
    }),
  }),
  async (req, res, next) => {
    try {
      const { emailOrUsername, password } = req.body;
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
        },
      });
      if (!user) throw new ApiError(401, "Invalid credentials");

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) throw new ApiError(401, "Invalid credentials");

      const tokens = await issueTokens(user);
      setAuthCookies(res, tokens);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (e) {
      next(e);
    }
  }
);

// === REFRESH ===
router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.rt;
    if (!token) throw new ApiError(401, "No refresh token");

    const payload = verifyJwt(token) as JwtPayload | null;
    if (!payload?.jti || !payload?.sub)
      throw new ApiError(401, "Invalid refresh token");

    const stored = await prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date())
      throw new ApiError(401, "Refresh token expired/revoked");

    await prisma.refreshToken.update({
      where: { jti: payload.jti },
      data: { revokedAt: new Date() },
    });

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new ApiError(401, "User not found");

    const tokens = await issueTokens(user);
    setAuthCookies(res, tokens);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// === LOGOUT ===
router.post("/logout", async (req, res) => {
  const r = req.cookies?.rt;
  if (r) {
    const payload = verifyJwt(r) as JwtPayload | null;
    if (payload?.jti) {
      await prisma.refreshToken.updateMany({
        where: { jti: payload.jti },
        data: { revokedAt: new Date() },
      });
    }
  }
  res.clearCookie("at", { path: "/" });
  res.clearCookie("rt", { path: "/" });
  res.json({ ok: true });
});

export default router;
