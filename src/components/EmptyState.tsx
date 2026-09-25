'use client'


import { ElementType } from 'react'

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction
}: EmptyStateProps) {
  return (
    <div className="app-empty-region" role="status" aria-live="polite">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[18px] border border-gray-200/70 bg-white text-gray-400 shadow-sm dark:border-slate-700/70 dark:bg-slate-800 dark:text-gray-500">
        <Icon size={24} strokeWidth={1.6} />
      </div>
      
      <h4 className="mb-1 text-[15px] font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h4>
      
      <p className="mx-auto max-w-[260px] text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
        {message}
      </p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="app-primary-action mt-5 min-h-10 rounded-[16px] px-5 text-[13px]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
