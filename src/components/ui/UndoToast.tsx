'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface UndoToastProps {
  message: string
  onUndo: () => void
  onDismiss?: () => void
  duration?: number // em milissegundos
}

export function UndoToast({ message, onUndo, onDismiss, duration = 3000 }: UndoToastProps) {
  const [progress, setProgress] = useState(100)

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
    onUndo()
    onDismiss?.()
  }

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-in slide-in-from-top-4 duration-300">
      <div className="p-4 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">
          {message}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline"
          >
            Desfazer
          </button>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="h-1 bg-gray-100 dark:bg-slate-700">
        <div
          className="h-full bg-teal-500 transition-all duration-50 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}