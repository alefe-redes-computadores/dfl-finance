'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

async function subscribeUser(userId: string) {
  if (!userId) return
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  const registration = await navigator.serviceWorker.ready
  const existingSubscription = await registration.pushManager.getSubscription()

  if (existingSubscription) {
    const { data } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', existingSubscription.endpoint)
      .maybeSingle()

    if (!data) {
      const json = existingSubscription.toJSON()
      await supabase.from('push_subscriptions').insert({
        user_id: userId,
        endpoint: json.endpoint!,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        user_agent: navigator.userAgent,
      })
    }

    return
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  if (!vapidPublicKey) {
    console.warn('Chave VAPID não configurada.')
    return
  }

  const newSubscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  const json = newSubscription.toJSON()

  await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  )
}

export default function PushNotificationManager({ userId }: { userId: string }) {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const isSupported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    if (!isSupported) return

    setSupported(true)
    setPermission(Notification.permission)
  }, [])

  const handleSubscribe = async () => {
    if (!userId || loading) return

    try {
      setLoading(true)
      await subscribeUser(userId)
      setPermission(Notification.permission)
    } finally {
      setLoading(false)
    }
  }

  if (!supported || permission === 'granted') return null

  if (permission === 'default') {
    return (
      <div className="fixed bottom-24 left-4 right-4 z-50">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-xl border border-gray-100 dark:border-slate-700 animate-in slide-in-from-bottom-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div className="flex-1">
              <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Ativar notificações</p>
              <p className="text-xs text-gray-500 mt-0.5">Receba alertas de vencimentos e metas</p>
            </div>
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={loading}
              className="px-4 py-2 bg-teal-700 text-white rounded-xl font-bold text-sm hover:bg-teal-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Ativando...' : 'Ativar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}