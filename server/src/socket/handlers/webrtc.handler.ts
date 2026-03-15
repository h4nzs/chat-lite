// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Server, Socket } from 'socket.io';
import { redisClient } from '../../lib/redis.js';
import type { AuthPayload } from '../../types/auth.js';

interface MigrationStartPayload {
  roomId: string;
  totalChunks: number;
  sealedKey: string;
  iv: string;
}

interface MigrationChunkPayload {
  roomId: string;
  chunkIndex: number;
  chunk: Record<string, unknown>;
}

interface MigrationAckPayload {
  roomId: string;
  success: boolean;
}

interface AuthenticatedSocket extends Socket {
  user?: AuthPayload & { publicKey: string | null };
}

export const registerMigrationHandlers = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user?.id;

  // Guest Zone - Migration Join
  socket.on('migration:join', (roomId: string) => {
    if (typeof roomId === 'string' && roomId.startsWith('mig_') && roomId.length > 20) {
      socket.join(roomId);
    } else {
      socket.emit("error", { message: "Invalid migration room" });
    }
  });

  // Migration Ack
  socket.on('migration:ack', (data: MigrationAckPayload) => {
    if (data && data.roomId) {
      socket.to(data.roomId).emit('migration:ack', data);
    }
  });

  // User Zone - Migration Start
  socket.on('migration:start', async (data: MigrationStartPayload) => {
    if (!data || !data.roomId || typeof data.roomId !== 'string' || !data.roomId.startsWith('mig_')) {
      socket.emit("error", { message: "Invalid migration room payload" });
      return;
    }

    await redisClient.setEx(`migration_owner:${data.roomId}`, 3600, userId!);
    socket.to(data.roomId).emit('migration:start', data);
  });

  // Migration Chunk
  socket.on('migration:chunk', async (data: MigrationChunkPayload) => {
    if (!data || !data.roomId || typeof data.roomId !== 'string') return;

    const ownerId = await redisClient.get(`migration_owner:${data.roomId}`);
    if (ownerId !== userId) {
      socket.emit("error", { message: "Permission denied for this migration room" });
      return;
    }

    socket.to(data.roomId).emit('migration:chunk', data);
  });

  // WebRTC E2EE Signaling
  socket.on('webrtc:secure_signal', (data: { to: string, type: string, payload: string }) => {
    if (!data || !data.to) return;
    socket.to(data.to).emit('webrtc:secure_signal', { 
      from: userId, 
      type: data.type, 
      payload: data.payload 
    });
  });
};
