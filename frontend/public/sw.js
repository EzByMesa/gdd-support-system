// Service Worker для Push-уведомлений GDD Support System

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'GDD Support', body: event.data.text() };
  }

  const options = {
    body: data.body || '',
    icon: '/icons/notification-icon.png',
    badge: '/icons/badge-icon.png',
    data: data.data || {},
    tag: data.tag || 'gdd-notification',
    renotify: true,
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'GDD Support', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const ticketId = event.notification.data?.ticketId;
  const url = ticketId ? `/tickets/${ticketId}` : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
