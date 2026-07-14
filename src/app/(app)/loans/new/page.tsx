'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Save, RefreshCw, HandCoins, Calendar, Landmark, DollarSign,
  ChevronLeft, X, Check, Loader2
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSafeDb } from '@/hooks/useSafeDb'
import MoneyInput from '@/components/MoneyInput'
import Skeleton from '@/components/Skeleton' // ✅ ADICIONADO

function NewLoanContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { user } = useAuth()

  const { safeAdd, safeUpdate } = useSafeDb()
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  // ✅ ADICIONADO: initialized
  const [initialized, setInitialized] = useState(!editId)
  const [saving, setSaving] = useState(false)

  const [description, setDescription] = useState("")
  const [amountNum, setAmountNum] = useState(0)
  const [direction, setDirection] = useState("lent")
  const [lender, setLender] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState("")
  const [interestRate, setInterestRate] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("active")

  const { data: localLoans } = useLocalData({
    table: 'loans' as any,
    filters: { context: effectiveContext },
  })

  const loanData = localLoans?.find((l: any) => l.id === editId) as any

  // ✅ CORRIGIDO: useEffect com initialized
  useEffect(() => {
    if (editId && loanData && !initialized) {
      setDescription(loanData.description || "")
      setAmountNum(Number(loanData.amount) || 0)
      setDirection(loanData.direction || "lent")
      setLender(loanData.lender || "")
      setDate(loanData.date ? loanData.date.split("T")[0] : "")
      setDueDate(loanData.due_date ? loanData.due_date.split("T")[0] : "")
      setInterestRate(loanData.interest_rate ? String(loanData.interest_rate) : "")
      setNotes(loanData.notes || "")
      setStatus(loanData.status || "active")
      setInitialized(true)
    }
    
    if (!editId && !initialized) {
      setInitialized(true)
    }
  }, [editId, loanData, initialized])

  const handleSave = async () => {
    if (!description.trim()) {
      errorHaptic()
      showToast("⚠️ Preencha a descrição", "warning")
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
        description: description.trim(),
        amount: amountNum,
        direction,
        lender: lender.trim() || null,
        date: date || new Date().toISOString().split("T")[0],
        due_date: dueDate || null,
        interest_rate: interestRate ? parseFloat(interestRate) : null,
        notes: notes.trim() || null,
        status,
        context: effectiveContext,
        updated_at: new Date().toISOString(),
      }

      if (editId) {
        const res = await safeUpdate('loans', editId, payload)
        if (!res.success) throw new Error(res.error)
      } else {
        const id = crypto.randomUUID()
        const fullPayload = {
          id,
          user_id: user!.id,
          ...payload,
          remaining_amount: amountNum,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        const res = await safeAdd('loans', fullPayload)
        if (!res.success) throw new Error(res.error)
      }

      success()
      showToast(editId ? "✅ Empréstimo atualizado!" : "✅ Empréstimo registrado!", "success")
      
      // ✅ Força recarga da lista para evitar flicker ao voltar
      // (opcional: se tiver acesso ao reload da listagem, pode chamar aqui)
      
      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, "error")
    } finally {
      setSaving(false)
    }
  }

  const contextTitle = effectiveContext === "dfl" ? "Empresa" : "Pessoal"
  const isLent = direction === "lent"
  const accent = isLent ? {
    ring: "focus-visible:ring-teal-500",
    text: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-600",
    bgSoft: "bg-teal-50 dark:bg-teal-900/20",
    borderSoft: "border-teal-100 dark:border-teal-800/40",
    hover: "hover:bg-teal-700",
    shadow: "shadow-teal-600/20",
  } : {
    ring: "focus-visible:ring-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500",
    bgSoft: "bg-orange-50 dark:bg-orange-900/20",
    borderSoft: "border-orange-100 dark:border-orange-800/40",
    hover: "hover:bg-orange-600",
    shadow: "shadow-orange-500/20",
  }

  const fieldShell = "rounded-[22px] border border-black/5 dark:border-white/10 bg-white dark:bg-slate-900 shadow-[0_6px_24px_rgba(15,23,42,0.04)] dark:shadow-none"
  const labelClass = "text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500"
  const inputClass = "w-full bg-transparent outline-none text-[15px] font-semibold text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"

  // ✅ ADICIONADO: tela de skeleton durante carregamento
  if (!initialized) {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
        <div className="flex-1 px-4 pt-6">
          <Skeleton count={6} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#f6f7f8]/90 dark:bg-slate-950/85 border-b border-black/5 dark:border-white/5 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => { vibrate([5]); router.back(); }}
            className="h-11 w-11 rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 active:scale-95 bg-white/80 dark:bg-slate-800/80 border border-black/5 dark:border-white/10"
            aria-label="Voltar"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="text-center min-w-0 flex-1">
            <h1 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100 truncate">
              {editId ? "Editar" : "Novo"} Empréstimo
            </h1>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
              {contextTitle}
            </p>
          </div>

          <div className="w-11" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-28 space-y-4 animate-in fade-in duration-300">
        <div className={`${fieldShell} p-4`}>
          <label className={labelClass}>Direção</label>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-[18px] bg-gray-50/80 dark:bg-slate-800/50 p-1.5 border border-black/5 dark:border-white/10">
            <button
              onClick={() => { vibrate([5]); setDirection("lent"); }}
              className={`h-12 rounded-[14px] text-[13px] font-semibold transition-all active:scale-[0.98] ${
                direction === "lent"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:bg-white/70 dark:hover:bg-slate-700/50"
              }`}
            >
              Emprestei
            </button>
            <button
              onClick={() => { vibrate([5]); setDirection("borrowed"); }}
              className={`h-12 rounded-[14px] text-[13px] font-semibold transition-all active:scale-[0.98] ${
                direction === "borrowed"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:bg-white/70 dark:hover:bg-slate-700/50"
              }`}
            >
              Peguei
            </button>
          </div>
        </div>

        <div className={`${fieldShell} p-4`}>
          <label className={labelClass}>Valor total</label>
          <div className="mt-3 flex items-start gap-2">
            <span className="text-[16px] leading-none text-gray-400 font-medium pt-2">R$</span>
            <MoneyInput
              value={amountNum}
              onChange={(num) => setAmountNum(num)}
              placeholder="0,00"
              className="flex-1 bg-transparent outline-none text-[30px] leading-none font-semibold text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className={`${fieldShell} p-4`}>
          <label className={labelClass}>Descrição</label>
          <input
            type="text"
            placeholder="Ex: Empréstimo para capital de giro"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} mt-3`}
            autoFocus
          />
        </div>

        <div className={`${fieldShell} p-4`}>
          <label className={labelClass}>{direction === "lent" ? "Quem pegou?" : "Quem emprestou?"}</label>
          <input
            type="text"
            placeholder="Nome da pessoa ou empresa"
            value={lender}
            onChange={(e) => setLender(e.target.value)}
            className={`${inputClass} mt-3`}
          />
        </div>

        <div className={`${fieldShell} p-4`}>
          <label className={labelClass}>Condições</label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-gray-50/80 dark:bg-slate-800/50 border border-black/5 dark:border-white/10 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500 mb-1">Data</p>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent text-[14px] font-semibold text-gray-900 dark:text-gray-100 outline-none"
              />
            </div>
            <div className="rounded-[18px] bg-gray-50/80 dark:bg-slate-800/50 border border-black/5 dark:border-white/10 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500 mb-1">Vencimento</p>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-transparent text-[14px] font-semibold text-gray-900 dark:text-gray-100 outline-none"
              />
            </div>
            <div className="rounded-[18px] bg-gray-50/80 dark:bg-slate-800/50 border border-black/5 dark:border-white/10 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500 mb-1">Juros % a.m.</p>
              <input
                type="number"
                step="0.01"
                placeholder="Ex: 1,5"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="rounded-[18px] bg-gray-50/80 dark:bg-slate-800/50 border border-black/5 dark:border-white/10 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500 mb-1">Status</p>
              <select
                value={status}
                onChange={(e) => { vibrate([5]); setStatus(e.target.value); }}
                className={`${inputClass} appearance-none cursor-pointer`}
              >
                <option value="active">Ativo</option>
                <option value="paid">Pago</option>
                <option value="overdue">Atrasado</option>
              </select>
            </div>
          </div>
        </div>

        <div className={`${fieldShell} p-4`}>
          <label className={labelClass}>Observações</label>
          <textarea
            rows={3}
            placeholder="Detalhes extras..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} mt-3 resize-none`}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#f6f7f8] dark:from-slate-950 via-[#f6f7f8]/90 dark:via-slate-950/90 to-transparent px-4 py-5">
        <button
          onClick={() => { vibrate([10, 50]); handleSave(); }}
          disabled={saving}
          className={`w-full max-w-md mx-auto text-white py-4 rounded-[20px] font-semibold text-[15px] shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 ${accent.bg} ${accent.hover} ${accent.shadow}`}
        >
          {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
          {editId ? "Atualizar Empréstimo" : "Criar Empréstimo"}
        </button>
      </div>
    </div>
  )
}

export default function NewLoanPage() {
  return <NewLoanContent />
}