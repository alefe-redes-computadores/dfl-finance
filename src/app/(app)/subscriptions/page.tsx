'use client'

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUpDown, Search, Plus, X, RefreshCw, Trash2, CheckCircle2, AlertTriangle, Clock, Repeat, Calendar, ChevronLeft
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import ContextToggle from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { db, addToSyncQueue } from '@/lib/db'

export default function SubscriptionsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [sortBy, setSortBy] = useState("updated_at")
  const [sortOrder, setSortOrder] = useState("desc")
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: subscriptions, loading, reload } = useLocalData({
    table: 'subscriptions' as any,
    filters: { context: effectiveContext },
  })

  const handleDelete = async () => {
    if (!deleteModal || !user) return
    try {
      await db.transaction('rw', ['subscriptions', 'syncQueue'], async () => {
        await db.table('subscriptions').delete(deleteModal)
        await addToSyncQueue(user.id, 'subscriptions', 'delete', deleteModal, null)
      })
      
      showToast("Assinatura excluída com sucesso!", "success")
      success()
      setDeleteModal(null)
      reload()
    } catch (err: any) {
      showToast(`Erro ao excluir assinatura: ${err.message}`, "error")
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

  const filteredSubscriptions = (subscriptions || []).filter((sub: any) => {
    if (!search) return true
    const s = search.toLowerCase()
    return ((sub.name && sub.name.toLowerCase().includes(s)) || (sub.category && sub.category.toLowerCase().includes(s)) || (sub.notes && sub.notes.toLowerCase().includes(s)))
  })

  const sortedSubscriptions = [...filteredSubscriptions].sort((a: any, b: any) => {
    let valA = a[sortBy] || ""; let valB = b[sortBy] || ""
    if (sortBy === "amount" || sortBy === "monthly_total") return sortOrder === "desc" ? Number(b[sortBy]) - Number(a[sortBy]) : Number(a[sortBy]) - Number(b[sortBy])
    return sortOrder === "desc" ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB))
  })

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)
  
  const formatDate = (date: string | null) => {
    if (!date) return ""
    const d = new Date(date + 'T12:00:00')
    return d.toLocaleDateString("pt-BR", { day: '2-digit', month: 'short' })
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "active": return { label: 'Ativa', icon: Clock, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/30' }
      case "cancelled": return { label: 'Cancelada', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' }
      case "paused": return { label: 'Pausada', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' }
      default: return { label: status, icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-slate-800' }
    }
  }

  const getBillingCycleLabel = (cycle: string) => {
    switch (cycle) {
      case "monthly": return "mensal"
      case "yearly": return "anual"
      case "weekly": return "semanal"
      case "quarterly": return "trimestral"
      case "semiannually": return "semestral"
      default: return cycle
    }
  }

  const monthlyTotal = (subscriptions || []).reduce((sum: number, sub: any) => {
    if (sub.status !== "active") return sum
    let monthlyAmount = sub.amount || 0
    switch (sub.billing_cycle) {
      case "yearly": monthlyAmount = monthlyAmount / 12; break
      case "weekly": monthlyAmount = monthlyAmount * 4.33; break
      case "quarterly": monthlyAmount = monthlyAmount / 3; break
      case "semiannually": monthlyAmount = monthlyAmount / 6; break
    }
    return sum + monthlyAmount
  }, 0)

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f8f9fa] dark:bg-slate-900 font-sans transition-colors duration-300">
      
      {(loadingPulse || loading || pendingCount > 0) && (
        <div className="fixed top-6 right-6 z-50">
          <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200/70 dark:border-slate-700">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* 🔥 HEADER UNIFICADO */}
      <div className="sticky top-0 z-40 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => router.push('/more')}
                className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                  Assinaturas
                </h1>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {appMode === "personal_only" ? "Visão pessoal" : "Visão global"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="h-11 w-11 rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
              >
                {showSearch ? <X size={18} /> : <Search size={18} />}
              </button>

              <button
                onClick={() => router.push("/subscriptions/new")}
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
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              className="h-10 px-3 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 text-gray-500 dark:text-gray-400 text-[12px] font-semibold flex items-center gap-1.5 active:scale-[0.98] transition-transform shrink-0"
            >
              <ArrowUpDown size={12} />
              {sortOrder === 'desc' ? 'Decrescente' : 'Crescente'}
            </button>
          </div>

          {showSearch && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
                <Search size={18} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar assinatura..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-[14px] text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none"
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
        </div>
      </div>

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-y-auto px-4 pt-3 pb-28 custom-scrollbar"
      >
        {/* 🔥 CARD DE RESUMO - NEUTRO */}
        {!loading && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5 mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1">
                  Comprometimento mensal
                </p>
                <p className="text-[30px] leading-none font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  {formatCurrency(monthlyTotal)}
                </p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-2">
                  {subscriptions?.filter((s: any) => s.status === "active").length || 0} assinaturas ativas
                </p>
              </div>

              <div className="w-12 h-12 rounded-[18px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
                <Calendar size={20} className="text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </div>
        )}

        {/* 🔥 FILTROS DE ORDENAÇÃO */}
        {!loading && sortedSubscriptions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-1">
            {[
              { key: 'updated_at', label: 'Mais recentes' },
              { key: 'amount', label: 'Maior valor' },
              { key: 'name', label: 'Por nome' },
            ].map(f => (
              <button
                type="button"
                key={f.key}
                onClick={() => setSortBy(f.key)}
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

        {loading ? (
          <div className="space-y-3">
            <Skeleton count={1} height="120px" borderRadius="24px" />
            <Skeleton count={3} height="92px" borderRadius="24px" />
          </div>
        ) : sortedSubscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full border border-gray-200/70 dark:border-slate-700 shadow-sm flex items-center justify-center mb-4">
              <Repeat size={28} className="opacity-30 text-gray-500" />
            </div>
            <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-200 text-center">
              {search ? "Nenhuma assinatura encontrada" : "Nenhuma assinatura ativa"}
            </p>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1 text-center max-w-[260px]">
              {search ? "Tente buscar com outro termo." : "Gerencie seus serviços, planos e contratos mensais aqui."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 animate-in fade-in duration-500">
            {sortedSubscriptions.map((sub: any) => {
              const status = getStatusInfo(sub.status)

              return (
                <div
                  key={sub.id}
                  className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2"
                >
                  <div className="rounded-[18px] p-3">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 ${status.bg}`}>
                          <Repeat size={18} className={status.color} />
                        </div>

                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {sub.name || "Assinatura"}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 min-w-0 text-[12px] text-gray-400 dark:text-gray-500">
                            <span>{getBillingCycleLabel(sub.billing_cycle)}</span>
                            {sub.category && (
                              <>
                                <span className="text-gray-300 dark:text-slate-600">•</span>
                                <span className="truncate max-w-[100px]">{sub.category}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`text-[15px] font-semibold tracking-tight ${
                          sub.status === 'active'
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {formatCurrency(sub.amount || 0)}
                        </p>
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-50 dark:bg-slate-700/60">
                          <status.icon size={10} className={status.color} />
                          <span className={status.color}>{status.label}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {sub.next_due_date && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[14px] bg-gray-50 dark:bg-slate-700/50 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                            <Calendar size={12} />
                            <span>Vence {formatDate(sub.next_due_date)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => router.push(`/subscriptions/new?edit=${sub.id}`)}
                        className="flex-1 h-10 rounded-[16px] bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 font-semibold text-[13px] transition-colors active:scale-[0.98]"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleteModal(sub.id)}
                        className="w-10 h-10 rounded-[16px] bg-gray-50 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors active:scale-[0.98]"
                        aria-label="Excluir"
                      >
                        <Trash2 size={15} className="mx-auto" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 🔥 MODAL DE EXCLUSÃO */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteModal(null)}>
          <div
            className="bg-white dark:bg-slate-800 p-6 rounded-t-[32px] sm:rounded-[32px] w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <h3 className="text-[20px] font-black text-gray-800 dark:text-gray-100 mb-2 text-center tracking-tight">
              Excluir Assinatura
            </h3>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-8 text-center font-medium px-4">
              Tem certeza que deseja remover esta assinatura do seu planejamento?
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
                onClick={handleDelete}
                className="flex-1 py-4 rounded-[20px] bg-red-500 hover:bg-red-600 text-white font-bold text-[15px] shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}