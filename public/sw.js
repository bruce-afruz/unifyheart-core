// UnifyHeart service worker — receives web push and shows notifications.
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'UnifyHeart', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'UnifyHeart';
  const opts = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    image: data.image,
    tag: data.tag || 'unifyheart',
    renotify: true,
    data: { url: data.url || '/' },
    requireInteraction: false,
    timestamp: data.timestamp || Date.now(),
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.matchAll({ type: 'window' }).then((wins) => {
    for (const w of wins) {
      if ('focus' in w) { w.navigate(url); return w.focus(); }
    }
    return clients.openWindow(url);
  }));
});
