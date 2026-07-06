'use client'

import React from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface ProjectionData {
  name: string
  otimista: number
  realista: number
  pessimista: number
}

interface ProjectionChartProps {
  data: ProjectionData[]
  title?: string
}

function ProjectionChartComponent({ data, title = 'Projeção de Saldo (12 meses)' }: ProjectionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 text-center py-8">
        <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhum dado disponível</p>
      </div>
    )
  }

  const formatCurrency = (val: number) => {
    if (val === Infinity) return '∞'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700">
          <p className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-2">{label}</p>
          <div className="space-y-1 text-xs">
            <p className="text-emerald-600">Otimista: {formatCurrency(payload[0]?.value || 0)}</p>
            <p className="text-blue-600">Realista: {formatCurrency(payload[1]?.value || 0)}</p>
            <p className="text-red-500">Pessimista: {formatCurrency(payload[2]?.value || 0)}</p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
      <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">{title}</h3>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="otimistaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="realistaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pessimistaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
            <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />
            <Area 
              type="monotone" 
              dataKey="otimista" 
              name="Otimista"
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#otimistaGradient)"
            />
            <Area 
              type="monotone" 
              dataKey="realista" 
              name="Realista"
              stroke="#3b82f6" 
              strokeWidth={2}
              fill="url(#realistaGradient)"
            />
            <Area 
              type="monotone" 
              dataKey="pessimista" 
              name="Pessimista"
              stroke="#ef4444" 
              strokeWidth={2}
              fill="url(#pessimistaGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// 🔥 MEMOIZADO: só re-renderiza se as props mudarem
export default React.memo(ProjectionChartComponent)