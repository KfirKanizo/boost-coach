/* eslint-disable no-restricted-globals */

/**
 * BoostCoach Web Push Service Worker.
 *
 * Listens for push events, displays notifications, and handles click
 * routing via the `data.link` payload.
 */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'BoostCoach', body: event.data.text() };
  }

  const title = payload.title || 'BoostCoach';
  const options = {
    body: payload.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    data: payload.data || {},
    vibrate: [100, 50, 100],
    tag: payload.data?.tag || 'boostcoach-default',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification.data?.link;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Try to focus an existing window first
      for (const client of allClients) {
        if ('focus' in client) {
          if (link && 'navigate' in client) {
            client.navigate(link);
          }
          return client.focus();
        }
      }

      // Otherwise open a new window
      if (link) {
        return self.clients.openWindow(link);
      }
      return self.clients.openWindow('/');
    })(),
  );
});
