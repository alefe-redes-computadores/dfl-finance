'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface ComparisonData {
  name: string
  receitasPF: number
  despesasPF: number
  receitasPJ: number
  despesasPJ: number
}

interface ComparisonChartProps {
  data: ComparisonData[]
  title?: string
}

function ComparisonChartComponent({ data, title = 'Comparativo PF vs PJ' }: ComparisonChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 text-center py-8">
        <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhum dado disponível</p>
      </div>
    )
  }

  const formatCurrency = (val: number) => {
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
            <p className="text-emerald-600">Receitas PF: {formatCurrency(payload[0]?.value || 0)}</p>
            <p className="text-red-500">Despesas PF: {formatCurrency(payload[1]?.value || 0)}</p>
            <p className="text-blue-600">Receitas PJ: {formatCurrency(payload[2]?.value || 0)}</p>
            <p className="text-orange-500">Despesas PJ: {formatCurrency(payload[3]?.value || 0)}</p>
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
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="receitasPF" name="Receitas PF" fill="#10b981" radius={[0, 4, 4, 0]} />
            <Bar dataKey="despesasPF" name="Despesas PF" fill="#ef4444" radius={[0, 4, 4, 0]} />
            <Bar dataKey="receitasPJ" name="Receitas PJ" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            <Bar dataKey="despesasPJ" name="Despesas PJ" fill="#f97316" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// 🔥 MEMOIZADO: só re-renderiza se as props mudarem
export default React.memo(ComparisonChartComponent)