// src/app/(app)/transactions/page.tsx
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  Search, ChevronLeft, ChevronRight, ReceiptText, Loader2,
  ArrowLeftRight, Download, ArrowDown, ArrowUp, Clock, ChevronDown,
  Check, Image as ImageIcon, Paperclip, CheckCircle, X, SortDesc, SortAsc,
  Filter, User
} from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useTransactionsList } from '@/hooks/useTransactionsList'
import { useDebtsList } from '@/hooks/useDebtsList'
import { useLocalSync } from '@/hooks/useLocalSync'
import { useLocalData } from '@/hooks/useLocalData'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { exportTransactionsToCSV, downloadCSV } from '@/lib/services/exportService'
import { createPortal } from 'react-dom'
import {
  getDebtRemainingAmount,
  getDebtStatusFromAmounts,
  isDebtPayment,
} from '@/lib/debtOperations'
import {
  getPendingDirection,
  getPendingLabel,
  isStandalonePendingReceivable,
} from '@/lib/pendingOperations'

import { getDebtDueState } from '@/lib/debtOperations'
type QuickFilter = 'all' | 'income' | 'expense' | 'transfer' | 'pending'
type PendingKind = 'all' | 'payable' | 'receivable'

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

function PendingCard({
  txs,
  debts,
  loading,
}: {
  txs: any[]
  debts: any[]
  loading: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()

  if (loading) return null

  const totalItems = txs.length + debts.length
  if (totalItems === 0) return null

  const totalExpense = txs
    .filter(
      (tx) =>
        getPendingDirection(tx) === 'payable'
    )
    .reduce(
      (sum, tx) => sum + safeNum(tx.amount),
      0
    )

  const transactionReceivables = txs
    .filter((tx) =>
      isStandalonePendingReceivable(tx)
    )
    .reduce(
      (sum, tx) => sum + safeNum(tx.amount),
      0
    )

  const debtReceivables = debts.reduce(
    (sum, debt) =>
      sum + safeNum(debt.remaining),
    0
  )

  const totalIncome =
    transactionReceivables + debtReceivables

  const fmt = (value: number) =>
    `R$ ${Math.abs(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="w-full rounded-[24px] border border-gray-200/70 bg-white px-4 py-3.5 shadow-sm transition-all active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-amber-50 dark:bg-amber-900/20">
              <Clock
                size={18}
                className="text-amber-600 dark:text-amber-400"
              />
            </div>

            <div className="min-w-0 text-left">
              <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                {totalItems}{' '}
                {totalItems === 1
                  ? 'pendência'
                  : 'pendências'}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                Contas a pagar e valores a receber
              </p>
            </div>
          </div>

          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700">
            <ChevronDown
              size={17}
              className={`text-gray-500 transition-transform duration-300 dark:text-gray-300 ${
                collapsed ? '-rotate-90' : ''
              }`}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-[15px] bg-red-50/70 px-3 py-2.5 text-left dark:bg-red-500/5">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-red-400">
              A pagar
            </p>
            <p className="mt-0.5 truncate text-[13px] font-bold text-red-600 dark:text-red-400">
              {fmt(totalExpense)}
            </p>
          </div>

          <div className="rounded-[15px] bg-emerald-50/70 px-3 py-2.5 text-left dark:bg-emerald-500/5">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-500">
              A receber
            </p>
            <p className="mt-0.5 truncate text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
              {fmt(totalIncome)}
            </p>
          </div>
        </div>
      </button>

      {!collapsed && (
        <div className="mt-2 overflow-hidden rounded-[24px] border border-gray-200/70 bg-white shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 dark:border-slate-700 dark:bg-slate-800">
          {debts.map((debt, index) => (
            <button
              key={`debt-${debt.id}`}
              type="button"
              onClick={() =>
                router.push(
                  `/debts/details?id=${encodeURIComponent(debt.id)}`
                )
              }
              className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-slate-700/50 ${
                index !== debts.length - 1 ||
                txs.length > 0
                  ? 'border-b border-gray-100 dark:border-slate-700/55'
                  : ''
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <User size={19} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                  {debt.person_name || 'Valor a receber'}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400">
                  Quem me deve · A receber
                </p>
              </div>

              <p className="shrink-0 text-[14px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                +{fmt(debt.remaining)}
              </p>
            </button>
          ))}

          {txs.map((tx, index) => (
            <TransactionItem
              key={tx.id}
              transaction={tx}
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
  const IconComp =
    transaction.type === 'transfer'
      ? ArrowLeftRight
      : getDynamicIcon(transaction.categories?.icon)

  const attachmentIcon = getAttachmentIcon(transaction.receipt_url)

  const isIncome = transaction.type === 'income'
  const isExpense =
    transaction.type === 'expense' ||
    transaction.type === 'sangria'
  const isTransfer = transaction.type === 'transfer'
  const pendingLabel = isPending
    ? getPendingLabel(transaction)
    : ''

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
                {isPending ? pendingLabel : typeLabel}
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
              {isPending ? pendingLabel : 'Transferência'}
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
  const searchParams = useSearchParams()
  const { effectiveContext } = useContext_()
  const { showToast } = useToast()
  const { pendingCount } = useLocalSync()

  const [quickFilter, setQuickFilter] =
    useState<QuickFilter>('all')
  const [pendingKind, setPendingKind] =
    useState<PendingKind>('all')
  const [advFilters, setAdvFilters] = useState<AdvFilters>(defaultAdvFilters)
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [tempFilters, setTempFilters] = useState<AdvFilters>(defaultAdvFilters)

  const [loadingPulse, setLoadingPulse] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success'>('idle')

  const exportMenuRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    const filter = searchParams.get('filter')
    const kind = searchParams.get('kind')

    if (
      filter === 'all' ||
      filter === 'income' ||
      filter === 'expense' ||
      filter === 'transfer' ||
      filter === 'pending'
    ) {
      setQuickFilter(filter)
    }

    if (
      kind === 'payable' ||
      kind === 'receivable'
    ) {
      setPendingKind(kind)
    } else {
      setPendingKind('all')
    }
  }, [searchParams])

  const startMonth = format(
    startOfMonth(currentDate),
    'yyyy-MM-dd'
  )
  const endMonth = format(
    endOfMonth(currentDate),
    'yyyy-MM-dd'
  )

  // ✅ HOOK ESPECÍFICO DE LISTAGEM
  const { data: transactions, loading } =
    useTransactionsList(effectiveContext)
  const {
    data: localDebts,
    loading: debtsLoading,
  } = useDebtsList(effectiveContext)
  const pageLoading = loading || debtsLoading

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

  const debtPaymentsById = useMemo(() => {
    const result = new Map<string, number>()

    for (const tx of transactions || []) {
      if (!isDebtPayment(tx) || !tx.debt_id) {
        continue
      }

      result.set(
        tx.debt_id,
        (result.get(tx.debt_id) || 0) +
          Math.round(safeNum(tx.amount) * 100)
      )
    }

    return result
  }, [transactions])

  const openDebtReceivables = useMemo(() => {
    return (localDebts || [])
      .map((debt: any) => {
        const totalCents = Math.round(
          safeNum(debt.total_amount) * 100
        )
        const paidCents =
          debtPaymentsById.get(debt.id) || 0
        const status =
          debt.status === 'cancelled'
            ? 'cancelled'
            : getDebtStatusFromAmounts(
                totalCents,
                paidCents
              )
        const remaining = getDebtRemainingAmount(
          safeNum(debt.total_amount),
          paidCents / 100
        )

        return {
          ...debt,
          paid_amount: paidCents / 100,
          remaining,
          status,
        }
      })
      .filter(
        (debt: any) =>
          debt.status !== 'paid' &&
          debt.status !== 'cancelled' &&
          debt.remaining > 0
      )
  }, [localDebts, debtPaymentsById])

  const isCurrentMonth =
    format(currentDate, 'yyyy-MM') ===
    format(new Date(), 'yyyy-MM')

  const debtReceivablesForPeriod = useMemo(() => {
    return openDebtReceivables.filter(
      (debt: any) => {
        const dueDate = String(
          debt.due_date || ''
        )

        if (!dueDate) {
          return isCurrentMonth
        }

        const dueState = getDebtDueState(debt.due_date)
        if (dueState.isOverdue || dueState.isToday) {
          return true
        }

        return (
          isCurrentMonth &&
          dueDate < startMonth
        )
      }
    )
  }, [
    openDebtReceivables,
    startMonth,
    endMonth,
    isCurrentMonth,
  ])

  // ✅ FILTROS
  const filtered = transactionsWithJoin.filter((t: any) => {
    if (t.date < startMonth || t.date > endMonth) return false

    if (quickFilter === 'income' && t.type !== 'income') return false
    if (quickFilter === 'expense' && t.type !== 'expense' && t.type !== 'sangria') return false
    if (quickFilter === 'transfer' && t.type !== 'transfer') return false
    if (
      quickFilter === 'pending' &&
      t.status !== 'pending'
    ) {
      return false
    }

    if (quickFilter === 'pending') {
      const direction = getPendingDirection(t)

      if (
        pendingKind === 'payable' &&
        direction !== 'payable'
      ) {
        return false
      }

      if (
        pendingKind === 'receivable' &&
        direction !== 'receivable'
      ) {
        return false
      }
    }

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
      const dateA = String(
        a.date || a.created_at || ''
      )
      const dateB = String(
        b.date || b.created_at || ''
      )

      return dateA.localeCompare(dateB) * orderMult
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

  const pendingSummaryTxs = transactionsWithJoin.filter(
    (tx: any) => {
      if (
        tx.date < startMonth ||
        tx.date > endMonth ||
        tx.status !== 'pending'
      ) {
        return false
      }

      if (
        advFilters.status !== 'all' &&
        advFilters.status !== 'pending'
      ) {
        return false
      }

      if (
        advFilters.accountId &&
        tx.account_id !== advFilters.accountId
      ) {
        return false
      }

      if (
        advFilters.categoryId &&
        tx.category_id !== advFilters.categoryId
      ) {
        return false
      }

      if (
        advFilters.minAmount &&
        safeNum(tx.amount) <
          safeNum(advFilters.minAmount)
      ) {
        return false
      }

      if (
        advFilters.maxAmount &&
        safeNum(tx.amount) >
          safeNum(advFilters.maxAmount)
      ) {
        return false
      }

      if (search) {
        const term = search.toLowerCase()
        const description = String(
          tx.description || ''
        ).toLowerCase()
        const category = String(
          tx.categories?.name || ''
        ).toLowerCase()
        const notes = String(
          tx.notes || ''
        ).toLowerCase()

        if (advFilters.searchNotes) {
          return (
            description.includes(term) ||
            category.includes(term) ||
            notes.includes(term)
          )
        }

        return (
          description.includes(term) ||
          category.includes(term)
        )
      }

      return true
    }
  )

  const pendingTxs = filtered.filter(
    (tx: any) => tx.status === 'pending'
  )
  const displayTxs = filtered
  const grouped = groupByDate(displayTxs)

  const debtSearchTerm = search
    .trim()
    .toLowerCase()

  const visibleDebtReceivables = useMemo(() => {
    if (quickFilter !== 'pending') return []

    if (pendingKind === 'payable') return []

    if (
      advFilters.accountId ||
      advFilters.categoryId ||
      advFilters.status === 'done'
    ) {
      return []
    }

    return debtReceivablesForPeriod
      .filter((debt: any) => {
        if (advFilters.minAmount) {
          if (
            safeNum(debt.remaining) <
            safeNum(advFilters.minAmount)
          ) {
            return false
          }
        }

        if (advFilters.maxAmount) {
          if (
            safeNum(debt.remaining) >
            safeNum(advFilters.maxAmount)
          ) {
            return false
          }
        }

        if (!debtSearchTerm) return true

        const person = String(
          debt.person_name || ''
        ).toLowerCase()
        const description = String(
          debt.description || ''
        ).toLowerCase()

        return (
          person.includes(debtSearchTerm) ||
          description.includes(debtSearchTerm)
        )
      })
      .sort((a: any, b: any) => {
        const dueA = String(
          a.due_date || '9999-12-31'
        )
        const dueB = String(
          b.due_date || '9999-12-31'
        )

        return dueA.localeCompare(dueB)
      })
  }, [
    quickFilter,
    pendingKind,
    advFilters.accountId,
    advFilters.categoryId,
    advFilters.status,
    advFilters.minAmount,
    advFilters.maxAmount,
    debtReceivablesForPeriod,
    debtSearchTerm,
  ])

  const pendingCardDebts =
    quickFilter === 'all' ||
    quickFilter === 'income'
      ? debtReceivablesForPeriod.filter(
          (debt: any) => {
            if (!debtSearchTerm) return true

            return (
              String(debt.person_name || '')
                .toLowerCase()
                .includes(debtSearchTerm) ||
              String(debt.description || '')
                .toLowerCase()
                .includes(debtSearchTerm)
            )
          }
        )
      : []

  const pendingPayableTotal = pendingSummaryTxs
    .filter(
      (tx: any) =>
        getPendingDirection(tx) === 'payable'
    )
    .reduce(
      (sum: number, tx: any) =>
        sum + safeNum(tx.amount),
      0
    )

  const pendingReceivableTxTotal = pendingSummaryTxs
    .filter((tx: any) =>
      isStandalonePendingReceivable(tx)
    )
    .reduce(
      (sum: number, tx: any) =>
        sum + safeNum(tx.amount),
      0
    )

  const pendingDebtTotal =
    debtReceivablesForPeriod.reduce(
      (sum: number, debt: any) =>
        sum + safeNum(debt.remaining),
      0
    )

  const pendingReceivableTotal =
    pendingReceivableTxTotal +
    pendingDebtTotal

  const hasVisibleRows =
    displayTxs.length > 0 ||
    visibleDebtReceivables.length > 0

  const sortedDates = Object.keys(grouped).sort(
    (a, b) =>
      advFilters.sortOrder === 'desc'
        ? b.localeCompare(a)
        : a.localeCompare(b)
  )

  // ✅ REMOVIDO useEffect com reload

  useEffect(() => {
    setLoadingPulse(pageLoading)
  }, [pageLoading])

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

      {(pageLoading || pendingCount > 0) && (
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

          {quickFilter === 'pending' && (
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-[14px] border border-gray-200/70 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
              {[
                {
                  key: 'all',
                  label: 'Tudo',
                  display: `${
                    pendingSummaryTxs.length +
                    debtReceivablesForPeriod.length
                  } itens`,
                },
                {
                  key: 'payable',
                  label: 'A pagar',
                  display: formatCurrency(
                    pendingPayableTotal
                  ),
                },
                {
                  key: 'receivable',
                  label: 'A receber',
                  display: formatCurrency(
                    pendingReceivableTotal
                  ),
                },
              ].map((option) => (
                <button
                  type="button"
                  key={option.key}
                  onClick={() =>
                    setPendingKind(
                      option.key as PendingKind
                    )
                  }
                  className={`rounded-[11px] px-2 py-2 text-center transition-all active:scale-[0.97] ${
                    pendingKind === option.key
                      ? option.key === 'payable'
                        ? 'bg-red-50 text-red-600 shadow-sm dark:bg-red-500/10 dark:text-red-400'
                        : option.key === 'receivable'
                          ? 'bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'bg-gray-100 text-gray-900 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-gray-400 hover:bg-gray-50 dark:text-gray-500 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <span className="block text-[10px] font-bold">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] font-semibold tabular-nums opacity-80">
                    {option.display}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-3">
        {pageLoading ? (
          <TransactionsSkeleton />
        ) : !hasVisibleRows ? (
          <div className="flex flex-col items-center py-20 text-gray-400 dark:text-gray-500 animate-in fade-in duration-300">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gray-200/70 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <ReceiptText
                size={28}
                className="opacity-30"
              />
            </div>
            <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">
              Nenhum registro
            </p>
            <p className="mt-1 max-w-[240px] text-center text-[12px] text-gray-400 dark:text-gray-500">
              {quickFilter === 'pending'
                ? 'Nenhuma conta a pagar ou valor a receber neste período.'
                : 'Tente alterar os filtros ou adicione um novo registro.'}
            </p>
          </div>
        ) : (
          <>
            {quickFilter !== 'pending' &&
              !hasAdvancedFilters &&
              (pendingTxs.length > 0 ||
                pendingCardDebts.length > 0) && (
                <PendingCard
                  txs={pendingTxs}
                  debts={pendingCardDebts}
                  loading={false}
                />
              )}

            {quickFilter === 'pending' &&
              visibleDebtReceivables.length > 0 && (
                <div className="mb-4">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-emerald-600 dark:text-emerald-400">
                      Quem me deve
                    </p>
                    <div className="h-px flex-1 bg-emerald-100 dark:bg-emerald-500/10" />
                  </div>

                  <div className="overflow-hidden rounded-[18px] border border-emerald-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.025)] dark:border-emerald-500/10 dark:bg-slate-800/80">
                    {visibleDebtReceivables.map(
                      (debt: any, index: number) => (
                        <button
                          key={debt.id}
                          type="button"
                          onClick={() =>
                            router.push(
                              `/debts/details?id=${encodeURIComponent(debt.id)}`
                            )
                          }
                          className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-emerald-50/40 active:bg-emerald-50 dark:hover:bg-emerald-500/5 ${
                            index !==
                            visibleDebtReceivables.length -
                              1
                              ? 'border-b border-gray-100 dark:border-slate-700/55'
                              : ''
                          }`}
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                            <User size={19} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                              {debt.person_name ||
                                'Valor a receber'}
                            </p>
                            <p className="mt-0.5 truncate text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400">
                              A receber
                              {debt.due_date
                                ? ` · ${dateLabel(
                                    debt.due_date
                                  )}`
                                : ' · Sem vencimento'}
                            </p>
                          </div>

                          <p className="shrink-0 text-[14px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            +{formatCurrency(
                              debt.remaining
                            )}
                          </p>
                        </button>
                      )
                    )}
                  </div>
                </div>
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
