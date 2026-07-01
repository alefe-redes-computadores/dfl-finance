'use client'

import { useEffect, useState } from 'react'
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

export default function DetailedProjectionChart() {
  const [data, setData] = useState<ProjectionData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchProjection() {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseAnonKey) {
          setError(true)
          setLoading(false)
          return
        }

        const response = await fetch(
          `${supabaseUrl}/rest/v1/projected_daily_balance?select=projection_date,projected_balance&order=projection_date.asc&limit=30`,
          {
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          console.error('Erro ao buscar projeção:', response.status)
          setError(true)
          return
        }

        const projection = await response.json()
        setData(projection || [])
      } catch (err) {
        console.error('Erro:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchProjection()
  }, [])

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}`
  }

  const formatCurrencyTooltip = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const formatCurrencyAxis = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(0)}k`
    }
    return value.toString()
  }

  const isPositiveTrend = data.length > 0 && data[data.length - 1].projected_balance >= 0

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
        <div className="h-64 w-full bg-slate-200 dark:bg-slate-700 rounded-lg" />
      </div>
    )
  }

  if (error || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-center">
        <p className="text-slate-500 dark:text-slate-400">Não foi possível carregar a projeção de saldo.</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
          Verifique se a view <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">projected_daily_balance</code> existe no banco.
        </p>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value
      const isPositive = value >= 0
      return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {new Date(label + 'T00:00:00').toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <p
            className={`text-lg font-bold ${
              isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatCurrencyTooltip(value)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Projeção de Saldo (30 dias)
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Saldo estimado dia a dia com base em transações futuras, faturas e assinaturas
          </p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            isPositiveTrend
              ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
          }`}
        >
          {isPositiveTrend ? 'Tendência Positiva' : 'Tendência Negativa'}
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="projectionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isPositiveTrend ? '#10b981' : '#ef4444'}
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor={isPositiveTrend ? '#10b981' : '#ef4444'}
                  stopOpacity={0.0}
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
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              interval="preserveStartEnd"
            />

            <YAxis
              tickFormatter={formatCurrencyAxis}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              width={45}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="projected_balance"
              stroke={isPositiveTrend ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              fill="url(#projectionGradient)"
              activeDot={{
                r: 5,
                fill: '#fff',
                stroke: isPositiveTrend ? '#10b981' : '#ef4444',
                strokeWidth: 2,
              }}
              isAnimationActive={true}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-emerald-500 rounded-full" />
          <span>Projeção</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
          <span>Dados diários</span>
        </div>
      </div>
    </div>
  )
}