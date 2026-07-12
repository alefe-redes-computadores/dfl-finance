// src/components/conciliation/ConciActions.tsx
'use client'

import { Check, X, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

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
  const { vibrate, success, error } = useHapticFeedback()

  return (
    <div className={cn('flex items-center justify-center gap-4 py-4', className)}>
      <button
        onClick={() => {
          if (!disabled) {
            error()
            onReject()
          }
        }}
        disabled={disabled}
        className={cn(
          'w-16 h-16 rounded-[24px] bg-red-50 dark:bg-red-500/10 text-red-500',
          'flex items-center justify-center',
          'hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-[0.90]',
          'transition-all duration-200 shadow-sm border border-red-100 dark:border-red-500/20',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <X size={28} />
      </button>

      {onSkip && (
        <button
          onClick={() => {
            if (!disabled) {
              vibrate([10])
              onSkip()
            }
          }}
          disabled={disabled}
          className={cn(
            'w-14 h-14 rounded-[20px] bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400',
            'flex items-center justify-center',
            'hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-[0.90]',
            'transition-all duration-200 border border-gray-100 dark:border-slate-700/50',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <RotateCcw size={22} />
        </button>
      )}

      <button
        onClick={() => {
          if (!disabled) {
            success()
            onApprove()
          }
        }}
        disabled={disabled}
        className={cn(
          'w-16 h-16 rounded-[24px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500',
          'flex items-center justify-center',
          'hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-[0.90]',
          'transition-all duration-200 shadow-sm border border-emerald-100 dark:border-emerald-500/20',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <Check size={28} />
      </button>
    </div>
  )
}
