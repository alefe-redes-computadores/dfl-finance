'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, TrendingUp, TrendingDown, PieChart, Calendar } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'

export default function AnalysisPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [topCategories, setTopCategories] = useState<any[]>([])

  useEffect(() => {
    if (!user?.id) return
    loadAnalysis()
  }, [user?.id, context])

  const loadAnalysis = async () => {
    setLoading(true)
    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    const { data: txs } = await supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('user_id', user.id)
      .eq('context', context)
      .gte('date', start)
      .lte('date', end)

    const transactions = Array.isArray(txs) ? txs : []
    const income = transactions.filter(t => t.type === 'income' && t.status === 'done').reduce((a, t) => a + Number(t.amount), 0)
    const expense = transactions.filter(t => t.type === 'expense' && t.status === 'done').reduce((a, t) => a + Number(t.amount), 0)

    const byCategory: Record<string, any> = {}
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.categories?.name || 'Outros'
      if (!byCategory[cat]) byCategory[cat] = { name: cat, total: 0, color: t.categories?.color || '#94a3b8' }
      byCategory[cat].total += Number(t.amount)
    })

    setTopCategories(Object.values(byCategory).sort((a: any, b: any) => b.total - a.total).slice(0, 5))
    setSummary({ income, expense, balance: income - expense })
    setLoading(false)
  }

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const maxCat = Math.max(...topCategories.map(c => c.total), 1)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/home')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Análise</h1>
          <div className="w-10" />
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton variant="card" height="100px" />
            <Skeleton variant="card" height="160px" />
            <Skeleton variant="card" height="120px" count={3} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center shadow-sm">
                <TrendingUp size={18} className="text-emerald-500 mx-auto mb-1" />
                <p className="text-[10px] text-gray-400 font-bold">Receitas</p>
                <p className="text-sm font-bold text-emerald-600">{formatCurrency(summary.income)}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center shadow-sm">
                <TrendingDown size={18} className="text-red-500 mx-auto mb-1" />
                <p className="text-[10px] text-gray-400 font-bold">Despesas</p>
                <p className="text-sm font-bold text-red-600">{formatCurrency(summary.expense)}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center shadow-sm">
                <PieChart size={18} className="text-teal-500 mx-auto mb-1" />
                <p className="text-[10px] text-gray-400 font-bold">Saldo</p>
                <p className={`text-sm font-bold ${summary.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.balance)}
                </p>
              </div>
            </div>

            {/* Top categorias */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-3">Top Categorias de Gastos</h3>
              {topCategories.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Nenhum gasto no mês.</p>
              ) : (
                <div className="space-y-2">
                  {topCategories.map((cat: any) => (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">{cat.name}</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{formatCurrency(cat.total)}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(cat.total / maxCat) * 100}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}