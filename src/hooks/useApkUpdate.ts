'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { fetchLatestApkRelease } from '@/lib/mobileUpdateService'
import { hasNewApk, parseInstalledBuild, type ApkRelease } from '@/lib/mobileUpdatePolicy'

const RECHECK_MS = 20 * 60 * 1000
const RETRY_AFTER_ERROR_MS = 2 * 60 * 1000

type CheckState = 'idle' | 'checking' | 'ready' | 'error'

/** No APK, compara com o versionCode real; no PWA, apenas informa releases. */
export function useApkUpdate(includeWeb = false) {
  const [android, setAndroid] = useState<boolean | null>(null)
  const [installedBuild, setInstalledBuild] = useState<number | null>(null)
  const [latest, setLatest] = useState<ApkRelease | null>(null)
  const [state, setState] = useState<CheckState>('idle')
  const checkedRef = useRef(0)
  const mountedRef = useRef(false)

  const refresh = useCallback(async (force = false) => {
    if (!force && Date.now() - checkedRef.current < RECHECK_MS) return
    checkedRef.current = Date.now()
    if (mountedRef.current) setState('checking')
    try {
      const release = await fetchLatestApkRelease(force)
      if (!mountedRef.current) return
      setLatest(release)
      setState('ready')
    } catch {
      // Falha de rede não bloqueia novas verificações pelos próximos 20 min.
      checkedRef.current = Date.now() - RECHECK_MS + RETRY_AFTER_ERROR_MS
      if (mountedRef.current) setState('error')
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const nativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
    setAndroid(nativeAndroid)
    if (nativeAndroid) {
      void App.getInfo().then(info => {
        if (mountedRef.current && info.id === 'com.dflfinance.app') {
          setInstalledBuild(parseInstalledBuild(info.build))
        }
      }).catch(() => { /* Sem versão verificável, não sugerir instalação. */ })
    }
    if (nativeAndroid || includeWeb) void refresh()

    const onResume = () => {
      if ((nativeAndroid || includeWeb) && document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('online', onResume)
    return () => {
      mountedRef.current = false
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('online', onResume)
    }
  }, [includeWeb, refresh])

  return {
    android,
    installedBuild,
    latest,
    state,
    refresh,
    updateAvailable: android === true && hasNewApk(installedBuild, latest),
  }
}
