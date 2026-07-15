'use client'

import { useState, Suspense, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createPortal } from "react-dom"
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
  Calendar,
  X,
  Wallet,
  Layers3,
  BadgePercent,
  Landmark,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useFinancingById } from "@/hooks/useFinancingById"
import { useFinancingInstallments } from "@/hooks/useFinancingInstallments"
import { useLocalSync } from "@/hooks/useLocalSync"
import Skeleton from "@/components/Skeleton"
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from "@/hooks/useSafeDb"

type Installment = {
  id: string
  financing_id: string
  amount: number
  due_date: string
  paid: boolean
  paid_date?: string | null
  number: number
}

function AppBottomSheet({
  open,
  onClose,
  title,
  children,
  zIndex = 600,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  zIndex?: number
}) {
  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex }}
      onClick={onClose}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-lg rounded-t-[32px] bg-white dark:bg-slate-800 p-6 pb-8 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full bg-gray-100 dark:bg-slate-700 p-2 text-gray-400 active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body
  )
}

function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`bg-white/92 dark:bg-slate-800/92 border border-gray-100/80 dark:border-slate-700/70 rounded-[28px] p-4 ${className}`}
    >
      {children}
    </section>
  )
}

function StatMiniCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-[20px] bg-gray-50 dark:bg-slate-700/35 border border-gray-100 dark:border-slate-700/60 p-3.5">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
        {icon}
        <span className="text-[11px] font-semibold">{label}</span>
      </div>
      <div className="text-gray-800 dark:text-gray-100 font-black">
        {value}
      </div>
    </div>
  )
}

