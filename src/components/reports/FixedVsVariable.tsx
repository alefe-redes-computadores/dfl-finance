'use client'

import React, { useState, useEffect } from 'react'
import { Lock, Repeat } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'

const FIXED_CATEGORIES = ['Moradia', 'Assinaturas', 'Educação', 'Saúde', 'Financiamento']

interface FixedVsVariableProps {
  filters: ReportFilterValues
}

export default function FixedVsVariable({ filters }: FixedVsVariableProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!user?.id || !filters.dateRange.start || !filters.dateRange.end) return

    let cancelled = false
    setLoading(true)

    const load = async () => {
      const [txResult, catResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .eq('context', filters.context)
          .gte('date', filters.dateRange.start)
          .lte('date', filters.dateRange.end)
          .order('date', { ascending: false }),
        supabase
          .from('categories')
          .select('id, name, color')
          .eq('user_id', user.id),
      ])

      if (cancelled) return

      if (txResult.error) console.error('FixedVsVariable TX:', txResult.error)
      if (catResult.error) console.error('FixedVsVariable CAT:', catResult.error)

      const catMap: Record<string, any> = {}
      ;(catResult.data || []).forEach((c: any) => { catMap[c.id] = c })

      setCategories(catMap)
      setTransactions(txResult.data || [])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, filters.context, filters.dateRange.start, filters.dateRange.end])

  const getCatName = (t: any) => categories[t.category_id]?.name || t.category || ''

  // Usa campo is_fixed se existir, senão fallback por nome de categoria
  const fixed = transactions.filter(t =>
    t.is_fixed !== undefined && t.is_fixed !== null
      ? t.is_fixed
      : FIXED_CATEGORIES.includes(getCatName(t))
  )
  const variable = transactions.filter(t =>
    t.is_fixed !== undefined && t.is_fixed !== null
      ? !t.is_fixed
      : !FIXED_CATEGORIES.includes(getCatName(t))
  )

  const fmt = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const totalFixed = fixed.reduce((s, t) => s + Number(t.amount), 0)
  const totalVar = variable.reduce((s, t) => s + Number(t.amount), 0)
  const total = totalFixed + totalVar
  const fixedPerc = total ? (totalFixed / total) * 100 : 0
  const varPerc = total ? (totalVar / total) * 100 : 0

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : total === 0 ? (
        <div className="text-center p-8 text-slate-500 dark:text-slate-400">
          Nenhuma despesa no período.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-amber-50 dark:bg-amber-950/50 p-4 rounded-xl border border-amber-100 dark:border-amber-900">
              <div className="flex items-center gap-1 mb-2">
                <Lock size={16} className="text-amber-600" />
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Fixas</p>
              </div>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{fmt(totalFixed)}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {fixedPerc.toFixed(1)}% do total • {fixed.length} itens
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-xl border border-blue-100 dark:border-blue-900">
              <div className="flex items-center gap-1 mb-2">
                <Repeat size={16} className="text-blue-600" />
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Variáveis</p>
              </div>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{fmt(totalVar)}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {varPerc.toFixed(1)}% do total • {variable.length} itens
              </p>
            </div>
          </div>

          {/* Barra proporcional */}
          <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden flex">
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${fixedPerc}%` }}
            />
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${varPerc}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" /> Fixas
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" /> Variáveis
            </div>
          </div>

          {fixed.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">
                Despesas Fixas ({fixed.length})
              </h3>
              <div className="space-y-2">
                {fixed.slice(0, 5).map(t => (
                  <div key={t.id} className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400 truncate mr-2">
                      {t.description || getCatName(t) || '—'}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 flex-shrink-0">
                      {fmt(Number(t.amount))}
                    </span>
                  </div>
                ))}
                {fixed.length > 5 && (
                  <p className="text-xs text-teal-600 mt-1">+ {fixed.length - 5} outras</p>
                )}
              </div>
            </div>
          )}

          {variable.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">
                Despesas Variáveis ({variable.length})
              </h3>
              <div className="space-y-2">
                {variable.slice(0, 5).map(t => (
                  <div key={t.id} className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400 truncate mr-2">
                      {t.description || getCatName(t) || '—'}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 flex-shrink-0">
                      {fmt(Number(t.amount))}
                    </span>
                  </div>
                ))}
                {variable.length > 5 && (
                  <p className="text-xs text-teal-600 mt-1">+ {variable.length - 5} outras</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}