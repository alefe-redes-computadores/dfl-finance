// src/app/(app)/subscriptions/new/page.tsx
'use client'

import { useState, useEffect, Suspense, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Save, RefreshCw, Loader2 } from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useSubscriptionById } from "@/hooks/useSubscriptionById"
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from "@/lib/hooks/useAuth"
import { db, addToSyncQueue } from '@/lib/db'
import MoneyInput from '@/components/MoneyInput'
import Skeleton from '@/components/Skeleton'

const CATEGORIES = ["Streaming", "Software", "Academia", "Clube", "Seguro", "Internet", "Telefone", "TV", "Educação", "Saúde", "Outros"]

const BILLING_CYCLES = [
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
  { value: "weekly", label: "Semanal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannually", label: "Semestral" },
]

function NewSubscriptionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Normaliza o ID de edição.
  const rawEditId = searchParams.get("edit")
  const editId = useMemo(() => rawEditId?.trim() || null, [rawEditId])
  
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { context, appMode } = useContext_()
  const { user } = useAuth()

  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const { data: subscription, loading, notFound } = useSubscriptionById(editId)

  const [initialized, setInitialized] = useState(!editId)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [amountNum, setAmountNum] = useState(0)
  const [billingCycle, setBillingCycle] = useState("monthly")
  const [category, setCategory] = useState("")
  const [nextDueDate, setNextDueDate] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("active")

  useEffect(() => {
    if (editId && subscription && !initialized) {
      setName(subscription.name || "")
      setAmountNum(Number(subscription.amount) || 0)
      setBillingCycle(subscription.billing_cycle || "monthly")
      setCategory(subscription.category || "")
      setNextDueDate(subscription.next_due_date ? subscription.next_due_date.split("T")[0] : "")
      setPaymentMethod(subscription.payment_method || "")
      setNotes(subscription.notes || "")
      setStatus(subscription.status || "active")
      setInitialized(true)
    }

    if (!editId && !initialized) {
      setInitialized(true)
    }
  }, [editId, subscription, initialized])

  // Só redireciona quando a consulta terminou e confirmou ausência.
  if (editId && notFound && !loading) {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 items-center justify-center px-4">
        <p className="text-gray-600 dark:text-gray-400 text-center">
          Assinatura não encontrada.
        </p>
        <button
          onClick={() => router.push('/subscriptions')}
          className="mt-4 px-6 py-3 bg-teal-600 text-white rounded-full font-semibold"
        >
          Voltar para listagem
        </button>
      </div>
    )
  }

  if (editId && loading) {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
        <div className="flex-1 px-4 pt-6">
          <Skeleton count={6} />
        </div>
      </div>
    )
  }

  if (!initialized) {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
        <div className="flex-1 px-4 pt-6">
          <Skeleton count={6} />
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      errorHaptic()
      showToast("Preencha o nome da assinatura.", "warning")
      return
    }

    if (amountNum <= 0) {
      errorHaptic()
      showToast("Informe um valor válido.", "warning")
      return
    }

    if (!user?.id) {
      errorHaptic()
      showToast("Usuário não autenticado.", "warning")
      return
    }

    setSaving(true)

    try {
      const payload = {
        name: name.trim(),
        amount: amountNum,
        billing_cycle: billingCycle,
        category: category || null,
        next_due_date: nextDueDate || null,
        payment_method: paymentMethod.trim() || null,
        notes: notes.trim() || null,
        status,
        context: effectiveContext,
        updated_at: new Date().toISOString(),
      }

      await db.transaction('rw', ['subscriptions', 'syncQueue'], async () => {
        if (editId) {
          const existing = await db.table('subscriptions').get(editId)

          if (!existing) {
            throw new Error('Assinatura não encontrada para atualização.')
          }

          if (existing.user_id !== user.id) {
            throw new Error('Assinatura pertence a outro usuário.')
          }

          const fullPayload = {
            ...existing,
            ...payload,
            id: editId,
            user_id: user.id,
            sync_status: 'pending',
            sync_attempts: 0,
            last_sync_error: null,
          }

          await db.table('subscriptions').put(fullPayload)
          await addToSyncQueue(
            user.id,
            'subscriptions',
            'update',
            editId,
            fullPayload
          )
        } else {
          const id = crypto.randomUUID()
          const fullPayload = {
            id,
            user_id: user.id,
            ...payload,
            created_at: new Date().toISOString(),
            sync_status: 'pending',
            sync_attempts: 0,
            last_sync_error: null,
          }

          await db.table('subscriptions').add(fullPayload)
          await addToSyncQueue(user.id, 'subscriptions', 'create', id, fullPayload)
        }
      })

      success()
      showToast(editId ? "Assinatura atualizada!" : "Assinatura criada!", "success")
      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast(`Erro: ${err.message}`, "error")
    } finally {
      setSaving(false)
    }
  }

  const contextTitle = effectiveContext === "dfl" ? "da Empresa" : "Pessoal"
  const isPersonal = effectiveContext === "personal"
  const primaryColor = isPersonal ? "bg-emerald-600" : "bg-teal-600"
  const primaryHover = isPersonal ? "hover:bg-emerald-700" : "hover:bg-teal-700"
  const shadowColor = isPersonal ? "shadow-emerald-600/25" : "shadow-teal-600/25"

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-[#f6f7f8]/88 dark:bg-slate-950/88 backdrop-blur-xl border-b border-black/5 dark:border-white/5 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { vibrate([5]); router.back(); }}
            className="p-2 -ml-2 rounded-full text-gray-800 dark:text-gray-200 active:scale-95 transition-transform"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="text-center">
            <h1 className="text-[18px] font-bold text-gray-900 dark:text-gray-50">
              {editId ? "Editar" : "Nova"} Assinatura
            </h1>
            <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
              {contextTitle}
            </p>
          </div>

          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-32 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <section className="rounded-[30px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 shadow-[0_6px_24px_rgba(15,23,42,0.05)] dark:shadow-none p-5">
          <div className="space-y-5">
            <div>
              <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
                Nome da assinatura
              </label>
              <input
                type="text"
                placeholder="Ex: Netflix, Spotify..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent text-[22px] leading-tight font-bold text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                autoFocus
              />
            </div>

            <div className="pt-1">
              <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
                Valor
              </label>
              <div className="flex items-end gap-2">
                <span className="text-[18px] text-gray-400 font-medium pb-1">R$</span>
                <MoneyInput
                  value={amountNum}
                  onChange={(num) => { setAmountNum(num) }}
                  placeholder="0,00"
                  className="text-[32px] leading-none font-bold bg-transparent outline-none w-full text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] p-4 border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none">
            <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
              Ciclo
            </label>
            <select
              value={billingCycle}
              onChange={(e) => { vibrate([5]); setBillingCycle(e.target.value) }}
              className="w-full bg-transparent text-[15px] font-semibold text-gray-900 dark:text-gray-100 outline-none appearance-none cursor-pointer"
            >
              {BILLING_CYCLES.map((cycle) => (
                <option key={cycle.value} value={cycle.value}>
                  {cycle.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[24px] p-4 border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none">
            <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
              Próximo vencimento
            </label>
            <input
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="w-full bg-transparent text-[15px] font-semibold text-gray-900 dark:text-gray-100 outline-none"
            />
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-[24px] p-4 border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none">
          <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-3 block">
            Categoria
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => { vibrate([5]); setCategory(category === cat ? "" : cat) }}
                className={`px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all active:scale-95 border ${
                  category === cat
                    ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                    : "bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200/70 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-[24px] p-4 border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
          <div>
            <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
              Forma de pagamento
            </label>
            <input
              type="text"
              placeholder="Ex: Cartão final 1234, PIX..."
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-transparent text-[15px] font-medium text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
            />
          </div>

          <div className="h-px bg-gray-100 dark:bg-slate-800" />

          <div>
            <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-3 block">
              Status da assinatura
            </label>
            <div className="grid grid-cols-3 gap-2 rounded-[20px] bg-gray-50 dark:bg-slate-800 p-1">
              {["active", "paused", "cancelled"].map((s) => {
                const isActive = status === s
                const label = s === "active" ? "Ativa" : s === "paused" ? "Pausada" : "Cancelada"

                return (
                  <button
                    key={s}
                    onClick={() => { vibrate([5]); setStatus(s) }}
                    className={`py-3 rounded-[16px] text-[13px] font-bold transition-all active:scale-95 ${
                      isActive
                        ? s === "active"
                          ? "bg-emerald-500 text-white shadow-sm"
                          : s === "paused"
                          ? "bg-orange-500 text-white shadow-sm"
                          : "bg-red-500 text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-[24px] p-4 border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none">
          <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
            Observações
          </label>
          <textarea
            placeholder="Detalhes adicionais..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-transparent text-[15px] font-medium text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600 resize-none"
          />
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#f6f7f8] dark:from-slate-950 via-[#f6f7f8]/90 dark:via-slate-950/90 to-transparent z-20">
        <button
          onClick={() => { vibrate([10, 50]); handleSave() }}
          disabled={saving}
          className={`w-full max-w-md mx-auto text-white py-4 rounded-[24px] font-bold text-[16px] shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 ${primaryColor} ${primaryHover} ${shadowColor}`}
        >
          {saving ? <RefreshCw size={22} className="animate-spin" /> : <Save size={22} />}
          {editId ? "Atualizar Assinatura" : "Criar Assinatura"}
        </button>
      </div>
    </div>
  )
}

export default function NewSubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] dark:bg-slate-950">
        <Loader2 className="animate-spin text-teal-600" size={32} />
      </div>
    }>
      <NewSubscriptionContent />
    </Suspense>
  )
}