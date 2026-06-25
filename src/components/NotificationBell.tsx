'use client'

import { Bell } from 'lucide-react'

interface NotificationBellProps {
  count: number
  onClick: () => void
  hasCritical: boolean
}

export default function NotificationBell({ count, onClick, hasCritical }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
    >
      <Bell size={20} />
      {count > 0 && (
        <span
          className={`absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow-sm ${
            hasCritical ? 'bg-red-500' : 'bg-orange-500'
          }`}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}
