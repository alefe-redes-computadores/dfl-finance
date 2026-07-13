'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line } from 'recharts'

interface ProjectionData {
  projection_date: string
  projected_balance: number
}

interface ProjectionSparklineCardProps {
  data?: ProjectionData[]
  href?: string
}

export default function ProjectionSparklineCard({
  data: externalData,
  href = '/analysis',
}: ProjectionSparklineCardProps) {
  const [data, setData] = useState<ProjectionData[]>(externalData ?? [])
  const [loading, setLoading] = useState(!externalData)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (externalData) {
      setData(externalData)
      setLoading(false)
      setError(false)
      return
    }

    let cancelled = false

    async function fetchProjection() {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseAnonKey) {
          if (!cancelled) setError(true)
          return
        }

        const response = await fetch(
          `${supabaseUrl}/rest/v1/projected_daily_balance?select=projection_date,projected_balance&order=projection_date.asc&limit=30`,
          {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          if (!cancelled) setError(true)
          return
        }

        const projection = await response.json()
        if (!cancelled) setData(Array.isArray(projection) ? projection : [])
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchProjection()

    return () => {
      cancelled = true
    }
  }, [externalData])

  const finalBalance = useMemo(
    () => (data.length > 0 ? Number(data[data.length - 1]?.projected_balance || 0) : 0),
    [data]
  )

  const isPositive = finalBalance >= 0
  const accentColor = isPositive ? '#10b981' : '#ef4444'
  const bgAccent = isPositive ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-red-50 dark:bg-red-900/10'
  const borderAccent = isPositive
    ? 'border-emerald-100 dark:border-emerald-900/30'
    : 'border-red-100 dark:border-red-900/30'
  const textAccent = isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'

  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-sm border border-gray-50 dark:border-slate-700/50 p-5 animate-pulse">
        <div className="h-3 w-28 bg-gray-200 dark:bg-slate-700 rounded mb-3" />
        <div className="h-8 w-36 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
        <div className="h-12 w-full bg-gray-100 dark:bg-slate-700/50 rounded-xl" />
      </div>
    )
  }

  if (error || data.length === 0) {
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
                isPositive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'
              }`}
            >
              {isPositive ? (
                <TrendingUp className={`w-3.5 h-3.5 ${textAccent}`} />
              ) : (
                <TrendingDown className={`w-3.5 h-3.5 ${textAccent}`} />
              )}
            </div>
          </div>

          <p className={`text-[26px] font-black tracking-tight ${textAccent} leading-none`}>
            {formatBRL(finalBalance)}
          </p>

          <p className={`text-[11px] font-bold ${textAccent} opacity-70 mt-1.5`}>
            {isPositive ? 'Saldo positivo no período' : 'Atenção: déficit projetado'}
          </p>

          <div className="mt-4 h-14 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <Line
                  type="monotone"
                  dataKey="projected_balance"
                  stroke={accentColor}
                  strokeWidth={3}
                  dot={false}
                  activeDot={false}
                  isAnimationActive
                  animationDuration={1000}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Link>
  )
}