'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useContext_ } from '@/components/ContextToggle'

export interface ReportFilterValues {
  context: 'dfl' | 'personal'
  dateRange: {
    start: string
    end: string
  }
  preset: '7days' | '30days' | '90days' | 'thisMonth' | 'lastMonth' | 'custom'
}

interface ReportFiltersProps {
  onChange: (filters: ReportFilterValues) => void
  initialPreset?: ReportFilterValues['preset']
}

export default function ReportFilters({ onChange, initialPreset = 'thisMonth' }: ReportFiltersProps) {
  const { context } = useContext_()
  const [preset, setPreset] = useState<ReportFilterValues['preset']>(initialPreset)
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showCustom, setShowCustom] = useState(preset === 'custom')

  const presets = [
    { key: '7days', label: '7 dias' },
    { key: '30days', label: '30 dias' },
    { key: '90days', label: '90 dias' },
    { key: 'thisMonth', label: 'Este mês' },
    { key: 'lastMonth', label: 'Mês passado' },
    { key: 'custom', label: 'Personalizado' },
  ] as const

  useEffect(() => {
    let start = ''
    let end = ''

    const today = new Date()
    switch (preset) {
      case '7days':
        start = format(subDays(today, 7), 'yyyy-MM-dd')
        end = format(today, 'yyyy-MM-dd')
        break
      case '30days':
        start = format(subDays(today, 30), 'yyyy-MM-dd')
        end = format(today, 'yyyy-MM-dd')
        break
      case '90days':
        start = format(subDays(today, 90), 'yyyy-MM-dd')
        end = format(today, 'yyyy-MM-dd')
        break
      case 'thisMonth':
        start = format(startOfMonth(today), 'yyyy-MM-dd')
        end = format(endOfMonth(today), 'yyyy-MM-dd')
        break
      case 'lastMonth':
        const last = subMonths(today, 1)
        start = format(startOfMonth(last), 'yyyy-MM-dd')
        end = format(endOfMonth(last), 'yyyy-MM-dd')
        break
      case 'custom':
        start = customStart
        end = customEnd
        break
    }

    onChange({
      context,
      dateRange: { start, end },
      preset,
    })
  }, [preset, customStart, customEnd, context])

  const handlePresetChange = (key: ReportFilterValues['preset']) => {
    setPreset(key)
    setShowCustom(key === 'custom')
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={16} className="text-teal-600 dark:text-teal-400" />
        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Período</span>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map(p => (
          <button
            key={p.key}
            onClick={() => handlePresetChange(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              preset === p.key
                ? 'bg-teal-700 text-white'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      {showCustom && (
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 dark:text-gray-500 block mb-1">Início</label>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl px-3 py-2 text-xs outline-none focus:border-teal-500 transition-colors text-gray-800 dark:text-gray-200"
            />
          </div>
          <span className="text-gray-400 mt-4">—</span>
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 dark:text-gray-500 block mb-1">Fim</label>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl px-3 py-2 text-xs outline-none focus:border-teal-500 transition-colors text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>
      )}
    </div>
  )
}