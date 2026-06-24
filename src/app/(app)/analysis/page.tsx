'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, ChevronRight, Loader2, TrendingUp, Sparkles,
  Home, Utensils, Car, HeartPulse, GraduationCap, Gamepad2, Shirt,
  Smile, Repeat, Wrench, Dog, FileText, Shield, Gift, MoreHorizontal,
  Briefcase, Laptop, TrendingUp as TrendingUpIcon, ShoppingCart, ReceiptIcon, Zap, Music,
  ArrowUp, ArrowDown, Wallet, Tag, SlidersHorizontal, X
} from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

const ICON_MAP: Record<string, React.ElementType> = {
  home: Home, utensils: Utensils, car: Car, heart: HeartPulse,
  graduation: GraduationCap, gamepad: Gamepad2, shirt: Shirt,
  smile: Smile, repeat: Repeat, wrench: Wrench, dog: Dog,
  file: FileText, shield: Shield, gift: Gift, briefcase: Briefcase,
  laptop: Laptop, trending: TrendingUpIcon, shopping: ShoppingCart,
  receipt: ReceiptIcon, zap: Zap, music: Music, other: MoreHorizontal
}

function AnalysisContent() {
  const { user } = useAuth()
  const { context } = useContext_()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [byCategory, setByCategory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'month' | 'new'>('month')
  const [showFilterModal, setShowFilterModal] = useState(false)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .match({ user_id: user.id, context: context })
      .gte('date', start)
      .lte('date', end)

    const txs = Array.isArray(data) ? data : []
    const income = txs.filter(t => t.type === 'income' && t.status === 'done').reduce((a, t) => a + Number(t.amount || 0), 0)
    const expense = txs.filter(t => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a, t) => a + Number(t.amount || 0), 0)
    setSummary({ income, expense, balance: income - expense })

    // Agrupa despesas por categoria usando reduce
    const catMap: Record<string, { name: string; color: string; icon: string; total: number }> = {}
    txs.filter(t => t.type === 'expense' || t.type === 'sangria').forEach(t => {
      const key = t.category_id ?? 'sem'
      if (!catMap[key]) {
        catMap[key] = {
          name: t.categories?.name ?? 'Sem categoria',
          color: t.categories?.color ?? '#64748b',
          icon: t.categories?.icon ?? 'other',
          total: 0
        }
      }
      catMap[key].total += Number(t.amount || 0)
    })

    const categoriesArray = Object.values(catMap).map(cat => ({
      ...cat,
      percent: expense > 0 ? (cat.total / expense) * 100 : 0
    })).sort((a, b) => b.total - a.total)

    setByCategory(categoriesArray)
    setLoading(false)
  }, [user, context, currentDate])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const totalExpense = summary.expense

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <ContextToggle />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 px-3 py-1.5 rounded-full">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 text-gray-800 dark:text-gray-300 hover:text-gray-500 transition-colors"><ChevronLeft size={18} /></button>
            <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200 capitalize tracking-wide">{monthLabel}</span>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 text-gray-800 dark:text-gray-300 hover:text-gray-500 transition-colors"><ChevronRight size={18} /></button>
          </div>
          <button 
            onClick={() => setShowFilterModal(true)}
            className="w-9 h-9 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 rounded-full flex items-center justify-center"
          >
            <SlidersHorizontal size={18} className="text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>

      <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 mb-4 px-1">Análise</h2>

      {/* Abas */}
      <div className="flex bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 p-1 rounded-full mb-6">
        <button
          onClick={() => setActiveTab('month')}
          className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all ${activeTab === 'month' ? 'bg-[#f4f6f8] dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-400 dark:text-gray-500'}`}
        >
          No mês
        </button>
        <button
          onClick={() => setActiveTab('new')}
          className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all ${activeTab === 'new' ? 'bg-[#f4f6f8] dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-400 dark:text-gray-500'}`}
        >
          Novos gastos
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
      ) : activeTab === 'new' ? (
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-8 shadow-sm border border-gray-50 dark:border-slate-700 text-center flex flex-col items-center justify-center mt-4">
          <div className="w-16 h-16 bg-teal-50 dark:bg-teal-900/30 rounded-full flex items-center justify-center mb-4">
            <Sparkles size={28} className="text-teal-700 dark:text-teal-400" />
          </div>
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mb-2">Em breve!</h3>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
            Para separar os gastos recorrentes dos "Novos Gastos", estamos preparando o motor de despesas fixas. Fique de olho!
          </p>
        </div>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
                <ArrowUp size={16} className="text-emerald-600" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Receitas</p>
              <p className="text-[15px] font-bold text-emerald-600">{formatCurrency(summary.income)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-2">
                <ArrowDown size={16} className="text-red-500" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Despesas</p>
              <p className="text-[15px] font-bold text-red-500">{formatCurrency(summary.expense)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-2">
                <Wallet size={16} className="text-teal-700 dark:text-teal-400" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Saldo</p>
              <p className={`text-[15px] font-bold ${summary.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatCurrency(summary.balance)}
              </p>
            </div>
          </div>

          {/* Gráfico Donut */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-6">
            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Distribuição de Gastos</h3>
            {byCategory.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-10">Nenhuma despesa neste mês.</p>
            ) : (
              <div className="h-56 relative flex items-center justify-center">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Total Gasto</p>
                  <p className="text-[20px] font-bold text-gray-800 dark:text-gray-100">{formatCurrency(totalExpense)}</p>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {byCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Lista de Categorias com Progress Bar */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Gastos por Categoria</h3>
            {byCategory.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-4">Nenhuma despesa neste mês.</p>
            ) : (
              <div className="space-y-4">
                {byCategory.map(c => {
                  const IconComp = ICON_MAP[c.icon] || ICON_MAP['other']
                  return (
                    <div key={c.name}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${c.color}20`, color: c.color }}>
                            <IconComp size={18} />
                          </div>
                          <span className="font-bold text-[13px] text-gray-800 dark:text-gray-200">{c.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-[13px] text-gray-800 dark:text-gray-200">{formatCurrency(c.total)}</span>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">{c.percent.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${c.percent}%`, backgroundColor: c.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de Filtros */}
      {showFilterModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowFilterModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Filtros</h3>
              <button onClick={() => setShowFilterModal(false)} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 block">Conta</label>
                <select className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200">
                  <option value="">Todas as contas</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 block">Categoria</label>
                <select className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200">
                  <option value="">Todas as categorias</option>
                </select>
              </div>
              <button className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold">Aplicar Filtros</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default function AnalysisPage() {
  return <ContextProvider><AnalysisContent /></ContextProvider>
}