// public/sw.js
self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const payload = event.data.json()
    const options = {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        url: payload.url || '/',
      },
      vibrate: [200, 100, 200],
      tag: payload.tag || 'default',
      renotify: true,
    }

    event.waitUntil(
      self.registration.showNotification(payload.title || 'DFL Finance', options)
    )
  } catch {
    // Fallback para texto puro
    event.waitUntil(
      self.registration.showNotification('DFL Finance', {
        body: event.data.text(),
        icon: '/icon-192.png',
      })
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})