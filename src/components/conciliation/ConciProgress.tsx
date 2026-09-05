// src/components/conciliation/ConciProgress.tsx
'use client'

import { cn } from '@/lib/utils'

interface ConciProgressProps {
  current: number
  total: number
  approved?: number
  rejected?: number
  className?: string
}

export function ConciProgress({
  current,
  total,
  approved = 0,
  rejected = 0,
  className,
}: ConciProgressProps) {
  const progress = total > 0 ? (current / total) * 100 : 0
  const done = approved + rejected
  const donePercent = total > 0 ? (done / total) * 100 : 0

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-end mb-2 px-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">Progresso</span>
          <span className="text-[14px] font-black text-gray-800 dark:text-gray-100 leading-none">
            {current} <span className="text-gray-400 text-[12px] font-bold">de {total}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-500/20">
            {approved} conciliadas
          </span>
          <span className="bg-red-50 dark:bg-red-500/10 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-100 dark:border-red-500/20">
            {rejected} adiadas
          </span>
        </div>
      </div>
      
      <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-700/50 rounded-full overflow-hidden relative shadow-inner border border-gray-50 dark:border-slate-700/30">
        {/* Barra de analisados totais (fundo levemente visível) */}
        <div
          className="absolute inset-0 h-full bg-teal-500/20 dark:bg-teal-500/30 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(donePercent, 100)}%` }}
        />
        {/* Barra de progresso atual (preenchimento forte) */}
        <div
          className="absolute inset-0 h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(13,148,136,0.5)]"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  )
}
