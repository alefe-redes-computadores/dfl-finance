'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useContext_ } from '@/components/ContextToggle'

export interface FilterState {
  period: string
  accountId: string
}

interface ReportFiltersProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

const PERIOD_OPTIONS = [
  { value: 'this-month', label: 'Este mês' },
  { value: 'last-month', label: 'Mês passado' },
  { value: 'last-3-months', label: 'Últimos 3 meses' },
  { value: 'this-year', label: 'Este ano' },
  { value: 'last-year', label: 'Ano passado' },
  { value: 'custom', label: 'Personalizado' },
]

export default function ReportFilters({ filters, onChange }: ReportFiltersProps) {
  const { user } = useAuth()
  const { context } = useContext_()
  const [accounts, setAccounts] = useState<any[]>([])
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('accounts')
      .select('id, name')
      .match({ user_id: user.id, context })
      .order('name')
      .then(({ data }) => setAccounts(Array.isArray(data) ? data : []))
  }, [user, context])

  const updateFilter = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="space-y-3 mb-6">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => updateFilter('period', opt.value)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              filters.period === opt.value
                ? 'bg-teal-700 text-white'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filters.period === 'custom' && (
        <div className="flex gap-2">
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-2 text-xs text-gray-800 dark:text-gray-200 outline-none" />
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-2 text-xs text-gray-800 dark:text-gray-200 outline-none" />
        </div>
      )}

      <select
        value={filters.accountId}
        onChange={e => updateFilter('accountId', e.target.value)}
        className="w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-2 text-xs text-gray-800 dark:text-gray-200 outline-none"
      >
        <option value="">Todas as contas</option>
        {accounts.map(acc => (
          <option key={acc.id} value={acc.id}>{acc.name}</option>
        ))}
      </select>
    </div>
  )
}