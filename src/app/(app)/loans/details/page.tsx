'use client'

import { useState, useCallback, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft, Save, Trash2, RefreshCw, Pencil, Landmark,
  CheckCircle2, AlertTriangle, Clock, ChevronDown, Plus, X, ArrowUpCircle, ArrowDownCircle
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from '@/hooks/useSafeDb'

type Payment = {
  id: string
  loan_id: string
  amount: number
  date: string
  notes?: string
  payment_type?: string
  created_at?: string
}

function LoanDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const loanId = searchParams.get('id') as string
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const { safeAdd, safeUpdate, safeDelete } = useSafeDb()

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
    filters: { context: effectiveContext },
  })

  const loanData = (localLoans || []).find((l: any) => l.id === loanId) as any

  const { data: allPayments } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext, type: 'loan_payment' },
  })

  const payments = (allPayments || []).filter((p: any) => p.loan_id === loanId) as Payment[]

  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        vibrate([10])
        reload().finally(() => setTimeout(() => setRefreshing(false), 600))
      }
    }
  }, [refreshing, reload, vibrate])

  const handleRegisterPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      errorHaptic()
      showToast("⚠️ Informe um valor válido", "warning")
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
        context: effectiveContext,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }

      const loanUpdate = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      const res1 = await safeAdd('transactions', txPayload)
      if (!res1.success) throw new Error(res1.error)
      
      const res2 = await safeUpdate('loans', loanId, loanUpdate)
      if (!res2.success) throw new Error(res2.error)

      success()
      showToast("✅ Pagamento registrado com sucesso!", "success")
      setShowPaymentForm(false)
      setPaymentAmount("")
      setPaymentNotes("")
      reload()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ ${err?.message || "Erro ao registrar pagamento"}`, "error")
    } finally {
      setSavingPayment(false)
    }
  }

  const handleDeletePayment = async (paymentId: string) => {
    vibrate([10, 50])
    try {
      const res1 = await safeDelete('transactions', paymentId)
      if (!res1.success) throw new Error(res1.error)

      const updatedPayments = payments.filter(p => p.id !== paymentId)
      const totalPaid = updatedPayments.reduce((sum: number, p: Payment) => sum + (p.amount || 0), 0)
      const totalAmountCents = Math.round((loanData?.amount || 0) * 100)
      const totalPaidCents = Math.round(totalPaid * 100)
      const newStatus = totalPaidCents >= totalAmountCents ? "paid" : "active"

      const loanUpdate = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }
      
      const res2 = await safeUpdate('loans', loanId, loanUpdate)
      if (!res2.success) throw new Error(res2.error)

      success()
      showToast("🗑️ Pagamento excluído com sucesso!", "success")
      setDeleteModal(null)
      reload()
    } catch {
      errorHaptic()
      showToast("❌ Erro ao excluir pagamento", "error")
    }
  }

  const handleDeleteLoan = async () => {
    vibrate([10, 50])
    if (!confirm("Tem certeza que deseja excluir este empréstimo e todos os seus pagamentos?")) return
    try {
      for (const p of payments) {
        const res1 = await safeDelete('transactions', p.id)
        if (!res1.success) throw new Error(res1.error)
      }
      
      const res2 = await safeDelete('loans', loanId)
      if (!res2.success) throw new Error(res2.error)

      success()
      showToast("🗑️ Empréstimo excluído!", "success")
      router.back()
    } catch {
      errorHaptic()
      showToast("❌ Erro ao excluir empréstimo", "error")
    }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)
  const formatDate = (date: string | null) => date ? new Date(date).toLocaleDateString("pt-BR") : ""

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <span className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full"><Clock size={12} /> Ativo</span>
      case "paid": return <span className="flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2.5 py-1 rounded-full"><CheckCircle2 size={12} /> Pago</span>
      case "overdue": return <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-full"><AlertTriangle size={12} /> Atrasado</span>
      default: return <span className="text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">{status}</span>
    }
  }

  const totalPaid = payments.reduce((sum: number, p: Payment) => sum + (p.amount || 0), 0)
  const remaining = (loanData?.amount || 0) - totalPaid
  const progressPercent = loanData?.amount ? (totalPaid / loanData.amount) * 100 : 0

  if (loading) return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors">
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
        <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
      </div>
      <div className="flex-1 px-4 pt-6"><Skeleton count={4} /></div>
    </div>
  )

  if (!loanData) return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900">
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
        <button onClick={() => router.back()} className="p-2 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 transition-colors"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-black mt-4">Empréstimo não encontrado</h1>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors">
      {(loadingPulse || pendingCount > 0) && <div className="fixed top-20 right-4 z-50"><div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]" /></div>}
      {refreshing && <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none"><div className="bg-white dark:bg-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.1)] rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300"><RefreshCw size={16} className="animate-spin text-teal-600" /><span className="text-[12px] font-bold text-teal-600">Atualizando...</span></div></div>}

      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 shadow-sm px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { vibrate([5]); router.back(); }} className="p-2 -ml-2 rounded-full text-gray-800 dark:text-gray-200 active:scale-95 transition-transform"><ArrowLeft size={24} /></button>
            <div>
              <h1 className="text-[18px] font-bold text-gray-800 dark:text-gray-100 truncate max-w-[150px]">{loanData.description || "Empréstimo"}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {getStatusBadge(loanData.status)}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => { vibrate([5]); router.push(`/loans/new?edit=${loanId}`); }} className="p-2.5 rounded-full bg-gray-50 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-teal-700 dark:text-teal-400 active:scale-95 transition-all" aria-label="Editar"><Pencil size={18} /></button>
            <button onClick={handleDeleteLoan} className="p-2.5 rounded-full bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 active:scale-95 transition-all" aria-label="Excluir"><Trash2 size={18} /></button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex-1 overflow-y-auto px-4 pt-6 pb-24 space-y-4">
        
        <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 text-center animate-in fade-in duration-300">
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Valor Restante</p>
          <p className={`text-[36px] font-light tracking-tight leading-none mb-4 ${remaining <= 0 ? "text-teal-500" : "text-gray-800 dark:text-gray-100"}`}>
            {formatCurrency(Math.max(0, remaining))}
          </p>
          <div className="w-full bg-gray-100 dark:bg-slate-700/50 rounded-full h-3 overflow-hidden shadow-inner mb-2">
             <div className="h-full bg-teal-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
          </div>
          <div className="flex justify-between text-[11px] font-bold text-gray-400 dark:text-gray-500">
            <span>{progressPercent.toFixed(1)}% Pago</span>
            <span>{formatCurrency(loanData.amount || 0)} Total</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-50 dark:border-slate-700/50 p-5 space-y-4 shadow-sm animate-in fade-in duration-300 delay-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[16px] bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center">
              <Landmark size={24} className="text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{loanData.direction === "lent" ? "Eu emprestei para" : "Peguei emprestado com"}</p>
              {loanData.lender && <p className="text-[12px] font-medium text-gray-500 mt-0.5">{loanData.lender}</p>}
            </div>
          </div>
          <div className="h-px bg-gray-100 dark:bg-slate-700/50" />
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 dark:bg-slate-700/30 rounded-[16px] p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Vencimento</p>
              <p className="text-[14px] font-black text-gray-800 dark:text-gray-200">{formatDate(loanData.due_date) || "N/A"}</p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700/30 rounded-[16px] p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Juros</p>
              <p className="text-[14px] font-black text-gray-800 dark:text-gray-200">{loanData.interest_rate ? `${loanData.interest_rate}% a.m.` : "Sem Juros"}</p>
            </div>
          </div>
          {loanData.notes && (
            <div className="bg-gray-50 dark:bg-slate-700/30 rounded-[16px] p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Observações</p>
              <p className="text-[13px] font-medium text-gray-600 dark:text-gray-400">{loanData.notes}</p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[28px] border border-gray-50 dark:border-slate-700/50 p-6 shadow-sm animate-in fade-in duration-300 delay-200">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100">Pagamentos</h3>
              <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 mt-0.5">{payments.length} realizados — Total: {formatCurrency(totalPaid)}</p>
            </div>
            {loanData.status !== "paid" && (
              <button onClick={() => { vibrate([5]); setShowPaymentForm(true); }} className="p-2.5 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 hover:bg-teal-100 hover:dark:bg-teal-900/50 transition-all active:scale-90" aria-label="Novo pagamento">
                <Plus size={20} />
              </button>
            )}
          </div>

          {payments.length === 0 ? (
            <p className="text-center text-[13px] font-medium text-gray-400 py-4">Nenhum pagamento registrado</p>
          ) : (
            <div className="space-y-2">
              {payments.slice(0, expandedPayments ? undefined : 5).map((p: Payment) => (
                <div key={p.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/40 rounded-[20px] px-3.5 py-3.5 transition-all active:scale-[0.98]">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <ArrowUpCircle size={16} className="text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate">{p.notes || `Pagamento`}</p>
                      <p className="text-[11px] font-medium text-gray-500 mt-0.5">{formatDate(p.date)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-black text-[14px] text-emerald-600 dark:text-emerald-400">{formatCurrency(p.amount)}</span>
                    <button onClick={() => { vibrate([5]); setDeleteModal(p.id); }} className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {payments.length > 5 && (
                <button onClick={() => { vibrate([5]); setExpandedPayments(!expandedPayments); }} className="w-full text-center text-[12px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 py-3 rounded-xl transition-colors mt-2 active:scale-95">
                  {expandedPayments ? "Recolher pagamentos" : `Ver todos os ${payments.length} pagamentos`}
                  <ChevronDown size={14} className={`inline ml-1 transition-transform ${expandedPayments ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Registrar Pagamento - Bottom Sheet */}
      {showPaymentForm && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowPaymentForm(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Registrar Pagamento</h3>
              <button onClick={() => { vibrate([5]); setShowPaymentForm(false); }} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Valor</label>
                <div className="flex items-center gap-2">
                  <span className="text-[18px] text-gray-400 font-medium">R$</span>
                  <input type="number" step="0.01" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full bg-transparent text-[24px] font-black text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" autoFocus />
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Data</label>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-100 outline-none" />
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Observação (Opcional)</label>
                <input type="text" placeholder="Ex: Pagamento parcial" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" />
              </div>
            </div>

            <button onClick={() => { vibrate([10, 50]); handleRegisterPayment(); }} disabled={savingPayment} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[16px] disabled:opacity-50 shadow-lg shadow-teal-600/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
              {savingPayment ? <RefreshCw size={22} className="animate-spin" /> : <Save size={22} />} Confirmar
            </button>
          </div>
        </div>
      )}

      {/* Modal Deletar Pagamento */}
      {deleteModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setDeleteModal(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Excluir Pagamento</h3>
              <button onClick={() => setDeleteModal(null)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
            </div>
            <p className="text-[14px] font-medium text-gray-500 mb-6">Tem certeza que deseja excluir este pagamento? O valor será revertido no empréstimo.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} className="flex-1 py-4 rounded-[24px] bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-[15px] active:scale-[0.98] transition-transform">Cancelar</button>
              <button onClick={() => { vibrate([10, 50]); handleDeletePayment(deleteModal); }} className="flex-1 py-4 rounded-[24px] bg-red-500 hover:bg-red-600 text-white font-bold text-[15px] shadow-lg shadow-red-500/30 active:scale-[0.98] transition-transform">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LoanDetailPage() {
  return (
    <Suspense fallback={<div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950"><div className="flex-1 px-4 pt-4"><Skeleton count={4} /></div></div>}>
      <LoanDetailContent />
    </Suspense>
  )
}
