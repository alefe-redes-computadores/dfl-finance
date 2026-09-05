// src/components/DetailedProjectionChart.tsx
'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface ProjectionData {
  projection_date: string
  projected_balance: number
}

interface DetailedProjectionChartProps {
  data?: ProjectionData[]
  title?: string
  subtitle?: string
}

const formatCurrencyTooltip = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

const formatCurrencyAxis = (value: number) => {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}k`
  }

  return value.toString()
}

const formatDate = (dateStr: string) => {
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}

export default function DetailedProjectionChart({
  data = [],
  title = 'Projeção de Saldo (30 dias)',
  subtitle = 'Estimativa baseada na média financeira recente. Não representa garantia de saldo futuro.',
}: DetailedProjectionChartProps) {
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

  const isPositiveTrend =
    safeData.length > 0 &&
    Number(
      safeData[safeData.length - 1]
        .projected_balance
    ) >=
      Number(safeData[0].projected_balance)

  if (safeData.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          Ainda não há dados suficientes para projetar o saldo.
        </p>
      </div>
    )
  }

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: any) => {
    if (!active || !payload?.length) return null

    const value = Number(
      payload[0]?.value || 0
    )

    const [year, month, day] =
      String(label).split('-')

    const dateLabel =
      year && month && day
        ? `${day}/${month}/${year}`
        : String(label)

    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
          {dateLabel}
        </p>
        <p
          className={`text-lg font-bold ${
            value >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {formatCurrencyTooltip(value)}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        </div>

        <div
          className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
            isPositiveTrend
              ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
          }`}
        >
          {isPositiveTrend
            ? 'Tendência positiva'
            : 'Tendência negativa'}
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={safeData}
            margin={{
              top: 5,
              right: 5,
              left: 5,
              bottom: 5,
            }}
          >
            <defs>
              <linearGradient
                id="projectionGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={
                    isPositiveTrend
                      ? '#10b981'
                      : '#ef4444'
                  }
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor={
                    isPositiveTrend
                      ? '#10b981'
                      : '#ef4444'
                  }
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
              className="dark:opacity-10"
            />

            <XAxis
              dataKey="projection_date"
              tickFormatter={formatDate}
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 12,
                fill: '#94a3b8',
              }}
              interval="preserveStartEnd"
            />

            <YAxis
              tickFormatter={formatCurrencyAxis}
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 12,
                fill: '#94a3b8',
              }}
              width={45}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="projected_balance"
              stroke={
                isPositiveTrend
                  ? '#10b981'
                  : '#ef4444'
              }
              strokeWidth={2}
              fill="url(#projectionGradient)"
              activeDot={{
                r: 5,
                fill: '#fff',
                stroke: isPositiveTrend
                  ? '#10b981'
                  : '#ef4444',
                strokeWidth: 2,
              }}
              isAnimationActive
              animationDuration={700}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
