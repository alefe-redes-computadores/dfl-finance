'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'

type Context = 'dfl' | 'personal'

export default function AnalysisPage() {
  const { user } = useAuth()
  const [context, setContext] = useState<Context>('dfl')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [tab, setTab] = useState<'month' | 'new'>('month')
  const [summary, setSummary] = useState({ income: 0, expense: 0 })
  const [byCategory, setByCategory] = useState<any[]>([])
  const [monthlyFlow, setMonthlyFlow] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('user_id', user.id)
      .eq('context', context)
      .gte('date', start)
      .lte('date', end)

    const txs = data ?? []
    const income = txs.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
    const expense = txs.filter(t => t.type === 'expense' || t.type === 'sangria').reduce((a, t) => a + Number(t.amount), 0)
    setSummary({ income, expense })

    const catMap: Record<string, any> = {}
    txs.filter(t => t.type === 'expense' || t.type === 'sangria').forEach(t => {
      const key = t.category_id ?? 'sem'
      if (!catMap[key]) catMap[key] = {
        name: t.categories?.name ?? 'Sem categoria',
        color: t.categories?.color ?? '#94a3b8',
        icon: t.categories?.icon ?? '📦',
        total: 0
      }
      catMap[key].total += Number(t.amount)
    })
    setByCategory(Object.values(catMap).sort((a, b) => b.total - a.total))

    const flows = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(currentDate, i)
      const s = format(startOfMonth(d), 'yyyy-MM-dd')
      const e = format(endOfMonth(d), 'yyyy-MM-dd')
      const { data: fd } = await supabase
        .from('transactions').select('type,amount')
        .eq('user_id', user.id).eq('context', context)
        .gte('date', s).lte('date', e)
      const fd2 = fd ?? []
      flows.push({
        month: format(d, 'MMM', { locale: ptBR }),
        income: fd2.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0),
        expense: fd2.filter(t => t.type === 'expense' || t.type === 'sangria').reduce((a, t) => a + Number(t.amount), 0),
      })
    }
    setMonthlyFlow(flows)
    setLoading(false)
  }, [user, context, currentDate])

  useEffect(() => { loadData() }, [loadData])

  const balance = summary.income - summary.expense
  const COLORS = ['#0d9488', '#16a34a', '#0891b2', '#7c3aed', '#dc2626', '#ea580c', '#ca8a04']

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-28 font-sans page-transition">
      <div className="px-4 pt-6 pb-4 bg-white shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Análise</h1>
          <div className="flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-full">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft size={16} className="text-gray-500" />
            </button>
            <span className="text-xs font-bold text-gray-700 capitalize w-24 text-center">{monthLabel}</span>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Toggle DFL / Pessoal */}
        <div className="flex bg-gray-100 p-1 rounded-full mb-3">
          {(['dfl', 'personal'] as Context[]).map(c => (
            <button key={c} onClick={() => setContext(c)}
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${context === c ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>

        {/* Tab No mês / Novos gastos */}
        <div className="flex bg-gray-100 p-1 rounded-full">
          <button onClick={() => setTab('month')} className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${tab === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>No mês</button>
          <button onClick={() => setTab('new')} className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${tab === 'new' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Novos gastos</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 space-y-4">

          {/* Balanço */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Balanço do mês</p>
            <div className="flex gap-4 items-center">
              <div className="flex items-end gap-1">
                <div className="w-3 rounded-t-full bg-teal-500 transition-all"
                  style={{ height: `${summary.income > 0 ? Math.min((summary.income / Math.max(summary.income, summary.expense)) * 56, 56) : 6}px` }} />
                <div className="w-3 rounded-t-full bg-red-400 transition-all"
                  style={{ height: `${summary.expense > 0 ? Math.min((summary.expense / Math.max(summary.income, summary.expense)) * 56, 56) : 6}px` }} />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Receitas</span>
                  <span className="text-sm font-bold text-teal-600">R$ {summary.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Despesas</span>
                  <span className="text-sm font-bold text-red-500">R$ {summary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-gray-800">Balanço</span>
                  <span className={`text-sm font-bold ${balance >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
                    R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Donut por categoria */}
          {byCategory.length > 0 ? (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-800 mb-1">Despesas por categoria</p>
              <p className="text-xs text-gray-400 mb-4">Visão detalhada do seu fluxo de caixa</p>
              <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={byCategory} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="total" paddingAngle={2}>
                      {byCategory.map((entry, i) => <Cell key={i} fill={entry.color ?? COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">Total gasto</p>
                  <p className="text-base font-bold text-gray-900">R$ {summary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div className="space-y-3 mt-3">
                {byCategory.map((cat, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cat.icon}</span>
                        <span className="text-sm text-gray-700">{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-800">R$ {cat.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-gray-400">{summary.expense > 0 ? ((cat.total / summary.expense) * 100).toFixed(1) : 0}%</p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${summary.expense > 0 ? (cat.total / summary.expense) * 100 : 0}%`, backgroundColor: cat.color ?? COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center text-gray-400">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-sm font-medium">Nenhuma despesa neste período</p>
            </div>
          )}

          {/* Fluxo mensal */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-bold text-gray-800">Fluxo mensal</p>
              <span className="text-xs text-gray-400">Últimos 6 meses</span>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-teal-500" /><span className="text-[10px] text-gray-500">Receitas</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /><span className="text-[10px] text-gray-500">Despesas</span></div>
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={monthlyFlow} barGap={2} barCategoryGap="30%">
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: any) => [`R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']} />
                <Bar dataKey="income" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}
    </div>
  )
}