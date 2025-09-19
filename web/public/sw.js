// Service worker for push notifications
self.addEventListener('push', (event: any) => {
  if (event.data) {
    const data = event.data.json();
    const title = data.title || 'New message';
    const options = {
      body: data.body || 'You have a new message',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: {
        conversationId: data.conversationId
      }
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();

  // Redirect to chat page
  event.waitUntil(
    clients.openWindow(`/chat/${event.notification.data.conversationId}`)
  );
});