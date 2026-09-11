// worker/index.js
// Extensão do service worker gerado pelo next-pwa.
// Cache/precache/fetch ficam sob responsabilidade do Workbox.
// Este arquivo preserva apenas notificações push e navegação ao tocar.

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const payload = event.data.json()
    const options = {
      body: payload.body || '',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: {
        url: payload.url || '/',
      },
      vibrate: [200, 100, 200],
      tag: payload.tag || 'default',
      renotify: true,
    }

    event.waitUntil(
      self.registration.showNotification(
        payload.title || 'DFL Finance',
        options
      )
    )
  } catch {
    event.waitUntil(
      self.registration.showNotification('DFL Finance', {
        body: event.data.text(),
        icon: '/icon-192x192.png',
        data: { url: '/' },
      })
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const rawUrl = event.notification.data?.url
  const urlToOpen =
    typeof rawUrl === 'string' &&
    rawUrl.startsWith('/') &&
    !rawUrl.startsWith('//')
      ? rawUrl
      : '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const absoluteUrl = new URL(urlToOpen, self.location.origin).href

        for (const client of clientList) {
          if (client.url === absoluteUrl && 'focus' in client) {
            return client.focus()
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen)
        }
      })
  )
})
