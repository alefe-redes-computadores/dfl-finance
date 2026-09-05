'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { BarChart2 } from 'lucide-react'

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
      <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 text-center py-10 flex flex-col items-center justify-center transition-colors duration-300">
        <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-3">
          <BarChart2 size={24} className="text-gray-400 dark:text-gray-500" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Nenhum dado disponível para este período.</p>
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
    if (!active || !payload?.length) return null

    const values = Object.fromEntries(
      payload.map((item: any) => [
        item.dataKey,
        Number(item.value) || 0,
      ])
    )

    return (
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-4 rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-50 dark:border-slate-700/50 z-50">
        <p className="font-bold text-gray-800 dark:text-gray-100 text-[13px] uppercase tracking-wider mb-3 pb-2 border-b border-gray-100 dark:border-slate-700">
          {label}
        </p>
        <div className="space-y-2 text-[13px] font-medium">
          <p className="flex justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">Receitas PF</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              {formatCurrency(values.receitasPF || 0)}
            </span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">Despesas PF</span>
            <span className="text-red-500 dark:text-red-400 font-bold">
              {formatCurrency(values.despesasPF || 0)}
            </span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">Receitas PJ</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">
              {formatCurrency(values.receitasPJ || 0)}
            </span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">Despesas PJ</span>
            <span className="text-orange-500 dark:text-orange-400 font-bold">
              {formatCurrency(values.despesasPJ || 0)}
            </span>
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
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} horizontal={true} vertical={true} />
            <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }} axisLine={false} tickLine={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 'bold' }} width={70} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
            <Legend 
              wrapperStyle={{ fontSize: 11, paddingTop: 12, fontWeight: 500 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="receitasPF" name="Receitas PF" fill="#10b981" radius={[0, 6, 6, 0]} barSize={8} />
            <Bar dataKey="despesasPF" name="Despesas PF" fill="#ef4444" radius={[0, 6, 6, 0]} barSize={8} />
            <Bar dataKey="receitasPJ" name="Receitas PJ" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={8} />
            <Bar dataKey="despesasPJ" name="Despesas PJ" fill="#f97316" radius={[0, 6, 6, 0]} barSize={8} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// MEMOIZADO: só re-renderiza se as props mudarem
export default React.memo(ComparisonChartComponent)
