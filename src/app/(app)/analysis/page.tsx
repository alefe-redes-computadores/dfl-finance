'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { ContextProvider, useContext_ } from '@/components/ContextToggle' // Importando seu contexto

function AnalysisContent() {
  const { user } = useAuth()
  const { context } = useContext_() // Usando o contexto global
  const [currentDate, setCurrentDate] = useState(new Date())
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

    // Busca filtrada estritamente pelo contexto
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

    // Processamento de categorias
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

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-28 font-sans">
      {/* ... (resto do seu layout de análise) ... */}
    </div>
  )
}

export default function AnalysisPage() {
  return <ContextProvider><AnalysisContent /></ContextProvider>
}
