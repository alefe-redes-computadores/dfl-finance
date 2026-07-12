'use client'

import { useState, useCallback, useRef, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft, Trash2, RefreshCw, Pencil, Car, Home, Percent,
  ChevronDown, CheckCircle2, AlertTriangle, Clock, Building2, Calendar, X
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from '@/hooks/useSafeDb'

type Installment = {
  id: string
  financing_id: string
  amount: number
  due_date: string
  paid: boolean
  paid_date?: string
  number: number
}

function FinancingDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const financingId = searchParams.get('id') as string
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  const { safeUpdate, safeDelete } = useSafeDb()

  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [expandedInstallments, setExpandedInstallments] = useState(false)
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: localFinancings, loading, reload } = useLocalData({
    table: 'financings' as any,
    filters: { context: effectiveContext },
  })

  const financingData = useMemo(() => {
    return (localFinancings || []).find((f: any) => f.id === financingId) as any
  }, [localFinancings, financingId])

  const { data: allInstallments } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext, type: 'financing_installment', financing_id: financingId },
  })

  const installments = (allInstallments || []) as Installment[]

  const handlePayInstallment = async (installment: Installment) => {
    if (!user) return
    try {
      const updateData = {
        paid: true,
        paid_date: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString()
      }
      
      const res1 = await safeUpdate('transactions', installment.id, updateData)
      if (!res1.success) throw new Error(res1.error)

      const updatedInstallments = installments.map((i: Installment) => i.id === installment.id ? { ...i, paid: true } : i)
      const allPaid = updatedInstallments.every((i: Installment) => i.paid)
      
      if (allPaid && financingData?.status !== "paid") {
        const statusUpdate = { status: "paid", updated_at: new Date().toISOString() }
        const res2 = await safeUpdate('financings', financingId, statusUpdate)
        if (!res2.success) throw new Error(res2.error)
      }

      success()
      showToast("✅ Parcela paga com sucesso!", "success")
      reload()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ ${err?.message || "Erro ao pagar parcela"}`, "error")
    }
  }

  const handleUndoPayment = async (installment: Installment) => {
    if (!user) return
    vibrate([10])
    try {
      const updateData = {
        paid: false,
        paid_date: null,
        updated_at: new Date().toISOString()
      }

      const res1 = await safeUpdate('transactions', installment.id, updateData)
      if (!res1.success) throw new Error(res1.error)

      if (financingData?.status === "paid") {
        const statusUpdate = { status: "active", updated_at: new Date().toISOString() }
        const res2 = await safeUpdate('financings', financingId, statusUpdate)
        if (!res2.success) throw new Error(res2.error)
      }

      success()
      showToast("🔄 Pagamento desfeito com sucesso!", "success")
      reload()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ ${err?.message || "Erro ao desfazer pagamento"}`, "error")
    }
  }

  const handleDeleteInstallment = async (installmentId: string) => {
    if (!user) return
    try {
      const res = await safeDelete('transactions', installmentId)
      if (!res.success) throw new Error(res.error)

      success()
      showToast("🗑️ Parcela excluída com sucesso!", "success")
      setDeleteModal(null)
      reload()
    } catch (err: any) {
      errorHaptic()
      showToast("❌ Erro ao excluir parcela", "error")
    }
  }

  const handleDeleteFinancing = async () => {
    if (!user) return
    vibrate([10, 50])
    if (!confirm("Tem certeza que deseja excluir este financiamento e todas as suas parcelas?")) return
    try {
      for (const inst of installments) {
        const res1 = await safeDelete('transactions', inst.id)
        if (!res1.success) throw new Error(res1.error)
      }
      
      const res2 = await safeDelete('financings', financingId)
      if (!res2.success) throw new Error(res2.error)

      success()
      showToast("🗑️ Financiamento excluído!", "success")
      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast("❌ Erro ao excluir financiamento", "error")
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        vibrate([10])
        reload().finally(() => setTimeout(() => setRefreshing(false), 600))
      }
    }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)
  const formatDate = (date: string | null) => date ? new Date(date).toLocaleDateString("pt-BR") : ""

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <span className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full"><Clock size={12} /> Ativo</span>
      case "paid": return <span className="flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2.5 py-1 rounded-full"><CheckCircle2 size={12} /> Quitado</span>
      case "overdue": return <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-full"><AlertTriangle size={12} /> Atrasado</span>
      default: return <span className="text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">{status}</span>
    }
  }

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "vehicle": return <Car size={22} className="text-teal-600 dark:text-teal-400" />
      case "property": return <Home size={22} className="text-teal-600 dark:text-teal-400" />
      default: return <Percent size={22} className="text-teal-600 dark:text-teal-400" />
    }
  }

  const paidInstallments = installments.filter((i: Installment) => i.paid)
  const totalPaid = paidInstallments.reduce((sum: number, i: Installment) => sum + (i.amount || 0), 0)
  const remaining = (financingData?.total_amount || 0) - totalPaid
  const progressPercent = financingData?.total_amount ? (totalPaid / financingData.total_amount) * 100 : 0

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

  if (!financingData) {
    return (
      <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900">
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
          <button onClick={() => router.back()} className="p-2 rounded-full bg-gray-100 dark:bg-slate-800"><ArrowLeft size={20} /></button>
          <h1 className="text-lg font-black mt-4">Financiamento não encontrado</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors">
      {(loadingPulse || pendingCount > 0) && (
        <div className="fixed top-20 right-4 z-50"><div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]" /></div>
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
            <div>
              <h1 className="text-[18px] font-bold text-gray-800 dark:text-gray-100 truncate max-w-[150px]">{financingData.description || "Financiamento"}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {getStatusBadge(financingData.status)}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => { vibrate([5]); router.push(`/financings/new?edit=${financingId}`); }} className="p-2.5 rounded-full bg-gray-50 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-teal-700 dark:text-teal-400 active:scale-95 transition-all">
              <Pencil size={18} />
            </button>
            <button onClick={handleDeleteFinancing} className="p-2.5 rounded-full bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 active:scale-95 transition-all">
              <Trash2 size={18} />
            </button>
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
            <span>{formatCurrency(financingData.total_amount || 0)} Total</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-50 dark:border-slate-700/50 p-5 space-y-4 shadow-sm animate-in fade-in duration-300 delay-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[16px] bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center">
              {getAssetIcon(financingData.asset_type)}
            </div>
            <div>
              <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{financingData.asset || "Bem não especificado"}</p>
              {financingData.bank && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 mt-0.5">
                  <Building2 size={12} /> {financingData.bank}
                </div>
              )}
            </div>
          </div>
          <div className="h-px bg-gray-100 dark:bg-slate-700/50" />
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-gray-50 dark:bg-slate-700/30 rounded-[16px] p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Parcelas</p>
              <p className="text-[14px] font-black text-gray-800 dark:text-gray-200">{financingData.installments_count}</p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-slate-700/30 rounded-[16px] p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Valor</p>
              <p className="text-[14px] font-black text-gray-800 dark:text-gray-200">{formatCurrency(financingData.installment_amount || 0)}</p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-slate-700/30 rounded-[16px] p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Juros</p>
              <p className="text-[14px] font-black text-gray-800 dark:text-gray-200">{financingData.interest_rate ? `${financingData.interest_rate}%` : "-"}</p>
            </div>
          </div>
          <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/30 rounded-[16px] p-3">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <span className="text-[12px] font-bold text-gray-500">Início:</span>
            </div>
            <span className="text-[12px] font-black text-gray-800 dark:text-gray-200">{formatDate(financingData.start_date) || "N/A"}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[28px] border border-gray-50 dark:border-slate-700/50 p-6 shadow-sm animate-in fade-in duration-300 delay-200">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100">Controle de Parcelas</h3>
              <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 mt-0.5">{paidInstallments.length} de {installments.length} pagas</p>
            </div>
          </div>

          {installments.length === 0 ? (
            <p className="text-center text-[13px] font-medium text-gray-400 py-4">Nenhuma parcela gerada.</p>
          ) : (
            <div className="space-y-2">
              {installments.sort((a: Installment, b: Installment) => a.number - b.number).slice(0, expandedInstallments ? undefined : 5).map((inst: Installment) => (
                <div key={inst.id} className={`flex items-center justify-between rounded-[20px] px-3.5 py-3.5 transition-all active:scale-[0.98] ${inst.paid ? "bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/50" : "bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50"}`}>
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <button 
                      onClick={() => { vibrate([10]); inst.paid ? handleUndoPayment(inst) : handlePayInstallment(inst); }} 
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${inst.paid ? "bg-teal-500 border-teal-500 text-white" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 hover:border-teal-500"}`}
                    >
                      {inst.paid && <CheckCircle2 size={16} />}
                    </button>
                    <div className="min-w-0">
                      <p className={`text-[14px] font-bold truncate ${inst.paid ? "text-teal-700 dark:text-teal-300" : "text-gray-800 dark:text-gray-200"}`}>Parcela #{inst.number}</p>
                      <p className={`text-[11px] font-medium mt-0.5 ${inst.paid ? "text-teal-600/80 dark:text-teal-400/80" : "text-gray-500"}`}>Vence {formatDate(inst.due_date)} {inst.paid && inst.paid_date && `• Pago ${formatDate(inst.paid_date)}`}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`font-black text-[14px] ${inst.paid ? "text-teal-600 dark:text-teal-400" : "text-gray-600 dark:text-gray-300"}`}>{formatCurrency(inst.amount)}</span>
                    <button onClick={() => { vibrate([5]); setDeleteModal(inst.id); }} className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {installments.length > 5 && (
                <button onClick={() => { vibrate([5]); setExpandedInstallments(!expandedInstallments); }} className="w-full text-center text-[12px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 py-3 rounded-xl transition-colors mt-2 active:scale-95">
                  {expandedInstallments ? "Recolher parcelas" : `Ver todas as ${installments.length} parcelas`}
                  <ChevronDown size={14} className={`inline ml-1 transition-transform ${expandedInstallments ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Deletar Parcela */}
      {deleteModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setDeleteModal(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Excluir Parcela</h3>
              <button onClick={() => setDeleteModal(null)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
            </div>
            <p className="text-[14px] font-medium text-gray-500 mb-6">Tem certeza que deseja excluir esta parcela? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} className="flex-1 py-4 rounded-[24px] bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-[15px] active:scale-[0.98] transition-transform">Cancelar</button>
              <button onClick={() => { vibrate([10, 50]); handleDeleteInstallment(deleteModal); }} className="flex-1 py-4 rounded-[24px] bg-red-500 hover:bg-red-600 text-white font-bold text-[15px] shadow-lg shadow-red-500/30 active:scale-[0.98] transition-transform">Excluir Parcela</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FinancingDetailPage() {
  return (
    <Suspense fallback={<div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950"><div className="flex-1 px-4 pt-4"><Skeleton count={3} /></div></div>}>
      <FinancingDetailContent />
    </Suspense>
  )
}
