'use client'

import type { ElementType } from 'react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

interface EmptyStateProps {
  icon: ElementType
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction
}: EmptyStateProps) {
  const { light } = useHapticFeedback()

  const handleAction = () => {
    if (!onAction) return
    light()
    onAction()
  }

  return (
    <div
      className="app-empty-region rounded-[24px] px-4 py-7"
      role="status"
      aria-live="polite"
    >
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[19px] border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <Icon size={24} strokeWidth={1.7} aria-hidden="true" />
      </div>

      <h4 className="mb-1 text-[15px] font-bold text-slate-900 dark:text-white">
        {title}
      </h4>

      <p className="mx-auto max-w-[290px] text-[13px] leading-5 text-slate-500 dark:text-slate-400">
        {message}
      </p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={handleAction}
          className="app-primary-action mt-5 min-h-11 rounded-[16px] px-5 text-[13px] font-bold transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 motion-reduce:transition-none"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
