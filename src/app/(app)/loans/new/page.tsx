"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useAuth } from "@/lib/hooks/useAuth"


export default function NewLoanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { context } = useAuth()

  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [direction, setDirection] = useState("lent") // lent = emprestei, borrowed = peguei
  const [lender, setLender] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState("")
  const [interestRate, setInterestRate] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("active")

  // Busca dados locais para edição
  const { data: localLoans } = useLocalData({
    table: 'loans' as any,
    filters: { context },
  })

  const loanData = localLoans?.find((l: any) => l.id === editId) as any

  const { create, update } = useLocalData({
    table: 'loans' as any,
  })

  // Preenche formulário para edição
  useEffect(() => {
    if (loanData) {
      setDescription(loanData.description || "")
      setAmount(loanData.amount ? String(loanData.amount) : "")
      setDirection(loanData.direction || "lent")
      setLender(loanData.lender || "")
      setDate(loanData.date ? loanData.date.split("T")[0] : "")
      setDueDate(loanData.due_date ? loanData.due_date.split("T")[0] : "")
      setInterestRate(loanData.interest_rate ? String(loanData.interest_rate) : "")
      setNotes(loanData.notes || "")
      setStatus(loanData.status || "active")
    }
  }, [loanData])

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
      showToast("Preencha a descrição do empréstimo", "warning")
      errorHaptic()
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      showToast("Informe um valor válido", "warning")
      errorHaptic()
      return
    }

    setSaving(true)
    try {
      const payload = {
        description: description.trim(),
        amount: parseFloat(amount),
        direction,
        lender: lender.trim() || null,
        date: date || new Date().toISOString().split("T")[0],
        due_date: dueDate || null,
        interest_rate: interestRate ? parseFloat(interestRate) : null,
        notes: notes.trim() || null,
        status,
        context,
      }

      if (editId) {
        await update(editId, payload)
        showToast("Empréstimo atualizado com sucesso!", "success")
      } else {
        await create(payload)
        showToast("Empréstimo criado com sucesso!", "success")
      }

      success()
      router.back()
    } catch (err: any) {
      showToast(err?.message || "Erro ao salvar empréstimo", "error")
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editId) return
    if (!confirm("Tem certeza que deseja excluir este empréstimo?")) return
    try {
      const { remove } = useLocalData({ table: 'loans' as any })
      await remove(editId)
      showToast("Empréstimo excluído com sucesso!", "success")
      success()
      router.back()
    } catch {
      showToast("Erro ao excluir empréstimo", "error")
      errorHaptic()
    }
  }

  // Define o título baseado no contexto
  const contextTitle = context === "pj" ? "da Empresa" : "Pessoal"

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
              {editId ? "Editar" : "Novo"} Empréstimo
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
        {/* Tipo de direção */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Tipo de Empréstimo
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setDirection("lent")}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
                direction === "lent"
                  ? "bg-teal-500 text-white shadow-md shadow-teal-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              Emprestei Dinheiro
            </button>
            <button
              onClick={() => setDirection("borrowed")}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
                direction === "borrowed"
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              Peguei Emprestado
            </button>
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Descrição
          </label>
          <input
            type="text"
            placeholder="Ex: Empréstimo para capital de giro..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
          />
        </div>

        {/* Valor */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Valor (R$)
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
          />
        </div>

        {/* Pessoa (Credor/Devedor) */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            {direction === "lent" ? "Devedor" : "Credor"} (opcional)
          </label>
          <input
            type="text"
            placeholder={direction === "lent" ? "Nome de quem pegou o empréstimo" : "Nome de quem emprestou"}
            value={lender}
            onChange={(e) => setLender(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
          />
        </div>

        {/* Datas */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
              Data
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
              Vencimento
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
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
                {s === "active" ? "Ativo" : s === "paid" ? "Pago" : "Atrasado"}
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
            {editId ? "Atualizar Empréstimo" : "Criar Empréstimo"}
          </button>
        </div>
      </div>
    </div>
  )
}