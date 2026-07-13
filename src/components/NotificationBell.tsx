'use client'

import { Bell } from 'lucide-react'

interface NotificationBellProps {
  count: number
  onClick: () => void
  hasCritical: boolean
}

export default function NotificationBell({ count, onClick, hasCritical }: NotificationBellProps) {
  const safeCount = Number.isFinite(count) ? Math.max(0, count) : 0

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-teal-700 dark:hover:text-teal-400 transition-colors active:scale-[0.95]"
      title={safeCount > 0 ? `${safeCount} notificação(ões)` : 'Sem notificações'}
      aria-label={safeCount > 0 ? `${safeCount} notificações` : 'Sem notificações'}
      type="button"
    >
      <Bell size={20} />
      {safeCount > 0 && (
        <span
          className={`absolute -top-0.5 -right-0.5 min-w-[20px] h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow-sm px-1 ${
            hasCritical ? 'bg-red-500' : 'bg-orange-500'
          }`}
        >
          {safeCount > 99 ? '99+' : safeCount}
        </span>
      )}
    </button>
  )
}