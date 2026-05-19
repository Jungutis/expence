/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? '💳 Ar susimokėjai?', {
      body: data.body ?? 'Paspusk kad pridėtum išlaidą',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: 'payment-check',
      renotify: true,
      data: { url: '/quick-add' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            (client as WindowClient).navigate('/quick-add');
            return (client as WindowClient).focus();
          }
        }
        return self.clients.openWindow('/quick-add');
      })
  );
});
