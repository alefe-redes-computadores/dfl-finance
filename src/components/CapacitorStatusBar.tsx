// src/components/CapacitorStatusBar.tsx
'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export default function CapacitorStatusBar() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const root = document.documentElement
    root.dataset.nativeShell = 'true'

    let disposed = false

    const applyStatusBar = async () => {
      const isDark = document.documentElement.classList.contains('dark')

      try {
        /*
         * Edge-to-edge real:
         * a WebView continua atrás da status bar. A cor nativa é mantida
         * sincronizada com a superfície raiz para evitar flash/faixa do
         * Window enquanto o Android compõe os system bars.
         */
        await StatusBar.setOverlaysWebView({ overlay: true })

        await StatusBar.setBackgroundColor({
          color: isDark ? '#0f172a' : '#f8f9fa',
        })

        await StatusBar.setStyle({
          style: isDark ? Style.Light : Style.Dark,
        })
      } catch (error) {
        if (!disposed) {
          console.warn(
            'Não foi possível atualizar a barra de status nativa.',
            error
          )
        }
      }
    }

    void applyStatusBar()

    const observer = new MutationObserver(() => {
      void applyStatusBar()
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => {
      disposed = true
      observer.disconnect()
      delete root.dataset.nativeShell
    }
  }, [])

  return null
}
