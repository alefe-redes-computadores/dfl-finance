'use client'

/** R464: a fonte é GitHub Release verificado pelo serviço; não aceita URLs arbitrárias. */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export type DflDownloadProgress = { build: number; received: number; total: number; percent: number }
export type DflInstallResult = { opened?: boolean; permissionRequired?: boolean }
export type DflNativeApkUpdater = {
  downloadVerified(options: { build: number; sha256: string; bytes: number }): Promise<{ verified: boolean; build: number }>
  cancelDownload(): Promise<{ requested: boolean }>
  installVerified(options: { build: number; sha256: string }): Promise<DflInstallResult>
  openInstallSettings(): Promise<void>
  addListener(eventName: 'downloadProgress', listener: (progress: DflDownloadProgress) => void): Promise<PluginListenerHandle>
}

const native = registerPlugin<DflNativeApkUpdater>('DflApkUpdater')

export function getNativeApkUpdater(): DflNativeApkUpdater | null {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' ? native : null
}
