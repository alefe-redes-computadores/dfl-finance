'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import * as Icons from 'lucide-react'
import { 
  Search, SlidersHorizontal, ChevronLeft, ChevronRight, ReceiptText, Loader2, 
  ArrowLeftRight, Download, ArrowDown, ArrowUp, Layers, RefreshCw, Clock, ChevronDown,
  Check, Image as ImageIcon, Paperclip, CheckCircle // 🔥 CheckCircle adicionado
} from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import BankLogo from '@/components/BankLogo'
import { useScrollPosition } from '@/hooks/useScrollPosition'
import { useLocalData } from '@/hooks/useLocalData'
import { db } from '@/lib/db'
import { useSafeDb } from '@/hooks/useSafeDb'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext' // 🔥 Importado para os avisos de erro/sucesso

// 🔥 IMPORTANDO OS SERVIÇOS CLIENT-SIDE
import { exportTransactionsToCSV, downloadCSV } from '@/lib/services/exportService'

type Filter = 'all' | 'income' | 'expense' | 'transfer'
type StatusFilter = 'all' | 'pending' | 'done'

const safeNum = (val: any) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g,""));
  return isNaN(parsed) ? 0 : parsed;
}

const getAttachmentIcon = (url: string | null) => {
  if (!url) return null;
  const isDocument = /\.(pdf|doc|docx|xls|xlsx|csv|txt)(\?|$)/i.test(url.toLowerCase());
  if (isDocument) return <Paperclip size={12} className="text-gray-500 shrink-0" />;
  return <ImageIcon size={12} className="text-blue-500 shrink-0" />;
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

// 🔥 OVERLAY ANIMADO PARA EXPORTAÇÃO
function ExportFeedbackOverlay({ status, onClose }: { status: 'idle' | 'exporting' | 'success', onClose: () => void }) {
  if (status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={status === 'exporting' ? undefined : onClose}>
      <div className="bg-white dark:bg-slate-800 w-11/12 max-w-sm rounded-3xl p-6 animate-in zoom-in-95 duration-300 shadow-2xl flex flex-col items-center" onClick={e => e.stopPropagation()}>
        {status === 'exporting' ? (
          <div className="flex flex-col items-center py-6">
            <Loader2 size={48} className="text-teal-500 animate-spin mb-4" />
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Gerando Extrato...</h3>
            <p className="text-sm text-gray-500 mt-2 text-center">Processando suas transações localmente.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20">
              <CheckCircle size={40} className="text-emerald-500 animate-bounce" />
            </div>
            <h3 className="font-black text-xl text-gray-800 dark:text-gray-100 mb-2 text-center">Extrato Gerado!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-[250px] mb-6 font-medium">
              O download foi iniciado. Acesse a <strong className="text-emerald-600 dark:text-emerald-400">pasta de downloads</strong> do seu dispositivo para abrir o arquivo.
            </p>
            <button type="button" onClick={onClose} className="w-full bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200 py-3.5 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
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
        type="button"
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

function TransactionItem({ transaction, index, totalItems }: { transaction: any; index: number; totalItems: number }) {
  const router = useRouter()
  
  const isPending = transaction.status === 'pending'
  const amount = safeNum(transaction.amount)
  const IconComp = transaction.type === 'transfer' ? ArrowLeftRight : getDynamicIcon(transaction.categories?.icon)
  const attachmentIcon = getAttachmentIcon(transaction.receipt_url)

  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense' || transaction.type === 'sangria';
  const isTransfer = transaction.type === 'transfer';

  let amountColorClass = 'text-gray-800 dark:text-gray-200';
  let amountPrefix = '';
  let defaultName = 'Transação';

  if (isIncome) {
    amountColorClass = 'text-emerald-600 dark:text-emerald-400';
    amountPrefix = '+';
    defaultName = 'Receita';
  } else if (isExpense) {
    amountColorClass = 'text-red-500 dark:text-red-400';
    amountPrefix = '-';
    defaultName = 'Despesa';
  } else if (isTransfer) {
    amountColorClass = 'text-blue-500 dark:text-blue-400';
    amountPrefix = transaction.description?.toLowerCase().includes('de ') ? '+' : '-';
    defaultName = 'Transferência';
  }

  return (
    <div
      onClick={() => transaction.id && router.push(`/transactions/details?id=${transaction.id}`)}
      className={`flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${
        isPending ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
      } ${index !== totalItems - 1 ? 'border-b border-gray-50 dark:border-slate-700' : ''}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isPending ? (
          <div className="w-5 h-5 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
            <Clock size={12} className="text-orange-500" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <Check size={12} className="text-emerald-500" />
          </div>
        )}
        <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${transaction.categories?.color || '#94a3b8'}20`, color: transaction.categories?.color || '#64748b' }}>
          <IconComp size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate">
              {transaction.description || transaction.categories?.name || defaultName}
            </p>
            {attachmentIcon && <span className="shrink-0">{attachmentIcon}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[12px] text-gray-400 dark:text-gray-500">
              {format(new Date(transaction.date), "dd/MM/yyyy")}
            </span>
            {transaction.categories?.name && (
              <>
                <span className="text-[10px] text-gray-300 dark:text-gray-600">•</span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[80px]">
                  {transaction.categories.name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <p className={`text-[15px] font-bold ${amountColorClass}`}>
          {amountPrefix} {formatCurrency(amount)}
        </p>
        {isPending && (
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
            Pendente
          </span>
        )}
      </div>
    </div>
  )
}

function formatCurrency(val: number) {
  return `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function TransactionsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { effectiveContext } = useContext_()
  const { showToast } = useToast()
  
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()
  
  const [filter, setFilter] = useState<Filter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loadingPulse, setLoadingPulse] = useState(false)

  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  
  // 🔥 ESTADO DE ANIMAÇÃO DO EXPORT
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success'>('idle')

  const exportMenuRef = useRef<HTMLDivElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())

  const startMonth = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const endMonth = format(endOfMonth(currentDate), 'yyyy-MM-dd')

  const localFilters: Record<string, any> = {
    context: effectiveContext,
  }

  if (filter !== 'all') {
    localFilters.type = filter
  }

  if (statusFilter !== 'all') {
    localFilters.status = statusFilter
  }

  const {
    data: localTransactions,
    loading,
    syncing,
    reload: reloadTransactions,
  } = useLocalData({
    table: 'transactions' as any,
    filters: localFilters,
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
      categories: category
        ? { name: category.name, icon: category.icon, color: category.color }
        : null,
      accounts: account
        ? { name: account.name, color: account.color }
        : null,
    }
  })

  const filtered = transactionsWithJoin.filter((t: any) => {
    if (t.date < startMonth || t.date > endMonth) return false
    if (search) {
      const desc = String(t.description || '').toLowerCase()
      const cat = String(t.categories?.name || '').toLowerCase()
      const term = search.toLowerCase()
      if (!desc.includes(term) && !cat.includes(term)) return false
    }
    return true
  }).sort((a: any, b: any) => {
    const timeA = new Date(a.created_at || a.date || 0).getTime();
    const timeB = new Date(b.created_at || b.date || 0).getTime();
    return timeB - timeA;
  });

  const pendingTxs = filtered.filter((t: any) => t.status === 'pending')
  const doneTxs = filtered.filter((t: any) => t.status === 'done')

  const displayTxs = statusFilter === 'pending' ? pendingTxs : doneTxs

  const grouped = groupByDate(displayTxs)
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  useEffect(() => {
    if (user?.id && effectiveContext) {
      reloadTransactions()
    }
  }, [user?.id, effectiveContext, currentDate, filter, statusFilter, reloadTransactions])

  useEffect(() => {
    setLoadingPulse(loading || syncing)
  }, [loading, syncing])

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

  const filters: { key: Filter; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'Todas', icon: <Layers size={14} /> },
    { key: 'income', label: 'Receitas', icon: <ArrowUp size={14} /> },
    { key: 'expense', label: 'Despesas', icon: <ArrowDown size={14} /> },
    { key: 'transfer', label: 'Transferências', icon: <ArrowLeftRight size={14} /> },
  ]

  // 🔥 A MÁGICA DA EXPORTAÇÃO (Agorta Funcional e sem Refresh)
  const handleExport = async (range: string) => {
    setShowExportMenu(false)
    if (!user?.id) return

    setExportStatus('exporting')
    
    try {
      const blob = await exportTransactionsToCSV(user.id, effectiveContext, range)
      const filename = `Extrato_DFL_${effectiveContext}_${range}dias_${new Date().toISOString().split('T')[0]}.csv`
      
      await downloadCSV(blob, filename)
      
      setExportStatus('success')
      
      setTimeout(() => {
        setExportStatus('idle')
      }, 5000)
      
    } catch (err: any) {
      console.error(err)
      showToast(err.message || 'Erro ao exportar extrato.', 'error')
      setExportStatus('idle')
    }
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-24 font-sans relative transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {/* OVERLAY DE ANIMAÇÃO */}
      <ExportFeedbackOverlay 
        status={exportStatus} 
        onClose={() => setExportStatus('idle')} 
      />

      <div className="sticky top-0 z-50 bg-[#f8f9fa]/85 dark:bg-slate-900/85 backdrop-blur-xl pt-2 pb-2 px-4 mb-0 border-b border-gray-200/50 dark:border-slate-800/50 shadow-sm">
        <div className="flex items-center justify-between mb-2 mt-1">
          <h1 className="text-[22px] font-bold text-gray-800 dark:text-gray-100">Transações</h1>
          <div className="flex items-center gap-2">
            <div className="relative" ref={exportMenuRef}>
              <button 
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="w-9 h-9 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 rounded-full flex items-center justify-center transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                <Download size={18} className="text-gray-700 dark:text-gray-300" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-[42px] w-40 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-2 z-40 animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 py-2">Exportar extrato</p>
                  {[{ key: '7', label: '7 dias' }, { key: '14', label: '14 dias' }, { key: '30', label: '30 dias' }, { key: 'total', label: 'Todo período' }].map(opt => (
                    <button type="button" key={opt.key} onClick={() => handleExport(opt.key)} className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700">{opt.label}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 px-3 py-1.5 rounded-full">
              <button type="button" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"><ChevronLeft size={18} /></button>
              <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 capitalize w-24 text-center">{monthLabel}</span>
              <button type="button" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>

        <div className="mb-2">
          <ContextToggle />
        </div>

        <div className="flex gap-2 mb-2 relative">
          <div className="flex-1 flex items-center gap-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[16px] px-4 py-3 shadow-sm">
            <Search size={18} className="text-gray-400 dark:text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar transação..."
              className="flex-1 bg-transparent text-[14px] outline-none text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-500 font-medium" />
          </div>

          <div className="relative" ref={statusMenuRef}>
            <button 
              type="button"
              onClick={() => setShowStatusMenu(!showStatusMenu)} 
              className={`w-[48px] h-[48px] rounded-[16px] flex items-center justify-center transition-colors shadow-sm border ${showStatusMenu || statusFilter !== 'all' ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-400' : 'bg-white dark:bg-slate-800 border-gray-100 border-slate-700 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
            >
              <SlidersHorizontal size={20} />
            </button>

            {showStatusMenu && (
              <div className="absolute right-0 top-[54px] w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-2 z-40 animate-in fade-in zoom-in-95 duration-200">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 py-2">Filtrar por Status</p>
                <button type="button" onClick={() => { setStatusFilter('all'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'all' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Todas</button>
                <button type="button" onClick={() => { setStatusFilter('pending'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'pending' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Pendentes</button>
                <button type="button" onClick={() => { setStatusFilter('done'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'done' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Efetivadas</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map(f => (
            <button type="button" key={f.key} onClick={() => setFilter(f.key)}
              className={`px-5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${filter === f.key ? 'bg-teal-700 text-white border-teal-700 shadow-md' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3">
        {loading ? (
          <TransactionsSkeleton />
        ) : displayTxs.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400 dark:text-gray-500 animate-in fade-in duration-300">
            <ReceiptText size={48} className="mb-4 opacity-20" />
            <p className="text-[15px] font-bold text-gray-500 dark:text-gray-400">Nenhuma transação</p>
            <p className="text-[13px] mt-1">Nenhum resultado encontrado.</p>
          </div>
        ) : (
          <>
            {statusFilter !== 'pending' && pendingTxs.length > 0 && (
              <PendingCard txs={pendingTxs} loading={false} />
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

            {syncing && (
              <div className="flex justify-center py-2">
                <span className="text-xs text-gray-400">Sincronizando...</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
