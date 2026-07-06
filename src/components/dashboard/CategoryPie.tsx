'use client'

import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface CategoryData {
  name: string
  value: number
  color: string
}

interface CategoryPieProps {
  pfData: CategoryData[]
  pjData: CategoryData[]
  title?: string
}

const COLORS = ['#14b8a6', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#10b981', '#6366f1']

function CategoryPieComponent({ pfData, pjData, title = 'Distribuição de Gastos' }: CategoryPieProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700">
          <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{data.name}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{formatCurrency(data.value)}</p>
          <p className="text-xs text-gray-400">{((data.value / (pfData.reduce((s, d) => s + d.value, 0) + pjData.reduce((s, d) => s + d.value, 0))) * 100).toFixed(1)}%</p>
        </div>
      )
    }
    return null
  }

  const hasData = (pfData?.length > 0) || (pjData?.length > 0)

  if (!hasData) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 text-center py-8">
        <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhum dado disponível</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
      <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">{title}</h3>
      
      <div className="grid grid-cols-2 gap-4">
        {/* PF */}
        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center mb-2">PF</p>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pfData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={55}
                  paddingAngle={2}
                >
                  {pfData.map((entry, index) => (
                    <Cell key={`pf-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PJ */}
        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center mb-2">PJ</p>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pjData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={55}
                  paddingAngle={2}
                >
                  {pjData.map((entry, index) => (
                    <Cell key={`pj-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Legenda compacta */}
      <div className="flex flex-wrap justify-center gap-2 mt-3">
        {[...(pfData || []), ...(pjData || [])].slice(0, 6).map((item) => (
          <span key={item.name} className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-600 dark:text-gray-400">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || '#64748b' }} />
            {item.name}
          </span>
        ))}
        {(pfData?.length || 0) + (pjData?.length || 0) > 6 && (
          <span className="text-[10px] font-medium text-gray-400">+{(pfData?.length || 0) + (pjData?.length || 0) - 6}</span>
        )}
      </div>
    </div>
  )
}

// 🔥 MEMOIZADO: só re-renderiza se as props mudarem
export default React.memo(CategoryPieComponent)