// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Server, Socket } from 'socket.io';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../../types/auth.js';

interface PushSubscribePayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface AuthenticatedSocket extends Socket {
  user?: AuthPayload & { publicKey: string | null };
}

export const registerPushHandlers = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user?.id;
  if (!userId) return;

  // Push Subscription
  socket.on("push:subscribe", async (data: PushSubscribePayload) => {
    if (!data.endpoint || !data.keys?.p256dh || !data.keys?.auth) return;

    try {
      await prisma.pushSubscription.upsert({
        where: { endpoint: data.endpoint },
        update: { p256dh: data.keys.p256dh, auth: data.keys.auth },
        create: {
          endpoint: data.endpoint,
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
          userId
        },
      });
    } catch (error) {
      console.error("Failed to save push subscription:", error);
    }
  });

  socket.on("push:unsubscribe", async () => {
    try {
      await prisma.pushSubscription.deleteMany({
        where: { userId }
      });
    } catch (error) {
      console.error("Failed to remove push subscriptions:", error);
    }
  });};
