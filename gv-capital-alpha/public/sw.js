// Service Worker per la gestione delle notifiche Push native (W3C Web Push)

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error('Error parsing push data:', e);
  }

  const title = data.title || 'GV Capital Alert';
  const options = {
    body: data.message || data.body || 'Nuovo aggiornamento disponibile',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Apri Dashboard' },
      { action: 'ignore', title: 'Ignora' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;

  if (action === 'ignore') {
    return;
  }

  let targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';
  
  // Aggiungo i parametri all'URL nel caso in cui l'app debba essere riaperta da zero
  const titleEnc = encodeURIComponent(event.notification.title || '');
  const bodyEnc = encodeURIComponent(event.notification.body || '');
  const separator = targetUrl.includes('?') ? '&' : '?';
  const urlWithParams = `${targetUrl}${separator}notify_title=${titleEnc}&notify_body=${bodyEnc}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          if (action === 'rebalance') {
             client.postMessage({ type: 'FORCE_REBALANCE' });
          }
          // Se l'app è già aperta, le mando subito i dati per aprire il modale
          client.postMessage({ 
            type: 'SHOW_NOTIFICATION_MODAL', 
            payload: { title: event.notification.title, body: event.notification.body }
          });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlWithParams);
      }
    })
  );
});
