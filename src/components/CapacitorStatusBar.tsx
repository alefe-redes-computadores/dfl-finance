'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/**
 * Contrato Android V14.8
 *
 * No shell nativo o WebView é edge-to-edge e a superfície do topo
 * pertence ao próprio aplicativo.
 *
 * O Finance usa uma superfície escura na região das system bars no
 * shell Android. Portanto os ícones da status bar permanecem claros.
 *
 * Não derivamos mais a aparência dos ícones da classe `dark` do HTML:
 * essa classe representa o tema do conteúdo e pode mudar durante o
 * bootstrap/hidratação, enquanto a system bar é responsabilidade do
 * shell nativo.
 */
export default function CapacitorStatusBar() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const root = document.documentElement
    root.dataset.nativeShell = 'true'

    let disposed = false

    const applyNativeSystemBars = async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: true })

        // Style.Light = ícones/textos claros.
        await StatusBar.setStyle({
          style: Style.Light,
        })
      } catch (error) {
        if (!disposed) {
          console.warn(
            'Não foi possível aplicar as barras de sistema nativas.',
            error
          )
        }
      }
    }

    void applyNativeSystemBars()

    /*
     * Android pode reconstruir/reaplicar atributos da Window quando
     * o app volta do background, abre permissões, auth externa etc.
     * Reafirmamos o contrato quando o documento volta a ficar visível.
     */
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        void applyNativeSystemBars()
      }
    }

    document.addEventListener('visibilitychange', visibilityHandler)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', visibilityHandler)
      delete root.dataset.nativeShell
    }
  }, [])

  return null
}
