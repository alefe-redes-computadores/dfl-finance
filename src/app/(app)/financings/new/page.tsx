"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  Car,
  Home,
  Percent,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from "@/lib/hooks/useAuth"


export default function NewFinancingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { context } = useContext_()

  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)

  const [description, setDescription] = useState("")
  const [totalAmount, setTotalAmount] = useState("")
  const [installmentsCount, setInstallmentsCount] = useState("")
  const [installmentAmount, setInstallmentAmount] = useState("")
  const [interestRate, setInterestRate] = useState("")
  const [bank, setBank] = useState("")
  const [assetType, setAssetType] = useState("other")
  const [asset, setAsset] = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
  const [firstDueDate, setFirstDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("active")

  // Busca dados locais para edição
  const { data: localFinancings } = useLocalData({
    table: 'financings' as any,
    filters: { context },
  })

  const financingData = localFinancings?.find((f: any) => f.id === editId) as any

  const { create, update, remove } = useLocalData({
    table: 'financings' as any,
  })

  // Preenche formulário para edição
  useEffect(() => {
    if (financingData) {
      setDescription(financingData.description || "")
      setTotalAmount(financingData.total_amount ? String(financingData.total_amount) : "")
      setInstallmentsCount(financingData.installments_count ? String(financingData.installments_count) : "")
      setInstallmentAmount(financingData.installment_amount ? String(financingData.installment_amount) : "")
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

  // Calcula valor da parcela automaticamente
  useEffect(() => {
    if (totalAmount && installmentsCount && parseFloat(installmentsCount) > 0) {
      const total = parseFloat(totalAmount)
      const count = parseInt(installmentsCount)
      if (total > 0 && count > 0) {
        const installment = total / count
        setInstallmentAmount(installment.toFixed(2))
      }
    }
  }, [totalAmount, installmentsCount])

  // Pull-to-refresh
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        setTimeout(() => setRefreshing(false), 600)
      }
    }
  }, [refreshing])

  const handleSave = async () => {
    if (!description.trim()) {
      showToast("Preencha a descrição do financiamento", "warning")
      errorHaptic()
      return
    }
    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      showToast("Informe um valor total válido", "warning")
      errorHaptic()
      return
    }
    if (!installmentsCount || parseInt(installmentsCount) <= 0) {
      showToast("Informe o número de parcelas", "warning")
      errorHaptic()
      return
    }

    setSaving(true)
    try {
      const payload = {
        description: description.trim(),
        total_amount: parseFloat(totalAmount),
        installments_count: parseInt(installmentsCount),
        installment_amount: parseFloat(installmentAmount) || 0,
        interest_rate: interestRate ? parseFloat(interestRate) : null,
        bank: bank.trim() || null,
        asset_type: assetType,
        asset: asset.trim() || null,
        start_date: startDate || new Date().toISOString().split("T")[0],
        first_due_date: firstDueDate || null,
        notes: notes.trim() || null,
        status,
        context,
      }

      if (editId) {
        await update(editId, payload)
        showToast("Financiamento atualizado com sucesso!", "success")
      } else {
        await create(payload)
        showToast("Financiamento criado com sucesso!", "success")
      }

      success()
      router.back()
    } catch (err: any) {
      showToast(err?.message || "Erro ao salvar financiamento", "error")
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editId) return
    if (!confirm("Tem certeza que deseja excluir este financiamento?")) return
    try {
      await remove(editId)
      showToast("Financiamento excluído com sucesso!", "success")
      success()
      router.back()
    } catch {
      showToast("Erro ao excluir financiamento", "error")
      errorHaptic()
    }
  }

  const contextTitle = (context as string) === "pj" ? "da Empresa" : "Pessoal"

  return (
    <div
      className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {/* Pull-to-refresh */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">
              {editId ? "Editar" : "Novo"} Financiamento
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {contextTitle}
            </p>
          </div>
          <div className="flex gap-2">
            {editId && (
              <button
                onClick={handleDelete}
                className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                aria-label="Excluir"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white shadow-md shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50"
              aria-label="Salvar"
            >
              {saving ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : (
                <Save size={20} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        {/* Tipo de bem */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Tipo de Bem
          </label>
          <div className="flex gap-2">
            {[
              { value: "vehicle", label: "Veículo", icon: Car },
              { value: "property", label: "Imóvel", icon: Home },
              { value: "other", label: "Outro", icon: Percent },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setAssetType(value)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                  assetType === value
                    ? "bg-teal-500 text-white shadow-md shadow-teal-500/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Descrição
          </label>
          <input
            type="text"
            placeholder="Ex: Financiamento do veículo..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
          />
        </div>

        {/* Bem */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Bem (opcional)
          </label>
          <input
            type="text"
            placeholder="Ex: Honda Civic 2024, Apartamento Centro..."
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
          />
        </div>

        {/* Banco */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Banco/Financeira (opcional)
          </label>
          <input
            type="text"
            placeholder="Ex: Banco do Brasil, BV Financeira..."
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
          />
        </div>

        {/* Valor Total e Nº Parcelas */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
              Valor Total (R$)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
              Nº Parcelas
            </label>
            <input
              type="number"
              placeholder="Ex: 36"
              value={installmentsCount}
              onChange={(e) => setInstallmentsCount(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Valor da Parcela (calculado) */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Valor da Parcela (calculado)
          </label>
          <input
            type="number"
            step="0.01"
            value={installmentAmount}
            onChange={(e) => setInstallmentAmount(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-teal-600 dark:text-teal-400 outline-none focus:ring-2 focus:ring-teal-500/50"
          />
        </div>

        {/* Taxa de juros */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Taxa de Juros (% a.m.) — opcional
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="0,00"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
          />
        </div>

        {/* Datas */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
              Data Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
              1º Vencimento
            </label>
            <input
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Status
          </label>
          <div className="flex gap-2">
            {["active", "paid", "overdue"].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  status === s
                    ? s === "active"
                      ? "bg-blue-500 text-white"
                      : s === "paid"
                      ? "bg-teal-500 text-white"
                      : "bg-red-500 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                {s === "active" ? "Ativo" : s === "paid" ? "Quitado" : "Atrasado"}
              </button>
            ))}
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Observações (opcional)
          </label>
          <textarea
            placeholder="Detalhes adicionais..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400 resize-none"
          />
        </div>

        {/* Botão Salvar fixo no mobile */}
        <div className="fixed bottom-20 left-0 right-0 px-4 z-20">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-black text-base shadow-xl shadow-teal-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <RefreshCw size={20} className="animate-spin" />
            ) : (
              <Save size={20} />
            )}
            {editId ? "Atualizar Financiamento" : "Criar Financiamento"}
          </button>
        </div>
      </div>
    </div>
  )
}