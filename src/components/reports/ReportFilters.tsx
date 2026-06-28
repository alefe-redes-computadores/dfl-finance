'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Filter } from 'lucide-react'

export interface ReportFilterValues {
  context: string
  dateRange: {
    start: string
    end: string
  }
  preset: string
}

interface ReportFiltersProps {
  onChange: (values: ReportFilterValues) => void
  initialPreset?: string
  context: string
}

const presets: Record<string, { label: string; start: string; end: string }> = {
  thisMonth: {
    label: 'Este mês',
    get start() {
      const now = new Date()
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    },
    get end() {
      return new Date().toISOString().split('T')[0]
    },
  },
  lastMonth: {
    label: 'Mês passado',
    get start() {
      const now = new Date()
      return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
    },
    get end() {
      const now = new Date()
      return new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
    },
  },
  last3Months: {
    label: 'Últimos 3 meses',
    get start() {
      const now = new Date()
      return new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0]
    },
    get end() {
      return new Date().toISOString().split('T')[0]
    },
  },
  thisYear: {
    label: 'Este ano',
    get start() {
      return new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    },
    get end() {
      return new Date().toISOString().split('T')[0]
    },
  },
}

export default function ReportFilters({ onChange, initialPreset = 'thisMonth', context }: ReportFiltersProps) {
  const [preset, setPreset] = useState(initialPreset)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const applyPreset = (key: string) => {
    setPreset(key)
    setUseCustom(false)
    const p = presets[key]
    onChange({
      context,
      dateRange: { start: p.start, end: p.end },
      preset: key,
    })
  }

  const applyCustom = () => {
    setUseCustom(true)
    if (customStart && customEnd) {
      onChange({
        context,
        dateRange: { start: customStart, end: customEnd },
        preset: 'custom',
      })
    }
  }

  // Dispara com valor inicial
  useEffect(() => {
    applyPreset(preset)
  }, [])

  useEffect(() => {
    if (useCustom && customStart && customEnd) {
      onChange({
        context,
        dateRange: { start: customStart, end: customEnd },
        preset: 'custom',
      })
    }
  }, [customStart, customEnd])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <Filter size={14} />
          <span>Período</span>
        </div>
        <button
          onClick={() => setUseCustom(!useCustom)}
          className="text-xs text-teal-600 font-medium"
        >
          {useCustom ? 'Usar predefinição' : 'Personalizado'}
        </button>
      </div>

      {!useCustom ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(presets).map(([key, p]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                preset === key
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          />
          <span className="text-xs text-slate-500">até</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          />
        </div>
      )}
    </div>
  )
}