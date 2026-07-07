'use client'

import { useState, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  ArrowLeft,
  Trash2,
  RefreshCw,
  Pencil,
  Wallet,
  Building2,
  CreditCard,
  PiggyBank,
  ChevronDown,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { db, addToSyncQueue } from '@/lib/db' // 🔥 ADICIONADO

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

export default function AccountDetailPage() {
  const router = useRouter()
  const params = useParams()
  const accountId = params.id as string
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { context } = useContext_()
  const { user } = useAuth() // 🔥 ADICIONADO para pegar user.id

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

  const { data: localAccounts, loading, reload } = useLocalData({
    table: 'accounts' as any,
    filters: { context },
    orderBy: 'name',
    orderDir: 'asc',
  })

  const { data: allTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context, account_id: accountId },
    orderBy: 'date',
    orderDir: 'desc',
  })

  const accountData = (localAccounts || []).find((a: any) => a.id === accountId) as any
  const transactions = allTransactions || []

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)

  const formatDate = (date: string | null) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("pt-BR")
  }

  // 🔥 CORRIGIDO: Ajuste de saldo com sincronização
  const handleAdjustBalance = async () => {
    if (!user) return
    if (!adjustAmount || parseFloat(adjustAmount) === 0) {
      showToast("Informe um valor para ajuste", "warning")
      errorHaptic()
      return
    }
    setSaving(true)
    try {
      const amount = parseFloat(adjustAmount)
      const newBalance = (accountData?.balance || 0) + amount

      // 1. Atualiza a conta no IndexedDB
      await db.table('accounts').update(accountId, { balance: newBalance })
      // 2. Enfileira a atualização da conta
      await addToSyncQueue(
        user.id,
        'accounts',
        'update',
        accountId,
        { balance: newBalance }
      )

      // 3. Cria a transação no IndexedDB
      const txId = crypto.randomUUID()
      const newTx = {
        id: txId,
        user_id: accountData.user_id,
        description: adjustNotes || "Ajuste de saldo",
        amount: amount,
        type: amount >= 0 ? "income" : "expense",
        account_id: accountId,
        date: new Date().toISOString().split("T")[0],
        status: "completed",
        context,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }
      await db.table('transactions').put(newTx)
      // 4. Enfileira a transação
      await addToSyncQueue(
        user.id,
        'transactions',
        'create',
        txId,
        newTx
      )

      showToast("Saldo ajustado com sucesso!", "success")
      success()
      setShowAdjustModal(false)
      setAdjustAmount("")
      setAdjustNotes("")
      reload()
    } catch (err: any) {
      showToast(err?.message || "Erro ao ajustar saldo", "error")
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }

  // 🔥 CORRIGIDO: Transferência com sincronização
  const handleTransfer = async () => {
    if (!user) return
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      showToast("Informe um valor válido", "warning")
      errorHaptic()
      return
    }
    if (!transferToAccount) {
      showToast("Selecione a conta de destino", "warning")
      errorHaptic()
      return
    }
    setSaving(true)
    try {
      const amount = parseFloat(transferAmount)

      const fromTxId = crypto.randomUUID()
      const toTxId = crypto.randomUUID()

      // 1. Transação de saída (conta origem)
      const fromTx = {
        id: fromTxId,
        user_id: accountData.user_id,
        description: transferNotes || `Transferência para conta`,
        amount: -amount,
        type: "transfer_out",
        account_id: accountId,
        transfer_to: transferToAccount,
        date: new Date().toISOString().split("T")[0],
        status: "completed",
        context,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }
      await db.table('transactions').put(fromTx)
      await addToSyncQueue(user.id, 'transactions', 'create', fromTxId, fromTx)

      // 2. Transação de entrada (conta destino)
      const toTx = {
        id: toTxId,
        user_id: accountData.user_id,
        description: transferNotes || `Transferência recebida`,
        amount: amount,
        type: "transfer_in",
        account_id: transferToAccount,
        transfer_from: accountId,
        date: new Date().toISOString().split("T")[0],
        status: "completed",
        context,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }
      await db.table('transactions').put(toTx)
      await addToSyncQueue(user.id, 'transactions', 'create', toTxId, toTx)

      // 3. Atualiza saldo da conta origem
      const newFromBalance = (accountData?.balance || 0) - amount
      await db.table('accounts').update(accountId, { balance: newFromBalance })
      await addToSyncQueue(
        user.id,
        'accounts',
        'update',
        accountId,
        { balance: newFromBalance }
      )

      // 4. Atualiza saldo da conta destino
      const toAccount = (localAccounts || []).find((a: any) => a.id === transferToAccount) as any
      const newToBalance = (toAccount?.balance || 0) + amount
      await db.table('accounts').update(transferToAccount, { balance: newToBalance })
      await addToSyncQueue(
        user.id,
        'accounts',
        'update',
        transferToAccount,
        { balance: newToBalance }
      )

      showToast("Transferência realizada com sucesso!", "success")
      success()
      setShowTransferModal(false)
      setTransferAmount("")
      setTransferToAccount("")
      setTransferNotes("")
      reload()
    } catch (err: any) {
      showToast(err?.message || "Erro ao transferir", "error")
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }

  // 🔥 CORRIGIDO: Exclusão com sincronização
  const handleDelete = async () => {
    if (!user) return
    if (!confirm("Tem certeza que deseja excluir esta conta?")) return
    try {
      await db.table('accounts').delete(accountId)
      await addToSyncQueue(
        user.id,
        'accounts',
        'delete',
        accountId,
        { id: accountId }
      )
      showToast("Conta excluída com sucesso!", "success")
      success()
      router.back()
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, "error")
      errorHaptic()
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
        reload()
        setTimeout(() => setRefreshing(false), 600)
      }
    }
  }, [refreshing, reload])

  if (loading) {
    return (
      <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
              <ArrowLeft size={20} />
            </div>
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">Carregando...</h1>
          </div>
        </div>
        <div className="flex-1 px-4 pt-4">
          <Skeleton count={4} />
        </div>
      </div>
    )
  }

  if (!accountData) {
    return (
      <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-black">Conta não encontrada</h1>
          </div>
        </div>
      </div>
    )
  }

  const Icon = ACCOUNT_ICONS[accountData.type] || Wallet

  const sortedTransactions = [...transactions].sort((a: any, b: any) =>
    new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  )

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
      {(loading || pendingCount > 0) && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 truncate max-w-[180px]">
              {accountData.name}
            </h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push(`/accounts/new?edit=${accountId}`)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Pencil size={18} />
            </button>
            <button onClick={handleDelete} className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 ${(accountData.balance || 0) >= 0 ? "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"}`}>
            <Icon size={28} />
          </div>
          <p className="text-3xl font-black text-slate-800 dark:text-slate-200">{formatCurrency(accountData.balance || 0)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ACCOUNT_LABELS[accountData.type] || accountData.type}{accountData.bank ? ` — ${accountData.bank}` : ""}</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setShowAdjustModal(true)} className="flex-1 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold shadow-sm shadow-teal-500/20 transition-colors">
            Ajustar Saldo
          </button>
          <button onClick={() => setShowTransferModal(true)} className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold shadow-sm shadow-blue-500/20 transition-colors">
            Transferir
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <h3 className="font-black text-slate-800 dark:text-slate-200 mb-3">Transações</h3>
          {sortedTransactions.length === 0 ? (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">Nenhuma transação nesta conta</p>
          ) : (
            <div className="space-y-2">
              {sortedTransactions.slice(0, expandedTransactions ? undefined : 5).map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {(tx.amount || 0) >= 0 ? <ArrowUpCircle size={16} className="text-teal-500 flex-shrink-0" /> : <ArrowDownCircle size={16} className="text-red-500 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{tx.description || "Sem descrição"}</p>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(tx.date)}</span>
                    </div>
                  </div>
                  <span className={`font-bold text-sm flex-shrink-0 ${(tx.amount || 0) >= 0 ? "text-teal-600 dark:text-teal-400" : "text-red-500"}`}>{formatCurrency(tx.amount || 0)}</span>
                </div>
              ))}
              {sortedTransactions.length > 5 && (
                <button onClick={() => setExpandedTransactions(!expandedTransactions)} className="w-full text-center text-xs text-teal-500 hover:text-teal-600 font-semibold py-2">
                  {expandedTransactions ? "Ver menos" : `Ver todas (${sortedTransactions.length})`}
                  <ChevronDown size={12} className={`inline ml-1 transition-transform ${expandedTransactions ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAdjustModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4">Ajustar Saldo</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Valor (+ ou -)</label>
                <input type="number" step="0.01" placeholder="0,00" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500/50" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Observação</label>
                <input type="text" placeholder="Motivo do ajuste" value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500/50" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAdjustModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">Cancelar</button>
                <button onClick={handleAdjustBalance} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm disabled:opacity-50">{saving ? "Salvando..." : "Ajustar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowTransferModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4">Transferir</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Valor</label>
                <input type="number" step="0.01" placeholder="0,00" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500/50" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Conta Destino</label>
                <select value={transferToAccount} onChange={(e) => setTransferToAccount(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500/50">
                  <option value="">Selecione...</option>
                  {(localAccounts || []).filter((a: any) => a.id !== accountId).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Observação</label>
                <input type="text" placeholder="Descrição" value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500/50" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowTransferModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">Cancelar</button>
                <button onClick={handleTransfer} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm disabled:opacity-50">{saving ? "Transferindo..." : "Transferir"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}