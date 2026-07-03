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
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
        <span>
          {current} de {total}
        </span>
        <span>
          ✅ {approved} • ❌ {rejected}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
        <div
          className="h-full bg-teal-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
        <div
          className="absolute inset-0 h-full bg-emerald-500/30 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(donePercent, 100)}%` }}
        />
      </div>
    </div>
  )
}