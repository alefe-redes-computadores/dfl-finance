'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { 
  Search, SlidersHorizontal, ChevronLeft, ChevronRight, ReceiptText, Loader2, 
  ArrowLeftRight, Download, ArrowDown, ArrowUp, Layers, Clock, ChevronDown,
  Check, Image as ImageIcon, Paperclip, CheckCircle, X, SortDesc, SortAsc
} from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { db } from '@/lib/db'
import { useSafeDb } from '@/hooks/useSafeDb'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { exportTransactionsToCSV, downloadCSV } from '@/lib/services/exportService'

type QuickFilter = 'all' | 'income' | 'expense' | 'transfer' | 'pending'

interface AdvFilters {
  accountId: string;
  categoryId: string;
  minAmount: string;
  maxAmount: string;
  sortBy: 'date' | 'amount' | 'category';
  sortOrder: 'asc' | 'desc';
  searchNotes: boolean;
}

const defaultAdvFilters: AdvFilters = {
  accountId: '', categoryId: '', minAmount: '', maxAmount: '', sortBy: 'date', sortOrder: 'desc', searchNotes: false
}

const safeNum = (val: any) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g,""));
  return isNaN(parsed) ? 0 : parsed;
}

const getAttachmentIcon = (url: string | null) => {
  if (!url) return null;
  const isDocument = /\.(pdf|doc|docx|xls|xlsx|csv|txt)(\?|$)/i.test(url.toLowerCase());
  if (isDocument) return <Paperclip size={12} className="text-gray-400 shrink-0" />;
  return <ImageIcon size={12} className="text-blue-400 shrink-0" />;
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

function formatCurrency(val: number) {
  return `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const TransactionsSkeleton = () => (
  <div className="space-y-8 animate-pulse pt-4">
    {[1, 2].map((group) => (
      <div key={group}>
        <div className="h-3 bg-gray-200 dark:bg-slate-700/50 rounded-full w-24 mb-4 ml-2"></div>
        <div className="bg-white dark:bg-slate-800 rounded-[28px] border border-gray-100 dark:border-slate-700/50 overflow-hidden shadow-[0_2px_15px_rgba(0,0,0,0.02)]">
          {[1, 2, 3].map((item, idx) => (
            <div key={item} className={`px-5 py-4 flex items-center gap-4 ${idx !== 2 ? 'border-b border-gray-50 dark:border-slate-700/50' : ''}`}>
              <div className="w-[42px] h-[42px] rounded-[16px] bg-gray-100 dark:bg-slate-700/50 shrink-0"></div>
              <div className="flex-1 space-y-2.5">
                <div className="h-3.5 bg-gray-200 dark:bg-slate-600 rounded w-3/4"></div>
                <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded w-1/3"></div>
              </div>
              <div className="flex flex-col items-end space-y-2.5">
                <div className="h-3.5 bg-gray-200 dark:bg-slate-600 rounded w-20"></div>
                <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded w-12"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
)

// 🔥 MODAL DE EXPORTAÇÃO
function ExportFeedbackOverlay({ status, onClose }: { status: 'idle' | 'exporting' | 'success', onClose: () => void }) {
  if (status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={status === 'exporting' ? undefined : onClose}>
      <div className="bg-white dark:bg-slate-800 w-11/12 max-w-sm rounded-[32px] p-8 animate-in zoom-in-95 duration-300 shadow-2xl flex flex-col items-center" onClick={e => e.stopPropagation()}>
        {status === 'exporting' ? (
          <div className="flex flex-col items-center py-6">
            <Loader2 size={48} className="text-teal-500 animate-spin mb-4" />
            <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100 tracking-tight">Gerando Extrato...</h3>
            <p className="text-sm text-gray-500 mt-2 text-center font-medium">Processando suas transações localmente.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
              <CheckCircle size={40} className="text-emerald-500 animate-bounce" />
            </div>
            <h3 className="font-black text-2xl text-gray-800 dark:text-gray-100 mb-2 text-center tracking-tight">Extrato Gerado!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-[250px] mb-8 font-medium">
              Acesse a <strong className="text-emerald-600 dark:text-emerald-400">pasta de downloads</strong> do seu celular para abrir o arquivo.
            </p>
            <button type="button" onClick={onClose} className="w-full bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200 py-4 rounded-[20px] font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors active:scale-95">
              Concluir
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function PendingCard({ txs, loading }: { txs: any[]; loading: boolean }) {
  const [collapsed, setCollapsed] = useState(false)

  if (loading) return null;
  if (txs.length === 0) return null

  const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + safeNum(t.amount), 0)
  const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + safeNum(t.amount), 0)
  const fmt = (v: number) => `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 border border-amber-100 dark:border-amber-900/30 rounded-[24px] mb-2 transition-all active:scale-[0.98] shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="w-[42px] h-[42px] rounded-[16px] bg-white/60 dark:bg-amber-800/40 flex items-center justify-center shadow-sm">
            <Clock size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-[14px] font-bold text-amber-900 dark:text-amber-300 tracking-tight">
              {txs.length} {txs.length === 1 ? 'pendente' : 'pendentes'}
            </p>
            <p className="text-[11px] font-medium text-amber-700/70 dark:text-amber-500 mt-0.5">
              {totalExpense > 0 && <span className="text-red-500/90 dark:text-red-400">−{fmt(totalExpense)}</span>}
              {totalExpense > 0 && totalIncome > 0 && <span className="mx-1.5 opacity-40">•</span>}
              {totalIncome > 0 && <span className="text-emerald-600/90 dark:text-emerald-400">+{fmt(totalIncome)}</span>}
            </p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/50 dark:bg-amber-900/30 flex items-center justify-center">
          <ChevronDown size={18} className={`text-amber-600 dark:text-amber-400 transition-transform duration-300 ${collapsed ? '-rotate-90' : ''}`} />
        </div>
      </button>

      {!collapsed && (
        <div className="bg-white dark:bg-slate-800 rounded-[28px] border border-amber-100/50 dark:border-amber-900/20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
          {txs.map((t, index) => (
            <TransactionItem key={t.id} transaction={t} index={index} totalItems={txs.length} />
          ))}
        </div>
      )}
    </div>
  )
}

