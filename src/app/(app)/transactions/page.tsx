'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, ReceiptText } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Filter = 'all' | 'income' | 'expense' | 'transfer'
type Context = 'dfl' | 'personal'

export default function TransactionsPage() {
  const { user } = useAuth()
  
  const [context, setContext] = useState<Context>('dfl')
  const [transactions, setTransactions] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const loadTransactions = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    
    // Calcula o primeiro e último dia do mês exato para evitar bugs em fevereiro/meses com 30 dias
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    let query = supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('user_id', user.id)
      .eq('context', context)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('type', filter)
    }

    const { data, error } = await query
    if (error) console.error(error)
    
    setTransactions(data ?? [])
    setLoading(false)
  }, [user, context, currentDate, filter])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  const filtered = transactions.filter(t =>
    t.description?.toLowerCase().includes(search.toLowerCase()) ||
    t.categories?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'income', label: 'Receitas' },
    { key: 'expense', label: 'Despesas' },
    { key: 'transfer', label: 'Transferências' },
  ]

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 px-4 pt-6 pb-28 font-sans">

      {/* Header com Navegação de Meses */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Transações</h1>
        <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft size={18} className="text-gray-500 hover:text-emerald-700" />
          </button>
          <span className="text-xs font-bold text-gray-700 capitalize w-24 text-center">
            {monthLabel}
          </span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight size={18} className="text-gray-500 hover:text-emerald-700" />
          </button>
        </div>
      </div>

      {/* Contexto DFL / Pessoal */}
      <div className="flex bg-gray-200 rounded-full p-1 mb-4">
        <button 
          onClick={() => setContext('dfl')}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${context === 'dfl' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          DFL
        </button>
        <button 
          onClick={() => setContext('personal')}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${context === 'personal' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          Pessoal
        </button>
      </div>

      {/* Busca e Filtros */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
          <Search size={18} className="text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar transação..."
            className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400"
          />
        </div>
        <button className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100">
          <SlidersHorizontal size={18} className="text-gray-500" />
        </button>
      </div>

      {/* Chips de Filtro */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              filter === f.key
                ? 'bg-emerald-900 text-white shadow-md'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista de Transações */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-emerald-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <ReceiptText size={48} className="mb-4 opacity-20" />
          <p className="text-sm font-medium">Nenhuma transação neste período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm"
                style={{ backgroundColor: t.categories?.color ? `${t.categories.color}20` : '#f3f4f6' }}
              >
                {t.categories?.icon ?? (t.type === 'income' ? '💰' : t.type === 'transfer' ? '🔄' : '💸')}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">
                  {t.description ?? t.categories?.name ?? 'Sem descrição'}
                </p>
                <p className="text-xs text-gray-500 font-medium">
                  {t.categories?.name ?? 'Outros'} • {format(new Date(t.date + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}
                </p>
              </div>
              
              <div className="text-right">
                <p className={`text-sm font-bold ${
                  t.type === 'income' ? 'text-emerald-600' : 
                  t.type === 'expense' ? 'text-red-600' : 
                  'text-gray-700'
                }`}>
                  {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''} R$ {Number(t.amount).toFixed(2).replace('.', ',')}
                </p>
                <p className="text-[10px] font-semibold text-gray-400 uppercase mt-0.5">
                  {t.status === 'done' ? '✅ Pago' : '⏳ Pend.'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
