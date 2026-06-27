'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'

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

// Estilos Premium (Glassmorphism + Cores Vibrantes no Ícone)
const STYLE_MAP = {
  success: {
    iconColor: 'text-emerald-500',
    bgLight: 'bg-emerald-500/10',
    border: 'border-emerald-500/20'
  },
  error: {
    iconColor: 'text-red-500',
    bgLight: 'bg-red-500/10',
    border: 'border-red-500/20'
  },
  info: {
    iconColor: 'text-blue-500',
    bgLight: 'bg-blue-500/10',
    border: 'border-blue-500/20'
  },
  warning: {
    iconColor: 'text-orange-500',
    bgLight: 'bg-orange-500/10',
    border: 'border-orange-500/20'
  },
}

export default function Toast({ message, type, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const Icon = ICONS[type]
  const styles = STYLE_MAP[type]

  useEffect(() => {
    // Animação de entrada
    requestAnimationFrame(() => setIsVisible(true))
    
    // Auto-close após 3 segundos
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 400) // Espera a animação de saída terminar
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 min-w-[280px] max-w-sm mx-auto rounded-full shadow-2xl backdrop-blur-md border transition-all duration-400 ease-out bg-white/90 dark:bg-slate-800/90 dark:border-slate-700/50 ${
        isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-[-20px] opacity-0 scale-95'
      }`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${styles.bgLight}`}>
        <Icon size={18} className={styles.iconColor} />
      </div>
      
      <p className="flex-1 text-[14px] font-bold text-gray-800 dark:text-gray-100 tracking-tight truncate">
        {message}
      </p>
      
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(onClose, 400)
        }}
        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-full transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}
