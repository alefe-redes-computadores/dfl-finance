'use client'

import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PieChart as PieChartIcon } from 'lucide-react'

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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val)
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const total = (pfData || []).reduce((s, d) => s + d.value, 0) + (pjData || []).reduce((s, d) => s + d.value, 0)
      const percent = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0.0'

      return (
        <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-4 rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-50 dark:border-slate-700/50 flex flex-col gap-1 z-50">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color || COLORS[0] }} />
            <p className="font-bold text-gray-800 dark:text-gray-100 text-[13px] truncate max-w-[150px]">{data.name}</p>
          </div>
          <p className="text-[15px] font-bold text-gray-600 dark:text-gray-300 ml-5">{formatCurrency(data.value)}</p>
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 ml-5">{percent}% do total</p>
        </div>
      )
    }
    return null
  }

  const hasData = (pfData?.length > 0) || (pjData?.length > 0)

  if (!hasData) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 text-center py-10 flex flex-col items-center justify-center transition-colors duration-300">
        <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-3">
          <PieChartIcon size={24} className="text-gray-400 dark:text-gray-500" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Nenhuma distribuição registrada.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 transition-colors duration-300">
      <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100 mb-6">{title}</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* PF */}
        <div className="bg-gray-50/50 dark:bg-slate-700/20 p-4 rounded-[24px]">
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center mb-4">Pessoal (PF)</p>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pfData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={65}
                  paddingAngle={4}
                  stroke="none" // Remove a borda branca ao redor das fatias
                >
                  {pfData.map((entry, index) => (
                    <Cell key={`pf-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PJ */}
        <div className="bg-gray-50/50 dark:bg-slate-700/20 p-4 rounded-[24px]">
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center mb-4">Empresa (PJ)</p>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pjData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={65}
                  paddingAngle={4}
                  stroke="none"
                >
                  {pjData.map((entry, index) => (
                    <Cell key={`pj-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Legenda compacta e moderna */}
      <div className="flex flex-wrap justify-center gap-3 mt-2 px-2">
        {[...(pfData || []), ...(pjData || [])].slice(0, 6).map((item) => (
          <div key={item.name} className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-700/50 px-2.5 py-1 rounded-full border border-gray-100 dark:border-slate-600/50">
            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: item.color || '#64748b' }} />
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 truncate max-w-[80px]">
              {item.name}
            </span>
          </div>
        ))}
        {(pfData?.length || 0) + (pjData?.length || 0) > 6 && (
          <div className="flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold text-gray-400 bg-gray-50 dark:bg-slate-700/50">
            +{(pfData?.length || 0) + (pjData?.length || 0) - 6}
          </div>
        )}
      </div>
    </div>
  )
}

// 🔥 MEMOIZADO: só re-renderiza se as props mudarem
export default React.memo(CategoryPieComponent)
