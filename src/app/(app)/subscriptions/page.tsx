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
  Repeat,
  Calendar,
  CreditCard,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"


export default function SubscriptionsPage() {
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
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Busca dados locais
  const { data: subscriptions, loading, reload } = useLocalData({
    table: 'subscriptions' as any,
    filters: { context },
  })

  // Remove assinatura
  const { remove } = useLocalData({
    table: 'subscriptions' as any,
  })

  const handleDelete = async () => {
    if (!deleteModal) return
    try {
      await remove(deleteModal)
      showToast("Assinatura excluída com sucesso!", "success")
      success()
      setDeleteModal(null)
      reload()
    } catch {
      showToast("Erro ao excluir assinatura", "error")
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
  const filteredSubscriptions = (subscriptions || []).filter((sub: any) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (sub.name && sub.name.toLowerCase().includes(s)) ||
      (sub.category && sub.category.toLowerCase().includes(s)) ||
      (sub.notes && sub.notes.toLowerCase().includes(s))
    )
  })

  const sortedSubscriptions = [...filteredSubscriptions].sort((a: any, b: any) => {
    let valA = a[sortBy] || ""
    let valB = b[sortBy] || ""
    if (sortBy === "amount" || sortBy === "monthly_total") {
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
            <Clock size={12} /> Ativa
          </span>
        )
      case "cancelled":
        return (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
            <AlertTriangle size={12} /> Cancelada
          </span>
        )
      case "paused":
        return (
          <span className="flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded-full">
            <AlertTriangle size={12} /> Pausada
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

  const getBillingCycleLabel = (cycle: string) => {
    switch (cycle) {
      case "monthly": return "Mensal"
      case "yearly": return "Anual"
      case "weekly": return "Semanal"
      case "quarterly": return "Trimestral"
      case "semiannually": return "Semestral"
      default: return cycle
    }
  }

  // Calcula total mensal
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
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
      {/* Bolinha de loading sutil */}
      {(loadingPulse || loading || pendingCount > 0) && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {/* Pull-to-refresh */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* Header fixo */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pb-3">
        {/* Barra do topo */}
        <div className="flex items-center justify-between pt-4 mb-3">
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100">
              Assinaturas
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {appMode === "personal_only" ? "Pessoais" : "Empresariais e Pessoais"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Buscar"
            >
              {showSearch ? <X size={18} /> : <Search size={18} />}
            </button>
            <button
              onClick={() =>
                setSortOrder(sortOrder === "desc" ? "asc" : "desc")
              }
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Ordenar"
            >
              <ArrowUpDown size={18} />
            </button>
            <button
              onClick={() => router.push("/subscriptions/new")}
              className="p-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white shadow-md shadow-teal-500/20 transition-all active:scale-95"
              aria-label="Nova assinatura"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Card de total mensal */}
        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-2xl p-4 mb-3 text-white shadow-lg shadow-teal-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/80">Total Mensal</p>
              <p className="text-2xl font-black">{formatCurrency(monthlyTotal)}</p>
            </div>
            <div className="bg-white/20 rounded-xl p-2">
              <Calendar size={24} />
            </div>
          </div>
          <p className="text-xs text-white/70 mt-1">
            {subscriptions?.filter((s: any) => s.status === "active").length || 0} assinaturas ativas
          </p>
        </div>

        {/* Search */}
        {showSearch && (
          <div className="relative mb-2">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Buscar assinatura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
            />
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSortBy("updated_at")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              sortBy === "updated_at"
                ? "bg-teal-500 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            Recentes
          </button>
          <button
            onClick={() => setSortBy("amount")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              sortBy === "amount"
                ? "bg-teal-500 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            Valor
          </button>
          <button
            onClick={() => setSortBy("name")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              sortBy === "name"
                ? "bg-teal-500 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            Nome
          </button>
        </div>
      </div>

      {/* Lista */}
      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-y-auto px-4 pt-3 pb-24"
      >
        {loading ? (
          <Skeleton count={4} />
        ) : sortedSubscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Repeat size={48} className="text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-semibold">Nenhuma assinatura</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Toque no + para adicionar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedSubscriptions.map((sub: any) => (
              <div
                key={sub.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all"
              >
                {/* Card principal */}
                <button
                  onClick={() => router.push(`/subscriptions/new?edit=${sub.id}`)}
                  className="w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Repeat size={16} className="text-teal-500 flex-shrink-0" />
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {sub.name || "Assinatura"}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(sub.status)}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {getBillingCycleLabel(sub.billing_cycle)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-black text-lg text-slate-800 dark:text-slate-200">
                        {formatCurrency(sub.amount || 0)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        /{sub.billing_cycle === "monthly" ? "mês" : sub.billing_cycle === "yearly" ? "ano" : sub.billing_cycle}
                      </p>
                    </div>
                  </div>

                  {sub.next_due_date && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar size={12} />
                      <span>Próximo: {formatDate(sub.next_due_date)}</span>
                    </div>
                  )}

                  {sub.category && (
                    <span className="inline-block mt-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                      {sub.category}
                    </span>
                  )}
                </button>

                {/* Ações */}
                <div className="px-4 pb-3 flex gap-2">
                  <button
                    onClick={() => router.push(`/subscriptions/new?edit=${sub.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold shadow-sm shadow-teal-500/20 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setDeleteModal(sub.id)}
                    className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                    aria-label="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de exclusão */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">
              Excluir Assinatura
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Tem certeza que deseja excluir esta assinatura? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}