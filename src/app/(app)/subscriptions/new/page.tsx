"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Save, RefreshCw } from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from "@/lib/hooks/useAuth"
import { db, addToSyncQueue } from '@/lib/db' 
import MoneyInput from '@/components/MoneyInput'

const CATEGORIES = ["Streaming", "Software", "Academia", "Clube", "Seguro", "Internet", "Telefone", "TV", "Educação", "Saúde", "Outros"]

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
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { context, appMode } = useContext_()
  const { user } = useAuth()

  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [amountNum, setAmountNum] = useState(0)
  const [amountFormatted, setAmountFormatted] = useState("0,00")
  const [billingCycle, setBillingCycle] = useState("monthly")
  const [category, setCategory] = useState("")
  const [nextDueDate, setNextDueDate] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("active")

  const { data: localSubscriptions } = useLocalData({
    table: 'subscriptions' as any,
    filters: { context: effectiveContext },
  })

  const subscriptionData = localSubscriptions?.find((s: any) => s.id === editId) as any

  useEffect(() => {
    if (subscriptionData) {
      setName(subscriptionData.name || "")
      const val = Number(subscriptionData.amount) || 0
      setAmountNum(val)
      setAmountFormatted(val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      setBillingCycle(subscriptionData.billing_cycle || "monthly")
      setCategory(subscriptionData.category || "")
      setNextDueDate(subscriptionData.next_due_date ? subscriptionData.next_due_date.split("T")[0] : "")
      setPaymentMethod(subscriptionData.payment_method || "")
      setNotes(subscriptionData.notes || "")
      setStatus(subscriptionData.status || "active")
    }
  }, [subscriptionData])

  const handleSave = async () => {
    if (!name.trim()) {
      errorHaptic()
      showToast("⚠️ Preencha o nome da assinatura", "warning")
      return
    }
    if (amountNum <= 0) {
      errorHaptic()
      showToast("⚠️ Informe um valor válido", "warning")
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
          await db.table('subscriptions').update(editId, payload)
          await addToSyncQueue(user!.id, 'subscriptions', 'update', editId, payload)
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
          await db.table('subscriptions').add(fullPayload)
          await addToSyncQueue(user!.id, 'subscriptions', 'create', id, fullPayload)
        }
      })

      success()
      showToast(editId ? "✅ Assinatura atualizada!" : "✅ Assinatura criada!", "success")
      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, "error")
    } finally {
      setSaving(false)
    }
  }

  const contextTitle = effectiveContext === "dfl" ? "da Empresa" : "Pessoal"

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-gray-50/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { vibrate([5]); router.back(); }} className="p-2 -ml-2 rounded-full text-gray-800 dark:text-gray-200 active:scale-95 transition-transform"><ArrowLeft size={24} /></button>
          <div className="text-center">
            <h1 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{editId ? "Editar" : "Nova"} Assinatura</h1>
            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{contextTitle}</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-28 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Nome da Assinatura</label>
          <input type="text" placeholder="Ex: Netflix, Spotify..." value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent text-[16px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Valor</label>
            <div className="flex items-center gap-2">
              <span className="text-[16px] text-gray-400 font-medium">R$</span>
              <MoneyInput
                value={amountNum}
                onChange={(num, formatted) => { setAmountNum(num); setAmountFormatted(formatted) }}
                placeholder="0,00"
                className="text-[20px] font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600"
              />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Ciclo</label>
            <select value={billingCycle} onChange={(e) => { vibrate([5]); setBillingCycle(e.target.value); }} className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none appearance-none cursor-pointer">
              {BILLING_CYCLES.map((cycle) => (<option key={cycle.value} value={cycle.value}>{cycle.label}</option>))}
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block">Categoria</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => { vibrate([5]); setCategory(category === cat ? "" : cat); }} className={`px-4 py-2 rounded-full text-[13px] font-bold transition-all active:scale-95 ${category === cat ? "bg-teal-600 text-white shadow-sm" : "bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100"}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Próximo Vencimento (Opcional)</label>
          <input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none" />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Forma de Pagamento (Opcional)</label>
          <input type="text" placeholder="Ex: Cartão Final 1234, PIX..." value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-transparent text-[15px] font-medium text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block">Status da Assinatura</label>
          <div className="flex gap-2">
            {["active", "paused", "cancelled"].map((s) => (
              <button key={s} onClick={() => { vibrate([5]); setStatus(s); }} className={`flex-1 py-3 rounded-[16px] text-[13px] font-bold transition-all active:scale-95 ${status === s ? s === "active" ? "bg-emerald-500 text-white shadow-sm" : s === "paused" ? "bg-orange-500 text-white shadow-sm" : "bg-red-500 text-white shadow-sm" : "bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400"}`}>
                {s === "active" ? "Ativa" : s === "paused" ? "Pausada" : "Cancelada"}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Observações (Opcional)</label>
          <input type="text" placeholder="Detalhes adicionais..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-transparent text-[15px] font-medium text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" />
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 dark:from-slate-900 via-gray-50/80 dark:via-slate-900/80 to-transparent z-20">
          <button onClick={() => { vibrate([10, 50]); handleSave(); }} disabled={saving} className="w-full max-w-md mx-auto bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[16px] shadow-lg shadow-teal-600/30 transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <RefreshCw size={22} className="animate-spin" /> : <Save size={22} />}{editId ? "Atualizar Assinatura" : "Criar Assinatura"}
          </button>
        </div>
      </div>
    </div>
  )
}
