'use client'
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useTheme } from '@/contexts/ThemeContext'

export default function CapacitorStatusBar() {
  const { theme } = useTheme()
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const root = document.documentElement
    root.dataset.nativeShell = 'true'
    const platform = Capacitor.getPlatform()
    let disposed = false
    const apply = async () => {
      try {
        if (platform === 'android') {
          await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light })
          return
        }
        await StatusBar.setOverlaysWebView({ overlay: true })
        await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light })
      } catch (error) {
        if (!disposed) console.warn('Não foi possível atualizar as barras do sistema.', error)
      }
    }
    void apply()
    return () => { disposed = true; delete root.dataset.nativeShell }
  }, [theme])
  return null
}
