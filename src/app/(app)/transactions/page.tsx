// src/app/(app)/transactions/page.tsx
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  Search, ChevronLeft, ChevronRight, ReceiptText, Loader2,
  ArrowLeftRight, Download, ArrowDown, ArrowUp, Clock, ChevronDown,
  Check, Image as ImageIcon, Paperclip, CheckCircle, X, SortDesc, SortAsc,
  Filter
} from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useTransactionsList } from '@/hooks/useTransactionsList'
import { useLocalSync } from '@/hooks/useLocalSync'
import { useLocalData } from '@/hooks/useLocalData'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { exportTransactionsToCSV, downloadCSV } from '@/lib/services/exportService'
import { createPortal } from 'react-dom'

type QuickFilter = 'all' | 'income' | 'expense' | 'transfer' | 'pending'

interface AdvFilters {
  accountId: string;
  categoryId: string;
  minAmount: string;
  maxAmount: string;
  sortBy: 'date' | 'amount' | 'category';
  sortOrder: 'asc' | 'desc';
  searchNotes: boolean;
  status: 'all' | 'done' | 'pending';
}

const defaultAdvFilters: AdvFilters = {
  accountId: '', categoryId: '', minAmount: '', maxAmount: '', sortBy: 'date', sortOrder: 'desc', searchNotes: false, status: 'all'
}

