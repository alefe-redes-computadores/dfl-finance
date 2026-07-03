// src/components/conciliation/ConciSummary.tsx
'use client'

import { Check, X, RotateCcw, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ConciSummaryProps {
  total: number
  approved: number
  rejected: number
  onReset: () => void
  onFinish?: () => void
}

export function ConciSummary({
  total,
  approved,
  rejected,
  onReset,
  onFinish,
}: ConciSummaryProps) {
  const router = useRouter()

  const handleFinish = () => {
    if (onFinish) onFinish()
    router.push('/home')
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-800 rounded-[32px] shadow-lg border border-gray-100 dark:border-slate-700/50 p-8 text-center space-y-6">
      <div className="flex items-center justify-center gap-3">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
          <Check size={32} className="text-emerald-500" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Conciliação concluída! 🎉
      </h2>

      <p className="text-gray-500 dark:text-gray-400 text-sm">
        Você analisou todas as transações da fila.
      </p>

      <div className="grid grid-cols-3 gap-4 py-4">
        <div className="bg-gray-50 dark:bg-slate-700/30 rounded-2xl p-4">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-4">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{approved}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Aprovados ✅</p>
        </div>
        <div className="bg-red-50 dark:bg-red-500/10 rounded-2xl p-4">
          <p className="text-2xl font-bold text-red-500">{rejected}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Descartados ❌</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onReset}
          className={cn(
            'flex-1 py-3 rounded-2xl font-bold',
            'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300',
            'hover:bg-gray-200 dark:hover:bg-slate-600 active:scale-95',
            'transition-all duration-200',
            'flex items-center justify-center gap-2'
          )}
        >
          <RotateCcw size={18} />
          Recomeçar
        </button>
        <button
          onClick={handleFinish}
          className={cn(
            'flex-1 py-3 rounded-2xl font-bold',
            'bg-teal-600 text-white',
            'hover:bg-teal-700 active:scale-95',
            'transition-all duration-200',
            'flex items-center justify-center gap-2'
          )}
        >
          <Home size={18} />
          Ir para Home
        </button>
      </div>
    </div>
  )
}