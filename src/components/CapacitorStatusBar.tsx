// src/components/CapacitorStatusBar.tsx
'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

const LIGHT_BACKGROUND = '#f8f9fa'
const DARK_BACKGROUND = '#0f172a'

export default function CapacitorStatusBar() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let disposed = false

    const applyStatusBar = async () => {
      const isDark = document.documentElement.classList.contains('dark')

      try {
        await StatusBar.setOverlaysWebView({ overlay: false })

        await StatusBar.setBackgroundColor({
          color: isDark ? DARK_BACKGROUND : LIGHT_BACKGROUND,
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
    }
  }, [])

  return null
}
