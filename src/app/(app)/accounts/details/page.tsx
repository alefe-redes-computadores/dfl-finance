'use client'

import { useState, useCallback, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createPortal } from "react-dom"
import {
  ArrowLeft, Trash2, RefreshCw, Pencil, Wallet, Building2, CreditCard,
  PiggyBank, ChevronDown, ArrowUpCircle, ArrowDownCircle, Loader2, ArrowRightLeft, X
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useAccountById } from "@/hooks/useAccountById"
import { useAccountTransactions } from "@/hooks/useAccountTransactions"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from '@/lib/hooks/useAuth'
import Skeleton from '@/components/Skeleton'
import { db, addToSyncQueue } from '@/lib/db'

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

const safeNum = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

function AccountDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountId = searchParams.get('id')
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { context } = useContext_()
  const { user } = useAuth()

  // ✅ CORRETO: TODOS OS HOOKS SÃO CHAMADOS PRIMEIRO, SEM CONDICIONAIS
  // Hook por ID
  const { data: accountData, loading, notFound } = useAccountById(accountId)
  // Hook de relacionamento (transações)
  const { data: transactions } = useAccountTransactions(accountId)
  // Dados auxiliares para o modal de transferência
  const { data: allAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context },
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

  // ✅ AGORA PODEMOS TER RETORNOS CONDICIONAIS
  if (!accountId) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 p-6 dark:bg-slate-950">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10">
            <X size={32} />
          </div>
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">Conta não identificada</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">O ID da conta não foi fornecido na URL.</p>
          <button
            onClick={() => router.back()}
            className="mt-6 inline-flex items-center gap-2 rounded-[20px] bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
          >
            <ArrowLeft size={18} />
            Voltar
          </button>
        </div>
      </div>
    )
  }

  // 🔥 Estados de carregamento
  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-gray-50 dark:bg-slate-950">
        <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 px-4 pb-4 pt-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-slate-800" />
        </div>
        <div className="flex-1 px-4 pt-6">
          <Skeleton count={4} />
        </div>
      </div>
    )
  }

  if (notFound || !accountData) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 p-6 dark:bg-slate-950">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10">
            <X size={32} />
          </div>
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">Conta não encontrada</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">A conta que você procura não existe ou foi removida.</p>
          <button
            onClick={() => router.back()}
            className="mt-6 inline-flex items-center gap-2 rounded-[20px] bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
          >
            <ArrowLeft size={18} />
            Voltar
          </button>
        </div>
      </div>
    )
  }

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
      const txId = crypto.randomUUID()
      let newBalance = 0

      await db.transaction('rw', db.accounts, db.transactions, db.syncQueue, async () => {
        const acc = await db.table('accounts').get(accountId)
        if (!acc) throw new Error('Conta não encontrada')

        newBalance = safeNum(acc.balance) + amount
        await db.table('accounts').update(accountId, { balance: newBalance })
        await addToSyncQueue(user.id, 'accounts', 'update', accountId, { balance: newBalance })

        const newTx = {
          id: txId,
          user_id: acc.user_id,
          description: adjustNotes || "Ajuste de saldo",
          amount: Math.abs(amount),
          type: amount >= 0 ? "income" : "expense",
          account_id: accountId,
          date: new Date().toISOString().split("T")[0],
          status: "done",
          context,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }

        await db.table('transactions').add(newTx)
        await addToSyncQueue(user.id, 'transactions', 'create', txId, newTx)
      })

      success()
      showToast("✅ Saldo ajustado com sucesso!", "success")
      setShowAdjustModal(false)
      setAdjustAmount("")
      setAdjustNotes("")
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ ${err?.message || "Erro ao ajustar saldo"}`, "error")
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
      const fromTxId = crypto.randomUUID()
      const toTxId = crypto.randomUUID()
      const today = new Date().toISOString().split("T")[0]

      await db.transaction('rw', db.accounts, db.transactions, db.syncQueue, async () => {
        const fromAcc = await db.table('accounts').get(accountId)
        const toAcc = await db.table('accounts').get(transferToAccount)

        if (!fromAcc) throw new Error('Conta origem não encontrada')
        if (!toAcc) throw new Error('Conta destino não encontrada')

        const fromTx = {
          id: fromTxId,
          user_id: fromAcc.user_id,
          description: transferNotes || `Transferência para ${toAcc.name}`,
          amount,
          type: 'transfer',
          account_id: accountId,
          transfer_to: transferToAccount,
          date: today,
          status: 'done',
          context,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }

        await db.table('transactions').add(fromTx)
        await addToSyncQueue(user.id, 'transactions', 'create', fromTxId, fromTx)

        const toTx = {
          id: toTxId,
          user_id: toAcc.user_id,
          description: transferNotes || `Transferência de ${fromAcc.name}`,
          amount,
          type: 'transfer',
          account_id: transferToAccount,
          transfer_from: accountId,
          date: today,
          status: 'done',
          context,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }

        await db.table('transactions').add(toTx)
        await addToSyncQueue(user.id, 'transactions', 'create', toTxId, toTx)

        const newFromBalance = safeNum(fromAcc.balance) - amount
        await db.table('accounts').update(accountId, { balance: newFromBalance })
        await addToSyncQueue(user.id, 'accounts', 'update', accountId, { balance: newFromBalance })

        const newToBalance = safeNum(toAcc.balance) + amount
        await db.table('accounts').update(transferToAccount, { balance: newToBalance })
        await addToSyncQueue(user.id, 'accounts', 'update', transferToAccount, { balance: newToBalance })
      })

      success()
      showToast("✅ Transferência realizada com sucesso!", "success")
      setShowTransferModal(false)
      setTransferAmount("")
      setTransferToAccount("")
      setTransferNotes("")
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ ${err?.message || "Erro ao transferir"}`, "error")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!user) return
    vibrate([10, 50])

    if (!confirm("Tem certeza que deseja excluir esta conta?")) return

    try {
      await db.table('accounts').delete(accountId)
      await addToSyncQueue(user.id, 'accounts', 'delete', accountId, { id: accountId })
      success()
      showToast("🗑️ Conta excluída com sucesso!", "success")
      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro ao excluir: ${err.message}`, "error")
    }
  }

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

  const Icon = ACCOUNT_ICONS[accountData.type] || Wallet

  const sortedTransactions = [...(transactions || [])].sort(
    (a: any, b: any) =>
      new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  )

  const balance = safeNum(accountData.balance)
  const balancePositive = balance >= 0

  return (
    <div className="flex h-[100dvh] flex-col bg-gray-50 dark:bg-slate-950">
      {(loading || pendingCount > 0) && (
        <div className="fixed right-4 top-20 z-50">
          <div className="h-3 w-3 animate-pulse rounded-full bg-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.45)]" />
        </div>
      )}

      {refreshing && (
        <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center pt-6">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-[0_6px_24px_rgba(0,0,0,0.10)] animate-in slide-in-from-top-2 duration-300 dark:bg-slate-800">
            <RefreshCw size={16} className="animate-spin text-teal-600 dark:text-teal-400" />
            <span className="text-[12px] font-semibold text-teal-700 dark:text-teal-300">
              Atualizando...
            </span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 px-4 pb-4 pt-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => {
                vibrate([5])
                router.back()
              }}
              className="rounded-full p-2 -ml-2 text-gray-700 transition-transform active:scale-95 dark:text-gray-200"
            >
              <ArrowLeft size={24} />
            </button>

            <div className="min-w-0">
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                Detalhes da conta
              </p>
              <h1 className="truncate text-[18px] font-semibold text-gray-900 dark:text-gray-100">
                {accountData.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                vibrate([5])
                router.push(`/accounts/new?edit=${accountId}`)
              }}
              className="rounded-full border border-gray-200 bg-white p-2.5 text-gray-700 transition-all active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200"
            >
              <Pencil size={18} />
            </button>

            <button
              onClick={handleDelete}
              className="rounded-full border border-red-100 bg-red-50 p-2.5 text-red-500 transition-all active:scale-95 dark:border-red-900/30 dark:bg-red-950/40"
            >
              <Trash2 size={18} />
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
          <section className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-[18px] ${
                      balancePositive
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                    }`}
                  >
                    <Icon size={28} />
                  </div>

                  <div>
                    <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                      Saldo atual
                    </p>
                    <p className="mt-1 text-[32px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                      {formatCurrency(balance)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-medium text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                  {ACCOUNT_LABELS[accountData.type] || accountData.type}
                </span>

                {accountData.bank && (
                  <span className="rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-medium text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                    {accountData.bank}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 p-4 dark:border-slate-800">
              <button
                onClick={() => {
                  vibrate([5])
                  setShowAdjustModal(true)
                }}
                className="rounded-[18px] bg-teal-600 px-4 py-3.5 text-[14px] font-semibold text-white transition-transform active:scale-[0.98]"
              >
                Ajustar saldo
              </button>

              <button
                onClick={() => {
                  vibrate([5])
                  setShowTransferModal(true)
                }}
                className="rounded-[18px] border border-blue-200 bg-blue-50 px-4 py-3.5 text-[14px] font-semibold text-blue-700 transition-transform active:scale-[0.98] dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
              >
                Transferir
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between px-5 pb-2 pt-5">
              <div>
                <h2 className="text-[16px] font-semibold text-gray-900 dark:text-gray-100">
                  Transações recentes
                </h2>
                <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                  Movimentações ligadas a esta conta
                </p>
              </div>
            </div>

            {sortedTransactions.length === 0 ? (
              <div className="px-5 pb-6 pt-4">
                <div className="rounded-[22px] bg-gray-50 px-4 py-8 text-center dark:bg-slate-800/70">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-slate-700">
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

      {/* MODAL AJUSTAR SALDO */}
      {showAdjustModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center"
          onClick={() => setShowAdjustModal(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg rounded-t-[30px] bg-white p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-[20px] font-semibold text-gray-900 dark:text-gray-100">
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
                className="rounded-full bg-gray-100 p-2 text-gray-500 active:scale-95 dark:bg-slate-800 dark:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-[20px] border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-800/70">
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

              <div className="rounded-[20px] border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-800/70">
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

      {/* MODAL TRANSFERIR */}
      {showTransferModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center"
          onClick={() => setShowTransferModal(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-[30px] bg-white p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-[20px] font-semibold text-gray-900 dark:text-gray-100">
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
                className="rounded-full bg-gray-100 p-2 text-gray-500 active:scale-95 dark:bg-slate-800 dark:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-[20px] border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-800/70">
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

              <div className="relative rounded-[20px] border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-800/70">
                <label className="mb-2 block text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Conta destino
                </label>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <ArrowRightLeft size={18} />
                  </div>

                  <select
                    value={transferToAccount}
                    onChange={(e) => setTransferToAccount(e.target.value)}
                    className="w-full appearance-none bg-transparent pr-8 text-[15px] font-medium text-gray-900 outline-none dark:text-gray-100"
                  >
                    <option value="" disabled>
                      Selecione uma conta...
                    </option>
                    {(allAccounts || [])
                      .filter((a: any) => a.id !== accountId)
                      .map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>

                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 mt-3 text-gray-400"
                />
              </div>

              <div className="rounded-[20px] border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-800/70">
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