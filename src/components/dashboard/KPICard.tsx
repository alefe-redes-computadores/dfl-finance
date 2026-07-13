'use client'

import React from 'react'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  Flame,
  Gauge,
  Percent,
  DollarSign,
} from 'lucide-react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

interface KPICardProps {
  title: string
  value: number
  icon: 'trending-up' | 'trending-down' | 'wallet' | 'clock' | 'fire' | 'gauge' | 'percent' | 'dollar'
  subtitle?: string
  suffix?: string
  prefix?: string
  color?: 'emerald' | 'red' | 'blue' | 'purple' | 'orange' | 'teal'
  formatter?: (val: number) => string
}

const iconMap = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  wallet: Wallet,
  clock: Clock,
  fire: Flame,
  gauge: Gauge,
  percent: Percent,
  dollar: DollarSign,
}

const colorMap = {
  emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  red: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  teal: 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
}

function KPICardComponent({
  title,
  value,
  icon,
  subtitle,
  suffix = '',
  prefix = '',
  color = 'teal',
  formatter,
}: KPICardProps) {
  const { vibrate } = useHapticFeedback()
  const Icon = iconMap[icon] || Wallet
  const colorClass = colorMap[color] || colorMap.teal

  const safeValue = Number.isFinite(value) ? value : 0

  const formatValue = (val: number) => {
    if (formatter) return formatter(val)
    if (Number.isInteger(val)) return val.toLocaleString('pt-BR')
    return val.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <button
      type="button"
      className="w-full text-left bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700/50 transition-all hover:shadow-md active:scale-[0.98]"
      onClick={() => vibrate([5])}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {title}
        </p>
        <div className={`w-8 h-8 rounded-[12px] flex items-center justify-center ${colorClass}`}>
          <Icon size={16} />
        </div>
      </div>

      <p className="text-[22px] font-black text-gray-800 dark:text-gray-100 tracking-tight">
        {prefix}{formatValue(safeValue)}{suffix}
      </p>

      {subtitle && (
        <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-1">
          {subtitle}
        </p>
      )}
    </button>
  )
}

export default React.memo(KPICardComponent)