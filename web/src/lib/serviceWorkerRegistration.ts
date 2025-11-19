// This file is intentionally left blank.
//
// The service worker is currently being registered manually within the
// `usePushNotifications.ts` hook. This was likely done to handle push
// notification logic directly.
//
// The previous implementation used Workbox for registration, but it was
// commented out, leaving this file with dead code. To avoid confusion and
// potential duplicate service worker registrations, the Workbox-related code
// has been removed.
//
// If a more advanced service worker strategy (e.g., for caching with Workbox)
// is needed in the future, registration logic should be consolidated into
// this single file to maintain a clear separation of concerns.

export function registerServiceWorker() {
  // No-op
}