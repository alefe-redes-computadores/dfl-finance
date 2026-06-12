'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ContextProvider, useContext_ } from '@/components/ContextToggle'

type Filter = 'all' | 'income' | 'expense' | 'transfer'

function TransactionsContent() {
  const { user } = useAuth()
  const { context } = useContext_()
  const [transactions, setTransactions] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })
  const monthLabel2 = format(currentDate, 'yyyy-MM')

  useEffect(() => {
    if (!user) return
    loadTransactions()
  }, [user, context, currentDate, filter])

  async function loadTransactions() {
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('user_id', user!.uid)
      .eq('context', context)
      .gte('date', `${monthLabel2}-01`)
      .lte('date', `${monthLabel2}-31`)
      .order('date', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('type', filter)
    }

    const { data } = await query
    setTransactions(data ?? [])
    setLoading(false)
  }

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
    <div className="max-w-lg mx-auto px-4 pt-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Transações</h1>
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

      {/* Busca */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2.5 shadow-sm">
          <Search size={16} className="text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar transação..."
            className="flex-1 bg-transparent text-sm outline-none text-gray-800 dark:text-white placeholder-gray-400"
          />
        </div>
        <button className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm">
          <SlidersHorizontal size={16} className="text-gray-500" />
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
              filter === f.key
                ? 'bg-brand-teal text-white border-brand-teal'
                : 'bg-white dark:bg-zinc-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-zinc-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <span className="text-4xl mb-3">📋</span>
          <p className="text-sm font-medium">Nenhuma transação encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} className="bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ backgroundColor: t.categories?.color ? `${t.categories.color}20` : '#f3f4f6' }}
              >
                {t.categories?.icon ?? (t.type === 'income' ? '💰' : t.type === 'sangria' ? '🔻' : '💸')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                  {t.description ?? t.categories?.name ?? '—'}
                </p>
                <p className="text-xs text-gray-400">
                  {t.categories?.name ?? '—'} • {format(new Date(t.date + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}
                </p>
              </div>
              <p className={`text-sm font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                {t.type === 'income' ? '+' : '-'} R$ {Number(t.amount).toFixed(2).replace('.', ',')}
              </p>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

export default function TransactionsPage() {
  return (
    <ContextProvider>
      <TransactionsContent />
    </ContextProvider>
  )
}
