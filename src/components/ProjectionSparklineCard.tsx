// src/components/ProjectionSparklineCard.tsx
'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'

interface ProjectionData {
  projection_date: string
  projected_balance: number
}

interface ProjectionSparklineCardProps {
  data?: ProjectionData[]
  href?: string
}

export default function ProjectionSparklineCard({
  data = [],
  href = '/analysis',
}: ProjectionSparklineCardProps) {
  const safeData = useMemo(
    () =>
      data.filter(
        (item) =>
          item?.projection_date &&
          Number.isFinite(
            Number(item.projected_balance)
          )
      ),
    [data]
  )

  const finalBalance = useMemo(
    () =>
      safeData.length > 0
        ? Number(
            safeData[safeData.length - 1]
              ?.projected_balance || 0
          )
        : 0,
    [safeData]
  )

  const initialBalance =
    safeData.length > 0
      ? Number(
          safeData[0]?.projected_balance || 0
        )
      : 0

  const isPositiveTrend =
    finalBalance >= initialBalance

  const accentColor = isPositiveTrend
    ? '#10b981'
    : '#ef4444'

  const bgAccent = isPositiveTrend
    ? 'bg-emerald-50 dark:bg-emerald-900/10'
    : 'bg-red-50 dark:bg-red-900/10'

  const borderAccent = isPositiveTrend
    ? 'border-emerald-100 dark:border-emerald-900/30'
    : 'border-red-100 dark:border-red-900/30'

  const textAccent = isPositiveTrend
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400'

  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)

  if (safeData.length === 0) {
    return (
      <Link href={href}>
        <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-sm border border-gray-50 dark:border-slate-700/50 p-5 cursor-pointer active:scale-[0.98] transition-transform">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Projeção (30 dias)
          </p>
          <p className="text-[20px] font-black text-gray-400 dark:text-gray-500 mt-1">
            Indisponível
          </p>
          <p className="text-[12px] font-medium text-gray-400 mt-2">
            Toque para abrir análise
          </p>
        </div>
      </Link>
    )
  }

  return (
    <Link href={href}>
      <div
        className={`relative overflow-hidden ${bgAccent} rounded-[28px] shadow-sm border ${borderAccent} p-5 cursor-pointer active:scale-[0.98] transition-transform`}
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              Projeção (30 dias)
            </p>

            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                isPositiveTrend
                  ? 'bg-emerald-100 dark:bg-emerald-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}
            >
              {isPositiveTrend ? (
                <TrendingUp
                  className={`w-3.5 h-3.5 ${textAccent}`}
                />
              ) : (
                <TrendingDown
                  className={`w-3.5 h-3.5 ${textAccent}`}
                />
              )}
            </div>
          </div>

          <p
            className={`text-[26px] font-black tracking-tight ${textAccent} leading-none`}
          >
            {formatBRL(finalBalance)}
          </p>

          <p
            className={`text-[11px] font-bold ${textAccent} opacity-70 mt-1.5`}
          >
            {isPositiveTrend
              ? 'Tendência positiva no período'
              : 'Atenção à tendência projetada'}
          </p>

          <div className="mt-4 h-14 w-full">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart data={safeData}>
                <Line
                  type="monotone"
                  dataKey="projected_balance"
                  stroke={accentColor}
                  strokeWidth={3}
                  dot={false}
                  activeDot={false}
                  isAnimationActive
                  animationDuration={700}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Link>
  )
}
