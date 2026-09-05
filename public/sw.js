// ============================================================
// SERVICE WORKER - PWA + NOTIFICAÇÕES
// ============================================================

const CACHE_NAME = 'dfl-finance-v2'
const STATIC_ASSETS = [
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/favicon.ico',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith('dfl-finance-') &&
                cacheName !== CACHE_NAME
            )
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  )
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME)

  try {
    const response = await fetch(request)

    if (response && response.ok) {
      await cache.put(request, response.clone())
    }

    return response
  } catch (error) {
    const cached = await cache.match(request)

    if (cached) {
      return cached
    }

    if (request.mode === 'navigate') {
      const home = await cache.match('/')
      if (home) return home
    }

    throw error
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)

  if (cached) {
    return cached
  }

  const response = await fetch(request)

  if (response && response.ok) {
    await cache.put(request, response.clone())
  }

  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) return

  const isNavigation = request.mode === 'navigate'
  const isManifest = url.pathname === '/manifest.json'

  if (isNavigation || isManifest) {
    event.respondWith(networkFirst(request))
    return
  }

  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    ['style', 'script', 'image', 'font'].includes(request.destination)

  if (isStaticAsset) {
    event.respondWith(cacheFirst(request))
  }
})

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
      })
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
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
