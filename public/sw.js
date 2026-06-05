// public/sw.js

self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'SB Bundles';
    const options = {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/favicon.ico',
      data: {
        url: payload.url || '/'
      }
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // Fallback if payload isn't valid JSON
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('SB Bundles Update', {
        body: text,
        icon: '/icon-192.png',
        badge: '/favicon.ico',
        data: { url: '/' }
      })
    );
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open at that URL, focus it
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
