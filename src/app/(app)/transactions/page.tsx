'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import * as Icons from 'lucide-react'
import { 
  Search, SlidersHorizontal, ChevronLeft, ChevronRight, ReceiptText, Loader2, 
  ArrowLeftRight, Download, ArrowDown, ArrowUp, Layers, RefreshCw, Clock, ChevronDown
} from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import BankLogo from '@/components/BankLogo'
import { useScrollPosition } from '@/hooks/useScrollPosition'
import { TransactionItem } from '@/components/transactions/TransactionItem'

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

function PendingCard({ txs, loading }: { txs: any[]; loading: boolean }) {
  const [collapsed, setCollapsed] = useState(false)

  if (loading) {
    return (
      <div className="mb-6 animate-pulse">
        <div className="h-[60px] bg-amber-100/60 dark:bg-amber-900/20 rounded-[20px]" />
      </div>
    )
  }

  if (txs.length === 0) return null

  const totalExpense = txs
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + safeNum(t.amount), 0)
  const totalIncome = txs
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + safeNum(t.amount), 0)

  const fmt = (v: number) =>
    `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="mb-6">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-[20px] mb-1 transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center">
            <Clock size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-[13px] font-bold text-amber-800 dark:text-amber-300 leading-tight">
              {txs.length} {txs.length === 1 ? 'transação pendente' : 'transações pendentes'}
            </p>
            <p className="text-[11px] font-medium mt-0.5">
              {totalExpense > 0 && (
                <span className="text-red-500 dark:text-red-400">−{fmt(totalExpense)}</span>
              )}
              {totalExpense > 0 && totalIncome > 0 && (
                <span className="text-gray-300 mx-1">·</span>
              )}
              {totalIncome > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">+{fmt(totalIncome)}</span>
              )}
            </p>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`text-amber-500 dark:text-amber-400 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {!collapsed && (
        <div className="bg-white dark:bg-slate-800 rounded-[20px] border border-amber-100 dark:border-amber-900/40 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          {txs.map((t, index) => (
            <TransactionItem
              key={t.id}
              transaction={t}
              index={index}
              totalItems={txs.length}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TransactionsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { context, appMode } = useContext_()
  const [transactions, setTransactions] = useState<any[]>([])
  const [pendingTxs, setPendingTxs] = useState<any[]>([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loadingPulse, setLoadingPulse] = useState(false)

  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const exportMenuRef = useRef<HTMLDivElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const { scrollY, windowHeight, documentHeight } = useScrollPosition()

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

  const loadPending = useCallback(async () => {
    if (!user) return
    setLoadingPending(true)
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('transactions')
      .select('*, categories(name, icon, color), accounts!account_id(name, color)')
      .match({ user_id: user.id, context: context, status: 'pending' })
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    setPendingTxs(Array.isArray(data) ? data : [])
    setLoadingPending(false)
  }, [user, context, currentDate])

  const loadTransactions = useCallback(async (pageNum = 0, append = false) => {
    if (!user) return;

    if (pageNum === 0) setLoading(true)
    else setLoadingMore(true)
    setLoadingPulse(true)

    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    let query = supabase
      .from('transactions')
      .select('*, categories(name, icon, color), accounts!account_id(name, color)', { count: 'exact' })
      .match({ user_id: user.id, context: context })
      .gte('date', start)
      .lte('date', end)
      .order('status', { ascending: true })
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

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
    setLoadingPulse(false)
  }, [context, currentDate, filter, user])

  useEffect(() => {
    setPage(0)
    setHasMore(true)
    loadTransactions(0)
    loadPending()
  }, [loadTransactions, loadPending])

  useEffect(() => {
    if (loadingMore || !hasMore || loading) return
    if (scrollY + windowHeight >= documentHeight - 200) {
      const nextPage = page + 1
      setPage(nextPage)
      loadTransactions(nextPage, true)
    }
  }, [scrollY, windowHeight, documentHeight, page, hasMore, loadingMore, loading, loadTransactions])

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

  const filters: { key: Filter; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'Todas', icon: <Layers size={14} /> },
    { key: 'income', label: 'Receitas', icon: <ArrowUp size={14} /> },
    { key: 'expense', label: 'Despesas', icon: <ArrowDown size={14} /> },
    { key: 'transfer', label: 'Transferências', icon: <ArrowLeftRight size={14} /> },
  ]

  const handleExport = (range: string) => {
    setShowExportMenu(false)
    if (!user) return
    window.open(`/api/export-transactions?userId=${user.id}&context=${context}&range=${range}`, '_blank')
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-24 font-sans relative transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {/* ── HEADER STICKY COMPACTO E SEGURO (CORRIGIDO) ── */}
      {/* pt-7 garante isolamento do topo do celular e mb-0 limpa o espaçamento fantasma */}
      <div className="sticky top-0 z-30 bg-[#f8f9fa] dark:bg-slate-900 pt-7 pb-2 px-4 mb-0 border-b border-gray-100/20 dark:border-slate-800/20">
        
        {/* Compactamos as margens inferiores de mb-6 para mb-3 */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[22px] font-bold text-gray-800 dark:text-gray-100">Transações</h1>
          <div className="flex items-center gap-2">
            <div className="relative" ref={exportMenuRef}>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="w-9 h-9 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 rounded-full flex items-center justify-center transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                <Download size={18} className="text-gray-700 dark:text-gray-300" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-[42px] w-40 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-2 z-40 animate-in fade-in zoom-in-95 duration-200">
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

        {/* O alternador de contexto agora fica colado na estrutura sem empurrar a página */}
        <div className="mb-3">
          <ContextToggle />
        </div>

        {/* Compactamos de mb-4 para mb-3 */}
        <div className="flex gap-2 mb-3 relative">
          <div className="flex-1 flex items-center gap-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[16px] px-4 py-3 shadow-sm">
            <Search size={18} className="text-gray-400 dark:text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar transação..."
              className="flex-1 bg-transparent text-[14px] outline-none text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-500 font-medium" />
          </div>

          <div className="relative" ref={statusMenuRef}>
            <button 
              onClick={() => setShowStatusMenu(!showStatusMenu)} 
              className={`w-[48px] h-[48px] rounded-[16px] flex items-center justify-center transition-colors shadow-sm border ${showStatusMenu || statusFilter !== 'all' ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-400' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
            >
              <SlidersHorizontal size={20} />
            </button>

            {showStatusMenu && (
              <div className="absolute right-0 top-[54px] w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-2 z-40 animate-in fade-in zoom-in-95 duration-200">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 py-2">Filtrar por Status</p>
                <button onClick={() => { setStatusFilter('all'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'all' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Todas</button>
                <button onClick={() => { setStatusFilter('pending'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'pending' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Pendentes</button>
                <button onClick={() => { setStatusFilter('done'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'done' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Efetivadas</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${filter === f.key ? 'bg-teal-700 text-white border-teal-700 shadow-md' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTEÚDO DA LISTA COM ESPAÇAMENTO REAJUSTADO ── */}
      {/* mt-3 traz os cards para perto do cabeçalho de forma harmônica */}
      <div className="px-4 mt-3">
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
            {statusFilter !== 'pending' && (
              <PendingCard txs={pendingTxs} loading={loadingPending} />
            )}

            <div className="space-y-6 animate-in fade-in duration-300">
              {sortedDates.map(date => (
                <div key={date}>
                  <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 mb-3 px-1 tracking-wide">{dateLabel(date)}</p>
                  <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none border border-gray-50 dark:border-slate-700 overflow-hidden">
                    {grouped[date].map((t, index) => (
                      <TransactionItem
                        key={t.id}
                        transaction={t}
                        index={index}
                        totalItems={grouped[date].length}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

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
