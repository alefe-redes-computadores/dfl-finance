// src/app/(app)/financings/new/page.tsx
"use client"

import { Suspense, useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Car,
  Home,
  Percent,
  CalendarDays,
  Landmark,
  FileText,
  Wallet,
  Hash,
  BadgePercent,
  CheckCircle2,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useFinancingById } from "@/hooks/useFinancingById"
import { useContext_ } from "@/components/ContextToggle"
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from "@/hooks/useSafeDb"
import MoneyInput from "@/components/MoneyInput"
import Skeleton from "@/components/Skeleton"

type FinancingStatus = "active" | "paid" | "overdue"
type AssetType = "vehicle" | "property" | "other"

const STATUS_LABEL: Record<FinancingStatus, string> = {
  active: "Ativo",
  paid: "Quitado",
  overdue: "Atrasado",
}

const ASSET_LABEL: Record<AssetType, string> = {
  vehicle: "Veículo",
  property: "Imóvel",
  other: "Outro",
}

const today = () => new Date().toISOString().split("T")[0]

function NewFinancingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // useMemo para normalizar o ID
  const rawEditId = searchParams.get("edit")
  const editId = useMemo(() => rawEditId?.trim() || null, [rawEditId])

  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { user } = useAuth()
  const { safeAdd, safeUpdate } = useSafeDb()
  const { context, appMode } = useContext_()

  const effectiveContext = appMode === "personal_only" ? "personal" : context
  const contextTitle = effectiveContext === "dfl" ? "Empresa" : "Pessoal"

  const { data: financing, loading, notFound } = useFinancingById(editId)

  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [initialized, setInitialized] = useState(!editId)
  const touchStartY = useRef(0)

  const [description, setDescription] = useState("")
  const [totalAmountNum, setTotalAmountNum] = useState(0)
  const [installmentsCount, setInstallmentsCount] = useState("")
  const [interestRate, setInterestRate] = useState("")
  const [bank, setBank] = useState("")
  const [assetType, setAssetType] = useState<AssetType>("other")
  const [asset, setAsset] = useState("")
  const [startDate, setStartDate] = useState(today())
  const [firstDueDate, setFirstDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<FinancingStatus>("active")

  const installmentsCountNum = useMemo(() => {
    const parsed = parseInt(installmentsCount, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }, [installmentsCount])

  const installmentAmountNum = useMemo(() => {
    if (totalAmountNum <= 0 || installmentsCountNum <= 0) return 0
    return totalAmountNum / installmentsCountNum
  }, [totalAmountNum, installmentsCountNum])

  // HIDRATAÇÃO DO FORMULÁRIO
  useEffect(() => {
    if (editId && financing && !initialized) {
      setDescription(financing.description || "")
      setTotalAmountNum(Number(financing.total_amount) || 0)
      setInstallmentsCount(
        financing.installments_count ? String(financing.installments_count) : ""
      )
      setInterestRate(
        financing.interest_rate ? String(financing.interest_rate) : ""
      )
      setBank(financing.bank || "")
      setAssetType((financing.asset_type as AssetType) || "other")
      setAsset(financing.asset || "")
      setStartDate(financing.start_date ? financing.start_date.split("T")[0] : today())
      setFirstDueDate(
        financing.first_due_date ? financing.first_due_date.split("T")[0] : ""
      )
      setNotes(financing.notes || "")
      setStatus((financing.status as FinancingStatus) || "active")
      setInitialized(true)
    }

    if (!editId && !initialized) {
      setInitialized(true)
    }
  }, [editId, financing, initialized])

  // SÓ REDIRECIONA SE NOTFOUND E NÃO ESTÁ CARREGANDO
  if (editId && notFound && !loading) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-gray-50 px-4 dark:bg-slate-950">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
          <Percent size={32} className="text-red-500" />
        </div>

        <h2 className="mb-2 text-xl font-bold text-gray-800 dark:text-gray-200">
          Financiamento não encontrado
        </h2>

        <p className="mb-6 max-w-xs text-center text-sm text-gray-500 dark:text-gray-400">
          O financiamento que você está tentando editar pode ter sido excluído ou você não tem permissão para acessá-lo.
        </p>

        <button
          onClick={() => router.push("/financings")}
          className="rounded-full bg-teal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-teal-700 active:scale-95"
        >
          Voltar para listagem
        </button>
      </div>
    )
  }

  if (editId && loading) {
    return (
      <div className="flex h-[100dvh] flex-col bg-gray-50 transition-colors duration-300 dark:bg-slate-900">
        <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 px-4 pt-6 pb-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-slate-700" />
            <div className="h-6 w-32 animate-pulse rounded bg-gray-200 dark:bg-slate-700" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-slate-700" />
          </div>
        </div>

        <div className="flex-1 px-4 pt-4">
          <Skeleton count={6} />
        </div>
      </div>
    )
  }

  if (!initialized) {
    return (
      <div className="flex h-[100dvh] flex-col bg-gray-50 transition-colors duration-300 dark:bg-slate-900">
        <div className="flex-1 px-4 pt-4">
          <Skeleton count={6} />
        </div>
      </div>
    )
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (window.scrollY <= 0) {
        const deltaY = e.touches[0].clientY - touchStartY.current
        if (deltaY > 60 && !refreshing) {
          setRefreshing(true)
          vibrate([10])
          setTimeout(() => setRefreshing(false), 600)
        }
      }
    },
    [refreshing, vibrate]
  )

  const handleSave = useCallback(async () => {
    if (saving) return

    const trimmedDescription = description.trim()
    const trimmedBank = bank.trim()
    const trimmedAsset = asset.trim()
    const trimmedNotes = notes.trim()
    const parsedInterestRate = interestRate
      ? parseFloat(interestRate.replace(",", "."))
      : null

    if (!user && !editId) {
      errorHaptic()
      showToast("Sua sessão expirou. Entre novamente para continuar.", "error")
      return
    }

    if (!trimmedDescription) {
      errorHaptic()
      showToast("Informe uma descrição para identificar o financiamento.", "warning")
      return
    }

    if (totalAmountNum <= 0) {
      errorHaptic()
      showToast("Informe um valor total maior que zero.", "warning")
      return
    }

    if (installmentsCountNum <= 0) {
      errorHaptic()
      showToast("Informe uma quantidade válida de parcelas.", "warning")
      return
    }

    if (parsedInterestRate !== null && Number.isNaN(parsedInterestRate)) {
      errorHaptic()
      showToast("Informe uma taxa de juros válida.", "warning")
      return
    }

    setSaving(true)

    try {
      const payload = {
        description: trimmedDescription,
        total_amount: totalAmountNum,
        installments_count: installmentsCountNum,
        installment_amount: installmentAmountNum,
        interest_rate: parsedInterestRate,
        bank: trimmedBank || null,
        asset_type: assetType,
        asset: trimmedAsset || null,
        start_date: startDate || today(),
        first_due_date: firstDueDate || null,
        notes: trimmedNotes || null,
        status,
        context: effectiveContext,
        updated_at: new Date().toISOString(),
      }

      if (editId) {
        const res = await safeUpdate("financings", editId, payload)
        if (!res.success) throw new Error(res.error)

        success()
        showToast("Financiamento atualizado com sucesso.", "success")
      } else {
        const fullPayload = {
          id: crypto.randomUUID(),
          user_id: user!.id,
          ...payload,
          remaining_amount: totalAmountNum,
          created_at: new Date().toISOString(),
          sync_status: "pending",
          sync_attempts: 0,
        }

        const res = await safeAdd("financings", fullPayload)
        if (!res.success) throw new Error(res.error)

        success()
        showToast("Financiamento criado com sucesso.", "success")
      }

      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast(`Não foi possível salvar o financiamento: ${err.message}`, "error")
    } finally {
      setSaving(false)
    }
  }, [
    saving,
    description,
    bank,
    asset,
    notes,
    interestRate,
    user,
    editId,
    totalAmountNum,
    installmentsCountNum,
    installmentAmountNum,
    assetType,
    startDate,
    firstDueDate,
    status,
    effectiveContext,
    safeUpdate,
    safeAdd,
    success,
    errorHaptic,
    showToast,
    router,
  ])

  const sectionClass =
    "rounded-[28px] border border-gray-100/80 bg-white/92 dark:border-slate-700/70 dark:bg-slate-800/92"
  const fieldClass =
    "rounded-[20px] border border-gray-100 bg-gray-50/90 px-4 py-3.5 dark:border-slate-700/60 dark:bg-slate-700/35"
  const labelClass =
    "mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400"
  const inputClass =
    "w-full bg-transparent text-[15px] font-semibold text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-500"

  return (
    <div
      className="flex h-[100dvh] flex-col bg-gray-50 transition-colors duration-300 dark:bg-slate-900"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {refreshing && (
        <div className="pointer-events-none fixed top-0 left-0 right-0 z-50 flex justify-center pt-6">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-lg animate-in slide-in-from-top-2 duration-300 dark:bg-slate-800">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 px-4 pt-6 pb-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              vibrate([5])
              router.back()
            }}
            className="rounded-full p-2 -ml-2 text-gray-800 transition-transform active:scale-95 dark:text-gray-200"
            aria-label="Voltar"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="text-center">
            <h1 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">
              {editId ? "Editar" : "Novo"} Financiamento
            </h1>
            <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
              Contexto: {contextTitle}
            </p>
          </div>

          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pt-5 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="rounded-[28px] bg-gradient-to-br from-teal-600 to-teal-700 p-5 text-white shadow-[0_14px_40px_rgba(13,148,136,0.28)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold text-teal-50/90">Resumo</p>
              <h2 className="mt-1 text-[24px] font-black leading-none">
                {totalAmountNum > 0
                  ? totalAmountNum.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })
                  : "R$ 0,00"}
              </h2>
            </div>

            <div className="rounded-[18px] bg-white/14 px-3 py-2 text-right">
              <p className="text-[10px] font-medium text-teal-50/80">
                Parcela estimada
              </p>
              <p className="text-[15px] font-bold">
                {installmentAmountNum.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full bg-white/12 px-3 py-1.5 text-[12px] font-semibold">
              {installmentsCountNum > 0
                ? `${installmentsCountNum} parcelas`
                : "Sem parcelas"}
            </div>
            <div className="rounded-full bg-white/12 px-3 py-1.5 text-[12px] font-semibold">
              {STATUS_LABEL[status]}
            </div>
            <div className="rounded-full bg-white/12 px-3 py-1.5 text-[12px] font-semibold">
              {ASSET_LABEL[assetType]}
            </div>
          </div>
        </div>

        <section className={`${sectionClass} p-4`}>
          <div className="mb-4">
            <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">
              Identificação
            </p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              Informações principais do financiamento.
            </p>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              { value: "vehicle" as AssetType, label: "Veículo", icon: Car },
              { value: "property" as AssetType, label: "Imóvel", icon: Home },
              { value: "other" as AssetType, label: "Outro", icon: Percent },
            ].map(({ value, label, icon: Icon }) => {
              const active = assetType === value

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    vibrate([5])
                    setAssetType(value)
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-[20px] border px-3 py-3.5 transition-all active:scale-95 ${
                    active
                      ? "border-teal-600 bg-teal-600 text-white shadow-md shadow-teal-600/20"
                      : "border-gray-100 bg-gray-50 text-gray-600 dark:border-slate-700/60 dark:bg-slate-700/35 dark:text-gray-300"
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-[12px] font-bold">{label}</span>
                </button>
              )
            })}
          </div>

          <div className="space-y-3">
            <div className={fieldClass}>
              <label className={labelClass}>Descrição</label>
              <input
                type="text"
                placeholder="Ex: Financiamento Itaú"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-transparent text-[17px] font-bold text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-500"
                autoFocus
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass}>Bem financiado</label>
              <div className="flex items-center gap-3">
                <FileText size={16} className="shrink-0 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ex: Honda Civic 2024"
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className={fieldClass}>
              <label className={labelClass}>Banco / Financeira</label>
              <div className="flex items-center gap-3">
                <Landmark size={16} className="shrink-0 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ex: Banco do Brasil"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </section>

        <section className={`${sectionClass} p-4`}>
          <div className="mb-4">
            <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">
              Valores
            </p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              Total, quantidade de parcelas e cálculo automático.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={`${fieldClass} flex min-h-[92px] flex-col justify-between`}>
              <label className={labelClass}>Valor total</label>
              <div className="flex items-center gap-2">
                <Wallet size={16} className="shrink-0 text-gray-400" />
                <span className="text-[15px] font-semibold text-gray-400">R$</span>
                <MoneyInput
                  value={totalAmountNum}
                  onChange={(num) => setTotalAmountNum(num)}
                  placeholder="0,00"
                  className="w-full bg-transparent text-[22px] font-black text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </div>
            </div>

            <div className={`${fieldClass} flex min-h-[92px] flex-col justify-between`}>
              <label className={labelClass}>Número de parcelas</label>
              <div className="flex items-center gap-2">
                <Hash size={16} className="shrink-0 text-gray-400" />
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Ex: 36"
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(e.target.value)}
                  className="w-full bg-transparent text-[22px] font-black text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-[22px] border border-teal-100 bg-teal-50 px-4 py-4 dark:border-teal-800/40 dark:bg-teal-900/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                  Valor estimado por parcela
                </p>
                <p className="mt-0.5 text-[12px] text-teal-700/80 dark:text-teal-300/80">
                  Calculado automaticamente com base no total e nas parcelas.
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[22px] font-black text-teal-700 dark:text-teal-300">
                  {installmentAmountNum.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${sectionClass} p-4`}>
          <div className="mb-4">
            <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">
              Condições
            </p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              Status atual, juros e datas de controle.
            </p>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className={fieldClass}>
              <label className={labelClass}>Juros (% a.m.)</label>
              <div className="flex items-center gap-2">
                <BadgePercent size={16} className="shrink-0 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Ex: 1,5"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className={fieldClass}>
              <label className={labelClass}>Status</label>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-gray-400" />
                <select
                  value={status}
                  onChange={(e) => {
                    vibrate([5])
                    setStatus(e.target.value as FinancingStatus)
                  }}
                  className="w-full cursor-pointer appearance-none bg-transparent text-[15px] font-semibold text-gray-800 outline-none dark:text-gray-100"
                >
                  <option value="active">Ativo</option>
                  <option value="paid">Quitado</option>
                  <option value="overdue">Atrasado</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={fieldClass}>
              <label className={labelClass}>Data de início</label>
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="shrink-0 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-transparent text-[14px] font-semibold text-gray-800 outline-none dark:text-gray-100"
                />
              </div>
            </div>

            <div className={fieldClass}>
              <label className={labelClass}>Primeiro vencimento</label>
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="shrink-0 text-gray-400" />
                <input
                  type="date"
                  value={firstDueDate}
                  onChange={(e) => setFirstDueDate(e.target.value)}
                  className="w-full bg-transparent text-[14px] font-semibold text-gray-800 outline-none dark:text-gray-100"
                />
              </div>
            </div>
          </div>
        </section>

        <section className={`${sectionClass} p-4`}>
          <div className="mb-3">
            <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">
              Observações
            </p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              Informações complementares para consulta futura.
            </p>
          </div>

          <div className={fieldClass}>
            <textarea
              placeholder="Ex: entrada já paga, contrato assinado, observações do banco..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full resize-none bg-transparent text-[15px] font-medium text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>
        </section>
      </div>

      <div className="fixed right-0 bottom-0 left-0 z-20 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent p-4 dark:from-slate-900 dark:via-slate-900/90">
        <button
          onClick={() => {
            vibrate([10, 50])
            handleSave()
          }}
          disabled={saving}
          className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-[24px] bg-teal-600 py-4 text-[16px] font-bold text-white shadow-lg shadow-teal-600/30 transition-transform hover:bg-teal-700 active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? <RefreshCw size={22} className="animate-spin" /> : <Save size={22} />}
          {editId ? "Atualizar Financiamento" : "Criar Financiamento"}
        </button>
      </div>
    </div>
  )
}

export default function NewFinancingPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[100dvh] items-center justify-center bg-gray-50 dark:bg-slate-950">
        <RefreshCw className="animate-spin text-teal-600" size={32} />
      </div>
    }>
      <NewFinancingContent />
    </Suspense>
  )
}