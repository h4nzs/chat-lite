/* eslint-env serviceworker */

// Service worker for push notifications
self.addEventListener('push', (event) => {
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
