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
    // A Web Vibration API não é universal em WebViews Android.
    // Não simular sucesso nem registrar ruído quando o dispositivo não suporta.
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    try {
      const valid = Array.isArray(pattern)
        ? pattern.filter((duration) => Number.isFinite(duration) && duration >= 0).map((duration) => Math.min(duration, 250))
        : Math.min(Math.max(Number.isFinite(pattern) ? pattern : 0, 0), 250)
      navigator.vibrate(valid)
    } catch {
      // Feedback tátil é opcional: nunca interromper uma ação financeira.
    }
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