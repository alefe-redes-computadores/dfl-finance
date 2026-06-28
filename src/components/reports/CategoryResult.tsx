'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'

const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: '#FF6B6B', Transporte: '#4ECDC4', Moradia: '#45B7D1',
  Lazer: '#96CEB4', Saúde: '#FFEAA7', Educação: '#DDA0DD',
  Assinaturas: '#98D8C8', Salário: '#6C5CE7', Freelance: '#A8E6CF',
  Investimentos: '#FFD93D', Vendas: '#FF8B94', Serviços: '#B8A9C9',
  Outros: '#95A5A6',
}

interface CategoryResultProps {
  filters: ReportFilterValues
}

export default function CategoryResult({ filters }: CategoryResultProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!user?.id || !filters.dateRange.start || !filters.dateRange.end) return

    let cancelled = false
    setLoading(true)

    const load = async () => {
      // Busca transações e categorias em paralelo
      const [txResult, catResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('context', filters.context)
          .gte('date', filters.dateRange.start)
          .lte('date', filters.dateRange.end)
          .order('date', { ascending: false }),
        supabase
          .from('categories')
          .select('id, name, color, icon')
          .eq('user_id', user.id),
      ])

      if (cancelled) return

      if (txResult.error) console.error('CategoryResult TX error:', txResult.error)
      if (catResult.error) console.error('CategoryResult CAT error:', catResult.error)

      // Monta mapa id → categoria
      const catMap: Record<string, any> = {}
      ;(catResult.data || []).forEach((c: any) => { catMap[c.id] = c })

      setCategories(catMap)
      setTransactions(txResult.data || [])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, filters.context, filters.dateRange.start, filters.dateRange.end])

  const expensesByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any, t: any) => {
      // Usa o nome real da categoria via join local, com fallback
      const catName = categories[t.category_id]?.name || t.category || 'Outros'
      const catColor = categories[t.category_id]?.color || CATEGORY_COLORS[catName] || '#95A5A6'
      if (!acc[catName]) acc[catName] = { total: 0, count: 0, transactions: [], color: catColor }
      acc[catName].total += Number(t.amount)
      acc[catName].count += 1
      acc[catName].transactions.push(t)
      return acc
    }, {})

  const categoryArray = Object.entries(expensesByCategory)
    .map(([name, data]: any) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)

  const totalExpenses = categoryArray.reduce((sum, c) => sum + c.total, 0)

  const fmt = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : categoryArray.length === 0 ? (
        <div className="text-center p-8 text-slate-500 dark:text-slate-400">
          Nenhuma despesa no período.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">
              Distribuição de Gastos
            </h3>
            <div className="space-y-2">
              {categoryArray.map(cat => {
                const percent = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0
                return (
                  <div key={cat.name} className="flex items-center gap-2">
                    <div className="w-24 text-xs text-slate-600 dark:text-slate-400 truncate">
                      {cat.name}
                    </div>
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%`, backgroundColor: cat.color }}
                      />
                    </div>
                    <div className="w-28 text-xs text-right">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {fmt(cat.total)}
                      </span>
                      <span className="text-slate-400 ml-1">({percent.toFixed(1)}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {categoryArray.map(cat => (
            <div key={cat.name} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200">{cat.name}</h4>
                </div>
                <p className="text-sm font-bold text-red-600">{fmt(cat.total)}</p>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                {cat.count} transação(ões)
                {totalExpenses > 0 && ` • ${((cat.total / totalExpenses) * 100).toFixed(1)}% do total`}
              </p>
              <div className="space-y-1">
                {cat.transactions.slice(0, 3).map((t: any) => (
                  <div key={t.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span className="truncate mr-2">{t.description || '—'}</span>
                    <span>{fmt(Number(t.amount))}</span>
                  </div>
                ))}
                {cat.transactions.length > 3 && (
                  <p className="text-xs text-teal-600 mt-1">
                    + {cat.transactions.length - 3} outras
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}