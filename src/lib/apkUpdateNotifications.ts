'use client'

/** R467 — Notificações somente após consentimento e descoberta foreground de release certificada. */
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { ApkRelease } from '@/lib/mobileUpdatePolicy'
import {
  UPDATE_ALERT_ENABLED_KEY, UPDATE_ALERT_LAST_BUILD_KEY,
  apkUpdateNotificationId, shouldAnnounceApkUpdate,
} from '@/lib/apkUpdateAlertPolicy'

const CHANNEL_ID = 'dfl-app-updates-r467'
let schedulingBuild: number | null = null

function supported(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LocalNotifications')
}

function readLastBuild(): number | null {
  try {
    const n = Number(localStorage.getItem(UPDATE_ALERT_LAST_BUILD_KEY))
    return Number.isSafeInteger(n) && n > 0 ? n : null
  } catch { return null }
}

export function apkUpdateAlertsEnabled(): boolean {
  if (!supported()) return false
  try { return localStorage.getItem(UPDATE_ALERT_ENABLED_KEY) === '1' }
  catch { return false }
}

/** Não solicita permissão fora de interação explícita do usuário. */
export async function setApkUpdateAlertsEnabled(value: boolean): Promise<boolean> {
  if (!supported()) return false
  if (!value) {
    try { localStorage.setItem(UPDATE_ALERT_ENABLED_KEY, '0') } catch { return false }
    const last = readLastBuild()
    if (last !== null) {
      try { await LocalNotifications.cancel({ notifications: [{ id: apkUpdateNotificationId(last) }] }) }
      catch { /* Desativação local permanece respeitada. */ }
    }
    return false
  }
  try {
    const permission = await LocalNotifications.requestPermissions()
    if (permission.display !== 'granted') {
      localStorage.setItem(UPDATE_ALERT_ENABLED_KEY, '0')
      return false
    }
    localStorage.setItem(UPDATE_ALERT_ENABLED_KEY, '1')
    return true
  } catch { return false }
}

/** O app precisa abrir/retomar para descobrir versão; não há push remoto. */
export async function notifyApkUpdateOnce(release: ApkRelease, installedBuild: number | null): Promise<void> {
  if (!supported() || !apkUpdateAlertsEnabled() || !release.direct ||
      !shouldAnnounceApkUpdate(true, installedBuild, release, readLastBuild())) return
  if (schedulingBuild === release.build) return
  schedulingBuild = release.build
  try {
    const permission = await LocalNotifications.checkPermissions()
    if (permission.display !== 'granted') return
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Atualizações do Finance',
      description: 'Avisos opcionais sobre APKs certificados disponíveis',
      importance: 3,
    })
    // Revalida o opt-in após awaits: desativação durante a consulta não agenda aviso.
    if (!apkUpdateAlertsEnabled()) return
    await LocalNotifications.schedule({ notifications: [{
      id: apkUpdateNotificationId(release.build),
      title: 'Atualização do Finance disponível',
      body: `APK #${release.build} pronto para atualizar com segurança.`,
      schedule: { at: new Date(Date.now() + 2500) },
      channelId: CHANNEL_ID,
      smallIcon: 'ic_stat_dfl_finance',
      extra: { route: '/updates', type: 'dfl_apk_update_r467' },
    }] })
    if (!apkUpdateAlertsEnabled()) {
      // Desativação concorrente: cancela apenas o aviso de atualização criado agora.
      await LocalNotifications.cancel({ notifications: [{ id: apkUpdateNotificationId(release.build) }] }).catch(() => undefined)
      return
    }
    localStorage.setItem(UPDATE_ALERT_LAST_BUILD_KEY, String(release.build))
  } catch { /* Alertas nunca impedem o uso do Finance nem o seu atualizador. */ }
  finally { schedulingBuild = null }
}
