"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
import { useLocalData } from "@/hooks/useLocalData"
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from '@/hooks/useSafeDb'
import MoneyInput from '@/components/MoneyInput'

export default function NewFinancingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { user } = useAuth()
  const { safeAdd, safeUpdate } = useSafeDb()

  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)

  const [description, setDescription] = useState("")
  const [totalAmountNum, setTotalAmountNum] = useState(0)
  const [installmentsCount, setInstallmentsCount] = useState("")
  const [installmentAmountNum, setInstallmentAmountNum] = useState(0)
  const [interestRate, setInterestRate] = useState("")
  const [bank, setBank] = useState("")
  const [assetType, setAssetType] = useState("other")
  const [asset, setAsset] = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
  const [firstDueDate, setFirstDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("active")

  const { data: localFinancings } = useLocalData({
    table: 'financings' as any,
    filters: { context: effectiveContext },
  })

  const financingData = localFinancings?.find((f: any) => f.id === editId) as any

  useEffect(() => {
    if (financingData) {
      setDescription(financingData.description || "")
      const total = Number(financingData.total_amount) || 0
      setTotalAmountNum(total)
      setInstallmentsCount(financingData.installments_count ? String(financingData.installments_count) : "")
      setInstallmentAmountNum(Number(financingData.installment_amount) || 0)
      setInterestRate(financingData.interest_rate ? String(financingData.interest_rate) : "")
      setBank(financingData.bank || "")
      setAssetType(financingData.asset_type || "other")
      setAsset(financingData.asset || "")
      setStartDate(financingData.start_date ? financingData.start_date.split("T")[0] : "")
      setFirstDueDate(financingData.first_due_date ? financingData.first_due_date.split("T")[0] : "")
      setNotes(financingData.notes || "")
      setStatus(financingData.status || "active")
    }
  }, [financingData])

  useEffect(() => {
    if (totalAmountNum > 0 && installmentsCount && parseInt(installmentsCount) > 0) {
      const installment = totalAmountNum / parseInt(installmentsCount)
      setInstallmentAmountNum(installment)
    }
  }, [totalAmountNum, installmentsCount])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        vibrate([10])
        setTimeout(() => setRefreshing(false), 600)
      }
    }
  }, [refreshing, vibrate])

  const handleSave = async () => {
    if (!description.trim()) {
      errorHaptic()
      showToast("⚠️ Preencha a descrição", "warning")
      return
    }
    if (totalAmountNum <= 0) {
      errorHaptic()
      showToast("⚠️ Informe um valor válido", "warning")
      return
    }
    if (!installmentsCount || parseInt(installmentsCount) <= 0) {
      errorHaptic()
      showToast("⚠️ Informe o número de parcelas", "warning")
      return
    }

    setSaving(true)
    try {
      const payload = {
        description: description.trim(),
        total_amount: totalAmountNum,
        installments_count: parseInt(installmentsCount),
        installment_amount: installmentAmountNum,
        interest_rate: interestRate ? parseFloat(interestRate.replace(',', '.')) : null,
        bank: bank.trim() || null,
        asset_type: assetType,
        asset: asset.trim() || null,
        start_date: startDate || new Date().toISOString().split("T")[0],
        first_due_date: firstDueDate || null,
        notes: notes.trim() || null,
        status,
        context: effectiveContext,
        updated_at: new Date().toISOString(),
      }

      if (editId) {
        const res = await safeUpdate('financings', editId, payload)
        if (!res.success) throw new Error(res.error)
        success()
        showToast("✅ Financiamento atualizado!", "success")
      } else {
        const id = crypto.randomUUID()
        const fullPayload = {
          id,
          user_id: user!.id,
          ...payload,
          remaining_amount: totalAmountNum,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        const res = await safeAdd('financings', fullPayload)
        if (!res.success) throw new Error(res.error)
        success()
        showToast("✅ Financiamento criado!", "success")
      }

      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, "error")
    } finally {
      setSaving(false)
    }
  }

  const contextTitle = effectiveContext === "dfl" ? "Empresa" : "Pessoal"

  const sectionClass =
    "bg-white/92 dark:bg-slate-800/92 border border-gray-100/80 dark:border-slate-700/70 rounded-[28px]"
  const fieldClass =
    "rounded-[20px] bg-gray-50/90 dark:bg-slate-700/35 border border-gray-100 dark:border-slate-700/60 px-4 py-3.5"
  const labelClass =
    "text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block"
  const inputClass =
    "w-full bg-transparent text-[15px] font-semibold text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"

  return (
    <div
      className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors duration-300"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { vibrate([5]); router.back() }}
            className="p-2 -ml-2 rounded-full text-gray-800 dark:text-gray-200 active:scale-95 transition-transform"
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

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-32 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="rounded-[28px] bg-gradient-to-br from-teal-600 to-teal-700 text-white p-5 shadow-[0_14px_40px_rgba(13,148,136,0.28)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold text-teal-50/90">Resumo</p>
              <h2 className="text-[24px] font-black mt-1 leading-none">
                {totalAmountNum > 0
                  ? totalAmountNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "R$ 0,00"}
              </h2>
            </div>
            <div className="rounded-[18px] bg-white/14 px-3 py-2 text-right">
              <p className="text-[10px] font-medium text-teal-50/80">Parcela estimada</p>
              <p className="text-[15px] font-bold">
                {installmentAmountNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full bg-white/12 px-3 py-1.5 text-[12px] font-semibold">
              {installmentsCount ? `${installmentsCount} parcelas` : "Sem parcelas"}
            </div>
            <div className="rounded-full bg-white/12 px-3 py-1.5 text-[12px] font-semibold">
              {status === "active" ? "Ativo" : status === "paid" ? "Quitado" : "Atrasado"}
            </div>
            <div className="rounded-full bg-white/12 px-3 py-1.5 text-[12px] font-semibold capitalize">
              {assetType === "vehicle" ? "Veículo" : assetType === "property" ? "Imóvel" : "Outro"}
            </div>
          </div>
        </div>

        <section className={`${sectionClass} p-4`}>
          <div className="mb-4">
            <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">Identificação</p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Informações principais do financiamento.</p>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { value: "vehicle", label: "Veículo", icon: Car },
              { value: "property", label: "Imóvel", icon: Home },
              { value: "other", label: "Outro", icon: Percent },
            ].map(({ value, label, icon: Icon }) => {
              const active = assetType === value
              return (
                <button
                  key={value}
                  onClick={() => { vibrate([5]); setAssetType(value) }}
                  className={`rounded-[20px] px-3 py-3.5 flex flex-col items-center justify-center gap-1.5 border transition-all active:scale-95 ${
                    active
                      ? "bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20"
                      : "bg-gray-50 dark:bg-slate-700/35 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-700/60"
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
                className="w-full bg-transparent text-[17px] font-bold text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"
                autoFocus
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass}>Bem financiado</label>
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-gray-400 shrink-0" />
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
                <Landmark size={16} className="text-gray-400 shrink-0" />
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
            <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">Valores</p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Total, quantidade de parcelas e cálculo automático.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={`${fieldClass} min-h-[92px] flex flex-col justify-between`}>
              <label className={labelClass}>Valor total</label>
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-gray-400 shrink-0" />
                <span className="text-[15px] font-semibold text-gray-400">R$</span>
                <MoneyInput
                  value={totalAmountNum}
                  onChange={(num) => setTotalAmountNum(num)}
                  placeholder="0,00"
                  className="w-full bg-transparent text-[22px] font-black text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"
                />
              </div>
            </div>

            <div className={`${fieldClass} min-h-[92px] flex flex-col justify-between`}>
              <label className={labelClass}>Número de parcelas</label>
              <div className="flex items-center gap-2">
                <Hash size={16} className="text-gray-400 shrink-0" />
                <input
                  type="number"
                  placeholder="Ex: 36"
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(e.target.value)}
                  className="w-full bg-transparent text-[22px] font-black text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-[22px] bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/40 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">Valor estimado por parcela</p>
                <p className="text-[12px] text-teal-700/80 dark:text-teal-300/80 mt-0.5">Calculado automaticamente com base no total e nas parcelas.</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[22px] font-black text-teal-700 dark:text-teal-300">
                  {installmentAmountNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${sectionClass} p-4`}>
          <div className="mb-4">
            <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">Condições</p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Status atual, juros e datas de controle.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className={fieldClass}>
              <label className={labelClass}>Juros (% a.m.)</label>
              <div className="flex items-center gap-2">
                <BadgePercent size={16} className="text-gray-400 shrink-0" />
                <input
                  type="number"
                  step="0.01"
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
                <CheckCircle2 size={16} className="text-gray-400 shrink-0" />
                <select
                  value={status}
                  onChange={(e) => { vibrate([5]); setStatus(e.target.value) }}
                  className="w-full bg-transparent text-[15px] font-semibold text-gray-800 dark:text-gray-100 outline-none appearance-none cursor-pointer"
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
                <CalendarDays size={16} className="text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-transparent text-[14px] font-semibold text-gray-800 dark:text-gray-100 outline-none"
                />
              </div>
            </div>

            <div className={fieldClass}>
              <label className={labelClass}>Primeiro vencimento</label>
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={firstDueDate}
                  onChange={(e) => setFirstDueDate(e.target.value)}
                  className="w-full bg-transparent text-[14px] font-semibold text-gray-800 dark:text-gray-100 outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        <section className={`${sectionClass} p-4`}>
          <div className="mb-3">
            <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">Observações</p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Informações complementares para consulta futura.</p>
          </div>

          <div className={fieldClass}>
            <textarea
              placeholder="Ex: entrada já paga, contrato assinado, observações do banco..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full bg-transparent text-[15px] font-medium text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500 resize-none"
            />
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 dark:from-slate-900 via-gray-50/90 dark:via-slate-900/90 to-transparent z-20">
        <button
          onClick={() => { vibrate([10, 50]); handleSave() }}
          disabled={saving}
          className="w-full max-w-md mx-auto bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[16px] shadow-lg shadow-teal-600/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <RefreshCw size={22} className="animate-spin" /> : <Save size={22} />}
          {editId ? "Atualizar Financiamento" : "Criar Financiamento"}
        </button>
      </div>
    </div>
  )
}