/* Service worker KhoaChat: nhận Web Push khi đã đóng tab và mở đúng kênh khi bấm vào thông báo */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'KhoaChat', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'KhoaChat';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Bạn có tin nhắn mới',
      tag: data.tag,
      renotify: true,
      icon: '/logo.svg',
      badge: '/logo.svg',
      data: { url: data.url || '/', channelId: data.channelId, messageId: data.messageId },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url, channelId, messageId } = event.notification.data || {};
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if (new URL(c.url).origin === self.location.origin) {
          await c.focus();
          c.postMessage({ type: 'open-channel', channelId, messageId });
          return;
        }
      }
      await self.clients.openWindow(url || '/');
    })(),
  );
});
