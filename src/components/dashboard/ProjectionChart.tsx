'use client'

import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  type TooltipProps,
} from 'recharts'
import { TrendingUp } from 'lucide-react'

interface ProjectionData {
  name: string
  otimista: number
  realista: number
  pessimista: number
}

interface ProjectionChartProps {
  data?: ProjectionData[]
  title?: string
}

function formatCurrency(val: number) {
  if (!Number.isFinite(val)) return '—'

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val)
}

function ProjectionChartComponent({
  data = [],
  title = 'Projeção de Saldo (12 meses)',
}: ProjectionChartProps) {
  const safeData = useMemo(
    () => data.filter((item) => item && typeof item.name === 'string'),
    [data]
  )

  if (safeData.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 text-center py-10 transition-colors duration-300">
        <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
          <TrendingUp size={24} className="text-gray-400" />
        </div>
        <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">
          Nenhum dado de projeção disponível
        </p>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null

    const byKey = Object.fromEntries(
      payload.map((item) => [item.dataKey, item.value])
    )

    return (
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-4 rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 dark:border-slate-700/50 z-50">
        <p className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-3 border-b pb-2">
          {label}
        </p>
        <div className="space-y-2 text-[13px] font-medium">
          <p className="text-emerald-600 dark:text-emerald-400 flex justify-between gap-6">
            Otimista:
            <span className="font-bold">{formatCurrency(Number(byKey.otimista ?? 0))}</span>
          </p>
          <p className="text-blue-600 dark:text-blue-400 flex justify-between gap-6">
            Realista:
            <span className="font-bold">{formatCurrency(Number(byKey.realista ?? 0))}</span>
          </p>
          <p className="text-red-500 dark:text-red-400 flex justify-between gap-6">
            Pessimista:
            <span className="font-bold">{formatCurrency(Number(byKey.pessimista ?? 0))}</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 transition-colors duration-300">
      <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100 mb-6">{title}</h3>

      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={safeData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="otimistaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="realistaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pessimistaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => formatCurrency(Number(v))}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10, fontWeight: 600 }} iconType="circle" iconSize={8} />
            <Area type="monotone" dataKey="otimista" name="Otimista" stroke="#10b981" strokeWidth={2.5} fill="url(#otimistaGradient)" />
            <Area type="monotone" dataKey="realista" name="Realista" stroke="#3b82f6" strokeWidth={2.5} fill="url(#realistaGradient)" />
            <Area type="monotone" dataKey="pessimista" name="Pessimista" stroke="#ef4444" strokeWidth={2.5} fill="url(#pessimistaGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default React.memo(ProjectionChartComponent)