function FinancingHeader({
  title,
  status,
  onBack,
  onEdit,
  onDelete,
  getStatusBadge,
}: {
  title: string
  status: string
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  getStatusBadge: (status: string) => React.ReactNode
}) {
  return (
    <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 shadow-sm px-4 pt-6 pb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full text-gray-800 dark:text-gray-200 active:scale-95 transition-transform shrink-0"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="min-w-0">
            <h1 className="text-[18px] font-bold text-gray-800 dark:text-gray-100 truncate">
              {title}
            </h1>
            <div className="mt-1">{getStatusBadge(status)}</div>
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-2.5 rounded-full bg-gray-50 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-teal-700 dark:text-teal-400 active:scale-95 transition-all"
          >
            <Pencil size={18} />
          </button>

          <button
            onClick={onDelete}
            className="p-2.5 rounded-full bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 active:scale-95 transition-all"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

function FinancingHeroCard({
  remaining,
  totalPaid,
  progressPercent,
  totalAmount,
  formatCurrency,
}: {
  remaining: number
  totalPaid: number
  progressPercent: number
  totalAmount: number
  formatCurrency: (val: number) => string
}) {
  return (
    <section className="rounded-[30px] bg-gradient-to-br from-teal-600 to-teal-700 text-white p-6 shadow-[0_16px_40px_rgba(13,148,136,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-teal-50/90">
            Valor restante
          </p>
          <p className="text-[36px] font-black tracking-tight leading-none mt-1">
            {formatCurrency(Math.max(0, remaining))}
          </p>
        </div>

        <div className="rounded-[18px] bg-white/14 px-3 py-2 text-right">
          <p className="text-[10px] font-medium text-teal-50/80">Já pago</p>
          <p className="text-[15px] font-bold">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between text-[12px] font-semibold text-teal-50/90">
          <span>{progressPercent.toFixed(1)}% pago</span>
          <span>{formatCurrency(totalAmount || 0)} total</span>
        </div>
      </div>
    </section>
  )
}

function InstallmentItem({
  installment,
  formatCurrency,
  formatDate,
  onTogglePaid,
  onDelete,
}: {
  installment: Installment
  formatCurrency: (val: number) => string
  formatDate: (date: string | null) => string
  onTogglePaid: (installment: Installment) => void
  onDelete: (installmentId: string) => void
}) {
  const isPaid = installment.paid

  return (
    <div
      className={`rounded-[22px] border px-3.5 py-3.5 transition-all active:scale-[0.98] ${
        isPaid
          ? "bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800/40"
          : "bg-gray-50 dark:bg-slate-700/35 border-gray-100 dark:border-slate-700/60"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => onTogglePaid(installment)}
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              isPaid
                ? "bg-teal-500 border-teal-500 text-white"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 hover:border-teal-500"
            }`}
          >
            {isPaid && <CheckCircle2 size={16} />}
          </button>

          <div className="min-w-0">
            <p
              className={`text-[14px] font-bold truncate ${
                isPaid
                  ? "text-teal-700 dark:text-teal-300"
                  : "text-gray-800 dark:text-gray-100"
              }`}
            >
              Parcela #{installment.number}
            </p>

            <p
              className={`text-[12px] mt-0.5 ${
                isPaid
                  ? "text-teal-700/80 dark:text-teal-300/80"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Vence {formatDate(installment.due_date)}
              {isPaid && installment.paid_date
                ? ` • Pago ${formatDate(installment.paid_date)}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`font-black text-[14px] ${
              isPaid
                ? "text-teal-700 dark:text-teal-300"
                : "text-gray-700 dark:text-gray-200"
            }`}
          >
            {formatCurrency(installment.amount)}
          </span>

          <button
            onClick={() => onDelete(installment.id)}
            className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function FinancingDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const financingId = searchParams.get("id") as string

  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  const { safeUpdate, safeDelete } = useSafeDb()

  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [expandedInstallments, setExpandedInstallments] = useState(false)

  const {
    data: financingData,
    loading,
    notFound,
  } = useFinancingById(financingId)

  const {
    data: installments,
    loading: installmentsLoading,
  } = useFinancingInstallments(financingId)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val)

  const formatDate = (date: string | null) =>
    date ? new Date(date).toLocaleDateString("pt-BR") : ""

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full">
            <Clock size={12} /> Ativo
          </span>
        )
      case "paid":
        return (
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 px-3 py-1.5 rounded-full">
            <CheckCircle2 size={12} /> Quitado
          </span>
        )
      case "overdue":
        return (
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded-full">
            <AlertTriangle size={12} /> Atrasado
          </span>
        )
      default:
        return (
          <span className="text-[12px] font-bold text-gray-500 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
            {status}
          </span>
        )
    }
  }

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "vehicle":
        return <Car size={22} className="text-teal-600 dark:text-teal-400" />
      case "property":
        return <Home size={22} className="text-teal-600 dark:text-teal-400" />
      default:
        return <Percent size={22} className="text-teal-600 dark:text-teal-400" />
    }
  }

  const handlePayInstallment = async (installment: Installment) => {
    if (!user) return

    try {
      const updateData = {
        paid: true,
        paid_date: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      }

      const res1 = await safeUpdate("transactions", installment.id, updateData)
      if (!res1.success) throw new Error(res1.error)

      const updatedInstallments = installments.map((i: Installment) =>
        i.id === installment.id ? { ...i, paid: true } : i
      )
      const allPaid = updatedInstallments.every((i: Installment) => i.paid)

      if (allPaid && financingData?.status !== "paid") {
        const statusUpdate = {
          status: "paid",
          updated_at: new Date().toISOString(),
        }
        const res2 = await safeUpdate("financings", financingId, statusUpdate)
        if (!res2.success) throw new Error(res2.error)
      }

      success()
      showToast("✅ Parcela paga com sucesso!", "success")
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
        updated_at: new Date().toISOString(),
      }

      const res1 = await safeUpdate("transactions", installment.id, updateData)
      if (!res1.success) throw new Error(res1.error)

      if (financingData?.status === "paid") {
        const statusUpdate = {
          status: "active",
          updated_at: new Date().toISOString(),
        }
        const res2 = await safeUpdate("financings", financingId, statusUpdate)
        if (!res2.success) throw new Error(res2.error)
      }

      success()
      showToast("🔄 Pagamento desfeito com sucesso!", "success")
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ ${err?.message || "Erro ao desfazer pagamento"}`, "error")
    }
  }

  const handleDeleteInstallment = async (installmentId: string) => {
    if (!user) return

    try {
      const res = await safeDelete("transactions", installmentId)
      if (!res.success) throw new Error(res.error)

      success()
      showToast("🗑️ Parcela excluída com sucesso!", "success")
      setDeleteModal(null)
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
        const res1 = await safeDelete("transactions", inst.id)
        if (!res1.success) throw new Error(res1.error)
      }

      const res2 = await safeDelete("financings", financingId)
      if (!res2.success) throw new Error(res2.error)

      success()
      showToast("🗑️ Financiamento excluído!", "success")
      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast("❌ Erro ao excluir financiamento", "error")
    }
  }

  const paidInstallments = useMemo(
    () => installments.filter((i: Installment) => i.paid),
    [installments]
  )

  const sortedInstallments = useMemo(
    () => [...installments].sort((a: Installment, b: Installment) => a.number - b.number),
    [installments]
  )

  const visibleInstallments = useMemo(
    () => sortedInstallments.slice(0, expandedInstallments ? undefined : 5),
    [sortedInstallments, expandedInstallments]
  )

  const totalPaid = useMemo(
    () => paidInstallments.reduce((sum: number, i: Installment) => sum + (i.amount || 0), 0),
    [paidInstallments]
  )

  if (loading) {
    return (
      <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors">
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
        </div>
        <div className="flex-1 px-4 pt-6">
          <Skeleton count={4} />
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900">
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full bg-gray-100 dark:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-black mt-4 text-gray-900 dark:text-gray-100">
            Financiamento não encontrado
          </h1>
        </div>
      </div>
    )
  }

  if (!financingData) return null

  const remaining = (financingData.total_amount || 0) - totalPaid
  const progressPercent = financingData.total_amount
    ? (totalPaid / financingData.total_amount) * 100
    : 0

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors">
      {pendingCount > 0 && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
        </div>
      )}

      <FinancingHeader
        title={financingData.description || "Financiamento"}
        status={financingData.status}
        getStatusBadge={getStatusBadge}
        onBack={() => {
          vibrate([5])
          router.back()
        }}
        onEdit={() => {
          vibrate([5])
          router.push(`/financings/new?edit=${financingId}`)
        }}
        onDelete={handleDeleteFinancing}
      />

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-24 space-y-4">
        <FinancingHeroCard
          remaining={remaining}
          totalPaid={totalPaid}
          progressPercent={progressPercent}
          totalAmount={financingData.total_amount || 0}
          formatCurrency={formatCurrency}
        />

        <SectionCard>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-[18px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
              {getAssetIcon(financingData.asset_type)}
            </div>

            <div className="min-w-0">
              <p className="text-[15px] font-bold text-gray-800 dark:text-gray-100 truncate">
                {financingData.asset || "Bem não especificado"}
              </p>

              {financingData.bank && (
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                  <Landmark size={13} /> {financingData.bank}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-3 gap-3">
              <StatMiniCard
                icon={<Layers3 size={14} />}
                label="Parcelas"
                value={
                  <p className="text-[17px]">{financingData.installments_count}</p>
                }
              />

              <StatMiniCard
                icon={<Wallet size={14} />}
                label="Parcela"
                value={
                  <p className="text-[14px] leading-tight">
                    {formatCurrency(financingData.installment_amount || 0)}
                  </p>
                }
              />

              <StatMiniCard
                icon={<BadgePercent size={14} />}
                label="Juros"
                value={
                  <p className="text-[17px]">
                    {financingData.interest_rate
                      ? `${financingData.interest_rate}%`
                      : "-"}
                  </p>
                }
              />
            </div>

            <div className="rounded-[20px] bg-gray-50 dark:bg-slate-700/35 border border-gray-100 dark:border-slate-700/60 px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Calendar size={14} />
                <span className="text-[12px] font-semibold">Início</span>
              </div>
              <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100">
                {formatDate(financingData.start_date) || "N/A"}
              </span>
            </div>

            {financingData.first_due_date && (
              <div className="rounded-[20px] bg-gray-50 dark:bg-slate-700/35 border border-gray-100 dark:border-slate-700/60 px-4 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Calendar size={14} />
                  <span className="text-[12px] font-semibold">
                    Primeiro vencimento
                  </span>
                </div>
                <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100">
                  {formatDate(financingData.first_due_date)}
                </span>
              </div>
            )}

            {financingData.notes && (
              <div className="rounded-[20px] bg-gray-50 dark:bg-slate-700/35 border border-gray-100 dark:border-slate-700/60 px-4 py-3.5">
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                  Observações
                </p>
                <p className="text-[14px] font-medium text-gray-800 dark:text-gray-100 leading-relaxed">
                  {financingData.notes}
                </p>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between mb-4 gap-3">
            <div>
              <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100">
                Parcelas
              </h3>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                {paidInstallments.length} de {installments.length} pagas
              </p>
            </div>
          </div>

          {installmentsLoading ? (
            <div className="flex justify-center p-8">
              <RefreshCw size={24} className="animate-spin text-teal-500" />
            </div>
          ) : installments.length === 0 ? (
            <div className="rounded-[22px] bg-gray-50 dark:bg-slate-700/30 border border-gray-100 dark:border-slate-700/60 py-8 px-4 text-center">
              <p className="text-[13px] font-medium text-gray-400">
                Nenhuma parcela gerada.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleInstallments.map((inst: Installment) => (
                <InstallmentItem
                  key={inst.id}
                  installment={inst}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  onTogglePaid={(item) => {
                    vibrate([10])
                    item.paid ? handleUndoPayment(item) : handlePayInstallment(item)
                  }}
                  onDelete={(id) => {
                    vibrate([5])
                    setDeleteModal(id)
                  }}
                />
              ))}

              {installments.length > 5 && (
                <button
                  onClick={() => {
                    vibrate([5])
                    setExpandedInstallments(!expandedInstallments)
                  }}
                  className="w-full text-center text-[12px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 py-3 rounded-[18px] transition-colors mt-2 active:scale-95"
                >
                  {expandedInstallments
                    ? "Recolher parcelas"
                    : `Ver todas as ${installments.length} parcelas`}
                  <ChevronDown
                    size={14}
                    className={`inline ml-1 transition-transform ${
                      expandedInstallments ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      <AppBottomSheet
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Excluir Parcela"
        zIndex={99999}
      >
        <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400 mb-6">
          Tem certeza que deseja excluir esta parcela? Esta ação não pode ser desfeita.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => setDeleteModal(null)}
            className="flex-1 py-4 rounded-[24px] bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-[15px] active:scale-[0.98] transition-transform"
          >
            Cancelar
          </button>

          <button
            onClick={() => {
              vibrate([10, 50])
              if (deleteModal) handleDeleteInstallment(deleteModal)
            }}
            className="flex-1 py-4 rounded-[24px] bg-red-500 hover:bg-red-600 text-white font-bold text-[15px] shadow-lg shadow-red-500/30 active:scale-[0.98] transition-transform"
          >
            Excluir Parcela
          </button>
        </div>
      </AppBottomSheet>
    </div>
  )
}

export default function FinancingDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
          <div className="flex-1 px-4 pt-4">
            <Skeleton count={3} />
          </div>
        </div>
      }
    >
      <FinancingDetailContent />
    </Suspense>
  )
}