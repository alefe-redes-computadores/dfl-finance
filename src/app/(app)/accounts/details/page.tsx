'use client'

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
import {
  adjustAccountBalance,
  transferBetweenAccounts,
} from '@/lib/accountOperations'

const ACCOUNT_ICONS: Record<string, any> = {
  checking: Wallet,
  savings: PiggyBank,
  investment: Building2,
  credit_card: CreditCard,
  wallet: Wallet,
  other: Wallet,
}

const ACCOUNT_LABELS: Record<string, string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  investment: "Investimento",
  credit_card: "Cartão de Crédito",
  wallet: "Carteira",
  other: "Outro",
}

const BANK_META: Record<string, { label: string; color: string; icon: string }> = {
  nubank: { label: "Nubank", color: "#8A05BE", icon: "N" },
  itau: { label: "Itaú", color: "#EC7000", icon: "I" },
  itaú: { label: "Itaú", color: "#EC7000", icon: "I" },
  bradesco: { label: "Bradesco", color: "#CC092F", icon: "B" },
  santander: { label: "Santander", color: "#EC0000", icon: "S" },
  inter: { label: "Inter", color: "#FF7A00", icon: "I" },
  "banco do brasil": { label: "Banco do Brasil", color: "#FFCD00", icon: "BB" },
  caixa: { label: "Caixa", color: "#005CA9", icon: "C" },
  c6: { label: "C6 Bank", color: "#111111", icon: "C6" },
  picpay: { label: "PicPay", color: "#21C25E", icon: "P" },
  original: { label: "Original", color: "#005C5A", icon: "O" },
  next: { label: "Next", color: "#00E36E", icon: "N" },
  safra: { label: "Safra", color: "#0B3A6E", icon: "S" },
  will: { label: "Will Bank", color: "#7B61FF", icon: "W" },
}

const safeNum = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

const normalizeBankKey = (bank?: string | null) =>
  (bank || '').trim().toLowerCase().replace(/\s+/g, ' ')

function BankBadge({ bank }: { bank?: string | null }) {
  const key = normalizeBankKey(bank)
  const meta = BANK_META[key]

  if (meta) {
    return (
      <div
        className="flex items-center gap-3 rounded-[18px] border border-black/5 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900"
      >
        <div
          className="flex h-11 w-11 items-center justify-center rounded-[14px] text-[12px] font-black text-white shadow-sm"
          style={{ backgroundColor: meta.color }}
        >
          {meta.icon}
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Instituição</p>
          <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
            {meta.label}
          </p>
        </div>
      </div>
    )
  }

  if (!bank?.trim()) {
    return (
      <div className="flex items-center gap-3 rounded-[18px] border border-dashed border-black/10 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-slate-900/60">
        <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gray-200 text-[12px] font-black text-gray-500 dark:bg-slate-700 dark:text-gray-300">
          --
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Instituição</p>
          <p className="truncate text-[14px] font-semibold text-gray-400 dark:text-gray-500">
            Sem banco definido
          </p>
        </div>
      </div>
    )
  }

  const fallback = bank.trim().slice(0, 2).toUpperCase()
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-black/5 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-teal-600 text-[12px] font-black text-white shadow-sm">
        {fallback}
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Instituição</p>
        <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
          {bank}
        </p>
      </div>
    </div>
  )
}

function AccountDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // ✅ PEGA O ID CORRETAMENTE E FAZ VALIDAÇÃO
  const rawId = searchParams?.get('id')
  const accountId = useMemo(() => {
    if (!rawId || rawId === 'null' || rawId === 'undefined') return null
    return rawId.trim()
  }, [rawId])
  
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { context } = useContext_()
  const { user } = useAuth()
  const { safeDelete } = useSafeDb()

  // ✅ SÓ CHAMA O HOOK SE TIVER ID VÁLIDO
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
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustNotes, setAdjustNotes] = useState("")
  const [transferAmount, setTransferAmount] = useState("")
  const [transferToAccount, setTransferToAccount] = useState("")
  const [transferNotes, setTransferNotes] = useState("")
  const [saving, setSaving] = useState(false)

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

  // ✅ TRATAMENTO DE ID AUSENTE - MAIS ROBUSTO
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
      <div className="flex min-h-[100dvh] flex-col bg-[#f8f9fa] dark:bg-slate-950">
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

  const formatDate = (date: string | null) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("pt-BR")
  }

  const handleAdjustBalance = async () => {
    if (!user) return

    const amount = parseFloat(adjustAmount.replace(',', '.'))

    if (!adjustAmount || isNaN(amount) || amount === 0) {
      errorHaptic()
      showToast("⚠️ Informe um valor para ajuste", "warning")
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
      showToast("✅ Saldo ajustado com sucesso!", "success")
      setShowAdjustModal(false)
      setAdjustAmount("")
      setAdjustNotes("")
    } catch (err: any) {
      errorHaptic()
      showToast(
        `❌ ${err?.message || "Erro ao ajustar saldo"}`,
        "error"
      )
    } finally {
      setSaving(false)
    }
  }

  const handleTransfer = async () => {
    if (!user) return

    const amount = parseFloat(transferAmount.replace(',', '.'))

    if (!transferAmount || isNaN(amount) || amount <= 0) {
      errorHaptic()
      showToast("⚠️ Informe um valor válido", "warning")
      return
    }

    if (!transferToAccount) {
      errorHaptic()
      showToast("⚠️ Selecione a conta de destino", "warning")
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
      showToast("✅ Transferência realizada com sucesso!", "success")
      setShowTransferModal(false)
      setTransferAmount("")
      setTransferToAccount("")
      setTransferNotes("")
    } catch (err: any) {
      errorHaptic()
      showToast(
        `❌ ${err?.message || "Erro ao transferir"}`,
        "error"
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!user) return
    vibrate([10, 50])

    if (!confirm("Tem certeza que deseja excluir esta conta?")) return

    try {
      const result = await safeDelete('accounts', accountId)

      if (!result.success) {
        throw new Error(result.error || 'Erro ao excluir conta')
      }

      success()
      showToast("🗑️ Conta excluída com sucesso!", "success")
      router.push('/accounts')
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro ao excluir: ${err.message}`, "error")
    }
  }

  const Icon = ACCOUNT_ICONS[account.type] || Wallet
  const sortedTransactions = [...(transactions || [])].sort(
    (a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  )
  const balance = safeNum(account.balance)
  const balancePositive = balance >= 0
  const bankName = account.bank || ""

  const targetAccounts = (allAccounts || []).filter((a: any) => a.id !== accountId)

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

      <div className="sticky top-0 z-30 border-b border-gray-200/60 bg-white/90 px-4 pt-4 pb-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between rounded-[24px] border border-black/5 bg-white px-4 py-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => {
                vibrate([5])
                router.push('/accounts')
              }}
              className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-black/5 bg-gray-50 text-gray-700 transition-transform active:scale-95 dark:border-white/10 dark:bg-slate-800 dark:text-gray-200"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="min-w-0">
              <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500">
                Detalhes da conta
              </p>
              <h1 className="truncate text-[20px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
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
              className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-black/5 bg-gray-50 text-gray-700 transition-all active:scale-95 dark:border-white/10 dark:bg-slate-800 dark:text-gray-200"
            >
              <Pencil size={17} />
            </button>

            <button
              onClick={handleDelete}
              className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-red-100 bg-red-50 text-red-500 transition-all active:scale-95 dark:border-red-900/30 dark:bg-red-950/40"
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
        className="flex-1 overflow-y-auto px-4 pb-28 pt-5"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <section className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="relative overflow-hidden px-5 pb-5 pt-5">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-transparent dark:from-teal-500/10" />
              <div className="relative">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <BankLogo color={account.color} name={account.name} size="lg" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                        Saldo atual
                      </p>
                      <p className="mt-1 text-[34px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                        {formatCurrency(balance)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-medium text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                    {ACCOUNT_LABELS[account.type] || account.type}
                  </span>

                  <BankBadge bank={bankName} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-black/5 p-4 dark:border-white/10">
              <button
                onClick={() => {
                  vibrate([5])
                  setShowAdjustModal(true)
                }}
                className="flex items-center justify-center gap-2 rounded-[18px] bg-teal-600 px-4 py-3.5 text-[14px] font-semibold text-white shadow-lg shadow-teal-600/15 transition-transform active:scale-[0.98]"
              >
                <ArrowUpCircle size={18} />
                Ajustar saldo
              </button>

              <button
                onClick={() => {
                  vibrate([5])
                  setShowTransferModal(true)
                }}
                className="flex items-center justify-center gap-2 rounded-[18px] border border-blue-200 bg-blue-50 px-4 py-3.5 text-[14px] font-semibold text-blue-700 transition-transform active:scale-[0.98] dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
              >
                <ArrowRightLeft size={18} />
                Transferir
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="px-5 pb-2 pt-5">
              <h2 className="text-[16px] font-semibold text-gray-900 dark:text-gray-100">
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
                        className="flex items-center justify-between gap-3 rounded-[20px] px-3 py-3 transition-colors hover:bg-gray-50 active:scale-[0.99] dark:hover:bg-slate-800"
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

      {showAdjustModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center"
          onClick={() => setShowAdjustModal(false)}
        >
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg rounded-t-[32px] border border-black/5 bg-white p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 dark:border-white/10 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[20px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  Ajustar saldo
                </h3>
                <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
                  Informe um valor positivo ou negativo
                </p>
              </div>

              <button
                onClick={() => {
                  vibrate([5])
                  setShowAdjustModal(false)
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
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-full bg-transparent text-[28px] font-semibold tracking-tight text-gray-900 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
                    autoFocus
                  />
                </div>
              </div>

              <div className="rounded-[22px] border border-black/5 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-800/70">
                <label className="mb-2 block text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Observação
                </label>
                <input
                  type="text"
                  placeholder="Ex: Ajuste de final de mês"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
                />
              </div>
            </div>

            <button
              onClick={() => {
                vibrate([10, 50])
                handleAdjustBalance()
              }}
              disabled={saving}
              className="mt-6 flex w-full items-center justify-center rounded-[22px] bg-teal-600 py-4 text-[16px] font-semibold text-white shadow-lg shadow-teal-600/20 transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={22} /> : "Confirmar ajuste"}
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
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
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
                      const key = normalizeBankKey(a.bank)
                      const meta = BANK_META[key]
                      const selected = transferToAccount === a.id
                      const TypeIcon = ACCOUNT_ICONS[a.type] || Wallet

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
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-white shadow-sm"
                            style={{ backgroundColor: meta?.color || '#0f766e' }}
                          >
                            {meta?.icon ? (
                              <span className="text-[12px] font-black">{meta.icon}</span>
                            ) : (
                              <TypeIcon size={18} />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                              {a.name}
                            </p>
                            <p className="truncate text-[12px] text-gray-500 dark:text-gray-400">
                              {meta?.label || a.bank || 'Sem banco'} • {ACCOUNT_LABELS[a.type] || a.type}
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