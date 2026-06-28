'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Filter } from 'lucide-react'

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

function getPresetDates(key: string): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const today = now.toISOString().split('T')[0]

  switch (key) {
    case 'thisMonth':
      return {
        start: new Date(y, m, 1).toISOString().split('T')[0],
        end: today,
      }
    case 'lastMonth':
      return {
        start: new Date(y, m - 1, 1).toISOString().split('T')[0],
        end: new Date(y, m, 0).toISOString().split('T')[0],
      }
    case 'last3Months':
      return {
        start: new Date(y, m - 3, 1).toISOString().split('T')[0],
        end: today,
      }
    case 'thisYear':
      return {
        start: new Date(y, 0, 1).toISOString().split('T')[0],
        end: today,
      }
    default:
      return {
        start: new Date(y, m, 1).toISOString().split('T')[0],
        end: today,
      }
  }
}

const PRESET_LABELS: Record<string, string> = {
  thisMonth: 'Este mês',
  lastMonth: 'Mês passado',
  last3Months: 'Últimos 3 meses',
  thisYear: 'Este ano',
}

export default function ReportFilters({
  onChange,
  initialPreset = 'thisMonth',
  context,
}: ReportFiltersProps) {
  const [preset, setPreset] = useState(initialPreset)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  // Evita disparar onChange no mount duas vezes
  const mounted = useRef(false)

  // Disparo único no mount com as datas calculadas
  useEffect(() => {
    if (mounted.current) return
    mounted.current = true
    const dates = getPresetDates(initialPreset)
    onChange({ context, dateRange: dates, preset: initialPreset })
  }, []) // eslint-disable-line

  // Quando o contexto externo muda, repropaga com as datas atuais
  useEffect(() => {
    if (!mounted.current) return
    if (useCustom && customStart && customEnd) {
      onChange({ context, dateRange: { start: customStart, end: customEnd }, preset: 'custom' })
    } else {
      const dates = getPresetDates(preset)
      onChange({ context, dateRange: dates, preset })
    }
  }, [context]) // eslint-disable-line

  const applyPreset = (key: string) => {
    setPreset(key)
    setUseCustom(false)
    const dates = getPresetDates(key)
    onChange({ context, dateRange: dates, preset: key })
  }

  const handleCustomDates = (start: string, end: string) => {
    setCustomStart(start)
    setCustomEnd(end)
    if (start && end) {
      onChange({ context, dateRange: { start, end }, preset: 'custom' })
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <Filter size={14} />
          <span>Período</span>
        </div>
        <button
          onClick={() => {
            const next = !useCustom
            setUseCustom(next)
            if (!next) applyPreset(preset)
          }}
          className="text-xs text-teal-600 font-medium"
        >
          {useCustom ? 'Usar predefinição' : 'Personalizado'}
        </button>
      </div>

      {!useCustom ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(PRESET_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                preset === key
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => handleCustomDates(e.target.value, customEnd)}
            className="flex-1 px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          />
          <span className="text-xs text-slate-500">até</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => handleCustomDates(customStart, e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          />
        </div>
      )}
    </div>
  )
}