"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  Pencil,
  Wallet,
  ArrowLeftRight,
  Landmark,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  Plus,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { db } from '@/lib/db' 

type Payment = {
  id: string
  loan_id: string
  amount: number
  date: string
  notes?: string
  payment_type?: string
  created_at?: string
}

export default function LoanDetailPage() {
  const router = useRouter()
  const params = useParams()
  const loanId = params.id as string
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { context } = useContext_()
  const { user } = useAuth()

  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [paymentNotes, setPaymentNotes] = useState("")
  const [savingPayment, setSavingPayment] = useState(false)
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [expandedPayments, setExpandedPayments] = useState(false)
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: localLoans, loading, reload } = useLocalData({
    table: 'loans' as any,
    filters: { context },
  })

  const loanData = (localLoans || []).find((l: any) => l.id === loanId) as any

  const { data: allPayments } = useLocalData({
    table: 'transactions' as any,
    filters: { context, type: 'loan_payment' },
  })

  const payments = (allPayments || []).filter((p: any) => p.loan_id === loanId) as Payment[]

  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        reload().finally(() => setTimeout(() => setRefreshing(false), 600))
      }
    }
  }, [refreshing, reload])

  // 🔥 REGISTRAR PAGAMENTO ATÔMICO
  const handleRegisterPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      showToast("Informe um valor válido", "warning")
      errorHaptic()
      return
    }

    setSavingPayment(true)
    try {
      const totalPaid = payments.reduce((sum: number, p: Payment) => sum + (p.amount || 0), 0)
      const newTotalPaidCents = Math.round((totalPaid + parseFloat(paymentAmount)) * 100)
      const totalAmountCents = Math.round((loanData?.amount || 0) * 100)
      const newStatus = newTotalPaidCents >= totalAmountCents ? "paid" : loanData?.status || "active"

      const txId = crypto.randomUUID()
      const txPayload = {
        id: txId,
        user_id: user!.id,
        description: `Pagamento: ${loanData?.description || "Empréstimo"}`,
        amount: parseFloat(paymentAmount),
        type: "loan_payment",
        loan_id: loanId,
        date: paymentDate || new Date().toISOString().split("T")[0],
        notes: paymentNotes || null,
        status: "completed",
        account_id: null,
        category_id: null,
        context,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }

      const loanUpdate = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      await db.transaction('rw', 'transactions', 'loans', 'syncQueue', async () => {
        await db.table('transactions').add(txPayload)
        await db.table('syncQueue').add({ table: 'transactions', operation: 'create', record_id: txId, data: txPayload, user_id: user!.id, created_at: new Date().toISOString() })
        
        await db.table('loans').update(loanId, loanUpdate)
        await db.table('syncQueue').add({ table: 'loans', operation: 'update', record_id: loanId, data: loanUpdate, user_id: user!.id, created_at: new Date().toISOString() })
      })

      showToast("Pagamento registrado com sucesso!", "success")
      success()
      setShowPaymentForm(false)
      setPaymentAmount("")
      setPaymentNotes("")
      reload()
    } catch (err: any) {
      showToast(err?.message || "Erro ao registrar pagamento", "error")
      errorHaptic()
    } finally {
      setSavingPayment(false)
    }
  }

  // 🔥 EXCLUIR PAGAMENTO ATÔMICO
  const handleDeletePayment = async (paymentId: string) => {
    try {
      await db.transaction('rw', 'transactions', 'loans', 'syncQueue', async () => {
        await db.table('transactions').delete(paymentId)
        await db.table('syncQueue').add({ table: 'transactions', operation: 'delete', record_id: paymentId, user_id: user!.id, created_at: new Date().toISOString() })

        const updatedPayments = payments.filter(p => p.id !== paymentId)
        const totalPaid = updatedPayments.reduce((sum: number, p: Payment) => sum + (p.amount || 0), 0)
        const totalAmountCents = Math.round((loanData?.amount || 0) * 100)
        const totalPaidCents = Math.round(totalPaid * 100)
        const newStatus = totalPaidCents >= totalAmountCents ? "paid" : "active"

        const loanUpdate = {
          status: newStatus,
          updated_at: new Date().toISOString()
        }
        
        await db.table('loans').update(loanId, loanUpdate)
        await db.table('syncQueue').add({ table: 'loans', operation: 'update', record_id: loanId, data: loanUpdate, user_id: user!.id, created_at: new Date().toISOString() })
      })

      showToast("Pagamento excluído com sucesso!", "success")
      success()
      setDeleteModal(null)
      reload()
    } catch {
      showToast("Erro ao excluir pagamento", "error")
      errorHaptic()
    }
  }

  // 🔥 EXCLUIR EMPRÉSTIMO ATÔMICO (Cascata)
  const handleDeleteLoan = async () => {
    try {
      await db.transaction('rw', 'transactions', 'loans', 'syncQueue', async () => {
        for (const p of payments) {
          await db.table('transactions').delete(p.id)
          await db.table('syncQueue').add({ table: 'transactions', operation: 'delete', record_id: p.id, user_id: user!.id, created_at: new Date().toISOString() })
        }
        await db.table('loans').delete(loanId)
        await db.table('syncQueue').add({ table: 'loans', operation: 'delete', record_id: loanId, user_id: user!.id, created_at: new Date().toISOString() })
      })
      showToast("Empréstimo excluído com sucesso!", "success")
      success()
      router.back()
    } catch {
      showToast("Erro ao excluir empréstimo", "error")
      errorHaptic()
    }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)
  const formatDate = (date: string | null) => date ? new Date(date).toLocaleDateString("pt-BR") : ""

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full"><Clock size={12} /> Ativo</span>
      case "paid": return <span className="flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full"><CheckCircle2 size={12} /> Pago</span>
      case "overdue": return <span className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full"><AlertTriangle size={12} /> Atrasado</span>
      default: return <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{status}</span>
    }
  }

  const totalPaid = payments.reduce((sum: number, p: Payment) => sum + (p.amount || 0), 0)
  const remaining = (loanData?.amount || 0) - totalPaid

  if (loading) return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"><ArrowLeft size={20} /></div>
          <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">Carregando...</h1>
        </div>
      </div>
      <div className="flex-1 px-4 pt-4"><Skeleton count={4} /></div>
    </div>
  )

  if (!loanData) return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><ArrowLeft size={20} /></button>
          <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">Empréstimo não encontrado</h1>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
      {(loadingPulse || loading || pendingCount > 0) && <div className="fixed top-20 right-4 z-50"><div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" /></div>}
      {refreshing && <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none"><div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2"><RefreshCw size={16} className="animate-spin text-teal-600" /><span className="text-xs font-bold text-teal-600">Atualizando...</span></div></div>}

      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">{loanData.description || "Empréstimo"}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {getStatusBadge(loanData.status)}
                <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(loanData.date)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push(`/loans/new?edit=${loanId}`)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Editar"><Pencil size={18} /></button>
            <button onClick={handleDeleteLoan} className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors" aria-label="Excluir"><Trash2 size={18} /></button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Valor Total</p>
            <p className="text-xl font-black text-slate-800 dark:text-slate-200">{formatCurrency(loanData.amount || 0)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Restante</p>
            <p className={`text-xl font-black ${remaining <= 0 ? "text-teal-500" : "text-orange-500"}`}>{formatCurrency(Math.max(0, remaining))}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center gap-2"><Landmark size={16} className="text-teal-500" /><span className="text-sm text-slate-600 dark:text-slate-400">{loanData.direction === "lent" ? "Emprestei" : "Peguei Emprestado"}</span></div>
          {loanData.lender && <div><p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">{loanData.direction === "lent" ? "Devedor" : "Credor"}</p><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{loanData.lender}</p></div>}
          {loanData.due_date && <div><p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">Vencimento</p><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatDate(loanData.due_date)}</p></div>}
          {loanData.interest_rate && <div><p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">Taxa de Juros</p><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{loanData.interest_rate}% a.m.</p></div>}
          {loanData.notes && <div><p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">Observações</p><p className="text-sm text-slate-600 dark:text-slate-400">{loanData.notes}</p></div>}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div><h3 className="font-black text-slate-800 dark:text-slate-200">Pagamentos</h3><p className="text-xs text-slate-500 dark:text-slate-400">{payments.length} pagamento(s) — Total: {formatCurrency(totalPaid)}</p></div>
            {loanData.status !== "paid" && <button onClick={() => setShowPaymentForm(!showPaymentForm)} className="p-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white shadow-md shadow-teal-500/20 transition-all active:scale-95" aria-label="Novo pagamento"><Plus size={18} /></button>}
          </div>

          {showPaymentForm && (
            <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div><label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Valor do Pagamento</label><input type="number" step="0.01" placeholder="0,00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500/50" /></div>
              <div><label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Data</label><input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500/50" /></div>
              <div><label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Observações (opcional)</label><input type="text" placeholder="Ex: Pagamento via PIX" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500/50" /></div>
              <div className="flex gap-2">
                <button onClick={() => { setShowPaymentForm(false); setPaymentAmount(""); setPaymentNotes("") }} className="flex-1 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm">Cancelar</button>
                <button onClick={handleRegisterPayment} disabled={savingPayment} className="flex-1 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-1">{savingPayment ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Registrar</button>
              </div>
            </div>
          )}

          {payments.length === 0 ? <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">Nenhum pagamento registrado</p> : (
            <div className="space-y-2">
              {payments.slice(0, expandedPayments ? undefined : 5).map((p: Payment) => (
                <div key={p.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5">
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{p.notes || `Pagamento em ${formatDate(p.date)}`}</p><p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(p.date)}</p></div>
                  <div className="flex items-center gap-3"><span className="font-bold text-teal-600 dark:text-teal-400">{formatCurrency(p.amount)}</span><button onClick={() => setDeleteModal(p.id)} className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors" aria-label="Excluir pagamento"><Trash2 size={14} /></button></div>
                </div>
              ))}
              {payments.length > 5 && <button onClick={() => setExpandedPayments(!expandedPayments)} className="w-full text-center text-xs text-teal-500 hover:text-teal-600 font-semibold py-2">{expandedPayments ? "Ver menos" : `Ver todos (${payments.length})`}<ChevronDown size={12} className={`inline ml-1 transition-transform ${expandedPayments ? "rotate-180" : ""}`} /></button>}
            </div>
          )}
        </div>
      </div>

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Excluir Pagamento</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Tem certeza que deseja excluir este pagamento? O valor será revertido.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">Cancelar</button>
              <button onClick={() => handleDeletePayment(deleteModal)} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
