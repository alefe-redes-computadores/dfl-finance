'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, ReceiptText } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Filter = 'all' | 'income' | 'expense' | 'transfer'
type Context = 'dfl' | 'personal'

function groupByDate(transactions: any[]) {
  const groups: Record<string, any[]> = {}
  transactions.forEach(t => {
    const key = t.date
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })
  return groups
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "d 'de' MMMM", { locale: ptBR })
}

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
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    let query = supabase
      .from('transactions')
      .select('*, categories(name, icon, color), accounts(name)')
      .eq('user_id', user.id)
      .eq('context', context)
      .gte('date', start).lte('date', end)
      .order('date', { ascending: false })

    if (filter !== 'all') query = query.eq('type', filter)
    const { data } = await query
    setTransactions(data ?? [])
    setLoading(false)
  }, [user, context, currentDate, filter])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  const filtered = transactions.filter(t =>
    t.description?.toLowerCase().includes(search.toLowerCase()) ||
    t.categories?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = groupByDate(filtered)
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'income', label: 'Receitas' },
    { key: 'expense', label: 'Despesas' },
    { key: 'transfer', label: 'Transferências' },
  ]

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-28 font-sans">
      <div className="px-4 pt-6 pb-4 bg-white shadow-sm mb-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Transações</h1>
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft size={16} className="text-gray-500" /></button>
            <span className="text-xs font-bold text-gray-700 capitalize">{monthLabel}</span>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight size={16} className="text-gray-500" /></button>
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-full mb-3">
          {(['dfl', 'personal'] as Context[]).map(c => (
            <button key={c} onClick={() => setContext(c)}
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${context === c ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-3">
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
            <Search size={16} className="text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar transação..."
              className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400" />
          </div>
          <button className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <SlidersHorizontal size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filter === f.key ? 'bg-teal-800 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2">
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <ReceiptText size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">Nenhuma transação neste período</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDates.map(date => (
              <div key={date}>
                <p className="text-xs font-bold text-gray-400 uppercase mb-2 px-1">{dateLabel(date)}</p>
                <div className="space-y-2">
                  {grouped[date].map(t => (
                    <div key={t.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
                        style={{ backgroundColor: t.categories?.color ? `${t.categories.color}20` : '#f3f4f6' }}>
                        {t.categories?.icon ?? (t.type === 'income' ? '💰' : t.type === 'transfer' ? '🔄' : '💸')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{t.description ?? t.categories?.name ?? 'Sem descrição'}</p>
                        <p className="text-xs text-gray-400">{t.categories?.name ?? 'Outros'} • {t.accounts?.name ?? ''}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${t.type === 'income' ? 'text-teal-600' : t.type === 'expense' ? 'text-red-500' : 'text-gray-700'}`}>
                          {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''} R$ {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-gray-400">{t.status === 'done' ? '✅' : '⏳'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}