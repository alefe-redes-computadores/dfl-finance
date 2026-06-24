'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, ChevronRight, Loader2, TrendingUp, Sparkles,
  // Ícones Lucide para categorias
  Home, Utensils, Car, HeartPulse, GraduationCap, Gamepad2, Shirt,
  Smile, Repeat, Wrench, Dog, FileText, Shield, Gift, MoreHorizontal,
  Briefcase, Laptop, TrendingUp as TrendingUpIcon, ShoppingCart, ReceiptIcon, Zap, Music
} from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

// Mapa de ícones (padrão do projeto)
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
  const [summary, setSummary] = useState({ income: 0, expense: 0 })
  const [byCategory, setByCategory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'month' | 'new'>('month')

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
    const income = txs.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
    const expense = txs.filter(t => t.type === 'expense' || t.type === 'sangria').reduce((a, t) => a + Number(t.amount), 0)
    setSummary({ income, expense })

    const catMap: Record<string, any> = {}
    txs.filter(t => t.type === 'expense' || t.type === 'sangria').forEach(t => {
      const key = t.category_id ?? 'sem'
      if (!catMap[key]) catMap[key] = {
        name: t.categories?.name ?? 'Sem categoria',
        color: t.categories?.color ?? '#64748b',
        icon: t.categories?.icon ?? 'other',
        total: 0
      }
      catMap[key].total += Number(t.amount)
    })
    setByCategory(Object.values(catMap).sort((a, b) => b.total - a.total))

    setLoading(false)
  }, [user, context, currentDate])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const maiorCategoria = byCategory.length > 0 ? byCategory[0] : null;
  const maiorPesoPorcentagem = maiorCategoria && summary.expense > 0 ? ((maiorCategoria.total / summary.expense) * 100).toFixed(0) : '0';

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <ContextToggle />
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 px-3 py-1.5 rounded-full">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 text-gray-800 dark:text-gray-300 hover:text-gray-500 transition-colors"><ChevronLeft size={18} /></button>
          <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200 capitalize tracking-wide">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 text-gray-800 dark:text-gray-300 hover:text-gray-500 transition-colors"><ChevronRight size={18} /></button>
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
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none mb-4 border border-gray-50 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-50 dark:border-slate-700">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <TrendingUp size={20} className="text-red-400" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-0.5">Gastos do mês</p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatCurrency(summary.expense)}</p>
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mb-1">Categorias</p>
                <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{byCategory.length}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mb-1">Média</p>
                <p className="text-[14px] font-bold text-red-400">{formatCurrency(byCategory.length > 0 ? summary.expense / byCategory.length : 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mb-1">Maior peso</p>
                <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 truncate max-w-[100px]">{maiorCategoria?.name || '-'}</p>
                <span className="text-[11px] text-red-400 font-bold">{maiorPesoPorcentagem}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 px-5 pt-8 pb-6 rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none border border-gray-50 dark:border-slate-700">
            {byCategory.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-10">Nenhuma despesa neste mês.</p>
            ) : (
              <>
                <div className="h-56 mb-8 relative flex items-center justify-center">
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Total Gasto</p>
                    <p className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{formatCurrency(summary.expense)}</p>
                  </div>

                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byCategory}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={75}
                        outerRadius={95}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {byCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="text-center mb-6">
                  <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100">Gastos por categoria</h3>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Onde os gastos começaram a pesar</p>
                </div>

                <div className="space-y-5">
                  {byCategory.map(c => {
                    const percentage = summary.expense > 0 ? (c.total / summary.expense) * 100 : 0;
                    const IconComp = ICON_MAP[c.icon] || ICON_MAP['other']
                    return (
                      <div key={c.name} className="group cursor-pointer">
                        <div className="flex justify-between items-end mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${c.color}20`, color: c.color }}>
                              <IconComp size={20} />
                            </div>
                            <span className="font-bold text-[13px] text-gray-800 dark:text-gray-200">{c.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{formatCurrency(c.total)}</span>
                            <div className="flex items-center gap-2 justify-end">
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">{percentage.toFixed(1)}%</p>
                              <ChevronRight size={14} className="text-gray-300 dark:text-gray-600" />
                            </div>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${percentage}%`, backgroundColor: c.color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function AnalysisPage() {
  return <ContextProvider><AnalysisContent /></ContextProvider>
}