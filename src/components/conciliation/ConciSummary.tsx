// src/components/conciliation/ConciSummary.tsx
'use client'

import { Check, X, RotateCcw, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

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
  const { vibrate, success } = useHapticFeedback()

  const handleFinish = () => {
    success()
    if (onFinish) onFinish()
    router.push('/home')
  }

  const handleReset = () => {
    vibrate([10])
    onReset()
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-800 rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-50 dark:border-slate-700/50 p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
      <div className="flex items-center justify-center gap-3">
        <div className="w-20 h-20 rounded-[24px] bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shadow-sm">
          <Check size={40} className="text-emerald-500" />
        </div>
      </div>

      <div>
        <h2 className="text-[22px] font-black text-gray-900 dark:text-white tracking-tight mb-1">
          Conciliação concluída! 🎉
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-[14px] font-medium">
          Você analisou todas as transações da fila.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 py-2">
        <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4 flex flex-col items-center justify-center transition-transform hover:scale-105">
          <p className="text-[24px] font-black text-gray-900 dark:text-white">{total}</p>
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1">Total</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-[20px] p-4 flex flex-col items-center justify-center transition-transform hover:scale-105">
          <p className="text-[24px] font-black text-emerald-600 dark:text-emerald-400">{approved}</p>
          <p className="text-[11px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest mt-1">Aprovados</p>
        </div>
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-[20px] p-4 flex flex-col items-center justify-center transition-transform hover:scale-105">
          <p className="text-[24px] font-black text-red-500">{rejected}</p>
          <p className="text-[11px] font-bold text-red-500/70 dark:text-red-400/70 uppercase tracking-widest mt-1">Descartados</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-2">
        <button
          onClick={handleReset}
          className={cn(
            'flex-1 py-4 rounded-[24px] font-bold text-[15px]',
            'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300',
            'hover:bg-gray-100 dark:hover:bg-slate-600 active:scale-[0.98]',
            'transition-all duration-200 border border-gray-100 dark:border-slate-600',
            'flex items-center justify-center gap-2'
          )}
        >
          <RotateCcw size={18} />
          Recomeçar
        </button>
        <button
          onClick={handleFinish}
          className={cn(
            'flex-1 py-4 rounded-[24px] font-bold text-[15px] shadow-lg shadow-teal-600/20',
            'bg-teal-600 text-white',
            'hover:bg-teal-700 active:scale-[0.98]',
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
