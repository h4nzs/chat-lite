/* eslint-env serviceworker */

// Check if Workbox is available and import it
if (typeof importScripts === 'function') {
    importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

    // Set up precaching (placeholder will be injected by vite-plugin-pwa)
    if (workbox) {
        console.log(`Yay! Workbox is loaded 🎉`);
        workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

        // --- Caching Strategy for API ---
        workbox.routing.registerRoute(
          ({ url }) => url.pathname.startsWith('/api/conversations'),
          new workbox.strategies.StaleWhileRevalidate({
            cacheName: 'api-conversations-cache',
            plugins: [
              new workbox.cacheable.CacheableResponsePlugin({
                statuses: [0, 200], // Cache successful responses & opaque responses
              }),
            ],
          })
        );
    } else {
        console.log(`Boo! Workbox didn't load 😬`);
    }
}


// --- Existing Push Notification Logic ---

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  // Skip waiting to activate the new service worker immediately.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  // Take control of all open clients immediately.
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

  // This looks for a matching client (browser tab) and focuses it.
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      // If a window for the app is already open, focus it.
      for (const client of clientList) {
        // A simple check to see if the client is the app.
        // You might want to make this more robust.
        if (client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // If no window is open, open a new one.
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
