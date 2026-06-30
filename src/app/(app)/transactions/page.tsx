'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import * as Icons from 'lucide-react'
import { 
  Search, SlidersHorizontal, ChevronLeft, ChevronRight, ReceiptText, Loader2, Clock, Check,
  ArrowLeftRight, Download
} from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Filter = 'all' | 'income' | 'expense' | 'transfer'
type StatusFilter = 'all' | 'pending' | 'done'
type Context = 'dfl' | 'personal'

const PAGE_SIZE = 20

const getDynamicIcon = (iconName: string) => {
  if (!iconName) return Icons.Tag
  const formattedName = iconName.charAt(0).toUpperCase() + iconName.slice(1)
  return (Icons as any)[formattedName] || Icons.Tag
}

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

// Componente visual para simular o carregamento (Skeleton)
const TransactionsSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {[1, 2].map((group) => (
      <div key={group}>
        <div className="h-3 bg-gray-200 dark:bg-slate-700/50 rounded w-24 mb-3 ml-1"></div>
        <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-50 dark:border-slate-700 overflow-hidden">
          {[1, 2, 3].map((item, idx) => (
            <div key={item} className={`px-4 py-4 flex items-center gap-3 ${idx !== 2 ? 'border-b border-gray-50 dark:border-slate-700' : ''}`}>
              <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-700/50"></div>
              <div className="w-10 h-10 rounded-[12px] bg-gray-100 dark:bg-slate-700/50"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-gray-100 dark:bg-slate-700/50 rounded w-3/4"></div>
                <div className="h-2.5 bg-gray-100 dark:bg-slate-700/50 rounded w-1/2"></div>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <div className="h-2.5 bg-gray-100 dark:bg-slate-700/50 rounded w-12"></div>
                <div className="h-3.5 bg-gray-100 dark:bg-slate-700/50 rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
)

export default function TransactionsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [context, setContext] = useState<Context>('dfl')
  const [transactions, setTransactions] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  
  // Referências para detectar o clique fora dos modais
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  // Lógica para fechar os modais ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const loadTransactions = useCallback(async (pageNum = 0, append = false) => {
    if (!user) return;
    
    if (pageNum === 0) setLoading(true)
    else setLoadingMore(true)

    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    let query = supabase
      .from('transactions')
      .select('*, categories(name, icon, color), accounts!account_id(name)', { count: 'exact' })
      .match({ user_id: user.id, context: context })
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }) // Garante que a transação adicionada por último fique no topo

    if (filter !== 'all') query = query.eq('type', filter)
    
    const { data, count, error } = await query
    
    if (error) {
      console.error("Erro na listagem de transações:", error)
    }
    
    const txs = Array.isArray(data) ? data : []

    if (append) {
      setTransactions(prev => [...prev, ...txs])
    } else {
      setTransactions(txs)
    }

    const totalLoaded = append ? (pageNum + 1) * PAGE_SIZE : txs.length
    setHasMore(count ? totalLoaded < count : txs.length === PAGE_SIZE)
    setLoading(false)
    setLoadingMore(false)
  }, [context, currentDate, filter, user])

  useEffect(() => {
    setPage(0)
    setHasMore(true)
    loadTransactions(0)
  }, [loadTransactions])

  // Infinite Scroll
  const handleScroll = useCallback(() => {
    if (loadingMore || !hasMore || loading) return
    
    const scrollY = window.scrollY
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight
    
    if (scrollY + windowHeight >= documentHeight - 200) {
      const nextPage = page + 1
      setPage(nextPage)
      loadTransactions(nextPage, true)
    }
  }, [page, hasMore, loadingMore, loading, loadTransactions])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

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

  const handleExport = (range: string) => {
    setShowExportMenu(false)
    if (!user) return
    window.open(`/api/export-transactions?userId=${user.id}&context=${context}&range=${range}`, '_blank')
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-24 font-sans relative transition-colors duration-300">
      <div className="px-4 pt-6 pb-4 bg-[#f8f9fa] dark:bg-slate-900 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[22px] font-bold text-gray-800 dark:text-gray-100">Transações</h1>
          <div className="flex items-center gap-2">
            
            {/* Menu de Exportação com Ref para detectar clique fora */}
            <div className="relative" ref={exportMenuRef}>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="w-9 h-9 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 rounded-full flex items-center justify-center transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                <Download size={18} className="text-gray-700 dark:text-gray-300" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-[42px] w-40 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-2 z-30 animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 py-2">Exportar extrato</p>
                  {[{ key: '7', label: '7 dias' }, { key: '14', label: '14 dias' }, { key: '30', label: '30 dias' }, { key: 'total', label: 'Todo período' }].map(opt => (
                    <button key={opt.key} onClick={() => handleExport(opt.key)} className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700">{opt.label}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 px-3 py-1.5 rounded-full">
              <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"><ChevronLeft size={18} /></button>
              <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 capitalize w-24 text-center">{monthLabel}</span>
              <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>

        <div className="flex bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 p-1 rounded-full mb-5">
          {(['dfl', 'personal'] as Context[]).map(c => (
            <button key={c} onClick={() => setContext(c)}
              className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all ${context === c ? 'bg-[#f4f6f8] dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-400 dark:text-gray-500'}`}>
              {c === 'dfl' ? 'Empresa' : 'Pessoal'}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-4 relative">
          <div className="flex-1 flex items-center gap-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[16px] px-4 py-3 shadow-sm">
            <Search size={18} className="text-gray-400 dark:text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar transação..."
              className="flex-1 bg-transparent text-[14px] outline-none text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-500 font-medium" />
          </div>
          
          {/* Menu de Status com Ref para detectar clique fora */}
          <div className="relative" ref={statusMenuRef}>
            <button 
              onClick={() => setShowStatusMenu(!showStatusMenu)} 
              className={`w-[48px] h-[48px] rounded-[16px] flex items-center justify-center transition-colors shadow-sm border ${showStatusMenu || statusFilter !== 'all' ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-400' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
            >
              <SlidersHorizontal size={20} />
            </button>

            {showStatusMenu && (
              <div className="absolute right-0 top-[54px] w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-2 z-30 animate-in fade-in zoom-in-95 duration-200">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 py-2">Filtrar por Status</p>
                <button onClick={() => { setStatusFilter('all'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'all' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Todas</button>
                <button onClick={() => { setStatusFilter('pending'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'pending' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Pendentes</button>
                <button onClick={() => { setStatusFilter('done'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'done' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Efetivadas</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border ${filter === f.key ? 'bg-teal-700 text-white border-teal-700 shadow-md' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4">
        {loading ? (
          <TransactionsSkeleton />
        ) : filtered.length === 0 && !loadingMore ? (
          <div className="flex flex-col items-center py-20 text-gray-400 dark:text-gray-500 animate-in fade-in duration-300">
            <ReceiptText size={48} className="mb-4 opacity-20" />
            <p className="text-[15px] font-bold text-gray-500 dark:text-gray-400">Nenhuma transação</p>
            <p className="text-[13px] mt-1">Nenhum resultado encontrado.</p>
          </div>
        ) : (
          <>
            <div className="space-y-6 animate-in fade-in duration-300">
              {sortedDates.map(date => (
                <div key={date}>
                  <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 mb-3 px-1 tracking-wide">{dateLabel(date)}</p>
                  <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none border border-gray-50 dark:border-slate-700 overflow-hidden">
                    {grouped[date].map((t, index) => {
                      const isTransferIn = t.type === 'transfer' && t.description?.includes('de ');
                      const isIncomeVisual = t.type === 'income' || isTransferIn;
                      const isPending = t.status === 'pending';
                      
                      const IconComp = t.type === 'transfer' ? ArrowLeftRight : getDynamicIcon(t.categories?.icon)
                      
                      return (
                        <div 
                          key={t.id} 
                          onClick={() => router.push(`/transactions/${t.id}`)}
                          className={`px-4 py-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${index !== grouped[date].length - 1 ? 'border-b border-gray-50 dark:border-slate-700' : ''}`}
                        >
                          {isPending ? (
                            <div className="w-5 h-5 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                              <Clock size={12} className="text-red-400" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                              <Check size={12} className="text-emerald-500" />
                            </div>
                          )}

                          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: t.categories?.color ? `${t.categories.color}20` : '#f3f4f6', color: t.categories?.color || '#64748b' }}>
                            <IconComp size={18} />
                          </div>
                          
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate uppercase tracking-tight">{t.description ?? t.categories?.name ?? 'Sem descrição'}</p>
                            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 truncate">{t.categories?.name ?? 'Geral'} • {t.accounts?.name ?? ''}</p>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 mb-1">
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

            {/* Indicador de Infinite Scroll */}
            {loadingMore && (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-teal-700" size={24} />
              </div>
            )}
            {!hasMore && filtered.length > 0 && (
              <p className="text-center text-xs font-medium text-gray-400 py-6">Todas as transações carregadas</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
