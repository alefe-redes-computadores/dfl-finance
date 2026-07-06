"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUpDown,
  Search,
  Plus,
  X,
  ChevronDown,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Car,
  Home,
  Percent,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { db } from '@/lib/db' // 🔥 ADICIONADO

type Installment = {
  id: string
  financing_id: string
  amount: number
  due_date: string
  paid: boolean
  paid_date?: string
  number: number
}

export default function FinancingsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  const { context, appMode } = useContext_()

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

  // Busca dados locais
  const { data: financings, loading, reload } = useLocalData({
    table: 'financings' as any,
    filters: { context },
  })

  // Busca parcelas vinculadas (todos de uma vez)
  const { data: allInstallments } = useLocalData({
    table: 'transactions' as any,
    filters: { context, type: 'financing_installment' },
  })

  // Agrupa parcelas por financing_id
  const installmentsByFinancing = (allInstallments || []).reduce((acc: Record<string, Installment[]>, inst: any) => {
    if (inst.financing_id) {
      if (!acc[inst.financing_id]) acc[inst.financing_id] = []
      acc[inst.financing_id].push(inst)
    }
    return acc
  }, {})

  // 🔥 REMOVIDOS: const { remove } = useLocalData({ table: 'financings' as any })
  // 🔥 REMOVIDOS: const { remove: removeTransaction } = useLocalData({ table: 'transactions' as any })

  // 🔥 CORRIGIDO: Remove financiamento com db.table().delete()
  const handleDelete = async () => {
    if (!deleteModal) return
    try {
      const installments = installmentsByFinancing[deleteModal] || []
      for (const inst of installments) {
        await db.table('transactions').delete(inst.id)
      }
      await db.table('financings').delete(deleteModal)
      showToast("Financiamento excluído com sucesso!", "success")
      success()
      setDeleteModal(null)
      reload()
    } catch {
      showToast("Erro ao excluir financiamento", "error")
      errorHaptic()
    }
  }

  // Pull-to-refresh
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        reload().finally(() => {
          setTimeout(() => setRefreshing(false), 600)
        })
      }
    }
  }, [refreshing, reload])

  // Filtros e ordenação
  const filteredFinancings = (financings || []).filter((fin: any) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (fin.description && fin.description.toLowerCase().includes(s)) ||
      (fin.bank && fin.bank.toLowerCase().includes(s)) ||
      (fin.asset && fin.asset.toLowerCase().includes(s)) ||
      (fin.notes && fin.notes.toLowerCase().includes(s))
    )
  })

  const sortedFinancings = [...filteredFinancings].sort((a: any, b: any) => {
    let valA = a[sortBy] || ""
    let valB = b[sortBy] || ""
    if (sortBy === "total_amount" || sortBy === "remaining_amount") {
      return sortOrder === "desc" ? Number(b[sortBy]) - Number(a[sortBy]) : Number(a[sortBy]) - Number(b[sortBy])
    }
    return sortOrder === "desc" ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB))
  })

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)

  const formatDate = (date: string | null) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("pt-BR")
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
            <Clock size={12} /> Ativo
          </span>
        )
      case "paid":
        return (
          <span className="flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full">
            <CheckCircle2 size={12} /> Quitado
          </span>
        )
      case "overdue":
        return (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
            <AlertTriangle size={12} /> Atrasado
          </span>
        )
      default:
        return (
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {status}
          </span>
        )
    }
  }

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "vehicle":
        return <Car size={16} className="text-teal-500 flex-shrink-0" />
      case "property":
        return <Home size={16} className="text-teal-500 flex-shrink-0" />
      default:
        return <Percent size={16} className="text-teal-500 flex-shrink-0" />
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
      {(loadingPulse || loading || pendingCount > 0) && (
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

      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pb-3">
        <div className="flex items-center justify-between pt-4 mb-3">
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100">
              Financiamentos
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {appMode === "personal_only" ? "Pessoais" : "Empresariais e Pessoais"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearch(!showSearch)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Buscar">
              {showSearch ? <X size={18} /> : <Search size={18} />}
            </button>
            <button onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Ordenar">
              <ArrowUpDown size={18} />
            </button>
            <button onClick={() => router.push("/financings/new")} className="p-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white shadow-md shadow-teal-500/20 transition-all active:scale-95" aria-label="Novo financiamento">
              <Plus size={18} />
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar financiamento..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400" />
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button onClick={() => setSortBy("updated_at")} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${sortBy === "updated_at" ? "bg-teal-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>Recentes</button>
          <button onClick={() => setSortBy("total_amount")} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${sortBy === "total_amount" ? "bg-teal-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>Valor</button>
          <button onClick={() => setSortBy("start_date")} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${sortBy === "start_date" ? "bg-teal-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>Início</button>
        </div>
      </div>

      <div ref={scrollRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex-1 overflow-y-auto px-4 pt-3 pb-24">
        {loading ? (
          <Skeleton count={4} />
        ) : sortedFinancings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Percent size={48} className="text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-semibold">Nenhum financiamento</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Toque no + para adicionar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedFinancings.map((fin: any) => {
              const installments = installmentsByFinancing[fin.id] || []
              const paidInstallments = installments.filter((i: Installment) => i.paid)
              const totalPaid = paidInstallments.reduce((sum: number, i: Installment) => sum + (i.amount || 0), 0)
              const remaining = (fin.total_amount || 0) - totalPaid
              const isExpanded = expandedId === fin.id

              return (
                <div key={fin.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
                  <button onClick={() => router.push(`/financings/${fin.id}`)} className="w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getAssetIcon(fin.asset_type)}
                          <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate">{fin.description || "Financiamento"}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(fin.status)}
                          <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(fin.start_date)}</span>
                        </div>
                        {fin.asset && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{fin.asset}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-black text-lg text-slate-800 dark:text-slate-200">{formatCurrency(fin.total_amount || 0)}</p>
                        {fin.status === "active" && <p className="text-xs text-slate-500 dark:text-slate-400">Resta: {formatCurrency(Math.max(0, remaining))}</p>}
                      </div>
                    </div>
                    {fin.bank && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Banco: {fin.bank}</p>}
                    {installments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Parcelas ({paidInstallments.length}/{installments.length})</span>
                          <span className="text-xs font-bold text-teal-600 dark:text-teal-400">{formatCurrency(totalPaid)}</span>
                        </div>
                        <div className="space-y-1.5 max-h-28 overflow-y-auto">
                          {installments.slice(0, isExpanded ? undefined : 3).map((inst: Installment) => (
                            <div key={inst.id} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${inst.paid ? "bg-teal-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                                <span className="text-slate-600 dark:text-slate-400">#{inst.number} — {formatDate(inst.due_date)}</span>
                              </div>
                              <span className={`font-bold ${inst.paid ? "text-teal-600 dark:text-teal-400" : "text-slate-500"}`}>{formatCurrency(inst.amount)}</span>
                            </div>
                          ))}
                        </div>
                        {installments.length > 3 && (
                          <button onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : fin.id) }} className="w-full text-center text-xs text-teal-500 hover:text-teal-600 font-semibold mt-1 py-1">
                            {isExpanded ? "Ver menos" : `Ver todas (${installments.length})`}
                            <ChevronDown size={12} className={`inline ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                        )}
                      </div>
                    )}
                  </button>
                  <div className="px-4 pb-3 flex gap-2">
                    <button onClick={() => router.push(`/financings/${fin.id}`)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold shadow-sm shadow-teal-500/20 transition-colors">Ver Detalhes</button>
                    <button onClick={() => setDeleteModal(fin.id)} className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors" aria-label="Excluir"><Trash2 size={16} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Excluir Financiamento</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Tem certeza que deseja excluir este financiamento e todas as suas parcelas? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}