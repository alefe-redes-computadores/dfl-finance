// src/components/Toast.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastProps {
  message: string
  type: ToastType
  onClose: () => void
}

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const STYLE_MAP = {
  success: { iconColor: 'text-emerald-500', bgLight: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  error: { iconColor: 'text-red-500', bgLight: 'bg-red-500/10', border: 'border-red-500/20' },
  info: { iconColor: 'text-blue-500', bgLight: 'bg-blue-500/10', border: 'border-blue-500/20' },
  warning: { iconColor: 'text-orange-500', bgLight: 'bg-orange-500/10', border: 'border-orange-500/20' },
}

const DURATION_BY_TYPE: Record<ToastType, number> = {
  success: 3200,
  info: 3600,
  warning: 4500,
  error: 5200,
}

export default function Toast({ message, type, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const onCloseRef = useRef(onClose)
  const closingRef = useRef(false)
  const lifetimeTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const remainingRef = useRef(DURATION_BY_TYPE[type])
  const pausedRef = useRef(false)
  const mountedRef = useRef(true)
  const Icon = ICONS[type]
  const styles = STYLE_MAP[type]

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const clearLifetime = () => {
    if (lifetimeTimerRef.current !== null) {
      window.clearTimeout(lifetimeTimerRef.current)
      lifetimeTimerRef.current = null
    }
  }

  const startClose = () => {
    if (closingRef.current || !mountedRef.current) return
    closingRef.current = true
    clearLifetime()
    setIsVisible(false)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      if (mountedRef.current) onCloseRef.current()
    }, 220)
  }

  const resumeLifetime = () => {
    if (closingRef.current || !mountedRef.current || !pausedRef.current) return
    pausedRef.current = false
    startedAtRef.current = Date.now()
    lifetimeTimerRef.current = window.setTimeout(startClose, Math.max(1, remainingRef.current))
  }

  const pauseLifetime = () => {
    if (pausedRef.current || closingRef.current) return
    pausedRef.current = true
    remainingRef.current = Math.max(1, remainingRef.current - (Date.now() - startedAtRef.current))
    clearLifetime()
  }

  useEffect(() => {
    mountedRef.current = true
    closingRef.current = false
    pausedRef.current = false
    remainingRef.current = DURATION_BY_TYPE[type]
    startedAtRef.current = Date.now()
    const enter = requestAnimationFrame(() => setIsVisible(true))
    lifetimeTimerRef.current = window.setTimeout(startClose, remainingRef.current)

    return () => {
      mountedRef.current = false
      cancelAnimationFrame(enter)
      clearLifetime()
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
    // O ciclo do aviso é vinculado à identidade do toast (key no Provider).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, message])

  const urgent = type === 'error' || type === 'warning'

  return (
    <div
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-[22px] border bg-white/95 px-4 py-3.5 shadow-[0_14px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all duration-200 motion-reduce:transition-none dark:bg-slate-800/95 ${styles.border} ${
        isVisible ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-2 scale-[0.98] opacity-0'
      }`}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      aria-atomic="true"
      onPointerEnter={pauseLifetime}
      onPointerLeave={resumeLifetime}
      onFocusCapture={pauseLifetime}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) resumeLifetime()
      }}
    >
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${styles.bgLight}`}>
        <Icon size={18} className={styles.iconColor} />
      </div>

      <p className="min-w-0 flex-1 break-words text-[13px] font-semibold leading-5 text-gray-800 dark:text-gray-100">
        {message}
      </p>

      <button
        type="button"
        onClick={startClose}
        aria-label="Fechar aviso"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors active:scale-[0.95] dark:bg-slate-700 dark:text-gray-400"
      >
        <X size={14} />
      </button>
    </div>
  )
}
