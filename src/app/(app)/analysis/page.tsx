'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, Loader2, TrendingUp } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

function AnalysisContent() {
  const { user } = useAuth()
  const { context } = useContext_() 
  const [currentDate, setCurrentDate] = useState(new Date())
  const [summary, setSummary] = useState({ income: 0, expense: 0 })
  const [byCategory, setByCategory] = useState<any[]>([])
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
        color: t.categories?.color ?? '#64748b',
        icon: t.categories?.icon ?? '📦',
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
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] pb-28 font-sans px-4 pt-6">
      
      {/* Header Premium */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[22px] font-light text-gray-400">Análise</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 text-gray-800 hover:text-gray-500 transition-colors"><ChevronLeft size={18} /></button>
          <span className="text-[14px] font-bold text-gray-800 capitalize tracking-wide">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 text-gray-800 hover:text-gray-500 transition-colors"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="flex bg-white shadow-sm border border-gray-50 p-1 rounded-full mb-6">
        <button className="flex-1 py-2 rounded-full text-[13px] font-bold bg-[#f4f6f8] text-gray-900 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)] transition-all">No mês</button>
        <button className="flex-1 py-2 rounded-full text-[13px] font-bold text-gray-400 transition-all">Novos gastos</button>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
      ) : (
        <>
          {/* Card Superior Resumo */}
          <div className="bg-white rounded-[24px] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-4 border border-gray-50">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-50">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <TrendingUp size={20} className="text-red-400" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-bold mb-0.5">Gastos do mês</p>
                <p className="text-xl font-bold text-gray-800">{formatCurrency(summary.expense)}</p>
              </div>
            </div>
            
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[11px] text-gray-400 font-medium mb-1">Categorias</p>
                <p className="text-[14px] font-bold text-gray-800">{byCategory.length}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium mb-1">Média</p>
                <p className="text-[14px] font-bold text-red-400">{formatCurrency(byCategory.length > 0 ? summary.expense / byCategory.length : 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400 font-medium mb-1">Maior peso</p>
                <p className="text-[13px] font-bold text-gray-800 truncate max-w-[100px]">{maiorCategoria?.name || '-'}</p>
                <span className="text-[11px] text-red-400 font-bold">{maiorPesoPorcentagem}%</span>
              </div>
            </div>
          </div>

          {/* Gráfico Donut e Lista */}
          <div className="bg-white px-5 pt-8 pb-6 rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-50">
            
            {byCategory.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-10">Nenhuma despesa neste mês.</p>
            ) : (
              <>
                <div className="h-56 mb-8 relative flex items-center justify-center">
                  {/* Texto Central do Gráfico */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Gasto</p>
                    <p className="text-[18px] font-bold text-gray-800">{formatCurrency(summary.expense)}</p>
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
                  <h3 className="font-bold text-[16px] text-gray-800">Gastos por categoria</h3>
                  <p className="text-[11px] text-gray-400 mt-1">Onde os gastos começaram a pesar</p>
                </div>

                <div className="space-y-5">
                  {byCategory.map(c => {
                    const percentage = summary.expense > 0 ? (c.total / summary.expense) * 100 : 0;
                    
                    return (
                      <div key={c.name} className="group cursor-pointer">
                        <div className="flex justify-between items-end mb-2">
                          <div className="flex items-center gap-3">
                            <div className="text-lg" style={{ color: c.color }}>{c.icon}</div>
                            <span className="font-bold text-[13px] text-gray-800">{c.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[14px] text-gray-800">{formatCurrency(c.total)}</span>
                            <div className="flex items-center gap-2 justify-end">
                              <p className="text-[10px] text-gray-400 font-bold">{percentage.toFixed(1)}%</p>
                              <ChevronRight size={14} className="text-gray-300" />
                            </div>
                          </div>
                        </div>
                        {/* Barra de Progresso */}
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
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
