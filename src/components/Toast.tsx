'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastProps {
  message: string
  type: ToastType
  onClose: () => void
}

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const COLORS = {
  success: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
  error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
  info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
  warning: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
}

const ICON_COLORS = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
  warning: 'text-orange-600 dark:text-orange-400',
}

const TEXT_COLORS = {
  success: 'text-emerald-800 dark:text-emerald-200',
  error: 'text-red-800 dark:text-red-200',
  info: 'text-blue-800 dark:text-blue-200',
  warning: 'text-orange-800 dark:text-orange-200',
}

export default function Toast({ message, type, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const Icon = ICONS[type]

  useEffect(() => {
    // Animação de entrada
    requestAnimationFrame(() => setIsVisible(true))
    
    // Auto-close após 3 segundos
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // espera animação de saída
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg transition-all duration-300 ${
        COLORS[type]
      } ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <Icon size={20} className={ICON_COLORS[type]} />
      <p className={`flex-1 text-sm font-bold ${TEXT_COLORS[type]}`}>
        {message}
      </p>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(onClose, 300)
        }}
        className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
      >
        <X size={16} className={ICON_COLORS[type]} />
      </button>
    </div>
  )
}