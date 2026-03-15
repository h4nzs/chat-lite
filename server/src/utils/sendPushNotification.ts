import webpush from 'web-push'
import { prisma } from '../lib/prisma.js'
import { env } from '../config.js'

export async function sendPushNotification (userId: string, payload: Record<string, unknown>) {
  if (!env.vapidPublicKey || !env.vapidPrivateKey) {
    return // Jangan lakukan apa-apa jika VAPID keys tidak ada
  }

  try {
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
    if (subscriptions.length === 0) return

    let encryptedPushPayload = (payload['data'] as Record<string, unknown>)?.encryptedPushPayload as string | undefined;
    if (encryptedPushPayload && Buffer.byteLength(encryptedPushPayload, 'utf8') > 3000) {
      // If the encrypted payload exceeds safe limits (Web Push limit is ~4KB),
      // fallback to metadata-only to ensure delivery.
      encryptedPushPayload = undefined;
    }

    const safePayload = {
      title: "New Secure Message",
      body: "You received a new encrypted message.",
      type: (payload.type as string) || 'GENERIC_MESSAGE',
      data: {
        conversationId: (payload['data'] as Record<string, unknown>)?.conversationId as string | undefined,
        messageId: (payload['data'] as Record<string, unknown>)?.messageId as string | undefined,
        encryptedPushPayload
      }
    };
    const payloadString = JSON.stringify(safePayload);

    const notifications = subscriptions.map(sub =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        },
        payloadString
      ).catch((error: unknown) => {
        // Jika subscription tidak valid (misal: user uninstall app), hapus dari DB
        if ((error as { statusCode?: number }).statusCode === 410 || (error as { statusCode?: number }).statusCode === 404) {
          return prisma.pushSubscription.delete({ where: { id: sub.id } })
        }
        console.error(`Error sending push notification for sub ${sub.id}: statusCode=${(error as { statusCode?: number })?.statusCode || 'unknown'}`);
      })
    )

    await Promise.all(notifications)
  } catch (error: unknown) {
    console.error(`Failed to send push notifications: statusCode=${(error as { statusCode?: number })?.statusCode || 'unknown'}`);
  }
}
