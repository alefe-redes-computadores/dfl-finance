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
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-gray-200/70 bg-white text-gray-400 shadow-sm dark:border-slate-700/70 dark:bg-slate-800 dark:text-gray-500">
        <Icon size={28} strokeWidth={1.5} />
      </div>
      
      <h4 className="mb-1.5 text-[15px] font-bold text-gray-900 dark:text-gray-100">
        {title}
      </h4>
      
      <p className="mx-auto max-w-[260px] text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
        {message}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="app-primary-action mt-5 min-h-10 rounded-[16px] px-5 text-[13px]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
