'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, ReceiptText, Loader2, Clock, Check } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Filter = 'all' | 'income' | 'expense' | 'transfer'
type StatusFilter = 'all' | 'pending' | 'done'
type Context = 'dfl' | 'personal'

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
  if (isToday(d)) return 'HOJE'
  if (isYesterday(d)) return 'ONTEM'
  return format(d, "dd 'DE' MMMM", { locale: ptBR }).toUpperCase()
}

export default function TransactionsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [context, setContext] = useState<Context>('dfl')
  const [transactions, setTransactions] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

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
    if (!user) return;
    setLoading(true)
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    let query = supabase
      .from('transactions')
      .select('*, categories(name, icon, color), accounts!account_id(name)')
      .match({ user_id: user.id, context: context })
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    if (filter !== 'all') query = query.eq('type', filter)
    
    const { data, error } = await query
    
    if (error) {
      console.error("Erro na listagem de transações:", error)
    }
    
    setTransactions(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [context, currentDate, filter, user])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  const filtered = transactions.filter(t => {
    let matchSearch = true;
    if (search) {
      const desc = String(t.description || '').toLowerCase();
      const cat = String(t.categories?.name || '').toLowerCase();
      const term = search.toLowerCase();
      matchSearch = desc.includes(term) || cat.includes(term);
    }

    let matchStatus = true;
    if (statusFilter !== 'all') {
      matchStatus = t.status === statusFilter;
    }

    return matchSearch && matchStatus;
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
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] pb-24 font-sans relative">
      <div className="px-4 pt-6 pb-4 bg-[#f8f9fa] sticky top-0 z-20">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[22px] font-bold text-gray-800">Transações</h1>
          <div className="flex items-center gap-3 bg-white shadow-sm border border-gray-50 px-3 py-1.5 rounded-full">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="text-gray-400 hover:text-gray-800 transition-colors"><ChevronLeft size={18} /></button>
            <span className="text-[13px] font-bold text-gray-800 capitalize w-24 text-center">{monthLabel}</span>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="text-gray-400 hover:text-gray-800 transition-colors"><ChevronRight size={18} /></button>
          </div>
        </div>

        {/* Seletor DFL / Pessoal */}
        <div className="flex bg-white shadow-sm border border-gray-50 p-1 rounded-full mb-5">
          {(['dfl', 'personal'] as Context[]).map(c => (
            <button key={c} onClick={() => setContext(c)}
              className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all ${context === c ? 'bg-[#f4f6f8] text-gray-900 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-400'}`}>
              {c === 'dfl' ? 'Empresa' : 'Pessoal'}
            </button>
          ))}
        </div>

        {/* Busca e Filtro de Status */}
        <div className="flex gap-2 mb-4 relative">
          <div className="flex-1 flex items-center gap-3 bg-white border border-gray-100 rounded-[16px] px-4 py-3 shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar transação..."
              className="flex-1 bg-transparent text-[14px] outline-none text-gray-800 placeholder-gray-300 font-medium" />
          </div>
          
          <button 
            onClick={() => setShowStatusMenu(!showStatusMenu)} 
            className={`w-[48px] h-[48px] rounded-[16px] flex items-center justify-center transition-colors shadow-sm border ${showStatusMenu || statusFilter !== 'all' ? 'bg-teal-50 border-teal-100 text-teal-700' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}`}
          >
            <SlidersHorizontal size={20} />
          </button>

          {/* Menu de Filtro de Status */}
          {showStatusMenu && (
            <div className="absolute right-0 top-[54px] w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-30 animate-in fade-in zoom-in-95 duration-200">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2">Filtrar por Status</p>
              <button onClick={() => { setStatusFilter('all'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'all' ? 'bg-teal-50 text-teal-700' : 'text-gray-700 hover:bg-gray-50'}`}>Todas</button>
              <button onClick={() => { setStatusFilter('pending'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'pending' ? 'bg-teal-50 text-teal-700' : 'text-gray-700 hover:bg-gray-50'}`}>Pendentes</button>
              <button onClick={() => { setStatusFilter('done'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'done' ? 'bg-teal-50 text-teal-700' : 'text-gray-700 hover:bg-gray-50'}`}>Efetivadas</button>
            </div>
          )}
        </div>

        {/* Filtros de Tipo */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border ${filter === f.key ? 'bg-teal-700 text-white border-teal-700 shadow-md' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="px-4">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400">
            <ReceiptText size={48} className="mb-4 opacity-20" />
            <p className="text-[15px] font-bold text-gray-500">Nenhuma transação</p>
            <p className="text-[13px] mt-1">Nenhum resultado encontrado.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(date => (
              <div key={date}>
                <p className="text-[12px] font-bold text-gray-400 mb-3 px-1 tracking-wide">{dateLabel(date)}</p>
                <div className="bg-white rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-50 overflow-hidden">
                  {grouped[date].map((t, index) => {
                    const isTransferIn = t.type === 'transfer' && t.description?.includes('de ');
                    const isIncomeVisual = t.type === 'income' || isTransferIn;
                    const isPending = t.status === 'pending';
                    
                    return (
                      <div 
                        key={t.id} 
                        onClick={() => router.push(`/transactions/${t.id}`)}
                        className={`px-4 py-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${index !== grouped[date].length - 1 ? 'border-b border-gray-50' : ''}`}
                      >
                        {/* Ícone de Status Circular */}
                        {isPending ? (
                          <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                            <Clock size={12} className="text-red-400" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <Check size={12} className="text-emerald-500" />
                          </div>
                        )}

                        {/* Ícone da Categoria */}
                        <div className="w-10 h-10 rounded-[12px] flex items-center justify-center text-[18px] flex-shrink-0"
                          style={{ backgroundColor: t.categories?.color ? `${t.categories.color}20` : '#f3f4f6' }}>
                          {t.type === 'transfer' ? '🔄' : (t.categories?.icon ?? (t.type === 'income' ? '💰' : '💸'))}
                        </div>
                        
                        {/* Textos da Esquerda */}
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-[14px] font-bold text-gray-800 truncate uppercase tracking-tight">{t.description ?? t.categories?.name ?? 'Sem descrição'}</p>
                          <p className="text-[11px] font-medium text-gray-400 mt-0.5 truncate">{t.categories?.name ?? 'Geral'} • {t.accounts?.name ?? ''}</p>
                        </div>

                        {/* Textos da Direita (Data e Valor) */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] font-bold text-gray-300 mb-1">
                            {format(new Date(t.date), "dd 'de' MMM", { locale: ptBR })}
                          </p>
                          <p className={`text-[14px] font-bold whitespace-nowrap ${isIncomeVisual ? 'text-emerald-600' : 'text-red-500'}`}>
                            {isIncomeVisual ? '+' : '-'} R$ {safeNum(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
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