'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, ReceiptText } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Filter = 'all' | 'income' | 'expense' | 'transfer'
type Context = 'dfl' | 'personal'

// Anti-NaN
const safeNum = (val: any) => {
  if (!val) return 0;
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g,""));
  return isNaN(parsed) ? 0 : parsed;
}

function groupByDate(transactions: any[]) {
  const groups: Record<string, any[]> = {}
  transactions.forEach(t => {
    const key = t.date || 'Sem Data'
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })
  return groups
}

function dateLabel(dateStr: string) {
  if (dateStr === 'Sem Data') return dateStr;
  const d = new Date(dateStr + 'T12:00:00')
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "d 'de' MMMM", { locale: ptBR })
}

export default function TransactionsPage() {
  const router = useRouter()
  const [context, setContext] = useState<Context>('dfl')
  const [transactions, setTransactions] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    
    // REMOVI OS FILTROS DE DATA E CONTEXTO. 
    // Isso vai trazer TODAS as transações do banco para garantir que elas existam.
    let query = supabase
      .from('transactions')
      .select('*, categories(name, icon, color), accounts(name)')
      .order('date', { ascending: false })
      .limit(50) // Traz as últimas 50, independente de quando foram

    if (filter !== 'all') query = query.eq('type', filter)
    
    const { data, error } = await query
    
    if (error) {
      console.error("Erro listagem:", error)
      alert("Erro transações: " + error.message)
    }
    
    setTransactions(data ?? [])
    setLoading(false)
  }, [filter])

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
    <div className="page-transition max-w-md mx-auto min-h-screen bg-[#f8f9fa] pb-24">
      <div className="px-4 pt-6 pb-4 bg-white shadow-sm mb-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Transações (Buscando Tudo)</h1>
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
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-teal-700" size={24} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <ReceiptText size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">Nenhuma transação salva no banco.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDates.map(date => (
              <div key={date}>
                <p className="text-[11px] font-bold text-gray-400 uppercase mb-2 px-1 tracking-wider">{dateLabel(date)}</p>
                <div className="space-y-2">
                  {grouped[date].map(t => (
                    <div key={t.id} onClick={() => router.push(`/transactions/${t.id}`)} className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-3 cursor-pointer">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl" style={{ backgroundColor: t.categories?.color ? `${t.categories.color}20` : '#f3f4f6' }}>
                        {t.categories?.icon ?? (t.type === 'income' ? '💰' : t.type === 'transfer' ? '🔄' : '💸')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate uppercase tracking-tight">{t.description ?? t.categories?.name ?? 'Sem descrição'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{t.categories?.name ?? 'Outros'} • {t.accounts?.name ?? ''}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-[14px] font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-gray-700'}`}>
                          {t.type === 'income' ? '+' : '-'} R$ {safeNum(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
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
