import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";
import { env } from "../config.js";

export interface AuthPayload {
  id: string;
  username: string;
}

// === Middleware untuk REST API ===
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token =
    req.cookies?.at || // access token dari cookie
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// === Helper untuk verifikasi token ===
export function verifySocketAuth(token?: string): AuthPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, env.jwtSecret) as AuthPayload;
  } catch {
    return null;
  }
}

// === Middleware khusus Socket.IO ===
export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
) {
  try {
    // 1. Ambil token dari handshake.auth
    let token: string | null =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization?.startsWith("Bearer ")
        ? socket.handshake.headers.authorization.split(" ")[1]
        : null);

    // 2. Fallback ke cookie (at)
    if (!token && socket.handshake.headers?.cookie) {
      const cookies = Object.fromEntries(
        socket.handshake.headers.cookie.split(";").map((c) => {
          const [k, v] = c.trim().split("=");
          return [k, decodeURIComponent(v)];
        })
      );
      token = cookies["at"] || null;
    }

    const user = verifySocketAuth(token);
    if (!user) return next(new Error("Unauthorized"));

    (socket as any).user = user;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
}
