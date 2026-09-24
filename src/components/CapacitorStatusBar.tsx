'use client'

import { useEffect } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useTheme } from '@/contexts/ThemeContext'

interface SystemBarsPlugin {
  setTheme(options: { dark: boolean }): Promise<void>
}

const SystemBars = registerPlugin<SystemBarsPlugin>('SystemBars')

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
          // React comunica apenas o tema. Android nativo continua sendo
          // o único responsável pela aparência e geometria da StatusBar.
          await SystemBars.setTheme({ dark: theme === 'dark' })
          return
        }

        await StatusBar.setOverlaysWebView({ overlay: true })
        await StatusBar.setStyle({
          style: theme === 'dark' ? Style.Light : Style.Dark,
        })
      } catch (error) {
        if (!disposed) {
          console.warn('Não foi possível atualizar as barras do sistema.', error)
        }
      }
    }

    void apply()

    return () => {
      disposed = true
      delete root.dataset.nativeShell
    }
  }, [theme])

  return null
}