const safeNum = (val: any) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g, ""));
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
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3.5 shadow-sm transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-[16px] bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
            <Clock size={18} className="text-amber-600 dark:text-amber-400" />
          </div>

          <div className="text-left min-w-0">
            <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
              {txs.length} {txs.length === 1 ? 'pendente' : 'pendentes'}
            </p>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
              {totalExpense > 0 && <span className="text-red-500 dark:text-red-400">−{fmt(totalExpense)}</span>}
              {totalExpense > 0 && totalIncome > 0 && <span className="mx-1.5 text-gray-300 dark:text-slate-600">•</span>}
              {totalIncome > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{fmt(totalIncome)}</span>}
            </p>
          </div>
        </div>

        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
          <ChevronDown
            size={17}
            className={`text-gray-500 dark:text-gray-300 transition-transform duration-300 ${collapsed ? '-rotate-90' : ''}`}
          />
        </div>
      </button>

      {!collapsed && (
        <div className="mt-2 rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
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
  const IconComp =
    transaction.type === 'transfer'
      ? ArrowLeftRight
      : getDynamicIcon(transaction.categories?.icon)

  const attachmentIcon = getAttachmentIcon(transaction.receipt_url)

  const isIncome = transaction.type === 'income'
  const isExpense = transaction.type === 'expense' || transaction.type === 'sangria'
  const isTransfer = transaction.type === 'transfer'

  let amountColorClass = 'text-gray-900 dark:text-gray-100'
  let amountPrefix = ''
  let defaultName = 'Transação'
  let typeLabel = 'Movimentação'

  if (isIncome) {
    amountColorClass = 'text-emerald-600 dark:text-emerald-400'
    amountPrefix = '+'
    defaultName = 'Receita'
    typeLabel = 'Receita'
  } else if (isExpense) {
    amountColorClass = 'text-rose-600 dark:text-rose-400'
    amountPrefix = '−'
    defaultName = transaction.type === 'sangria' ? 'Sangria' : 'Despesa'
    typeLabel = transaction.type === 'sangria' ? 'Sangria' : 'Despesa'
  } else if (isTransfer) {
    amountColorClass = 'text-blue-600 dark:text-blue-400'
    amountPrefix = transaction.description?.toLowerCase().includes('de ') ? '+' : '−'
    defaultName = 'Transferência'
    typeLabel = 'Transferência'
  }

  const categoryColor = transaction.categories?.color || '#64748b'
  const title =
    transaction.description ||
    transaction.categories?.name ||
    defaultName

  const secondaryParts = [
    transaction.categories?.name,
    transaction.accounts?.name,
  ].filter(Boolean)

  return (
    <button
      type="button"
      onClick={() => {
        if (transaction.id) {
          router.push(`/transactions/details?id=${transaction.id}`)
        }
      }}
      className={`group relative w-full px-4 py-3.5 text-left transition-colors active:bg-gray-100/80 dark:active:bg-slate-700/70 ${
        isPending
          ? 'bg-amber-50/45 dark:bg-amber-950/10'
          : 'bg-transparent hover:bg-gray-50/80 dark:hover:bg-slate-700/35'
      } ${
        index !== totalItems - 1
          ? 'border-b border-gray-100 dark:border-slate-700/55'
          : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[15px]"
            style={{
              backgroundColor: `${categoryColor}14`,
              color: categoryColor,
            }}
          >
            <IconComp size={20} strokeWidth={2.15} />
          </div>

          {isPending && (
            <div className="absolute -bottom-1 -right-1 flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-white bg-amber-500 dark:border-slate-800">
              <Clock size={8} strokeWidth={2.8} className="text-white" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-[14px] font-semibold leading-5 text-gray-900 dark:text-gray-100">
              {title}
            </p>

            {attachmentIcon && (
              <span className="shrink-0">
                {attachmentIcon}
              </span>
            )}
          </div>

          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-gray-400 dark:text-gray-500">
            {secondaryParts.length > 0 ? (
              <>
                <span className="truncate">
                  {secondaryParts.join(' · ')}
                </span>

                {isPending && (
                  <>
                    <span className="shrink-0 text-gray-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className="shrink-0 font-medium text-amber-600 dark:text-amber-400">
                      Pendente
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className={isPending ? 'text-amber-600 dark:text-amber-400' : ''}>
                {isPending ? 'Pendente' : typeLabel}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 pl-2 text-right">
          <p
            className={`whitespace-nowrap text-[14px] font-bold tabular-nums tracking-[-0.01em] ${amountColorClass} ${
              isPending ? 'opacity-75' : ''
            }`}
          >
            {amountPrefix}{formatCurrency(amount)}
          </p>

          {(isPending || isTransfer) && (
            <p
              className={`mt-0.5 text-[10.5px] font-medium ${
                isPending
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-blue-500 dark:text-blue-400'
              }`}
            >
              {isPending ? 'Aguardando' : 'Transferência'}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

export default function TransactionsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { effectiveContext } = useContext_()
  const { showToast } = useToast()
  const { pendingCount } = useLocalSync()

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [advFilters, setAdvFilters] = useState<AdvFilters>(defaultAdvFilters)
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [tempFilters, setTempFilters] = useState<AdvFilters>(defaultAdvFilters)

  const [loadingPulse, setLoadingPulse] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success'>('idle')

  const exportMenuRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())

  const startMonth = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const endMonth = format(endOfMonth(currentDate), 'yyyy-MM-dd')

  // ✅ HOOK ESPECÍFICO DE LISTAGEM
  const { data: transactions, loading } = useTransactionsList(effectiveContext)

  // ✅ CATEGORIAS E CONTAS (useLocalData mantido para joins)
  const { data: localCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext },
  })

  const { data: localAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context: effectiveContext },
  })

  // ✅ useMemo para consolidar dados
  const transactionsWithJoin = useMemo(() => {
    return (transactions || []).map((tx: any) => {
      const category = (localCategories || []).find((c: any) => c.id === tx.category_id) as any
      const account = (localAccounts || []).find((a: any) => a.id === tx.account_id) as any
      return {
        ...tx,
        categories: category ? { name: category.name, icon: category.icon, color: category.color } : null,
        accounts: account ? { name: account.name, color: account.color } : null,
      }
    })
  }, [transactions, localCategories, localAccounts])

  // ✅ FILTROS
  const filtered = transactionsWithJoin.filter((t: any) => {
    if (t.date < startMonth || t.date > endMonth) return false

    if (quickFilter === 'income' && t.type !== 'income') return false
    if (quickFilter === 'expense' && t.type !== 'expense' && t.type !== 'sangria') return false
    if (quickFilter === 'transfer' && t.type !== 'transfer') return false
    if (quickFilter === 'pending' && t.status !== 'pending') return false

    if (advFilters.status !== 'all' && t.status !== advFilters.status) return false
    if (advFilters.accountId && t.account_id !== advFilters.accountId) return false
    if (advFilters.categoryId && t.category_id !== advFilters.categoryId) return false
    if (advFilters.minAmount && safeNum(t.amount) < safeNum(advFilters.minAmount)) return false
    if (advFilters.maxAmount && safeNum(t.amount) > safeNum(advFilters.maxAmount)) return false

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
      return (timeA > timeB ? 1 : -1) * orderMult;
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
  const displayTxs = filtered;
  const grouped = groupByDate(displayTxs)

  const sortedDates = Object.keys(grouped).sort((a, b) => {
    return advFilters.sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
  })

  // ✅ REMOVIDO useEffect com reload

  useEffect(() => {
    setLoadingPulse(loading)
  }, [loading])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) setShowExportMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const hasAdvancedFilters = advFilters.accountId || advFilters.categoryId || advFilters.minAmount || advFilters.maxAmount || advFilters.sortBy !== 'date' || advFilters.sortOrder !== 'desc' || advFilters.searchNotes || advFilters.status !== 'all';

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans relative transition-colors duration-300">

      {(loading || pendingCount > 0) && (
        <div className="fixed top-6 right-6 z-50">
          <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      <ExportFeedbackOverlay status={exportStatus} onClose={() => setExportStatus('idle')} />

      <div className="sticky top-0 z-40 border-b border-gray-200/70 bg-[#f8f9fa]/95 px-4 pb-3 pt-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto max-w-md">
          <div className="mb-3 flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-[25px] font-bold tracking-[-0.035em] text-gray-950 dark:text-white">
                Transações
              </h1>
              <p className="mt-0.5 text-[11.5px] font-medium text-gray-400 dark:text-gray-500">
                Movimentações do seu financeiro
              </p>
            </div>

            <div className="relative shrink-0" ref={exportMenuRef}>
              <button
                type="button"
                aria-label="Exportar transações"
                title="Exportar"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={`flex h-10 w-10 items-center justify-center rounded-[14px] border transition-all active:scale-95 ${
                  showExportMenu
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700'
                }`}
              >
                <Download size={17} />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-[46px] z-50 w-48 rounded-[20px] border border-gray-200/80 bg-white p-2 shadow-xl shadow-black/10 animate-in fade-in zoom-in-95 duration-150 dark:border-slate-700 dark:bg-slate-800">
                  <div className="px-3 pb-1.5 pt-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
                      Exportar extrato
                    </p>
                  </div>

                  {[
                    { key: '7', label: 'Últimos 7 dias' },
                    { key: '14', label: 'Últimos 14 dias' },
                    { key: '30', label: 'Últimos 30 dias' },
                    { key: 'total', label: 'Todo o período' },
                  ].map(opt => (
                    <button
                      type="button"
                      key={opt.key}
                      onClick={() => handleExport(opt.key)}
                      className="flex w-full items-center rounded-[13px] px-3 py-2.5 text-left text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 dark:text-gray-200 dark:hover:bg-slate-700"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mb-2.5 flex items-center gap-2">
            <div className="flex h-11 min-w-0 flex-1 items-center rounded-[15px] border border-gray-200/80 bg-white px-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-95 dark:hover:bg-slate-700 dark:hover:text-gray-200"
              >
                <ChevronLeft size={17} />
              </button>

              <div className="min-w-0 flex-1 text-center">
                <p className="truncate text-[13px] font-semibold capitalize text-gray-800 dark:text-gray-100">
                  {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </p>
              </div>

              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-95 dark:hover:bg-slate-700 dark:hover:text-gray-200"
              >
                <ChevronRight size={17} />
              </button>
            </div>

            <button
              type="button"
              aria-label="Filtros avançados"
              onClick={() => {
                setTempFilters(advFilters)
                setShowFilterDrawer(true)
              }}
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border shadow-sm transition-all active:scale-95 ${
                hasAdvancedFilters
                  ? 'border-teal-600 bg-teal-600 text-white'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-400 dark:hover:bg-slate-700'
              }`}
            >
              <Filter size={17} />

              {hasAdvancedFilters && (
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#f8f9fa] bg-amber-500 dark:border-slate-900" />
              )}
            </button>
          </div>

          <div className="mb-2.5">
            <ContextToggle />
          </div>

          <div className="mb-2.5 flex h-11 items-center gap-2 rounded-[15px] border border-gray-200/80 bg-white px-3 shadow-sm transition-all focus-within:border-teal-500/50 focus-within:ring-2 focus-within:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-800">
            <Search size={17} className="shrink-0 text-gray-400" />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou categoria"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] font-medium text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
            />

            {search && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setSearch('')}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-300"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-5 gap-1 rounded-[16px] bg-gray-100 p-1 dark:bg-slate-800/80">
            {[
              {
                key: 'all',
                label: 'Todas',
                icon: ReceiptText,
                active: 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-white',
              },
              {
                key: 'income',
                label: 'Receitas',
                icon: ArrowUp,
                active: 'bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-500/15 dark:text-emerald-400',
              },
              {
                key: 'expense',
                label: 'Despesas',
                icon: ArrowDown,
                active: 'bg-rose-50 text-rose-700 shadow-sm dark:bg-rose-500/15 dark:text-rose-400',
              },
              {
                key: 'transfer',
                label: 'Transf.',
                icon: ArrowLeftRight,
                active: 'bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-500/15 dark:text-blue-400',
              },
              {
                key: 'pending',
                label: 'Pend.',
                icon: Clock,
                active: 'bg-amber-50 text-amber-700 shadow-sm dark:bg-amber-500/15 dark:text-amber-400',
              },
            ].map(f => {
              const QuickIcon = f.icon
              const selected = quickFilter === f.key

              return (
                <button
                  type="button"
                  key={f.key}
                  onClick={() => setQuickFilter(f.key as QuickFilter)}
                  className={`flex h-[42px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[12px] border border-transparent text-[9.5px] font-semibold transition-all active:scale-[0.97] ${
                    selected
                      ? f.active
                      : 'bg-transparent text-gray-500 hover:bg-white/70 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-slate-700/70 dark:hover:text-gray-200'
                  }`}
                >
                  <QuickIcon size={15} strokeWidth={2.25} />
                  <span className="max-w-full truncate px-0.5">
                    {f.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3">
        {loading ? (
          <TransactionsSkeleton />
        ) : displayTxs.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400 dark:text-gray-500 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 border border-gray-200/70 dark:border-slate-700 shadow-sm flex items-center justify-center mb-4">
              <ReceiptText size={28} className="opacity-30" />
            </div>
            <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">Nenhuma transação</p>
            <p className="text-[12px] mt-1 text-center max-w-[220px] text-gray-400 dark:text-gray-500">
              Tente alterar os filtros ou adicione um novo registro.
            </p>
          </div>
        ) : (
          <>
            {quickFilter !== 'pending' && pendingTxs.length > 0 && !hasAdvancedFilters && (
              <PendingCard txs={pendingTxs} loading={false} />
            )}

            <div className="space-y-4 animate-in fade-in duration-500">
              {sortedDates.map(date => (
                <div key={date} className="relative">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-gray-400 dark:text-gray-500">
                      {dateLabel(date)}
                    </p>
                    <div className="h-px flex-1 bg-gray-200/80 dark:bg-slate-800" />
                  </div>

                  <div className="overflow-hidden rounded-[18px] border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.025)] dark:border-slate-800 dark:bg-slate-800/80">
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

      {showFilterDrawer && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300">
          <div className="absolute inset-0" onClick={() => setShowFilterDrawer(false)} />

          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[32px] flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-2xl max-h-[85dvh]">
            
            <div className="shrink-0 px-6 pt-4 pb-4 border-b border-gray-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 rounded-t-[32px]">
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[20px] font-bold text-gray-900 dark:text-white">Filtros</h2>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">Refine a análise exibida</p>
                </div>
                <button onClick={() => setShowFilterDrawer(false)} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 pb-6 custom-scrollbar">
              
              <div>
                <label className="text-[14px] font-bold text-gray-800 dark:text-gray-200 mb-3 block">Status</label>
                <div className="flex bg-gray-50 dark:bg-slate-800 p-1 rounded-[16px] border border-gray-100 dark:border-slate-700">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'done', label: 'Efetivados' },
                    { key: 'pending', label: 'Pendentes' }
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setTempFilters({ ...tempFilters, status: opt.key as any })}
                      className={`flex-1 py-2.5 text-[13px] font-bold rounded-[12px] transition-all ${
                        tempFilters.status === opt.key
                          ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[14px] font-bold text-gray-800 dark:text-gray-200 mb-3 block">Conta</label>
                <div className="relative">
                  <select
                    value={tempFilters.accountId}
                    onChange={(e) => setTempFilters({ ...tempFilters, accountId: e.target.value })}
                    className="w-full h-[54px] bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[20px] px-4 text-[15px] font-semibold text-gray-800 dark:text-gray-200 appearance-none focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                  >
                    <option value="">Todas as contas</option>
                    {(localAccounts || []).map((acc: any) => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-[14px] font-bold text-gray-800 dark:text-gray-200 mb-3 block">Categoria</label>
                <div className="relative">
                  <select
                    value={tempFilters.categoryId}
                    onChange={(e) => setTempFilters({ ...tempFilters, categoryId: e.target.value })}
                    className="w-full h-[54px] bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[20px] px-4 text-[15px] font-semibold text-gray-800 dark:text-gray-200 appearance-none focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                  >
                    <option value="">Todas as categorias</option>
                    {(localCategories || []).map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-[14px] font-bold text-gray-800 dark:text-gray-200 mb-3 block">Faixa de Valor</label>
                <div className="flex gap-3">
                  <div className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[20px] p-3 px-4 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
                    <span className="text-[11px] text-gray-400 font-semibold mb-1 block">Mínimo</span>
                    <div className="flex items-center">
                      <span className="text-[14px] text-gray-400 font-semibold mr-1.5">R$</span>
                      <input type="number" placeholder="0,00" value={tempFilters.minAmount} onChange={(e) => setTempFilters({ ...tempFilters, minAmount: e.target.value })} className="bg-transparent w-full text-[15px] font-bold outline-none text-gray-800 dark:text-gray-200" />
                    </div>
                  </div>
                  <div className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[20px] p-3 px-4 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
                    <span className="text-[11px] text-gray-400 font-semibold mb-1 block">Máximo</span>
                    <div className="flex items-center">
                      <span className="text-[14px] text-gray-400 font-semibold mr-1.5">R$</span>
                      <input type="number" placeholder="0,00" value={tempFilters.maxAmount} onChange={(e) => setTempFilters({ ...tempFilters, maxAmount: e.target.value })} className="bg-transparent w-full text-[15px] font-bold outline-none text-gray-800 dark:text-gray-200" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[14px] font-bold text-gray-800 dark:text-gray-200 mb-3 block">Ordenar por</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'date', label: 'Data' },
                    { key: 'amount', label: 'Valor' },
                    { key: 'category', label: 'Categoria' }
                  ].map(o => (
                    <button
                      key={o.key} type="button"
                      onClick={() => setTempFilters({ ...tempFilters, sortBy: o.key as any })}
                      className={`px-4 py-2.5 rounded-[14px] text-[13px] font-bold transition-all ${
                        tempFilters.sortBy === o.key 
                          ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 ring-1 ring-teal-500/50' 
                          : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-slate-700'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}

                  <div className="w-[1px] h-6 bg-gray-200 dark:bg-slate-700 my-auto mx-1" />

                  <button
                    type="button"
                    onClick={() => setTempFilters({ ...tempFilters, sortOrder: tempFilters.sortOrder === 'asc' ? 'desc' : 'asc' })}
                    className="px-4 py-2.5 rounded-[14px] bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-slate-700 text-[13px] font-bold flex items-center gap-2 hover:bg-gray-100 transition-colors"
                  >
                    {tempFilters.sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
                    <span className="whitespace-nowrap">{tempFilters.sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div>
                  <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200">Buscar nas observações</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">Incluir descrições detalhadas na busca</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTempFilters({ ...tempFilters, searchNotes: !tempFilters.searchNotes })}
                  className={`w-12 h-7 rounded-full relative transition-colors shadow-inner shrink-0 ${tempFilters.searchNotes ? 'bg-teal-600' : 'bg-gray-200 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${tempFilters.searchNotes ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

            </div>

            <div className="shrink-0 px-6 pt-4 pb-8 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800/60">
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={resetAdvancedFilters} 
                  className="w-1/3 py-4 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-[20px] font-bold active:scale-[0.98] transition-all text-[15px]"
                >
                  Limpar
                </button>
                <button 
                  type="button" 
                  onClick={applyAdvancedFilters} 
                  className="w-2/3 py-4 bg-teal-700 text-white rounded-[20px] font-bold shadow-lg shadow-teal-700/20 active:scale-[0.98] transition-all text-[15px]"
                >
                  Aplicar filtros
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  )
}