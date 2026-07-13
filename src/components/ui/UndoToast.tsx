'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

interface UndoToastProps {
  message: string
  onUndo: () => void
  onDismiss?: () => void
  duration?: number // em milissegundos
}

export function UndoToast({ message, onUndo, onDismiss, duration = 3000 }: UndoToastProps) {
  const [progress, setProgress] = useState(100)
  const { vibrate } = useHapticFeedback()

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        onDismiss?.()
      }
    }, 50)

    return () => clearInterval(interval)
  }, [duration, onDismiss])

  const handleUndo = () => {
    vibrate([10])
    onUndo()
    onDismiss?.()
  }

  const handleDismiss = () => {
    vibrate([5])
    onDismiss?.()
  }

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[999] w-[90%] max-w-sm bg-gray-900/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.2)] border border-white/10 dark:border-slate-700 overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="p-4 flex items-center justify-between gap-3">
        <span className="text-[13px] font-bold text-white flex-1 leading-snug">
          {message}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleUndo}
            className="text-[13px] font-black text-teal-400 hover:text-teal-300 active:scale-95 transition-transform uppercase tracking-wide"
          >
            Desfazer
          </button>
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white p-1.5 rounded-full active:scale-90 transition-transform bg-white/5 hover:bg-white/10"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="h-1.5 bg-white/10 dark:bg-slate-900/50">
        <div
          className="h-full bg-teal-500 transition-all duration-50 ease-linear rounded-r-full shadow-[0_0_8px_rgba(20,184,166,0.8)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
