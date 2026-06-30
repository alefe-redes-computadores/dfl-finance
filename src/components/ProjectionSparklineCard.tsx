'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line } from 'recharts'
import { createClient } from '@/utils/supabase/client'

interface ProjectionData {
  projection_date: string
  projected_balance: number
}

export default function ProjectionSparklineCard() {
  const [data, setData] = useState<ProjectionData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function fetchProjection() {
      try {
        const { data: projection, error } = await supabase
          .from('projected_daily_balance')
          .select('projection_date, projected_balance')
          .order('projection_date', { ascending: true })
          .limit(30)

        if (error) {
          console.error('Erro ao buscar projeção:', error)
          setError(true)
          return
        }

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

  // Valor projetado no 30º dia (ou último disponível)
  const finalBalance = data.length > 0 ? data[data.length - 1].projected_balance : 0
  const isPositive = finalBalance >= 0

  // Cor dinâmica
  const accentColor = isPositive ? '#10b981' : '#ef4444' // emerald-500 : red-500
  const bgAccentLight = isPositive ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-red-50 dark:bg-red-950'
  const textAccent = isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
  const borderAccent = isPositive ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'

  // Formatador de moeda
  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
        <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
        <div className="h-6 w-36 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
        <div className="h-12 w-full bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
    )
  }

  if (error || data.length === 0) {
    return (
      <Link href="/analysis">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow cursor-pointer">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Projeção (30 dias)
          </p>
          <p className="text-lg font-semibold text-slate-400 dark:text-slate-500 mt-1">
            Indisponível
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Clique para tentar novamente
          </p>
        </div>
      </Link>
    )
  }

  return (
    <Link href="/analysis">
      <div
        className={`relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border ${borderAccent} p-4 hover:shadow-md transition-all cursor-pointer active:scale-[0.98]`}
      >
        {/* Fundo com leve degradê */}
        <div className={`absolute inset-0 opacity-5 ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`} />

        <div className="relative z-10">
          {/* Título */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Projeção (30 dias)
            </p>
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
          </div>

          {/* Valor projetado */}
          <p className={`text-xl font-bold ${textAccent}`}>
            {formatBRL(finalBalance)}
          </p>

          {/* Indicador textual */}
          <p className={`text-xs ${textAccent} opacity-80 mt-0.5`}>
            {isPositive ? 'Saldo positivo projetado' : 'Atenção: saldo negativo projetado'}
          </p>

          {/* Sparkline */}
          <div className="mt-3 h-12 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <Line
                  type="monotone"
                  dataKey="projected_balance"
                  stroke={accentColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={true}
                  animationDuration={800}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Link>
  )
}