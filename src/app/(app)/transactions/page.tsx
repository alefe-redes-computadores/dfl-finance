'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, ReceiptText, Loader2 } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Filter = 'all' | 'income' | 'expense' | 'transfer'
type Context = 'dfl' | 'personal'

// Anti-NaN para garantir que os valores sempre sejam números válidos
const safeNum = (val: any) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
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

  // Checa a URL para filtros
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const queryFilter = params.get('filter') as Filter
      if (queryFilter && ['all', 'income', 'expense', 'transfer'].includes(queryFilter)) {
        setFilter(queryFilter)
      }
    }
  }, [])

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    let query = supabase
      .from('transactions')
      .select('*, categories(name, icon, color), accounts(name)')
      .eq('context', context)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    if (filter !== 'all') query = query.eq('type', filter)
    
    const { data, error } = await query
    
    if (error) {
      console.error("Erro na listagem de transações:", error)
      alert("Erro ao carregar transações: " + error.message)
    }
    
    setTransactions(data ?? [])
    setLoading(false)
  }, [context, currentDate, filter])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  // FILTRO BLINDADO CONTRA ERROS DE NULO (Causa principal do Bug)
  const filtered = transactions.filter(t => {
    if (!search) return true; // Se não estiver pesquisando nada, mostra tudo
    
    const desc = String(t.description || '').toLowerCase();
    const cat = String(t.categories?.name || '').toLowerCase();
    const term = search.toLowerCase();
    
    return desc.includes(term) || cat.includes(term);
  })

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
          <h1 className="text-xl font-bold text-gray-900">Transações</h1>
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="text-gray-500 hover:text-gray-800 transition-colors"><ChevronLeft size={16} /></button>
            <span className="text-xs font-bold text-gray-700 capitalize w-20 text-center">{monthLabel}</span>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="text-gray-500 hover:text-gray-800 transition-colors"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-full mb-3">
          {(['dfl', 'personal'] as Context[]).map(c => (
            <button key={c} onClick={() => setContext(c)}
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${context === c ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
              {c === 'dfl' ? 'Empresa' : 'Pessoal'}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-3">
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-[16px] px-4 py-3">
            <Search size={18} className="text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar transação..."
              className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400" />
          </div>
          <button className="w-[48px] h-[48px] bg-gray-100 rounded-[16px] flex items-center justify-center hover:bg-gray-200 transition-colors">
            <SlidersHorizontal size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filter === f.key ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <ReceiptText size={56} className="mb-4 opacity-20" />
            <p className="text-[15px] font-bold text-gray-500">Nenhuma transação</p>
            <p className="text-xs mt-1">Neste mês e contexto.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDates.map(date => (
              <div key={date}>
                <p className="text-[11px] font-bold text-gray-400 uppercase mb-2 px-1 tracking-wider">{dateLabel(date)}</p>
                <div className="space-y-2">
                  {grouped[date].map(t => {
                    const isTransferIn = t.type === 'transfer' && t.description?.includes('de ');
                    const isIncomeVisual = t.type === 'income' || isTransferIn;
                    
                    return (
                      <div 
                        key={t.id} 
                        onClick={() => router.push(`/transactions/${t.id}`)}
                        className="bg-white rounded-[20px] px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-11 h-11 rounded-[14px] flex items-center justify-center text-xl"
                          style={{ backgroundColor: t.categories?.color ? `${t.categories.color}20` : '#f3f4f6' }}>
                          {t.type === 'transfer' ? '🔄' : (t.categories?.icon ?? (t.type === 'income' ? '💰' : '💸'))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate uppercase tracking-tight">{t.description ?? t.categories?.name ?? 'Sem descrição'}</p>
                          <p className="text-[11px] font-medium text-gray-400 mt-0.5 truncate">{t.categories?.name ?? 'Geral'} • {t.accounts?.name ?? ''}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-[14px] font-bold ${isIncomeVisual ? 'text-emerald-600' : 'text-gray-800'}`}>
                            {isIncomeVisual ? '+' : '-'} R$ {safeNum(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{t.status === 'done' ? '✅ Pago' : '⏳ Pendente'}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
