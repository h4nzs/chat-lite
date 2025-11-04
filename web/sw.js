/* eslint-env serviceworker */

// 1. Import Workbox library
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// 2. Check if Workbox is loaded
if (workbox) {
  console.log(`Workbox is loaded.`);

  // 3. Deconstruct necessary modules for clarity
  const { precaching, routing, strategies, cacheableResponse } = workbox;

  // 4. Inject precache manifest. This is a placeholder that vite-plugin-pwa will replace.
  precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  // 5. Caching Strategy for API
  routing.registerRoute(
    ({ url }) => url.pathname.startsWith('/api/conversations'),
    new strategies.StaleWhileRevalidate({
      cacheName: 'api-conversations-cache',
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200], // Cache successful and opaque responses
        }),
      ],
    })
  );

} else {
  console.error(`Workbox failed to load.`);
}

// --- 6. Existing Push Notification & Lifecycle Logic ---

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('Service Worker: Push Received.');
  if (event.data) {
    const data = event.data.json();
    const title = data.title || 'New message';
    const options = {
      body: data.body || 'You have a new message',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: {
        conversationId: data.conversationId,
      },
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const conversationId = event.notification.data?.conversationId;
  const targetUrl = conversationId ? `/conversations/${conversationId}` : '/';

  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
