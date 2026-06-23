'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
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
        color: t.categories?.color ?? '#94a3b8',
        icon: t.categories?.icon ?? '📦',
        total: 0
      }
      catMap[key].total += Number(t.amount)
    })
    setByCategory(Object.values(catMap).sort((a, b) => b.total - a.total))

    setLoading(false)
  }, [user, context, currentDate])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f4f6f8] pb-28 font-sans px-4 pt-4">
      
      <div className="flex justify-between items-center mb-6">
        <ContextToggle />
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 text-gray-400 hover:text-gray-600">
            <ChevronLeft size={20} />
          </button>
          <span className="text-[15px] font-bold text-gray-800 capitalize tracking-wide">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 text-gray-400 hover:text-gray-600">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Receitas</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.income)}</p>
            </div>
            <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Despesas</p>
              <p className="text-lg font-bold text-red-500">{formatCurrency(summary.expense)}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-sm mb-6 border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 text-center">Despesas por Categoria</h3>
            
            {byCategory.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-10">Nenhuma despesa neste mês.</p>
            ) : (
              <>
                <div className="h-64 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={byCategory} 
                        dataKey="total" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={60} 
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {byCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="space-y-3">
                  {byCategory.map(c => (
                    <div key={c.name} className="flex justify-between items-center text-sm p-2 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{backgroundColor: `${c.color}20`}}>
                          {c.icon}
                        </div>
                        <span className="font-bold text-gray-800">{c.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-gray-800">R$ {c.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                        <p className="text-[10px] text-gray-400 font-bold">{((c.total / summary.expense) * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
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
