/* Notification clicks stay inside this app's scope. No remote destination is accepted. */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = self.registration.scope + '#/notifications';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    const client = windows.find(window => window.url.startsWith(self.registration.scope));
    if (client) { await client.navigate(target); return client.focus(); }
    return self.clients.openWindow(target);
  })());
});
