'use client'

/** R459 — envio LOCAL opcional. Sem push remoto, leitura financeira ou alarmes ocultos. */
import { Capacitor, registerPlugin } from '@capacitor/core'
import { requestNativeNotificationPermission } from '@/lib/nativeNotifications'
import type { ProactiveObservation } from '@/lib/proactiveObservations'
import { planProactiveDigest, type ProactiveDigestSettings } from '@/lib/proactiveDigestPolicy'

const OWNER = 'dfl-finance-proactive'
const CHANNEL = 'dfl-finance-observations'

type Pending = { id: number; extra?: Record<string, unknown> }
type NativePlugin = {
  checkPermissions(): Promise<{ display: string }>
  getPending(): Promise<{ notifications: Pending[] }>
  cancel(opts: { notifications: Array<{ id: number }> }): Promise<void>
  createChannel(opts: { id: string; name: string; description: string; importance: number; visibility: number }): Promise<void>
  schedule(opts: { notifications: Array<{
    id: number; title: string; body: string; schedule: { at: Date; allowWhileIdle: boolean }
    channelId: string; smallIcon: string; iconColor: string; extra: Record<string, unknown>
  }> }): Promise<void>
}
const LocalNotifications = registerPlugin<NativePlugin>('LocalNotifications')
const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LocalNotifications')

// Autorizacao somente apos acao explicita do usuario.
export async function requestProactiveDigestPermission() {
  return requestNativeNotificationPermission()
}

export async function clearProactiveNativeDigest(): Promise<number> {
  if (!isAndroid()) return 0
  const pending = await LocalNotifications.getPending()
  const owned = pending.notifications.filter(item => item.extra?.managedBy === OWNER)
  if (owned.length) await LocalNotifications.cancel({ notifications: owned.map(item => ({ id: item.id })) })
  return owned.length
}

export async function syncProactiveNativeDigest(
  userId: string,
  context: 'dfl' | 'personal',
  observations: readonly ProactiveObservation[],
  settings: ProactiveDigestSettings,
): Promise<'unsupported' | 'disabled' | 'not-permitted' | 'unchanged' | 'scheduled' | 'nothing-to-remind'> {
  if (!isAndroid()) return 'unsupported'
  const planned = planProactiveDigest(userId, context, observations, settings)
  const pending = await LocalNotifications.getPending()
  const owned = pending.notifications.filter(item => item.extra?.managedBy === OWNER)
  if (!planned) {
    if (owned.length) await LocalNotifications.cancel({ notifications: owned.map(item => ({ id: item.id })) })
    return settings.enabled && settings.frequency !== 'off' ? 'nothing-to-remind' : 'disabled'
  }
  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') {
    if (owned.length) await LocalNotifications.cancel({ notifications: owned.map(item => ({ id: item.id })) })
    return 'not-permitted'
  }
  const matches = owned.length === 1 && owned[0].id === planned.id && owned[0].extra?.signature === planned.signature
  if (matches) return 'unchanged'
  if (owned.length) await LocalNotifications.cancel({ notifications: owned.map(item => ({ id: item.id })) })
  await LocalNotifications.createChannel({
    id: CHANNEL, name: 'Observações do Finance',
    description: 'Resumo opcional das observações revisadas no aplicativo.',
    importance: 3, visibility: 0,
  })
  await LocalNotifications.schedule({ notifications: [{
    id: planned.id, title: planned.title, body: planned.body,
    schedule: { at: planned.at, allowWhileIdle: true },
    channelId: CHANNEL, smallIcon: 'ic_stat_dfl_finance', iconColor: '#0f766e',
    extra: { managedBy: OWNER, signature: planned.signature, route: planned.route, context },
  }] })
  return 'scheduled'
}
