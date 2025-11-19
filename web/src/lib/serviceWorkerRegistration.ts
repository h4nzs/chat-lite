import { Workbox } from 'workbox-window';
import { useConversationStore } from '@store/conversation';

/**
 * Sets up a Workbox service worker instance and attaches an activation handler that triggers conversation resynchronization when an updated service worker takes control.
 *
 * If the browser lacks Service Worker support this is a no-op. The function configures the activated event listener but does not perform registration (the registration call is intentionally disabled).
 */
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    const wb = new Workbox('/sw.js');

    wb.addEventListener('activated', (event) => {
      // This event is fired when the new service worker has taken control.
      // It's a good time to reload data if a new SW has taken over.
      if (event.isUpdate) {
        console.log('New service worker has been activated. Resyncing data...');
        // Use the store action to re-fetch conversations
        useConversationStore.getState().resyncState();
      }
    });

    // Register the service worker.
    // wb.register();
  }
}