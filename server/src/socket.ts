// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Server, Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { env } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { verifyJwt } from "./utils/jwt.js";
import { redisClient } from "./lib/redis.js";
import { AuthPayload } from "./types/auth.js";
import cookie from "cookie";
import crypto from "crypto";

// --- REDIS ADAPTER IMPORTS ---
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";

// --- HANDLER IMPORTS ---
import { registerMessageHandlers } from "./socket/handlers/message.handler.js";
import { registerPresenceHandlers } from "./socket/handlers/presence.handler.js";
import { registerSessionHandlers } from "./socket/handlers/session.handler.js";
import { registerMigrationHandlers } from "./socket/handlers/webrtc.handler.js";
import { registerPushHandlers } from "./socket/handlers/push.handler.js";

// Extend the Socket type from Socket.IO to include our custom user property
interface AuthenticatedSocket extends Socket {
  user?: AuthPayload & { publicKey: string | null };
}

export let io: Server;

export function getIo() {
  if (!io) {
    throw new Error("Socket.IO not initialized!");
  }
  return io;
}

export function registerSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowedOrigins = [
          env.corsOrigin,
          "http://localhost:5173",
          "http://localhost:4173",
          "http://nyx-app.my.id",
          "https://nyx-app.my.id",
          "http://*.nyx-app.my.id",
          "https://*.nyx-app.my.id"
        ];
        if (
          allowedOrigins.includes(origin) ||
          origin.endsWith('.vercel.app') ||
          origin.endsWith('.koyeb.app') ||
          origin.endsWith('.onrender.com') ||
          origin.endsWith('.nyx-app.my.id') ||
          origin.endsWith('.ngrok-free.app')
        ) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ["GET", "POST"]
    },
    path: '/socket.io',
    transports: ['polling', 'websocket'],
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
    allowEIO3: true,
    pingTimeout: 30000,
    pingInterval: 35000
  });

  // === REDIS ADAPTER SETUP (CLUSTER MODE SUPPORT) ===
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  const redisOptions = {
    url: redisUrl,
    socket: {
      keepAlive: true,
      reconnectStrategy: (retries: number) => Math.min(retries * 50, 2000),
    }
  };

  const pubClient = createClient(redisOptions);
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient));
    })
    .catch((err) => {
      console.error("❌ Socket.IO Redis Adapter Connection Failed:", err);
    });
  // ==================================================

  // === MIDDLEWARE AUTH ===
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      if (!token) {
        const cookieHeader = socket.handshake.headers.cookie;
        if (cookieHeader) {
          const cookies = cookie.parse(cookieHeader);
          token = cookies.at;
        }
      }

      if (!token) {
        socket.user = undefined;
        return next();
      }

      const payload = verifyJwt(token);
      if (!payload || typeof payload === 'string') {
        socket.user = undefined;
        return next();
      }

      // @ts-ignore
      const userId = payload.id || payload.sub;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, publicKey: true }
      });

      if (!user) {
        socket.user = undefined;
        return next();
      }

      socket.user = {
        id: user.id,
        publicKey: user.publicKey
      };
      next();
    } catch (err) {
      console.error("[Socket] Auth Middleware Error:", err);
      socket.user = undefined;
      next();
    }
  });

  io.on("connection", async (socket: AuthenticatedSocket) => {
    const userId = socket.user?.id;

    // ==========================================
    // 🅰️ GUEST ZONE (Belum Login / HP Baru)
    // ==========================================
    if (!userId) {
      // Event 1: Request QR Token (Dipanggil oleh LinkDevicePage)
      socket.on("auth:request_linking_qr", async (payload: { publicKey: string }, callback) => {
        const linkingToken = crypto.randomBytes(32).toString('hex');
        await socket.join(`linking:${linkingToken}`);

        if (typeof callback === 'function') {
          callback({ token: linkingToken });
        }
      });

      // Register migration handlers for guests
      registerMigrationHandlers(io, socket);

      socket.on("disconnect", () => {
        // Guest disconnect - no cleanup needed
      });

      // STOP! Guest tidak boleh lanjut ke logika user
      return;
    }

    // ==========================================
    // 🅱️ USER ZONE (Sudah Login / HP Lama)
    // ==========================================

    // Join room pribadi user
    socket.join(userId);

    // Update Presence
    if (!socket.recovered) {
      const userSocketsKey = `user:${userId}:sockets`;
      const added = await redisClient.sAdd(userSocketsKey, socket.id);
      const currentCount = await redisClient.sCard(userSocketsKey);

      if (added === 1 && currentCount === 1) {
        await redisClient.sAdd('online_users', userId);
        socket.broadcast.emit("presence:user_joined", userId);
      }

      const onlineUserIds = await redisClient.sMembers('online_users');
      socket.emit("presence:init", onlineUserIds);
    }

    // Register domain-specific handlers
    registerMessageHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerSessionHandlers(io, socket);
    registerMigrationHandlers(io, socket);
    registerPushHandlers(io, socket);

  }); // End io.on connection

  return io;
}
