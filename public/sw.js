// Service Worker para MoTaxi - Web Push Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Manejar push notifications entrantes
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'MoTaxi', body: event.data ? event.data.text() : 'Nueva notificación' };
  }

  const title = data.title || 'MoTaxi';
  const options = {
    body: data.body || '',
    icon: data.icon || '/logo.png',
    badge: '/logo.png',
    tag: data.tag || 'motaxi-notification',
    data: data.data || {},
    requireInteraction: data.data?.type === 'new_trip', // Mantener visible para viajes nuevos
    actions: data.data?.type === 'new_trip'
      ? [{ action: 'open', title: 'Ver viaje' }]
      : [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Manejar click en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/driver';

  if (data.type === 'new_trip') {
    url = '/driver';
  } else if (data.type === 'trip_accepted') {
    url = `/passenger/trip/${data.tripId || ''}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana abierta, enfocarla
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Abrir nueva ventana
      return clients.openWindow(url);
    })
  );
});