function TransactionItem({ transaction, index, totalItems }: { transaction: any; index: number; totalItems: number }) {
  const router = useRouter()
  
  const isPending = transaction.status === 'pending'
  const amount = safeNum(transaction.amount)
  const IconComp = transaction.type === 'transfer' ? ArrowLeftRight : getDynamicIcon(transaction.categories?.icon)
  const attachmentIcon = getAttachmentIcon(transaction.receipt_url)

  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense' || transaction.type === 'sangria';
  const isTransfer = transaction.type === 'transfer';

  let amountColorClass = 'text-gray-900 dark:text-gray-100';
  let amountPrefix = '';
  let defaultName = 'Transação';

  if (isIncome) {
    amountColorClass = 'text-emerald-600 dark:text-emerald-400';
    amountPrefix = '+';
    defaultName = 'Receita';
  } else if (isExpense) {
    amountColorClass = 'text-gray-900 dark:text-gray-100';
    amountPrefix = '-';
    defaultName = 'Despesa';
  } else if (isTransfer) {
    amountColorClass = 'text-blue-600 dark:text-blue-400';
    amountPrefix = transaction.description?.toLowerCase().includes('de ') ? '+' : '-';
    defaultName = 'Transferência';
  }

  return (
    <div
      onClick={() => transaction.id && router.push(`/transactions/details?id=${transaction.id}`)}
      className={`flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-slate-700/40 transition-colors active:bg-gray-100 dark:active:bg-slate-600 ${
        isPending ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''
      } ${index !== totalItems - 1 ? 'border-b border-gray-50 dark:border-slate-700/50' : ''}`}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="relative">
          <div className="w-[42px] h-[42px] rounded-[16px] flex items-center justify-center shrink-0 shadow-sm transition-transform" 
               style={{ backgroundColor: `${transaction.categories?.color || '#94a3b8'}15`, color: transaction.categories?.color || '#64748b' }}>
            <IconComp size={20} strokeWidth={2.5} />
          </div>
          {isPending ? (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center shadow-sm">
              <Clock size={8} className="text-white" />
            </div>
          ) : (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center shadow-sm">
              <Check size={8} className="text-white" strokeWidth={3} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-[15px] font-bold text-gray-800 dark:text-gray-100 truncate tracking-tight">
              {transaction.description || transaction.categories?.name || defaultName}
            </p>
            {attachmentIcon}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 truncate max-w-[100px]">
              {transaction.categories?.name || 'Sem categoria'}
            </span>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500">
              {format(new Date(transaction.date), "dd/MM")}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col items-end shrink-0 pl-3">
        <p className={`text-[15px] font-bold tracking-tight ${amountColorClass} ${isPending ? 'opacity-60' : ''}`}>
          {amountPrefix} {formatCurrency(amount)}
        </p>
        {isPending && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mt-1">
            Pendente
          </span>
        )}
      </div>
    </div>
  )
}

export default function TransactionsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { effectiveContext } = useContext_()
  const { showToast } = useToast()
  
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [advFilters, setAdvFilters] = useState<AdvFilters>(defaultAdvFilters)
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  
  const [tempFilters, setTempFilters] = useState<AdvFilters>(defaultAdvFilters) // Para o modal
  
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success'>('idle')

  const exportMenuRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())

  const startMonth = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const endMonth = format(endOfMonth(currentDate), 'yyyy-MM-dd')

  const { data: localTransactions, loading, syncing, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext },
  })

  const { data: localCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext },
  })

  const { data: localAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context: effectiveContext },
  })

  const transactionsWithJoin = (localTransactions || []).map((tx: any) => {
    const category = (localCategories || []).find((c: any) => c.id === tx.category_id) as any
    const account = (localAccounts || []).find((a: any) => a.id === tx.account_id) as any
    return {
      ...tx,
      categories: category ? { name: category.name, icon: category.icon, color: category.color } : null,
      accounts: account ? { name: account.name, color: account.color } : null,
    }
  })

  // A LÓGICA MESTRA DE FILTRAGEM E ORDENAÇÃO
  const filtered = transactionsWithJoin.filter((t: any) => {
    // 1. Mês atual
    if (t.date < startMonth || t.date > endMonth) return false
    
    // 2. Filtro Rápido (Pílulas)
    if (quickFilter === 'income' && t.type !== 'income') return false
    if (quickFilter === 'expense' && t.type !== 'expense' && t.type !== 'sangria') return false
    if (quickFilter === 'transfer' && t.type !== 'transfer') return false
    if (quickFilter === 'pending' && t.status !== 'pending') return false

    // 3. Filtros Avançados
    if (advFilters.accountId && t.account_id !== advFilters.accountId) return false
    if (advFilters.categoryId && t.category_id !== advFilters.categoryId) return false
    if (advFilters.minAmount && safeNum(t.amount) < safeNum(advFilters.minAmount)) return false
    if (advFilters.maxAmount && safeNum(t.amount) > safeNum(advFilters.maxAmount)) return false

    // 4. Busca
    if (search) {
      const term = search.toLowerCase()
      const desc = String(t.description || '').toLowerCase()
      const cat = String(t.categories?.name || '').toLowerCase()
      const notes = String(t.notes || '').toLowerCase()
      
      if (advFilters.searchNotes) {
        if (!desc.includes(term) && !cat.includes(term) && !notes.includes(term)) return false
      } else {
        if (!desc.includes(term) && !cat.includes(term)) return false
      }
    }
    return true
  }).sort((a: any, b: any) => {
    const orderMult = advFilters.sortOrder === 'asc' ? 1 : -1;
    
    if (advFilters.sortBy === 'date') {
      const timeA = new Date(a.created_at || a.date || 0).getTime();
      const timeB = new Date(b.created_at || b.date || 0).getTime();
      if (timeA === timeB) return 0;
      return (timeA > timeB ? 1 : -1) * orderMult; // Data: desc = mais recente primeiro
    }
    if (advFilters.sortBy === 'amount') {
      return (safeNum(a.amount) - safeNum(b.amount)) * orderMult;
    }
    if (advFilters.sortBy === 'category') {
      const catA = a.categories?.name || '';
      const catB = b.categories?.name || '';
      return catA.localeCompare(catB) * orderMult;
    }
    return 0;
  });

  const pendingTxs = filtered.filter((t: any) => t.status === 'pending')
  const doneTxs = filtered.filter((t: any) => t.status === 'done')

  // Se o filtro rápido for 'pending', não mostramos o bloco agrupado, pois ele já tá na lista principal
  const displayTxs = filtered;

  const grouped = groupByDate(displayTxs)
  
  // Ordenação das chaves de data (sempre do mais recente para o mais antigo se a ordem da data for desc)
  const sortedDates = Object.keys(grouped).sort((a, b) => {
    return advFilters.sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
  })

  useEffect(() => {
    if (user?.id && effectiveContext) reloadTransactions()
  }, [user?.id, effectiveContext, currentDate, reloadTransactions])

  useEffect(() => {
    setLoadingPulse(loading || syncing)
  }, [loading, syncing])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) setShowExportMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const handleExport = async (range: string) => {
    setShowExportMenu(false)
    if (!user?.id) return

    setExportStatus('exporting')
    try {
      const { csv, filename } = await exportTransactionsToCSV(user.id, effectiveContext, range)
      downloadCSV(csv, filename)
      setExportStatus('success')
      setTimeout(() => setExportStatus('idle'), 5000)
    } catch (err: any) {
      console.error(err)
      showToast(err.message || 'Erro ao exportar extrato.', 'error')
      setExportStatus('idle')
    }
  }

  const applyAdvancedFilters = () => {
    setAdvFilters(tempFilters)
    setShowFilterDrawer(false)
  }

  const resetAdvancedFilters = () => {
    setTempFilters(defaultAdvFilters)
    setAdvFilters(defaultAdvFilters)
    setShowFilterDrawer(false)
  }

  const hasAdvancedFilters = advFilters.accountId || advFilters.categoryId || advFilters.minAmount || advFilters.maxAmount || advFilters.sortBy !== 'date' || advFilters.sortOrder !== 'desc' || advFilters.searchNotes;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans relative transition-colors duration-300">
      
      {/* Indicador de Sincronização Sutil (Ponto de luz) */}
      {loadingPulse && (
        <div className="fixed top-6 right-6 z-50">
          <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      <ExportFeedbackOverlay status={exportStatus} onClose={() => setExportStatus('idle')} />

      {/* HEADER SOFT UI */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl pt-6 pb-3 px-4 border-b border-gray-100 dark:border-slate-800 shadow-[0_2px_15px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[26px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">Transações</h1>
          <div className="flex items-center gap-2">
            
            {/* Seletor de Mês Super Clean */}
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"><ChevronLeft size={18} /></button>
              <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200 capitalize tracking-tight min-w-[80px] text-center">{format(currentDate, 'MMM yyyy', { locale: ptBR })}</span>
              <button type="button" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"><ChevronRight size={18} /></button>
            </div>

          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <ContextToggle />
          
          <div className="relative" ref={exportMenuRef}>
            <button 
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="h-10 px-4 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center gap-2 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 active:scale-95 font-bold text-[13px]"
            >
              <Download size={16} /> Exportar
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-[48px] w-44 bg-white dark:bg-slate-800 rounded-[24px] shadow-xl border border-gray-100 dark:border-slate-700 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-3 py-2">Exportar extrato</p>
                {[{ key: '7', label: 'Últimos 7 dias' }, { key: '14', label: '14 dias' }, { key: '30', label: '30 dias' }, { key: 'total', label: 'Todo período' }].map(opt => (
                  <button type="button" key={opt.key} onClick={() => handleExport(opt.key)} className="w-full text-left px-4 py-2.5 rounded-[16px] text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all">{opt.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700/50 rounded-[18px] px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
            <Search size={18} className="text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar transação..."
              className="flex-1 bg-transparent text-[14px] outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 font-medium" />
            {search && (
               <button onClick={() => setSearch('')} className="p-1 text-gray-400 hover:text-gray-600"><X size={14}/></button>
            )}
          </div>

          {/* Botão de Filtro Avançado */}
          <button 
            type="button"
            onClick={() => { setTempFilters(advFilters); setShowFilterDrawer(true); }} 
            className={`w-[46px] h-[46px] rounded-[18px] flex items-center justify-center transition-all shadow-sm border relative ${hasAdvancedFilters ? 'bg-teal-600 border-teal-600 text-white' : 'bg-gray-50 dark:bg-slate-800/80 border-gray-100 dark:border-slate-700/50 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
          >
            <SlidersHorizontal size={18} />
            {hasAdvancedFilters && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />}
          </button>
        </div>

        {/* FILTROS RÁPIDOS COM PENDENTES */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 snap-x">
          {[
            { key: 'all', label: 'Todas', icon: null },
            { key: 'income', label: 'Receitas', icon: <ArrowUp size={14} className={quickFilter === 'income' ? 'text-emerald-200' : 'text-emerald-500'} /> },
            { key: 'expense', label: 'Despesas', icon: <ArrowDown size={14} className={quickFilter === 'expense' ? 'text-red-200' : 'text-red-500'} /> },
            { key: 'transfer', label: 'Transf.', icon: <ArrowLeftRight size={14} className={quickFilter === 'transfer' ? 'text-blue-200' : 'text-blue-500'} /> },
            { key: 'pending', label: 'Pendentes', icon: <Clock size={14} className={quickFilter === 'pending' ? 'text-amber-200' : 'text-amber-500'} /> },
          ].map(f => (
            <button type="button" key={f.key} onClick={() => setQuickFilter(f.key as QuickFilter)}
              className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 snap-start shrink-0 ${quickFilter === f.key ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-md scale-105' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <TransactionsSkeleton />
        ) : displayTxs.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-gray-400 dark:text-gray-500 animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
               <ReceiptText size={32} className="opacity-30" />
            </div>
            <p className="text-[16px] font-bold text-gray-800 dark:text-gray-200 tracking-tight">Nenhuma transação</p>
            <p className="text-[13px] mt-1 font-medium text-center max-w-[200px]">Tente alterar os filtros ou adicione um novo registro.</p>
          </div>
        ) : (
          <>
            {/* Se o QuickFilter for 'pending', não mostramos o bloco amarelo isolado, pois a lista inteira é de pendentes */}
            {quickFilter !== 'pending' && pendingTxs.length > 0 && !hasAdvancedFilters && (
              <PendingCard txs={pendingTxs} loading={false} />
            )}

            <div className="space-y-8 animate-in fade-in duration-500">
              {sortedDates.map(date => (
                <div key={date} className="relative">
                  <div className="sticky top-[200px] z-30 bg-[#f8f9fa] dark:bg-slate-900 py-2 -mx-4 px-4 mb-2">
                     <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase ml-2 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                       {dateLabel(date)}
                     </p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-[0_2px_15px_rgba(0,0,0,0.02)] border border-gray-100 dark:border-slate-700/50 overflow-hidden">
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
          </>
        )}
      </div>

      {/* GAVETA DE FILTROS AVANÇADOS (BOTTOM SHEET) */}
      {showFilterDrawer && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowFilterDrawer(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-6 h-[85vh] flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-2xl" onClick={e => e.stopPropagation()}>
            
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Filtros Avançados</h3>
              <button type="button" onClick={() => setShowFilterDrawer(false)} className="text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
              
              {/* Conta */}
              <div>
                <label className="text-[13px] font-bold text-gray-700 dark:text-gray-300 mb-2 block">Conta</label>
                <div className="relative">
                  <select
                    value={tempFilters.accountId}
                    onChange={(e) => setTempFilters({...tempFilters, accountId: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 rounded-[16px] p-4 text-[14px] font-bold text-gray-800 dark:text-gray-200 appearance-none focus:ring-2 focus:ring-teal-500/30 outline-none"
                  >
                    <option value="">Todas as contas</option>
                    {(localAccounts || []).map((acc: any) => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Categoria */}
              <div>
                <label className="text-[13px] font-bold text-gray-700 dark:text-gray-300 mb-2 block">Categoria</label>
                <div className="relative">
                  <select
                    value={tempFilters.categoryId}
                    onChange={(e) => setTempFilters({...tempFilters, categoryId: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 rounded-[16px] p-4 text-[14px] font-bold text-gray-800 dark:text-gray-200 appearance-none focus:ring-2 focus:ring-teal-500/30 outline-none"
                  >
                    <option value="">Todas as categorias</option>
                    {(localCategories || []).map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Faixa de Valor */}
              <div>
                <label className="text-[13px] font-bold text-gray-700 dark:text-gray-300 mb-2 block">Faixa de Valor</label>
                <div className="flex gap-3">
                  <div className="flex-1 bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 rounded-[16px] p-3 flex flex-col focus-within:ring-2 focus-within:ring-teal-500/30">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Mínimo</span>
                    <div className="flex items-center">
                      <span className="text-[14px] text-gray-400 font-bold mr-1">R$</span>
                      <input type="number" placeholder="0,00" value={tempFilters.minAmount} onChange={(e) => setTempFilters({...tempFilters, minAmount: e.target.value})} className="bg-transparent w-full text-[15px] font-bold outline-none text-gray-800 dark:text-gray-200" />
                    </div>
                  </div>
                  <div className="flex-1 bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 rounded-[16px] p-3 flex flex-col focus-within:ring-2 focus-within:ring-teal-500/30">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Máximo</span>
                    <div className="flex items-center">
                      <span className="text-[14px] text-gray-400 font-bold mr-1">R$</span>
                      <input type="number" placeholder="0,00" value={tempFilters.maxAmount} onChange={(e) => setTempFilters({...tempFilters, maxAmount: e.target.value})} className="bg-transparent w-full text-[15px] font-bold outline-none text-gray-800 dark:text-gray-200" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Ordenação */}
              <div>
                <label className="text-[13px] font-bold text-gray-700 dark:text-gray-300 mb-2 block">Ordenar por</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'date', label: 'Data' },
                    { key: 'amount', label: 'Valor' },
                    { key: 'category', label: 'Categoria' }
                  ].map(o => (
                    <button 
                      key={o.key} type="button" 
                      onClick={() => setTempFilters({...tempFilters, sortBy: o.key as any})}
                      className={`px-4 py-2.5 rounded-[12px] text-[13px] font-bold transition-all ${tempFilters.sortBy === o.key ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 ring-1 ring-teal-500' : 'bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-slate-600'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                  
                  <div className="w-[1px] h-6 bg-gray-200 dark:bg-slate-600 my-auto mx-1" />
                  
                  <button 
                    type="button" 
                    onClick={() => setTempFilters({...tempFilters, sortOrder: tempFilters.sortOrder === 'asc' ? 'desc' : 'asc'})}
                    className="px-4 py-2.5 rounded-[12px] bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-slate-600 text-[13px] font-bold flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                  >
                    {tempFilters.sortOrder === 'asc' ? <SortAsc size={16}/> : <SortDesc size={16}/>}
                    {tempFilters.sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
                  </button>
                </div>
              </div>

              {/* Busca em Observações */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-[16px] p-4 border border-gray-100 dark:border-slate-600">
                <span className="text-[13px] font-bold text-gray-700 dark:text-gray-300">Buscar nas observações</span>
                <button 
                  type="button"
                  onClick={() => setTempFilters({...tempFilters, searchNotes: !tempFilters.searchNotes})} 
                  className={`w-12 h-7 rounded-full relative transition-colors shadow-inner ${tempFilters.searchNotes ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${tempFilters.searchNotes ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

            </div>

            <div className="pt-6 mt-2 border-t border-gray-100 dark:border-slate-700 flex gap-3 pb-4">
              <button type="button" onClick={resetAdvancedFilters} className="flex-1 py-4 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-[20px] font-bold active:scale-95 transition-all text-[15px]">Limpar</button>
              <button type="button" onClick={applyAdvancedFilters} className="flex-[2] py-4 bg-teal-600 text-white rounded-[20px] font-bold shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:scale-95 transition-all text-[15px]">Aplicar Filtros</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
