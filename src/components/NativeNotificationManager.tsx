'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUserSettings } from '@/hooks/useUserSettings'
import {
  addNativeNotificationActionListener,
  syncNativeFinancialReminders,
} from '@/lib/nativeNotifications'

const DFL_NOTIFICATION_ROUTE_STORAGE_KEY = 'dfl_finance_pending_notification_route'
const DFL_NOTIFICATION_ROUTE_TTL_MS = 5 * 60 * 1000

function persistNotificationRoute(route: string) {
  try {
    sessionStorage.setItem(
      DFL_NOTIFICATION_ROUTE_STORAGE_KEY,
      JSON.stringify({ route, at: Date.now() })
    )
  } catch {
    // Navegação continua funcionando mesmo sem storage.
  }
}

function consumeNotificationRoute() {
  try {
    const raw = sessionStorage.getItem(DFL_NOTIFICATION_ROUTE_STORAGE_KEY)
    if (!raw) return null

    sessionStorage.removeItem(DFL_NOTIFICATION_ROUTE_STORAGE_KEY)

    const parsed = JSON.parse(raw) as { route?: unknown; at?: unknown }
    if (
      typeof parsed.route !== 'string' ||
      typeof parsed.at !== 'number' ||
      Date.now() - parsed.at > DFL_NOTIFICATION_ROUTE_TTL_MS
    ) {
      return null
    }

    return parsed.route
  } catch {
    return null
  }
}

export default function NativeNotificationManager({
  userId,
}: {
  userId: string
}) {
  const router = useRouter()
  const { settings } = useUserSettings()
  const lastNotificationRouteRef = useRef<{
    route: string
    at: number
  } | null>(null)

  /*
   * V44 — replay estrutural do deep link persistido.
   * O checker V41.1 podia aceitar apenas a definição da função.
   * Aqui existe uma chamada real após o router estar montado.
   */
  useEffect(() => {
    const pendingRoute = consumeNotificationRoute()
    if (!pendingRoute) return

    const now = Date.now()
    const last = lastNotificationRouteRef.current

    if (
      last?.route === pendingRoute &&
      now - last.at < 1500
    ) {
      return
    }

    lastNotificationRouteRef.current = {
      route: pendingRoute,
      at: now,
    }

    router.push(pendingRoute)
  }, [router])


  useEffect(() => {
    if (!userId || !settings) return

    let active = true
    let actionListener:
      | { remove: () => Promise<void> }
      | null = null

    let syncing = false
    let rerun = false

    const sync = async () => {
      if (!active) return

      if (syncing) {
        rerun = true
        return
      }

      syncing = true

      try {
        do {
          rerun = false
          await syncNativeFinancialReminders(
            userId,
            settings.preferences
          )
        } while (active && rerun)
      } catch (error) {
        console.warn(
          '[NativeNotifications] Não foi possível sincronizar lembretes:',
          error
        )
      } finally {
        syncing = false
      }
    }

    void sync()

    void addNativeNotificationActionListener((route) => {
      const now = Date.now()
      const last = lastNotificationRouteRef.current

      if (
        last?.route === route &&
        now - last.at < 1200
      ) {
        return
      }

      lastNotificationRouteRef.current = {
        route,
        at: now,
      }

      // O listener só existe depois que o shell autenticado e o router
      // estão montados. Assim, toque em notificação abre a ação contextual
      // em vez de depender da Home como destino intermediário.
      persistNotificationRoute(route)
      router.push(route)
    }).then((listener) => {
      if (!active) {
        void listener?.remove()
        return
      }

      actionListener = listener
    })

    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        void sync()
      }
    }

    window.addEventListener('online', sync)
    document.addEventListener(
      'visibilitychange',
      handleResume
    )

    return () => {
      active = false
      window.removeEventListener('online', sync)
      document.removeEventListener(
        'visibilitychange',
        handleResume
      )

      if (actionListener) {
        void actionListener.remove()
      }
    }
  }, [router, settings, userId])

  return null
}
