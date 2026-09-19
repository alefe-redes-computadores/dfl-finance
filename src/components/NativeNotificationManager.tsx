'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserSettings } from '@/hooks/useUserSettings'
import {
  addNativeNotificationActionListener,
  syncNativeFinancialReminders,
} from '@/lib/nativeNotifications'

export default function NativeNotificationManager({
  userId,
}: {
  userId: string
}) {
  const router = useRouter()
  const { settings } = useUserSettings()

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
