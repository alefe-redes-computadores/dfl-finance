"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  ArrowLeft,
  Trash2,
  RefreshCw,
  Pencil,
  Car,
  Home,
  Percent,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  Calendar,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { db } from '@/lib/db'

type Installment = {
  id: string
  financing_id: string
  amount: number
  due_date: string
  paid: boolean
  paid_date?: string
  number: number
}

export default function FinancingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const financingId = params.id as string
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  const { context } = useContext_()

  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [expandedInstallments, setExpandedInstallments] = useState(false)
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: localFinancings, loading, reload } = useLocalData({
    table: 'financings' as any,
    filters: { context },
  })

  const financingData = (localFinancings || []).find((f: any) => f.id === financingId) as any

  const { data: allInstallments } = useLocalData({
    table: 'transactions' as any,
    filters: { context, type: 'financing_installment', financing_id: financingId },
  })

  const installments = (allInstallments || []) as Installment[]

  // 🔥 PAGAMENTO ATÔMICO
  const handlePayInstallment = async (installment: Installment) => {
    if (!user) return
    try {
      await db.transaction('rw', 'transactions', 'financings', 'syncQueue', async () => {
        const updateData = {
          paid: true,
          paid_date: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString()
        }
        await db.table('transactions').update(installment.id, updateData)
        await db.table('syncQueue').add({ table: 'transactions', operation: 'update', record_id: installment.id, data: updateData, user_id: user.id, created_at: new Date().toISOString() })

        const updatedInstallments = installments.map((i: Installment) => i.id === installment.id ? { ...i, paid: true } : i)
        const allPaid = updatedInstallments.every((i: Installment) => i.paid)
        
        if (allPaid && financingData?.status !== "paid") {
          const statusUpdate = { status: "paid", updated_at: new Date().toISOString() }
          await db.table('financings').update(financingId, statusUpdate)
          await db.table('syncQueue').add({ table: 'financings', operation: 'update', record_id: financingId, data: statusUpdate, user_id: user.id, created_at: new Date().toISOString() })
        }
      })

      showToast("Parcela paga com sucesso!", "success")
      success()
      reload()
    } catch (err: any) {
      showToast(err?.message || "Erro ao pagar parcela", "error")
      errorHaptic()
    }
  }

  // 🔥 DESFAZER PAGAMENTO ATÔMICO
  const handleUndoPayment = async (installment: Installment) => {
    if (!user) return
    try {
      await db.transaction('rw', 'transactions', 'financings', 'syncQueue', async () => {
        const updateData = {
          paid: false,
          paid_date: null,
          updated_at: new Date().toISOString()
        }
        await db.table('transactions').update(installment.id, updateData)
        await db.table('syncQueue').add({ table: 'transactions', operation: 'update', record_id: installment.id, data: updateData, user_id: user.id, created_at: new Date().toISOString() })

        if (financingData?.status === "paid") {
          const statusUpdate = { status: "active", updated_at: new Date().toISOString() }
          await db.table('financings').update(financingId, statusUpdate)
          await db.table('syncQueue').add({ table: 'financings', operation: 'update', record_id: financingId, data: statusUpdate, user_id: user.id, created_at: new Date().toISOString() })
        }
      })

      showToast("Pagamento desfeito com sucesso!", "success")
      success()
      reload()
    } catch (err: any) {
      showToast(err?.message || "Erro ao desfazer pagamento", "error")
      errorHaptic()
    }
  }

  // 🔥 EXCLUIR PARCELA ATÔMICO
  const handleDeleteInstallment = async (installmentId: string) => {
    if (!user) return
    try {
      await db.transaction('rw', 'transactions', 'syncQueue', async () => {
        await db.table('transactions').delete(installmentId)
        await db.table('syncQueue').add({ table: 'transactions', operation: 'delete', record_id: installmentId, user_id: user.id, created_at: new Date().toISOString() })
      })
      showToast("Parcela excluída com sucesso!", "success")
      success()
      setDeleteModal(null)
      reload()
    } catch {
      showToast("Erro ao excluir parcela", "error")
      errorHaptic()
    }
  }

  // 🔥 EXCLUIR FINANCIAMENTO ATÔMICO (Cascata)
  const handleDeleteFinancing = async () => {
    if (!user) return
    if (!confirm("Tem certeza que deseja excluir este financiamento e todas as suas parcelas?")) return
    try {
      await db.transaction('rw', 'financings', 'transactions', 'syncQueue', async () => {
        for (const inst of installments) {
          await db.table('transactions').delete(inst.id)
          await db.table('syncQueue').add({ table: 'transactions', operation: 'delete', record_id: inst.id, user_id: user.id, created_at: new Date().toISOString() })
        }
        await db.table('financings').delete(financingId)
        await db.table('syncQueue').add({ table: 'financings', operation: 'delete', record_id: financingId, user_id: user.id, created_at: new Date().toISOString() })
      })
      showToast("Financiamento excluído com sucesso!", "success")
      success()
      router.back()
    } catch {
      showToast("Erro ao excluir financiamento", "error")
      errorHaptic()
    }
  }

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

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)
  const formatDate = (date: string | null) => date ? new Date(date).toLocaleDateString("pt-BR") : ""

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full"><Clock size={12} /> Ativo</span>
      case "paid": return <span className="flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full"><CheckCircle2 size={12} /> Quitado</span>
      case "overdue": return <span className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full"><AlertTriangle size={12} /> Atrasado</span>
      default: return <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{status}</span>
    }
  }

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "vehicle": return <Car size={20} className="text-teal-500" />
      case "property": return <Home size={20} className="text-teal-500" />
      default: return <Percent size={20} className="text-teal-500" />
    }
  }

  const paidInstallments = installments.filter((i: Installment) => i.paid)
  const totalPaid = paidInstallments.reduce((sum: number, i: Installment) => sum + (i.amount || 0), 0)
  const remaining = (financingData?.total_amount || 0) - totalPaid

  if (loading) {
    return (
      <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"><ArrowLeft size={20} /></div>
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">Carregando...</h1>
          </div>
        </div>
        <div className="flex-1 px-4 pt-4"><Skeleton count={3} /></div>
      </div>
    )
  }

  if (!financingData) {
    return (
      <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><ArrowLeft size={20} /></button>
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">Financiamento não encontrado</h1>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
      {(loadingPulse || loading || pendingCount > 0) && (
        <div className="fixed top-20 right-4 z-50"><div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" /></div>
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
            <button onClick={() => router.back()} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">{financingData.description || "Financiamento"}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {getStatusBadge(financingData.status)}
                <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(financingData.start_date)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push(`/financings/new?edit=${financingId}`)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Editar"><Pencil size={18} /></button>
            <button onClick={handleDeleteFinancing} className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors" aria-label="Excluir"><Trash2 size={18} /></button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Valor Total</p>
            <p className="text-xl font-black text-slate-800 dark:text-slate-200">{formatCurrency(financingData.total_amount || 0)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Restante</p>
            <p className={`text-xl font-black ${remaining <= 0 ? "text-teal-500" : "text-orange-500"}`}>{formatCurrency(Math.max(0, remaining))}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center gap-2">
            {getAssetIcon(financingData.asset_type)}
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{financingData.asset_type === "vehicle" ? "Veículo" : financingData.asset_type === "property" ? "Imóvel" : "Outro"}</span>
          </div>
          {financingData.asset && (
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">Bem</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{financingData.asset}</p>
            </div>
          )}
          {financingData.bank && (
            <div className="flex items-center gap-2"><Building2 size={16} className="text-slate-400" /><span className="text-sm text-slate-600 dark:text-slate-400">{financingData.bank}</span></div>
          )}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Parcelas</p><p className="font-bold text-slate-800 dark:text-slate-200">{financingData.installments_count}</p></div>
            <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Valor Parcela</p><p className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(financingData.installment_amount || 0)}</p></div>
            <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Juros</p><p className="font-bold text-slate-800 dark:text-slate-200">{financingData.interest_rate ? `${financingData.interest_rate}%` : "-"}</p></div>
          </div>
          {financingData.start_date && (
            <div className="flex items-center gap-2"><Calendar size={14} className="text-slate-400" /><span className="text-xs text-slate-500 dark:text-slate-400">Início: {formatDate(financingData.start_date)}</span></div>
          )}
          {financingData.first_due_date && (
            <div className="flex items-center gap-2"><Calendar size={14} className="text-slate-400" /><span className="text-xs text-slate-500 dark:text-slate-400">1º Vencimento: {formatDate(financingData.first_due_date)}</span></div>
          )}
          {financingData.notes && (
            <div><p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">Observações</p><p className="text-sm text-slate-600 dark:text-slate-400">{financingData.notes}</p></div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-200">Parcelas</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{paidInstallments.length}/{installments.length} pagas — {formatCurrency(totalPaid)}</p>
            </div>
          </div>

          {installments.length === 0 ? (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">Nenhuma parcela gerada.</p>
          ) : (
            <div className="space-y-2">
              {installments.sort((a: Installment, b: Installment) => a.number - b.number).slice(0, expandedInstallments ? undefined : 5).map((inst: Installment) => (
                <div key={inst.id} className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors ${inst.paid ? "bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800" : "bg-slate-50 dark:bg-slate-800"}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button onClick={() => inst.paid ? handleUndoPayment(inst) : handlePayInstallment(inst)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${inst.paid ? "bg-teal-500 border-teal-500 text-white" : "border-slate-300 dark:border-slate-600 hover:border-teal-500"}`}>{inst.paid && <CheckCircle2 size={14} />}</button>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${inst.paid ? "text-teal-700 dark:text-teal-300" : "text-slate-800 dark:text-slate-200"}`}>Parcela #{inst.number}</p>
                      <p className={`text-xs ${inst.paid ? "text-teal-600 dark:text-teal-400" : "text-slate-500 dark:text-slate-400"}`}>{formatDate(inst.due_date)}{inst.paid && inst.paid_date && ` — Pago em ${formatDate(inst.paid_date)}`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${inst.paid ? "text-teal-600 dark:text-teal-400" : "text-slate-500"}`}>{formatCurrency(inst.amount)}</span>
                    <button onClick={() => setDeleteModal(inst.id)} className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {installments.length > 5 && (
                <button onClick={() => setExpandedInstallments(!expandedInstallments)} className="w-full text-center text-xs text-teal-500 hover:text-teal-600 font-semibold py-2">
                  {expandedInstallments ? "Ver menos" : `Ver todas (${installments.length})`}
                  <ChevronDown size={12} className={`inline ml-1 transition-transform ${expandedInstallments ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Excluir Parcela</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Tem certeza que deseja excluir esta parcela?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">Cancelar</button>
              <button onClick={() => handleDeleteInstallment(deleteModal)} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
