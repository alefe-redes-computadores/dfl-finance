'use client'

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createPortal } from "react-dom" // ✅ ADICIONADO
import {
  ArrowUpDown, Search, Plus, X, ChevronDown, RefreshCw, Trash2, CheckCircle2, AlertTriangle, Clock, Car, Home, Percent,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import ContextToggle from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from '@/hooks/useSafeDb'

type Installment = { id: string, financing_id: string, amount: number, due_date: string, paid: boolean, number: number }

export default function FinancingsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  
  const { safeDelete } = useSafeDb()

  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [sortBy, setSortBy] = useState("updated_at")
  const [sortOrder, setSortOrder] = useState("desc")
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: financings, loading, reload } = useLocalData({ 
    table: 'financings' as any, 
    filters: { context: effectiveContext } 
  })
  
  const { data: allInstallments } = useLocalData({ 
    table: 'transactions' as any, 
    filters: { context: effectiveContext, type: 'financing_installment' } 
  })

  const installmentsByFinancing = (allInstallments || []).reduce((acc: Record<string, Installment[]>, inst: any) => {
    if (inst.financing_id) {
      if (!acc[inst.financing_id]) acc[inst.financing_id] = []
      acc[inst.financing_id].push(inst)
    }
    return acc
  }, {})

  const handleDelete = async () => {
    if (!deleteModal || !user) return
    vibrate([10, 50])
    try {
      const installments = installmentsByFinancing[deleteModal] || []
      
      for (const inst of installments) {
        const res1 = await safeDelete('transactions', inst.id)
        if (!res1.success) throw new Error(res1.error)
      }
      
      const res2 = await safeDelete('financings', deleteModal)
      if (!res2.success) throw new Error(res2.error)

      success()
      showToast("✅ Financiamento excluído com sucesso!", "success")
      setDeleteModal(null)
      reload()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro ao excluir financiamento: ${err.message}`, "error")
    }
  }

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

  const filteredFinancings = (financings || []).filter((fin: any) => {
    if (!search) return true
    const s = search.toLowerCase()
    return ((fin.description && fin.description.toLowerCase().includes(s)) || (fin.bank && fin.bank.toLowerCase().includes(s)) || (fin.asset && fin.asset.toLowerCase().includes(s)))
  })

  const sortedFinancings = [...filteredFinancings].sort((a: any, b: any) => {
    let valA = a[sortBy] || ""; let valB = b[sortBy] || ""
    if (sortBy === "total_amount" || sortBy === "remaining_amount") return sortOrder === "desc" ? Number(b[sortBy]) - Number(a[sortBy]) : Number(a[sortBy]) - Number(b[sortBy])
    return sortOrder === "desc" ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB))
  })

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)
  const formatDate = (date: string | null) => {
    if (!date) return ""
    return new Date(date + 'T12:00:00').toLocaleDateString("pt-BR", { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400"><Clock size={11} /> Ativo</span>
      case "paid": return <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 text-[11px] font-medium text-teal-600 dark:text-teal-400"><CheckCircle2 size={11} /> Quitado</span>
      case "overdue": return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/30 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400"><AlertTriangle size={11} /> Atrasado</span>
      default: return <span className="rounded-full bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-gray-500">{status}</span>
    }
  }

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "vehicle": return <Car size={18} className="text-teal-600 dark:text-teal-400" />
      case "property": return <Home size={18} className="text-teal-600 dark:text-teal-400" />
      default: return <Percent size={18} className="text-teal-600 dark:text-teal-400" />
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f8f9fa] dark:bg-slate-900 transition-colors duration-300">
      
      {/* Ponto de Luz */}
      {(loadingPulse || loading || pendingCount > 0) && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200/70 dark:border-slate-700">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* HEADER UNIFICADO */}
      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                Financiamentos
              </h1>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                {appMode === "personal_only" ? "Visão pessoal" : "Visão global"}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { vibrate([5]); setShowSearch(!showSearch); }}
                className="h-11 w-11 rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
              >
                {showSearch ? <X size={18} /> : <Search size={18} />}
              </button>

              <button
                onClick={() => { vibrate([10]); router.push("/financings/new"); }}
                className="h-11 w-11 rounded-[18px] bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98]"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <ContextToggle />
            </div>

            <button
              onClick={() => { vibrate([5]); setSortOrder(sortOrder === "desc" ? "asc" : "desc"); }}
              className="shrink-0 h-10 px-3 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 text-gray-500 dark:text-gray-400 flex items-center gap-1.5 text-[12px] font-semibold active:scale-[0.98] transition-transform"
            >
              <ArrowUpDown size={12} />
              {sortOrder === 'desc' ? 'Decrescente' : 'Crescente'}
            </button>
          </div>

          {showSearch && (
            <div className="mb-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
                <Search size={18} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar financiamento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-[14px] outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400"
                  autoFocus
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {!loading && sortedFinancings.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {[
                { key: 'updated_at', label: 'Mais recentes' },
                { key: 'total_amount', label: 'Valor total' },
                { key: 'start_date', label: 'Data início' },
              ].map(f => (
                <button
                  type="button"
                  key={f.key}
                  onClick={() => { vibrate([5]); setSortBy(f.key); }}
                  className={`h-10 px-3.5 rounded-[18px] border whitespace-nowrap shrink-0 text-[13px] font-semibold transition-colors active:scale-[0.98] ${
                    sortBy === f.key
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200/70 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-y-auto px-4 pt-3 pb-24 custom-scrollbar"
      >
        {loading ? (
          <div className="space-y-3">
            <Skeleton count={3} height="132px" borderRadius="24px" />
          </div>
        ) : sortedFinancings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full border border-gray-200/70 dark:border-slate-700 shadow-sm flex items-center justify-center mb-4">
              <Percent size={28} className="opacity-30 text-gray-500" />
            </div>
            <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">
              Nenhum financiamento
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 animate-in fade-in duration-500">
            {sortedFinancings.map((fin: any) => {
              const installments = installmentsByFinancing[fin.id] || []
              const paidInstallments = installments.filter((i: Installment) => i.paid)
              const totalPaid = paidInstallments.reduce((sum: number, i: Installment) => sum + (i.amount || 0), 0)
              const remaining = (fin.total_amount || 0) - totalPaid
              const isExpanded = expandedId === fin.id

              return (
                <div
                  key={fin.id}
                  className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2"
                >
                  <button
                    onClick={() => { vibrate([5]); router.push(`/financings/details?id=${fin.id}`); }}
                    className="w-full rounded-[18px] p-3 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-[14px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
                          {getAssetIcon(fin.asset_type)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {fin.description || "Financiamento"}
                          </p>
                          {fin.asset && (
                            <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                              {fin.asset}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {getStatusBadge(fin.status)}
                            <span className="text-[12px] text-gray-400 dark:text-gray-500">
                              {formatDate(fin.start_date)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-2">
                        <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(fin.total_amount || 0)}
                        </p>
                        {fin.status === "active" && (
                          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">
                            Falta {formatCurrency(Math.max(0, remaining))}
                          </p>
                        )}
                      </div>
                    </div>

                    {installments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700/60">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                            Parcelas {paidInstallments.length}/{installments.length}
                          </span>
                          <span className="text-[13px] font-semibold text-teal-600 dark:text-teal-400">
                            {formatCurrency(totalPaid)}
                          </span>
                        </div>

                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                          {installments.slice(0, isExpanded ? undefined : 3).map((inst: Installment) => (
                            <div
                              key={inst.id}
                              className={`rounded-[16px] px-3 py-2 flex items-center justify-between text-[12px] ${
                                inst.paid
                                  ? 'bg-teal-50 dark:bg-teal-900/10'
                                  : 'bg-gray-50 dark:bg-slate-700/40'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`w-2 h-2 rounded-full ${inst.paid ? "bg-teal-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                                <span className={`${inst.paid ? 'text-teal-700 dark:text-teal-400 font-medium' : 'text-gray-600 dark:text-gray-400'} truncate`}>
                                  #{inst.number} — {formatDate(inst.due_date)}
                                </span>
                              </div>
                              <span className={`font-semibold shrink-0 ${inst.paid ? "text-teal-600 dark:text-teal-400" : "text-gray-500"}`}>
                                {formatCurrency(inst.amount)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {installments.length > 3 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              vibrate([5])
                              setExpandedId(isExpanded ? null : fin.id)
                            }}
                            className="w-full mt-2 h-9 rounded-[16px] bg-teal-50 dark:bg-teal-900/10 text-teal-600 dark:text-teal-400 text-[12px] font-semibold active:scale-[0.98] transition-transform"
                          >
                            {isExpanded ? "Recolher parcelas" : `Ver todas (${installments.length})`}
                          </button>
                        )}
                      </div>
                    )}
                  </button>

                  <div className="px-3 pb-3 pt-1 flex gap-2">
                    <button
                      onClick={() => { vibrate([5]); router.push(`/financings/details?id=${fin.id}`); }}
                      className="flex-1 h-10 rounded-[16px] bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:text-teal-600 dark:hover:text-teal-400 text-[13px] font-semibold transition-colors active:scale-[0.98]"
                    >
                      Ver detalhes
                    </button>
                    <button
                      onClick={() => { vibrate([10]); setDeleteModal(fin.id); }}
                      className="w-10 h-10 rounded-[16px] bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors active:scale-[0.98]"
                      aria-label="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ✅ MODAL DE EXCLUSÃO COM PORTAL */}
      {deleteModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-sm"
          onClick={() => setDeleteModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 p-6 rounded-t-[32px] sm:rounded-[32px] w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <h3 className="text-[20px] font-black text-gray-800 dark:text-gray-100 mb-2 text-center tracking-tight">
              Excluir Financiamento
            </h3>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-8 text-center font-medium px-4">
              Tem certeza que deseja excluir este financiamento e todas as suas parcelas?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="flex-1 py-4 rounded-[20px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold text-[15px] hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { vibrate([50]); handleDelete(); }}
                className="flex-1 py-4 rounded-[20px] bg-red-500 hover:bg-red-600 text-white font-bold text-[15px] shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}