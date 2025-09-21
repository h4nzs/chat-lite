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
  // Prioritaskan pembacaan token dari cookie
  const token = req.cookies?.at || // access token dari cookie
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!token) {
    console.log('[Auth Middleware] No token found in request');
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    console.log('[Auth Middleware] Pengguna terotentikasi:', payload); 
    (req as any).user = payload;
    next();
  } catch (err) {
    console.error("Authentication error:", err);
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
    // Prioritaskan validasi token dengan cara mem-parsing cookie langsung dari header
    let token: string | undefined = undefined;
    
    // Logging untuk debugging
    console.log("Socket handshake headers:", socket.handshake.headers);
    
    // Ekstrak token dari cookie
    if (socket.handshake.headers?.cookie) {
      const cookies = Object.fromEntries(
        socket.handshake.headers.cookie.split(";").map((c) => {
          const [k, v] = c.trim().split("=");
          return [k, decodeURIComponent(v)];
        })
      );
      token = cookies["at"] || undefined;
      console.log("Token from cookie:", token);
    }

    const user = verifySocketAuth(token);
    if (!user) return next(new Error("Unauthorized"));

    (socket as any).user = user;
    next();
  } catch (err) {
    console.error("Socket authentication error:", err);
    next(new Error("Unauthorized"));
  }
}
