'use client'

import { useState, useCallback, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft, Trash2, RefreshCw, Pencil, Wallet, Building2, CreditCard,
  PiggyBank, ChevronDown, ArrowUpCircle, ArrowDownCircle, Check, X
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from '@/lib/hooks/useAuth'
import Skeleton from '@/components/Skeleton'
import { db, addToSyncQueue } from '@/lib/db'

const ACCOUNT_ICONS: Record<string, any> = {
  checking: Wallet, savings: PiggyBank, investment: Building2,
  credit_card: CreditCard, wallet: Wallet, other: Wallet,
}

const ACCOUNT_LABELS: Record<string, string> = {
  checking: "Conta Corrente", savings: "Poupança", investment: "Investimento",
  credit_card: "Cartão de Crédito", wallet: "Carteira", other: "Outro",
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
  const accountId = searchParams.get('id') as string
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { context } = useContext_()
  const { user } = useAuth()

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
  })

  const { data: allTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context, account_id: accountId },
  })

  const accountData = (localAccounts || []).find((a: any) => a.id === accountId) as any
  const transactions = allTransactions || []

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)
  const formatDate = (date: string | null) => { if (!date) return ""; return new Date(date).toLocaleDateString("pt-BR") }

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
      reload()
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
          id: fromTxId, user_id: fromAcc.user_id, description: transferNotes || `Transferência para ${toAcc.name}`,
          amount, type: 'transfer', account_id: accountId, transfer_to: transferToAccount, date: today,
          status: 'done', context, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          sync_status: 'pending', sync_attempts: 0,
        }
        await db.table('transactions').add(fromTx)
        await addToSyncQueue(user.id, 'transactions', 'create', fromTxId, fromTx)

        const toTx = {
          id: toTxId, user_id: toAcc.user_id, description: transferNotes || `Transferência de ${fromAcc.name}`,
          amount, type: 'transfer', account_id: transferToAccount, transfer_from: accountId, date: today,
          status: 'done', context, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          sync_status: 'pending', sync_attempts: 0,
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
      reload()
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
      showToast(`Erro ao excluir: ${err.message}`, "error")
    }
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY }, [])
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        vibrate([10])
        reload()
        setTimeout(() => setRefreshing(false), 600)
      }
    }
  }, [refreshing, reload, vibrate])

  if (loading) {
    return (
      <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors">
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
        </div>
        <div className="flex-1 px-4 pt-6"><Skeleton count={4} /></div>
      </div>
    )
  }

  if (!accountData) {
    return (
      <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900">
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
          <button onClick={() => router.back()} className="p-2 rounded-full bg-gray-100 dark:bg-slate-800"><ArrowLeft size={20} /></button>
          <h1 className="text-lg font-black mt-4">Conta não encontrada</h1>
        </div>
      </div>
    )
  }

  const Icon = ACCOUNT_ICONS[accountData.type] || Wallet
  const sortedTransactions = [...transactions].sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors">
      {(loading || pendingCount > 0) && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
        </div>
      )}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.1)] rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 shadow-sm px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { vibrate([5]); router.back(); }} className="p-2 -ml-2 rounded-full text-gray-800 dark:text-gray-200 active:scale-95 transition-transform">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-[18px] font-bold text-gray-800 dark:text-gray-100 truncate max-w-[180px]">
              {accountData.name}
            </h1>
          </div>
          <div className="flex gap-1">
            <button onClick={() => { vibrate([5]); router.push(`/accounts/new?edit=${accountId}`); }} className="p-2.5 rounded-full bg-gray-50 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-teal-700 dark:text-teal-400 active:scale-95 transition-all">
              <Pencil size={18} />
            </button>
            <button onClick={handleDelete} className="p-2.5 rounded-full bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 active:scale-95 transition-all">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex-1 overflow-y-auto px-4 pt-6 pb-24 space-y-5">
        <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 text-center shadow-sm border border-gray-50 dark:border-slate-700/50 animate-in fade-in duration-300">
          <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-4 ${(accountData.balance || 0) >= 0 ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"}`}>
            <Icon size={32} />
          </div>
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Saldo Atual</p>
          <p className="text-[36px] font-light text-gray-800 dark:text-gray-100 tracking-tight leading-none mb-2">{formatCurrency(accountData.balance || 0)}</p>
          <div className="inline-flex items-center gap-2 bg-gray-50 dark:bg-slate-700/50 px-3 py-1.5 rounded-full">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{ACCOUNT_LABELS[accountData.type] || accountData.type}</span>
            {accountData.bank && <><span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" /><span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{accountData.bank}</span></>}
          </div>
        </div>

        <div className="flex gap-3 animate-in slide-in-from-bottom-4 duration-300 delay-100">
          <button onClick={() => { vibrate([5]); setShowAdjustModal(true); }} className="flex-1 py-4 rounded-[20px] bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-[14px] font-bold active:scale-[0.98] transition-transform border border-teal-100 dark:border-teal-800/50">
            Ajustar Saldo
          </button>
          <button onClick={() => { vibrate([5]); setShowTransferModal(true); }} className="flex-1 py-4 rounded-[20px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[14px] font-bold active:scale-[0.98] transition-transform border border-blue-100 dark:border-blue-800/50">
            Transferir
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[28px] border border-gray-50 dark:border-slate-700/50 p-5 shadow-sm animate-in fade-in duration-300 delay-200">
          <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100 mb-4">Transações Recentes</h3>
          {sortedTransactions.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <RefreshCw size={20} className="text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-400 dark:text-gray-500">Nenhuma movimentação nesta conta.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sortedTransactions.slice(0, expandedTransactions ? undefined : 5).map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/40 rounded-[20px] px-3 py-3.5 transition-colors cursor-pointer active:scale-[0.98]">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0 ${tx.type === 'income' || (tx.type === 'transfer' && tx.description?.includes('de ')) ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' : 'bg-red-50 dark:bg-red-500/10 text-red-500'}`}>
                      {tx.type === 'income' || (tx.type === 'transfer' && tx.description?.includes('de ')) ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 truncate">{tx.description || "Sem descrição"}</p>
                      <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{formatDate(tx.date)}</span>
                    </div>
                  </div>
                  <span className={`font-bold text-[14px] flex-shrink-0 ${tx.type === 'income' || (tx.type === 'transfer' && tx.description?.includes('de ')) ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                    {tx.type === 'income' || (tx.type === 'transfer' && tx.description?.includes('de ')) ? '+' : '-'} {formatCurrency(Math.abs(safeNum(tx.amount)))}
                  </span>
                </div>
              ))}
              {sortedTransactions.length > 5 && (
                <button onClick={() => { vibrate([5]); setExpandedTransactions(!expandedTransactions); }} className="w-full text-center text-[12px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 py-3 rounded-xl transition-colors mt-2 active:scale-95">
                  {expandedTransactions ? "Recolher transações" : `Ver todas (${sortedTransactions.length})`}
                  <ChevronDown size={14} className={`inline ml-1 transition-transform ${expandedTransactions ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Ajustar Saldo - Bottom Sheet Premium */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowAdjustModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Ajustar Saldo</h3>
              <button onClick={() => { vibrate([5]); setShowAdjustModal(false); }} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Valor a ser Ajustado (+ ou -)</label>
                <div className="flex items-center gap-2">
                  <span className="text-[18px] text-gray-400 font-medium">R$</span>
                  <input type="number" step="0.01" placeholder="0.00" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} className="w-full bg-transparent text-[24px] font-black text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" autoFocus />
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Observação (Opcional)</label>
                <input type="text" placeholder="Ex: Ajuste de final de mês" value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" />
              </div>
            </div>

            <button onClick={() => { vibrate([10, 50]); handleAdjustBalance(); }} disabled={saving} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[16px] disabled:opacity-50 shadow-lg shadow-teal-600/30 active:scale-[0.98] transition-transform">
              {saving ? <Loader2 className="animate-spin mx-auto" size={22} /> : "Confirmar Ajuste"}
            </button>
          </div>
        </div>
      )}

      {/* Modal Transferir - Bottom Sheet Premium */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowTransferModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Transferir</h3>
              <button onClick={() => { vibrate([5]); setShowTransferModal(false); }} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Valor a transferir</label>
                <div className="flex items-center gap-2">
                  <span className="text-[18px] text-gray-400 font-medium">R$</span>
                  <input type="number" step="0.01" placeholder="0.00" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} className="w-full bg-transparent text-[24px] font-black text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" autoFocus />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4 relative">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Conta Destino</label>
                <select value={transferToAccount} onChange={(e) => setTransferToAccount(e.target.value)} className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-100 outline-none appearance-none pr-8 cursor-pointer">
                  <option value="" disabled className="text-gray-400">Selecione uma conta...</option>
                  {(localAccounts || []).filter((a: any) => a.id !== accountId).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 mt-1 text-gray-400 pointer-events-none" />
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Observação (Opcional)</label>
                <input type="text" placeholder="Ex: Pagamento de empréstimo" value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" />
              </div>
            </div>

            <button onClick={() => { vibrate([10, 50]); handleTransfer(); }} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-[24px] font-bold text-[16px] disabled:opacity-50 shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-transform">
              {saving ? <Loader2 className="animate-spin mx-auto" size={22} /> : "Confirmar Transferência"}
            </button>
          </div>
        </div>
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
