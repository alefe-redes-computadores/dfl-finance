// src/hooks/useHapticFeedback.ts
'use client'

import { useCallback } from 'react'

type HapticPattern = number | number[]

/**
 * Hook para feedback háptico (vibração)
 * Compatível com navegador e preparado para Capacitor/React Native
 */
export function useHapticFeedback() {
  const vibrate = useCallback((pattern: HapticPattern) => {
    // Verifica se está no navegador e se suporta vibrate
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern)
      return
    }

    // Fallback silencioso para ambientes que não suportam
    // Em produção com Capacitor, você pode adicionar:
    // import { Haptics } from '@capacitor/haptics';
    // Haptics.vibrate({ duration: Array.isArray(pattern) ? pattern[0] : pattern });
    console.debug('[Haptic] Vibração não suportada neste ambiente')
  }, [])

  // Atalhos para padrões comuns
  const light = useCallback(() => vibrate(10), [vibrate])
  const medium = useCallback(() => vibrate(30), [vibrate])
  const heavy = useCallback(() => vibrate(50), [vibrate])
  const success = useCallback(() => vibrate([30, 50, 30]), [vibrate])
  const error = useCallback(() => vibrate([50, 100, 50]), [vibrate])

  return {
    vibrate,
    light,
    medium,
    heavy,
    success,
    error,
  }
}