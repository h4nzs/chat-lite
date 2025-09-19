// Push notification service
import webpush from 'web-push'

// Set VAPID keys (you should generate these and store in environment variables)
const vapidKeys = {
  publicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY || '',
  privateKey: import.meta.env.VITE_VAPID_PRIVATE_KEY || ''
}

// Set VAPID details
webpush.setVapidDetails(
  'mailto:admin@chatlite.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
)

// Store subscriptions in memory (in production, store in database)
const subscriptions = new Map<string, webpush.PushSubscription>()

// Add subscription
export function addSubscription(userId: string, subscription: webpush.PushSubscription) {
  subscriptions.set(userId, subscription)
}

// Remove subscription
export function removeSubscription(userId: string) {
  subscriptions.delete(userId)
}

// Send push notification
export async function sendPushNotification(userId: string, payload: any) {
  const subscription = subscriptions.get(userId)
  if (!subscription) return

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
  } catch (error) {
    console.error('Error sending push notification:', error)
    // Remove invalid subscription
    if (error instanceof webpush.WebPushError && error.statusCode === 410) {
      subscriptions.delete(userId)
    }
  }
}

// Send push notifications to multiple users
export async function sendPushNotifications(userIds: string[], payload: any) {
  const promises = userIds.map(userId => sendPushNotification(userId, payload))
  await Promise.allSettled(promises)
}