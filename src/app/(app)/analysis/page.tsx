'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ContextProvider, useContext_ } from '@/components/ContextToggle'

function AnalysisContent() {
  const { user } = useAuth()
  const { context } = useContext_()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [summary, setSummary] = useState({ income: 0, expense: 0 })
  const [byCategory, setByCategory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })
  const monthLabel2 = format(currentDate, 'yyyy-MM')

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user, context, currentDate])

  async function loadData() {
    setLoading(true)

    const { data } = await supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('user_id', user!.uid)
      .eq('context', context)
      .gte('date', `${monthLabel2}-01`)
      .lte('date', `${monthLabel2}-31`)

    const transactions = data ?? []

    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((a, t) => a + Number(t.amount), 0)

    const expense = transactions
      .filter(t => t.type === 'expense' || t.type === 'sangria')
      .reduce((a, t) => a + Number(t.amount), 0)

    setSummary({ income, expense })

    // Agrupar por categoria
    const catMap: Record<string, any> = {}
    transactions
      .filter(t => t.type === 'expense' || t.type === 'sangria')
      .forEach(t => {
        const key = t.category_id ?? 'sem-categoria'
        const name = t.categories?.name ?? 'Sem categoria'
        const color = t.categories?.color ?? '#94a3b8'
        const icon = t.categories?.icon ?? '📦'
        if (!catMap[key]) catMap[key] = { name, color, icon, total: 0 }
        catMap[key].total += Number(t.amount)
      })

    const sorted = Object.values(catMap).sort((a, b) => b.total - a.total)
    setByCategory(sorted)
    setLoading(false)
  }

  const balance = summary.income - summary.expense

  const COLORS = ['#1a6b5c', '#16a34a', '#0891b2', '#7c3aed', '#dc2626', '#ea580c', '#ca8a04']

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Análise</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft size={20} className="text-gray-500" />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight size={20} className="text-gray-500" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">

          {/* Balanço */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-3">Balanço do mês</p>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-300">Receitas</span>
              <span className="text-sm font-semibold text-green-600">
                R$ {summary.income.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-300">Despesas</span>
              <span className="text-sm font-semibold text-red-600">
                R$ {summary.expense.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="h-px bg-gray-100 dark:bg-zinc-800 my-2" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-800 dark:text-white">Balanço</span>
              <span className={`text-sm font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {balance.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>

          {/* Gráfico donut */}
          {byCategory.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-800 dark:text-white mb-1">Despesas por categoria</p>
              <p className="text-xs text-gray-400 mb-4">Visão detalhada do seu fluxo</p>

              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={byCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="total"
                      paddingAngle={2}
                    >
                      {byCategory.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.color ?? COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [`R$ ${Number(value).toFixed(2).replace('.', ',')}`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xs text-gray-400">TOTAL GASTO</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    R$ {summary.expense.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>

              {/* Lista categorias */}
              <div className="space-y-3 mt-4">
                {byCategory.map((cat, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cat.icon}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">
                          R$ {cat.total.toFixed(2).replace('.', ',')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {summary.expense > 0 ? ((cat.total / summary.expense) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${summary.expense > 0 ? (cat.total / summary.expense) * 100 : 0}%`,
                          backgroundColor: cat.color ?? COLORS[i % COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <ContextProvider>
      <AnalysisContent />
    </ContextProvider>
  )
}
