// Service Worker per la gestione delle notifiche Push native (W3C Web Push)

self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'RV Capital Alpha';
    const options = {
      body: data.body || 'Nuovo aggiornamento disponibile',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      },
      actions: [
        { action: 'rebalance', title: 'Ribilancia Ora' },
        { action: 'ignore', title: 'Ignora' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (e) {
    console.error('Error handling push event:', e);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const action = event.action;

  if (action === 'ignore') {
    return;
  }

  let targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';
  
  if (action === 'rebalance') {
    targetUrl = '/?action=rebalance';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          if (action === 'rebalance') {
             client.postMessage({ type: 'FORCE_REBALANCE' });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
