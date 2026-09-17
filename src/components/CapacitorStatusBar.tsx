'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/**
 * DFL Finance — System Bars V15
 *
 * Contrato transplantado do Vault validado em Android/Samsung:
 *
 * Android:
 * - MainActivity é a autoridade única da StatusBar;
 * - React NÃO chama StatusBar.setStyle();
 * - React NÃO chama StatusBar.setOverlaysWebView();
 *
 * iOS:
 * - preserva o controle pelo plugin @capacitor/status-bar.
 *
 * O atributo data-native-shell não controla a StatusBar.
 * Ele identifica apenas o shell nativo para o contrato CSS/safe-area.
 */
export default function CapacitorStatusBar() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const root = document.documentElement
    root.dataset.nativeShell = 'true'

    const platform = Capacitor.getPlatform()

    if (platform === 'android') {
      return () => {
        delete root.dataset.nativeShell
      }
    }

    let disposed = false

    const applyIOSSystemBars = async () => {
      try {
        await StatusBar.setOverlaysWebView({
          overlay: true,
        })

        await StatusBar.setStyle({
          style: Style.Light,
        })
      } catch (error) {
        if (!disposed) {
          console.warn(
            'Não foi possível aplicar as barras de sistema no iOS.',
            error
          )
        }
      }
    }

    void applyIOSSystemBars()

    return () => {
      disposed = true
      delete root.dataset.nativeShell
    }
  }, [])

  return null
}
