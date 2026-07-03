// ============================================================
// SERVICE WORKER COMPLETO (PWA + NOTIFICAÇÕES)
// ============================================================

// ============================================================
// PARTE 1: NEXT-PWA (CACHING DE ASSETS)
// ============================================================

// Importa o Workbox (será injetado pelo next-pwa no build)
// Mas como você não pode rodar o build agora, vamos usar um fallback
// com a estratégia básica de caching

// Estratégia de caching para assets estáticos
const CACHE_NAME = 'dfl-finance-v1'
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/favicon.ico',
]

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto')
        return cache.addAll(urlsToCache)
      })
      .then(() => self.skipWaiting())
  )
})

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME]
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Interceptação de requisições (fallback para quando estiver offline)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response
        }
        return fetch(event.request).then(
          (response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response
            }

            // Clone da resposta para cache
            const responseToCache = response.clone()
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache)
              })

            return response
          }
        )
      })
  )
})

// ============================================================
// PARTE 2: NOTIFICAÇÕES PUSH (SEU CÓDIGO ORIGINAL)
// ============================================================

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
      self.registration.showNotification(payload.title || 'DFL Finance', options)
    )
  } catch {
    // Fallback para texto puro
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