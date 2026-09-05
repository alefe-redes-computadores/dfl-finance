// src/app/(app)/financings/page.tsx
'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createPortal } from "react-dom"
import {
  ArrowUpDown,
  Search,
  Plus,
  X,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Car,
  Home,
  Percent,
  ChevronLeft,
  CircleDollarSign,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useFinancingsList } from "@/hooks/useFinancingsList"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import ContextToggle from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from '@/hooks/useSafeDb'
import { useLocalData } from '@/hooks/useLocalData'

type Installment = {
  id: string
  financing_id: string
  amount: number
  due_date: string
  paid: boolean
  number: number
}

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
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: financings, loading } = useFinancingsList(effectiveContext)

  const { data: allInstallments } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext, type: 'financing_installment' }
  })

  const installmentsByFinancing = (allInstallments || []).reduce(
    (acc: Record<string, Installment[]>, inst: any) => {
      if (inst.financing_id) {
        if (!acc[inst.financing_id]) acc[inst.financing_id] = []
        acc[inst.financing_id].push(inst)
      }
      return acc
    },
    {}
  )

  const handleBack = () => {
    vibrate([5])
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
      return
    }
    router.push("/more")
  }

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
      showToast("Financiamento excluído com sucesso.", "success")
      setDeleteModal(null)
    } catch (err: any) {
      errorHaptic()
      showToast(`Não foi possível excluir o financiamento: ${err.message}`, "error")
    }
  }

  const filteredFinancings = (financings || []).filter((fin: any) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (fin.description && fin.description.toLowerCase().includes(s)) ||
      (fin.bank && fin.bank.toLowerCase().includes(s)) ||
      (fin.asset && fin.asset.toLowerCase().includes(s))
    )
  })

  const sortedFinancings = [...filteredFinancings].sort((a: any, b: any) => {
    if (sortBy === "total_amount" || sortBy === "remaining_amount") {
      return sortOrder === "desc"
        ? Number(b[sortBy] || 0) - Number(a[sortBy] || 0)
        : Number(a[sortBy] || 0) - Number(b[sortBy] || 0)
    }

    const valA = a[sortBy] || ""
    const valB = b[sortBy] || ""

    return sortOrder === "desc"
      ? String(valB).localeCompare(String(valA))
      : String(valA).localeCompare(String(valB))
  })

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val)

  const formatDate = (date: string | null) => {
    if (!date) return ""
    return new Date(date + 'T12:00:00').toLocaleDateString("pt-BR", {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Clock size={11} /> Ativo
          </span>
        )
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
            <CheckCircle2 size={11} /> Quitado
          </span>
        )
      case "overdue":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
            <AlertTriangle size={11} /> Atrasado
          </span>
        )
      default:
        return (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-slate-800">
            {status}
          </span>
        )
    }
  }


  const summary = (financings || []).reduce(
    (acc: { active: number; principal: number; paid: number; open: number }, fin: any) => {
      const installments = installmentsByFinancing[fin.id] || []
      const paid = installments.filter((item: Installment) => item.paid).reduce((sum: number, item: Installment) => sum + Number(item.amount || 0), 0)
      const principal = Number(fin.total_amount || 0)
      acc.principal += principal
      acc.paid += paid
      acc.open += Math.max(0, principal - paid)
      if (fin.status === 'active') acc.active += 1
      return acc
    },
    { active: 0, principal: 0, paid: 0, open: 0 }
  )

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "vehicle":
        return <Car size={18} className="text-teal-600 dark:text-teal-400" />
      case "property":
        return <Home size={18} className="text-teal-600 dark:text-teal-400" />
      default:
        return <Percent size={18} className="text-teal-600 dark:text-teal-400" />
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#f8f9fa] transition-colors duration-300 dark:bg-slate-900">
      {(loading || pendingCount > 0) && (
        <div className="fixed top-20 right-4 z-50">
          <div className="h-3 w-3 animate-pulse rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      <div className="sticky top-0 z-30 border-b border-gray-200/60 bg-[#f8f9fa]/92 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/92">
        <div className="rounded-[24px] border border-gray-200/70 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={handleBack}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-gray-200/70 bg-gray-50 text-gray-500 transition-colors active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50"
                aria-label="Voltar"
                type="button"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  Financiamentos
                </h1>
                <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">
                  {appMode === "personal_only" ? "Visão pessoal" : "Visão global"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => {
                  vibrate([5])
                  setShowSearch(!showSearch)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-gray-200/70 bg-gray-50/80 text-gray-600 transition-colors active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                type="button"
              >
                {showSearch ? <X size={18} /> : <Search size={18} />}
              </button>

              <button
                onClick={() => {
                  vibrate([10])
                  router.push("/financings/new")
                }}
                className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-teal-600 text-white shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98] hover:bg-teal-700"
                type="button"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <ContextToggle />
            </div>

            <button
              onClick={() => {
                vibrate([5])
                setSortOrder(sortOrder === "desc" ? "asc" : "desc")
              }}
              className="h-10 shrink-0 rounded-[16px] border border-gray-200/70 bg-gray-50 px-3 text-[12px] font-semibold text-gray-500 transition-transform active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-400"
              type="button"
            >
              <span className="flex items-center gap-1.5">
                <ArrowUpDown size={12} />
                {sortOrder === 'desc' ? 'Decrescente' : 'Crescente'}
              </span>
            </button>
          </div>

          {showSearch && (
            <div className="mb-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 transition-all focus-within:ring-2 focus-within:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900">
                <Search size={18} className="shrink-0 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar financiamento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-[14px] text-gray-800 outline-none placeholder-gray-400 dark:text-gray-200"
                  autoFocus
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-gray-300"
                    type="button"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {!loading && sortedFinancings.length > 0 && (
            <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
              {[
                { key: 'updated_at', label: 'Mais recentes' },
                { key: 'total_amount', label: 'Valor total' },
                { key: 'start_date', label: 'Data início' },
              ].map((f) => (
                <button
                  type="button"
                  key={f.key}
                  onClick={() => {
                    vibrate([5])
                    setSortBy(f.key)
                  }}
                  className={`h-10 shrink-0 whitespace-nowrap rounded-[18px] border px-3.5 text-[13px] font-semibold transition-colors active:scale-[0.98] ${
                    sortBy === f.key
                      ? 'border-transparent bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                      : 'border-gray-200/70 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-4 pb-24 pt-3">
        {!loading && (financings || []).length > 0 && (
          <section className="mb-4 overflow-hidden rounded-[28px] border border-teal-100/80 bg-gradient-to-br from-teal-600 to-teal-700 p-5 text-white shadow-[0_16px_40px_rgba(13,148,136,0.20)] dark:border-teal-800/50">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-100">Compromissos financiados</p>
                <p className="mt-1 text-[26px] font-black tracking-tight">{formatCurrency(summary.open)}</p>
                <p className="mt-0.5 text-[12px] font-medium text-teal-100/90">Saldo restante dos contratos</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white/15 ring-1 ring-white/15">
                <CircleDollarSign size={21} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[18px] bg-white/10 px-3 py-3 ring-1 ring-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-100">Ativos</p>
                <p className="mt-1 text-[17px] font-black">{summary.active}</p>
              </div>
              <div className="rounded-[18px] bg-white/10 px-3 py-3 ring-1 ring-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-100">Contratado</p>
                <p className="mt-1 truncate text-[13px] font-black">{formatCurrency(summary.principal)}</p>
              </div>
              <div className="rounded-[18px] bg-white/10 px-3 py-3 ring-1 ring-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-100">Pago</p>
                <p className="mt-1 truncate text-[13px] font-black">{formatCurrency(summary.paid)}</p>
              </div>
            </div>
          </section>
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton count={3} height="132px" borderRadius="24px" />
          </div>
        ) : sortedFinancings.length === 0 ? (
          <div className="animate-in fade-in flex flex-col items-center justify-center py-20 duration-300">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gray-200/70 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <Percent size={28} className="text-gray-500 opacity-30" />
            </div>
            <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">Nenhum financiamento por aqui</p>
            <p className="mt-2 max-w-[260px] text-center text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">Cadastre contratos, acompanhe parcelas pagas e veja quanto ainda falta quitar.</p>
            <button onClick={() => { vibrate([10]); router.push('/financings/new') }} className="mt-5 flex items-center gap-2 rounded-[18px] bg-teal-600 px-5 py-3 text-[13px] font-bold text-white shadow-lg shadow-teal-600/20 active:scale-[0.98]" type="button">
              <Plus size={16} /> Novo financiamento
            </button>
          </div>
        ) : (
          <div className="animate-in fade-in space-y-2.5 duration-500">
            {sortedFinancings.map((fin: any) => {
              const installments = installmentsByFinancing[fin.id] || []
              const paidInstallments = installments.filter((i: Installment) => i.paid)
              const totalPaid = paidInstallments.reduce(
                (sum: number, i: Installment) => sum + (i.amount || 0),
                0
              )
              const remaining = (fin.total_amount || 0) - totalPaid
              const isExpanded = expandedId === fin.id

              return (
                <div
                  key={fin.id}
                  className="rounded-[24px] border border-gray-200/70 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <button
                    onClick={() => {
                      vibrate([5])
                      router.push(`/financings/details?id=${fin.id}`)
                    }}
                    className="w-full rounded-[18px] p-3 text-left transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-slate-700/50"
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-teal-50 dark:bg-teal-900/20">
                          {getAssetIcon(fin.asset_type)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                            {fin.description || "Financiamento"}
                          </p>

                          {fin.asset && (
                            <p className="mt-0.5 truncate text-[12px] text-gray-400 dark:text-gray-500">
                              {fin.asset}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {getStatusBadge(fin.status)}
                            <span className="text-[12px] text-gray-400 dark:text-gray-500">
                              {formatDate(fin.start_date)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 pl-2 text-right">
                        <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(fin.total_amount || 0)}
                        </p>
                        {fin.status === "active" && (
                          <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500">
                            Falta {formatCurrency(Math.max(0, remaining))}
                          </p>
                        )}
                      </div>
                    </div>

                    {fin.total_amount > 0 && (
                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                          <span>Progresso do contrato</span>
                          <span>{Math.min(100, Math.max(0, Math.round((totalPaid / Number(fin.total_amount || 1)) * 100)))}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700/70">
                          <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, (totalPaid / Number(fin.total_amount || 1)) * 100))}%` }} />
                        </div>
                      </div>
                    )}

                    {installments.length > 0 && (
                      <div className="mt-3 border-t border-gray-100 pt-3 dark:border-slate-700/60">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                            Parcelas {paidInstallments.length}/{installments.length}
                          </span>
                          <span className="text-[13px] font-semibold text-teal-600 dark:text-teal-400">
                            {formatCurrency(totalPaid)}
                          </span>
                        </div>

                        <div className="max-h-32 space-y-2 overflow-y-auto pr-1">
                          {installments
                            .slice(0, isExpanded ? undefined : 3)
                            .map((inst: Installment) => (
                              <div
                                key={inst.id}
                                className={`flex items-center justify-between rounded-[16px] px-3 py-2 text-[12px] ${
                                  inst.paid
                                    ? 'bg-teal-50 dark:bg-teal-900/10'
                                    : 'bg-gray-50 dark:bg-slate-700/40'
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      inst.paid
                                        ? "bg-teal-500"
                                        : "bg-gray-300 dark:bg-gray-600"
                                    }`}
                                  />
                                  <span
                                    className={`truncate ${
                                      inst.paid
                                        ? 'font-medium text-teal-700 dark:text-teal-400'
                                        : 'text-gray-600 dark:text-gray-400'
                                    }`}
                                  >
                                    #{inst.number} — {formatDate(inst.due_date)}
                                  </span>
                                </div>
                                <span
                                  className={`shrink-0 font-semibold ${
                                    inst.paid
                                      ? "text-teal-600 dark:text-teal-400"
                                      : "text-gray-500"
                                  }`}
                                >
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
                            className="mt-2 h-9 w-full rounded-[16px] bg-teal-50 text-[12px] font-semibold text-teal-600 transition-transform active:scale-[0.98] dark:bg-teal-900/10 dark:text-teal-400"
                            type="button"
                          >
                            {isExpanded
                              ? "Recolher parcelas"
                              : `Ver todas (${installments.length})`}
                          </button>
                        )}
                      </div>
                    )}
                  </button>

                  <div className="flex gap-2 px-3 pb-3 pt-1">
                    <button
                      onClick={() => {
                        vibrate([5])
                        router.push(`/financings/details?id=${fin.id}`)
                      }}
                      className="h-10 flex-1 rounded-[16px] bg-gray-50 text-[13px] font-semibold text-gray-700 transition-colors active:scale-[0.98] hover:text-teal-600 dark:bg-slate-700 dark:text-gray-200 dark:hover:text-teal-400"
                      type="button"
                    >
                      Ver detalhes
                    </button>
                    <button
                      onClick={() => {
                        vibrate([10])
                        setDeleteModal(fin.id)
                      }}
                      className="h-10 w-10 rounded-[16px] bg-gray-50 text-gray-400 transition-colors active:scale-[0.98] hover:bg-red-50 hover:text-red-500 dark:bg-slate-700 dark:hover:bg-red-900/30"
                      aria-label="Excluir"
                      type="button"
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

      {deleteModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
            onClick={() => setDeleteModal(null)}
          >
            <div
              className="w-full max-w-sm rounded-t-[32px] bg-white p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 sm:rounded-[32px] sm:zoom-in-95 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 shadow-inner dark:bg-red-900/30">
                <Trash2 size={28} className="text-red-500" />
              </div>

              <h3 className="mb-2 text-center text-[20px] font-black tracking-tight text-gray-800 dark:text-gray-100">
                Excluir Financiamento
              </h3>

              <p className="mb-8 px-4 text-center text-[14px] font-medium text-gray-500 dark:text-gray-400">
                Tem certeza que deseja excluir este financiamento e todas as suas parcelas?
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteModal(null)}
                  className="flex-1 rounded-[20px] bg-gray-100 py-4 text-[15px] font-bold text-gray-600 transition-colors active:scale-[0.98] hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    vibrate([50])
                    handleDelete()
                  }}
                  className="flex-1 rounded-[20px] bg-red-500 py-4 text-[15px] font-bold text-white shadow-lg shadow-red-500/20 transition-all active:scale-[0.98] hover:bg-red-600"
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