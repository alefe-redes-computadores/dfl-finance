"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  CreditCard,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from "@/lib/hooks/useAuth"
import { db, addToSyncQueue } from '@/lib/db' // 🔥 ADICIONADO

const CATEGORIES = [
  "Streaming",
  "Software",
  "Academia",
  "Clube",
  "Seguro",
  "Internet",
  "Telefone",
  "TV",
  "Educação",
  "Saúde",
  "Outros",
]

const BILLING_CYCLES = [
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
  { value: "weekly", label: "Semanal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannually", label: "Semestral" },
]

export default function NewSubscriptionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { context } = useContext_()
  const { user } = useAuth()

  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)

  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [billingCycle, setBillingCycle] = useState("monthly")
  const [category, setCategory] = useState("")
  const [nextDueDate, setNextDueDate] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("active")

  // Busca dados locais para edição
  const { data: localSubscriptions } = useLocalData({
    table: 'subscriptions' as any,
    filters: { context },
  })

  const subscriptionData = localSubscriptions?.find((s: any) => s.id === editId) as any

  // Preenche formulário para edição
  useEffect(() => {
    if (subscriptionData) {
      setName(subscriptionData.name || "")
      setAmount(subscriptionData.amount ? String(subscriptionData.amount) : "")
      setBillingCycle(subscriptionData.billing_cycle || "monthly")
      setCategory(subscriptionData.category || "")
      setNextDueDate(subscriptionData.next_due_date ? subscriptionData.next_due_date.split("T")[0] : "")
      setPaymentMethod(subscriptionData.payment_method || "")
      setNotes(subscriptionData.notes || "")
      setStatus(subscriptionData.status || "active")
    }
  }, [subscriptionData])

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
    if (!name.trim()) {
      showToast("Preencha o nome da assinatura", "warning")
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
        name: name.trim(),
        amount: parseFloat(amount),
        billing_cycle: billingCycle,
        category: category || null,
        next_due_date: nextDueDate || null,
        payment_method: paymentMethod.trim() || null,
        notes: notes.trim() || null,
        status,
        context,
        updated_at: new Date().toISOString(),
      }

      if (editId) {
        // 🔥 ATUALIZA NO INDEXEDDB
        await db.table('subscriptions').update(editId, payload)
        // 🔥 ADICIONA À FILA DE SINCRONIZAÇÃO
        await addToSyncQueue(user!.id, 'subscriptions', 'update', editId, payload)
        showToast("Assinatura atualizada com sucesso!", "success")
      } else {
        const id = crypto.randomUUID()
        const fullPayload = {
          id,
          user_id: user!.id,
          ...payload,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        // 🔥 CRIA NO INDEXEDDB
        await db.table('subscriptions').add(fullPayload)
        // 🔥 ADICIONA À FILA DE SINCRONIZAÇÃO
        await addToSyncQueue(user!.id, 'subscriptions', 'create', id, fullPayload)
        showToast("Assinatura criada com sucesso!", "success")
      }

      success()
      router.back()
    } catch (err: any) {
      showToast(err?.message || "Erro ao salvar assinatura", "error")
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editId) return
    if (!confirm("Tem certeza que deseja excluir esta assinatura?")) return
    try {
      // 🔥 EXCLUI DO INDEXEDDB
      await db.table('subscriptions').delete(editId)
      // 🔥 ADICIONA À FILA DE SINCRONIZAÇÃO
      await addToSyncQueue(user!.id, 'subscriptions', 'delete', editId, { id: editId })
      showToast("Assinatura excluída com sucesso!", "success")
      success()
      router.back()
    } catch {
      showToast("Erro ao excluir assinatura", "error")
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
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

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
              {editId ? "Editar" : "Nova"} Assinatura
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

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Nome da Assinatura
          </label>
          <input
            type="text"
            placeholder="Ex: Netflix, Spotify, Academia..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
              Ciclo
            </label>
            <select
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50"
            >
              {BILLING_CYCLES.map((cycle) => (
                <option key={cycle.value} value={cycle.value}>
                  {cycle.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Categoria (opcional)
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(category === cat ? "" : cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  category === cat
                    ? "bg-teal-500 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Próximo Vencimento (opcional)
          </label>
          <input
            type="date"
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Forma de Pagamento (opcional)
          </label>
          <input
            type="text"
            placeholder="Ex: Cartão de Crédito, Débito Automático, PIX..."
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
            Status
          </label>
          <div className="flex gap-2">
            {["active", "paused", "cancelled"].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  status === s
                    ? s === "active"
                      ? "bg-blue-500 text-white"
                      : s === "paused"
                      ? "bg-orange-500 text-white"
                      : "bg-red-500 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                {s === "active" ? "Ativa" : s === "paused" ? "Pausada" : "Cancelada"}
              </button>
            ))}
          </div>
        </div>

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
            {editId ? "Atualizar Assinatura" : "Criar Assinatura"}
          </button>
        </div>
      </div>
    </div>
  )
}