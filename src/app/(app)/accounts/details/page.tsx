// src/app/(app)/accounts/details/page.tsx
'use client'

import { formatCivilDateBR } from '@/lib/civilDate'

import { Suspense, useState, useRef, useMemo, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createPortal } from "react-dom"
import {
  ArrowLeft, Trash2, RefreshCw, Pencil, Wallet, Building2, CreditCard,
  PiggyBank, ChevronDown, ArrowUpCircle, ArrowDownCircle, Loader2, ArrowRightLeft, X
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from '@/hooks/useLocalSync'
import { useAccountById } from "@/hooks/useAccountById"
import { useAccountTransactions } from "@/hooks/useAccountTransactions"
import { useSafeDb } from "@/hooks/useSafeDb"
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from '@/lib/hooks/useAuth'
import Skeleton from '@/components/Skeleton'
import BankLogo from '@/components/BankLogo'
import MoneyInput from '@/components/MoneyInput'
import { getAccountInstitutionLabel, getAccountTypeLabel, isAccountArchived, sortAccountsByBalance } from '@/lib/accountPresentation'
import {
  adjustAccountBalance,
  transferBetweenAccounts,
} from '@/lib/accountOperations'
import { repairFutureScheduledTransactions } from '@/lib/futureTransactionOperations'

const ACCOUNT_ICONS: Record<string, any> = {
  checking: Wallet,
  savings: PiggyBank,
  digital: Wallet,
  investment: Building2,
  credit_card: CreditCard,
  wallet: Wallet,
  other: Wallet,
}

const safeNum = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value).trim().replace(/\s/g, '').replace(/^R\$/i, '')
  if (!raw) return 0
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  const parsed = Number(normalized.replace(/[^0-9.-]+/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function AccountDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  //  PEGA O ID CORRETAMENTE E FAZ VALIDAÇÃO
  const rawId = searchParams?.get('id')
  const accountId = useMemo(() => {
    if (!rawId || rawId === 'null' || rawId === 'undefined') return null
    return rawId.trim()
  }, [rawId])
  
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  const { safeDelete } = useSafeDb()

  //  SÓ CHAMA O HOOK SE TIVER ID VÁLIDO
  const { data: accountData, loading, notFound } = useAccountById(accountId)
  const { data: transactions, loading: txLoading } = useAccountTransactions(accountId)
  const { data: allAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context: accountData?.context },
  })

  const [refreshing, setRefreshing] = useState(false)
  const [expandedTransactions, setExpandedTransactions] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState(0)
  const [adjustMode, setAdjustMode] = useState<'increase' | 'decrease'>('increase')
  const [adjustNotes, setAdjustNotes] = useState("")
  const [transferAmount, setTransferAmount] = useState(0)
  const [transferToAccount, setTransferToAccount] = useState("")
  const [transferNotes, setTransferNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    if (!user?.id) return

    repairFutureScheduledTransactions(user.id).catch((error) => {
      console.error(
        'Erro ao reparar lançamentos futuros:',
        error
      )
    })
  }, [user?.id])

  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        vibrate([10])
        setTimeout(() => setRefreshing(false), 600)
      }
    }
  }, [refreshing, vibrate])

  //  TRATAMENTO DE ID AUSENTE - MAIS ROBUSTO
  if (!accountId) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f8f9fa] p-6 dark:bg-slate-950">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] border border-red-100 bg-red-50 text-red-500 shadow-sm dark:border-red-900/30 dark:bg-red-500/10">
            <X size={32} />
          </div>
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">Conta não identificada</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">O ID da conta não foi fornecido na URL.</p>
          <button
            onClick={() => router.push('/accounts')}
            className="mt-6 inline-flex items-center gap-2 rounded-[18px] bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition-colors hover:bg-teal-700"
          >
            <ArrowLeft size={18} />
            Voltar para contas
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#f6f7f8] dark:bg-slate-950">
        <div className="sticky top-0 z-30 border-b border-gray-200/60 bg-white/90 px-4 pb-4 pt-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
          <div className="h-10 w-10 animate-pulse rounded-[16px] bg-gray-200 dark:bg-slate-800" />
        </div>
        <div className="flex-1 px-4 pt-6">
          <Skeleton count={4} />
        </div>
      </div>
    )
  }

  if (notFound || !accountData) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f8f9fa] p-6 dark:bg-slate-950">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] border border-red-100 bg-red-50 text-red-500 shadow-sm dark:border-red-900/30 dark:bg-red-500/10">
            <X size={32} />
          </div>
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">Conta não encontrada</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">A conta que você procura não existe ou foi removida.</p>
          <button
            onClick={() => router.push('/accounts')}
            className="mt-6 inline-flex items-center gap-2 rounded-[18px] bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition-colors hover:bg-teal-700"
          >
            <ArrowLeft size={18} />
            Voltar para contas
          </button>
        </div>
      </div>
    )
  }

  const account = accountData

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)

  const formatDate = (date: string | null) =>
    formatCivilDateBR(date)

  const handleAdjustBalance = async () => {
    if (!user) return

    const absoluteAmount = Math.abs(adjustAmount)
    const amount = adjustMode === 'decrease' ? -absoluteAmount : absoluteAmount

    if (!Number.isFinite(absoluteAmount) || absoluteAmount === 0) {
      errorHaptic()
      showToast("Informe um valor para ajuste", "warning")
      return
    }

    setSaving(true)

    try {
      await adjustAccountBalance({
        userId: user.id,
        accountId,
        amount,
        description: adjustNotes,
      })

      success()
      showToast("Saldo ajustado com sucesso!", "success")
      setShowAdjustModal(false)
      setAdjustAmount(0)
      setAdjustMode('increase')
      setAdjustNotes("")
    } catch (err: any) {
      errorHaptic()
      showToast(
        `${err?.message || "Erro ao ajustar saldo"}`,
        "error"
      )
    } finally {
      setSaving(false)
    }
  }

  const handleTransfer = async () => {
    if (!user) return

    const amount = transferAmount

    if (!Number.isFinite(amount) || amount <= 0) {
      errorHaptic()
      showToast("Informe um valor válido", "warning")
      return
    }

    if (!transferToAccount) {
      errorHaptic()
      showToast("Selecione a conta de destino", "warning")
      return
    }

    setSaving(true)

    try {
      await transferBetweenAccounts({
        userId: user.id,
        fromAccountId: accountId,
        toAccountId: transferToAccount,
        amount,
        description: transferNotes,
      })

      success()
      showToast("Transferência realizada com sucesso!", "success")
      setShowTransferModal(false)
      setTransferAmount(0)
      setTransferToAccount("")
      setTransferNotes("")
    } catch (err: any) {
      errorHaptic()
      showToast(
        `${err?.message || "Erro ao transferir"}`,
        "error"
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!user) return
    vibrate([10, 50])
    try {
      const result = await safeDelete('accounts', accountId)
      if (!result.success) throw new Error(result.error || 'Erro ao excluir conta')
      success()
      showToast('Conta excluída com sucesso!', 'success')
      setShowDeleteModal(false)
      router.replace('/accounts')
    } catch (err: any) {
      errorHaptic()
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const Icon = ACCOUNT_ICONS[account.type || ''] || Wallet
  const todayIso = new Date().toLocaleDateString('en-CA')
  const sortedTransactions = [...(transactions || [])]
    .filter(
      (transaction: any) =>
        transaction.status === 'done' &&
        String(transaction.date || '') <= todayIso
    )
    .sort(
      (a: any, b: any) =>
        new Date(b.date || 0).getTime() -
        new Date(a.date || 0).getTime()
    )
  const balance = safeNum(account.balance)
  const adjustSignedAmount =
    adjustMode === 'decrease' ? -Math.abs(adjustAmount) : Math.abs(adjustAmount)
  const adjustedBalancePreview = balance + adjustSignedAmount
  const balancePositive = balance >= 0
  const bankName = getAccountInstitutionLabel(account)

  const targetAccounts = sortAccountsByBalance((allAccounts || []).filter((a: any) => a.id !== accountId && !isAccountArchived(a)))

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f8f9fa] dark:bg-slate-950">
      {(loading || pendingCount > 0) && (
        <div className="fixed right-4 top-20 z-50">
          <div className="h-3 w-3 animate-pulse rounded-full bg-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.45)]" />
        </div>
      )}

      {refreshing && (
        <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center pt-6">
          <div className="flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 shadow-[0_6px_24px_rgba(0,0,0,0.10)] animate-in slide-in-from-top-2 duration-300 dark:border-white/10 dark:bg-slate-800">
            <RefreshCw size={16} className="animate-spin text-teal-600 dark:text-teal-400" />
            <span className="text-[12px] font-semibold text-teal-700 dark:text-teal-300">
              Atualizando...
            </span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 border-b border-black/5 bg-[#f6f7f8]/92 px-4 pb-3 pt-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/92">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => {
                vibrate([5])
                router.push('/accounts')
              }}
              className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-black/5 bg-white text-gray-600 shadow-sm transition-transform active:scale-95 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="min-w-0">
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                Detalhes da conta
              </p>
              <h1 className="truncate text-[18px] font-semibold tracking-tight text-gray-950 dark:text-white">
                {account.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                vibrate([5])
                router.push(`/accounts/new?edit=${accountId}`)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-black/5 bg-white text-gray-600 shadow-sm transition-all active:scale-95 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300"
            >
              <Pencil size={17} />
            </button>

            <button
              onClick={() => { vibrate([10]); setShowDeleteModal(true) }}
              className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-red-100 bg-white text-red-500 shadow-sm transition-all active:scale-95 dark:border-red-900/30 dark:bg-slate-900"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-y-auto px-4 pb-28 pt-3"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <section className="overflow-hidden rounded-[22px] bg-slate-950 text-white shadow-sm dark:bg-slate-900">
            <div className="relative overflow-hidden px-5 pb-4 pt-4">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-400/10 via-transparent to-transparent" />
              <div className="relative">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <BankLogo color={account.color} name={bankName || account.name} size="lg" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                        Saldo atual
                      </p>
                      <p className="mt-1 text-[32px] font-semibold tracking-tight text-white">
                        {formatCurrency(balance)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-slate-300">
                    {getAccountTypeLabel(account.type)}
                  </span>

                  <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-slate-300">
                    <BankLogo name={bankName} size="sm" />
                    <span>{bankName}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-3">
              <button
                onClick={() => {
                  vibrate([5])
                  setAdjustAmount(0)
                  setAdjustMode('increase')
                  setAdjustNotes("")
                  setShowAdjustModal(true)
                }}
                className="flex items-center justify-center gap-2 rounded-[15px] bg-teal-500 px-3 py-3 text-[13px] font-semibold text-white transition-transform active:scale-[0.98]"
              >
                <ArrowUpCircle size={18} />
                Ajustar saldo
              </button>

              <button
                onClick={() => {
                  vibrate([5])
                  setShowTransferModal(true)
                }}
                className="flex items-center justify-center gap-2 rounded-[15px] border border-white/10 bg-white/10 px-3 py-3 text-[13px] font-semibold text-white transition-transform active:scale-[0.98]"
              >
                <ArrowRightLeft size={18} />
                Transferir
              </button>
            </div>
          </section>

          <section className="rounded-[22px] border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="px-4 pb-2 pt-4">
              <h2 className="text-[15px] font-semibold text-gray-950 dark:text-gray-100">
                Transações recentes
              </h2>
              <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                Movimentações ligadas a esta conta
              </p>
            </div>

            {sortedTransactions.length === 0 ? (
              <div className="px-5 pb-6 pt-4">
                <div className="rounded-[22px] border border-dashed border-black/10 bg-gray-50 px-4 py-8 text-center dark:border-white/10 dark:bg-slate-800/70">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[16px] bg-white shadow-sm dark:bg-slate-700">
                    <RefreshCw size={18} className="text-gray-400" />
                  </div>
                  <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">
                    Nenhuma movimentação nesta conta.
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-3 pb-3">
                {sortedTransactions
                  .slice(0, expandedTransactions ? undefined : 5)
                  .map((tx: any) => {
                    const isIncoming =
                      tx.type === 'income' ||
                      (tx.type === 'transfer' && tx.description?.includes('de '))

                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-3 rounded-[16px] px-3 py-2.5 transition-colors active:bg-gray-50 dark:active:bg-slate-800"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${
                              isIncoming
                                ? "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400"
                                : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"
                            }`}
                          >
                            {isIncoming ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-medium text-gray-900 dark:text-gray-100">
                              {tx.description || "Sem descrição"}
                            </p>
                            <span className="text-[12px] text-gray-500 dark:text-gray-400">
                              {formatDate(tx.date)}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 text-[14px] font-semibold ${
                            isIncoming
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-500 dark:text-red-400"
                          }`}
                        >
                          {isIncoming ? '+' : '-'} {formatCurrency(Math.abs(safeNum(tx.amount)))}
                        </span>
                      </div>
                    )
                  })}

                {sortedTransactions.length > 5 && (
                  <div className="px-2 pt-2">
                    <button
                      onClick={() => {
                        vibrate([5])
                        setExpandedTransactions(!expandedTransactions)
                      }}
                      className="flex w-full items-center justify-center gap-1 rounded-[16px] bg-gray-50 py-3 text-[13px] font-medium text-teal-700 transition-colors active:scale-95 dark:bg-slate-800 dark:text-teal-300"
                    >
                      {expandedTransactions ? "Recolher transações" : `Ver todas (${sortedTransactions.length})`}
                      <ChevronDown
                        size={14}
                        className={`transition-transform ${expandedTransactions ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {showDeleteModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setShowDeleteModal(false)}>
          <div className="w-full max-w-sm rounded-t-[32px] bg-white p-6 shadow-2xl dark:bg-slate-900 sm:rounded-[32px]" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10"><Trash2 size={28} /></div>
            <h3 className="text-center text-[20px] font-semibold text-gray-900 dark:text-gray-100">Excluir conta</h3>
            <p className="mt-2 text-center text-[13px] leading-5 text-gray-500 dark:text-gray-400">A conta só será excluída se não houver dependências que precisem ser preservadas.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="flex-1 rounded-[18px] bg-gray-100 py-3.5 text-[14px] font-semibold text-gray-600 dark:bg-slate-800 dark:text-gray-300">Cancelar</button>
              <button type="button" onClick={handleDelete} className="flex-1 rounded-[18px] bg-red-500 py-3.5 text-[14px] font-semibold text-white shadow-lg shadow-red-500/20">Excluir</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showAdjustModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center sm:items-center sm:p-5"
          onClick={() => setShowAdjustModal(false)}
        >
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
          <div
            className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[32px] border border-black/5 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_rgba(15,23,42,0.20)] animate-in slide-in-from-bottom-8 duration-300 dark:border-white/10 dark:bg-slate-900 sm:rounded-[32px] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-gray-200 dark:bg-slate-700 sm:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <BankLogo color={account.color} name={bankName || account.name} size="md" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                    {account.name}
                  </p>
                  <h3 className="mt-0.5 text-[21px] font-semibold tracking-tight text-gray-950 dark:text-white">
                    Ajustar saldo
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  vibrate([5])
                  setShowAdjustModal(false)
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gray-100 text-gray-500 transition-transform active:scale-95 dark:bg-slate-800 dark:text-gray-300"
                aria-label="Fechar ajuste de saldo"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  vibrate([5])
                  setAdjustMode('increase')
                }}
                aria-pressed={adjustMode === 'increase'}
                className={`flex min-h-14 items-center justify-center gap-2 rounded-[18px] border px-3 text-[13px] font-semibold transition-all active:scale-[0.98] ${
                  adjustMode === 'increase'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-black/5 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-slate-800 dark:text-gray-400'
                }`}
              >
                <ArrowUpCircle size={18} />
                Adicionar
              </button>

              <button
                type="button"
                onClick={() => {
                  vibrate([5])
                  setAdjustMode('decrease')
                }}
                aria-pressed={adjustMode === 'decrease'}
                className={`flex min-h-14 items-center justify-center gap-2 rounded-[18px] border px-3 text-[13px] font-semibold transition-all active:scale-[0.98] ${
                  adjustMode === 'decrease'
                    ? 'border-red-200 bg-red-50 text-red-600 shadow-sm dark:border-red-900/50 dark:bg-red-500/10 dark:text-red-300'
                    : 'border-black/5 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-slate-800 dark:text-gray-400'
                }`}
              >
                <ArrowDownCircle size={18} />
                Reduzir
              </button>
            </div>

            <div className="mt-3 rounded-[24px] border border-black/5 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-800/70">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-400">
                  Valor do ajuste
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  adjustMode === 'increase'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300'
                }`}>
                  {adjustMode === 'increase' ? '+' : '−'}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="text-[17px] font-semibold text-gray-400">R$</span>
                <MoneyInput
                  value={Math.abs(adjustAmount)}
                  onChange={(value) => setAdjustAmount(Math.abs(value))}
                  ariaLabel="Valor do ajuste de saldo"
                  className="w-full bg-transparent text-[30px] font-semibold tracking-tight text-gray-950 outline-none placeholder:text-gray-300 dark:text-white dark:placeholder:text-gray-600"
                  autoFocus
                />
              </div>
            </div>

            <div className="mt-3 rounded-[22px] border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium text-gray-400">Saldo atual</p>
                  <p className="mt-1 text-[15px] font-semibold text-gray-700 dark:text-gray-200">
                    {formatCurrency(balance)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium text-gray-400">Após o ajuste</p>
                  <p className={`mt-1 text-[18px] font-bold ${
                    adjustedBalancePreview < 0
                      ? 'text-red-500'
                      : 'text-gray-950 dark:text-white'
                  }`}>
                    {formatCurrency(adjustedBalancePreview)}
                  </p>
                </div>
              </div>

              {adjustMode === 'decrease' && adjustedBalancePreview < 0 && (
                <p className="mt-3 rounded-[14px] bg-red-50 px-3 py-2 text-[11px] font-medium leading-4 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                  O saldo ficará negativo. O ajuste será permitido normalmente.
                </p>
              )}
            </div>

            <div className="mt-3 rounded-[22px] border border-black/5 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-800/70">
              <label className="mb-2 block text-[12px] font-medium text-gray-500 dark:text-gray-400">
                Observação
              </label>
              <input
                type="text"
                placeholder="Ex: Ajuste de final de mês"
                value={adjustNotes}
                onChange={(event) => setAdjustNotes(event.target.value)}
                className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                vibrate([10, 50])
                handleAdjustBalance()
              }}
              disabled={saving || Math.abs(adjustAmount) === 0}
              className={`mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-[20px] px-4 text-[15px] font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-45 ${
                adjustMode === 'increase'
                  ? 'bg-emerald-600 shadow-emerald-600/20'
                  : 'bg-red-500 shadow-red-500/20'
              }`}
            >
              {saving ? (
                <Loader2 className="animate-spin" size={22} />
              ) : (
                <>
                  {adjustMode === 'increase' ? <ArrowUpCircle size={19} /> : <ArrowDownCircle size={19} />}
                  {adjustMode === 'increase' ? 'Adicionar ao saldo' : 'Reduzir do saldo'}
                </>
              )}
            </button>
          </div>
        </div>,
        document.body
      )}

      {showTransferModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center"
          onClick={() => setShowTransferModal(false)}
        >
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-[32px] border border-black/5 bg-white p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 dark:border-white/10 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[20px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  Transferir
                </h3>
                <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
                  Mova saldo entre suas contas
                </p>
              </div>

              <button
                onClick={() => {
                  vibrate([5])
                  setShowTransferModal(false)
                }}
                className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gray-100 text-gray-500 transition-transform active:scale-95 dark:bg-slate-800 dark:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-[22px] border border-black/5 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-800/70">
                <label className="mb-2 block text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Valor
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[18px] font-medium text-gray-400">R$</span>
                  <MoneyInput
                    value={transferAmount}
                    onChange={(value) => setTransferAmount(value)}
                    ariaLabel="Valor da transferência"
                    className="w-full bg-transparent text-[28px] font-semibold tracking-tight text-gray-900 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
                    autoFocus
                  />
                </div>
              </div>

              <div className="rounded-[22px] border border-black/5 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-800/70">
                <label className="mb-3 block text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Conta destino
                </label>

                <div className="space-y-2">
                  {targetAccounts.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-black/10 bg-white px-4 py-4 text-[13px] text-gray-500 dark:border-white/10 dark:bg-slate-900 dark:text-gray-400">
                      Nenhuma outra conta disponível.
                    </div>
                  ) : (
                    targetAccounts.map((a: any) => {
                      const institution = getAccountInstitutionLabel(a)
                      const selected = transferToAccount === a.id

                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setTransferToAccount(a.id)}
                          className={`flex w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition-all active:scale-[0.99] ${
                            selected
                              ? 'border-teal-500 bg-teal-50 shadow-sm dark:border-teal-400/50 dark:bg-teal-500/10'
                              : 'border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800'
                          }`}
                        >
                          <BankLogo name={institution} size="lg" />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                              {a.name}
                            </p>
                            <p className="truncate text-[12px] text-gray-500 dark:text-gray-400">
                              {institution} • {getAccountTypeLabel(a.type)}
                            </p>
                          </div>

                          <div className={`h-5 w-5 rounded-full border-2 ${selected ? 'border-teal-600 bg-teal-600' : 'border-gray-300 dark:border-slate-600'}`} />
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="rounded-[22px] border border-black/5 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-800/70">
                <label className="mb-2 block text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Observação
                </label>
                <input
                  type="text"
                  placeholder="Ex: Pagamento de empréstimo"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
                />
              </div>
            </div>

            <button
              onClick={() => {
                vibrate([10, 50])
                handleTransfer()
              }}
              disabled={saving}
              className="mt-6 flex w-full items-center justify-center rounded-[22px] bg-blue-600 py-4 text-[16px] font-semibold text-white shadow-lg shadow-blue-600/20 transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={22} /> : "Confirmar transferência"}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function AccountDetailPage() {
  return (
    <Suspense fallback={<Skeleton count={4} />}>
      <AccountDetailContent />
    </Suspense>
  )
}
