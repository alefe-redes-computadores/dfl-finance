// src/components/conciliation/ConciActions.tsx
'use client'

import { Check, X, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConciActionsProps {
  onApprove: () => void
  onReject: () => void
  onSkip?: () => void
  disabled?: boolean
  className?: string
}

export function ConciActions({
  onApprove,
  onReject,
  onSkip,
  disabled = false,
  className,
}: ConciActionsProps) {
  return (
    <div className={cn('flex items-center justify-center gap-4 py-4', className)}>
      <button
        onClick={onReject}
        disabled={disabled}
        className={cn(
          'w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500',
          'flex items-center justify-center',
          'hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-90',
          'transition-all duration-200 shadow-md',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <X size={28} />
      </button>

      {onSkip && (
        <button
          onClick={onSkip}
          disabled={disabled}
          className={cn(
            'w-14 h-14 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400',
            'flex items-center justify-center',
            'hover:bg-gray-200 dark:hover:bg-slate-600 active:scale-90',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <RotateCcw size={22} />
        </button>
      )}

      <button
        onClick={onApprove}
        disabled={disabled}
        className={cn(
          'w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500',
          'flex items-center justify-center',
          'hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-90',
          'transition-all duration-200 shadow-md',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <Check size={28} />
      </button>
    </div>
  )
}