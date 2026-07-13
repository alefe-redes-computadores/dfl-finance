'use client'

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Save, RefreshCw } from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from '@/hooks/useSafeDb'
import MoneyInput from '@/components/MoneyInput'

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

  useEffect(() => {
    if (loanData) {
      setDescription(loanData.description || "")
      const val = Number(loanData.amount) || 0
      setAmountNum(val)
      setDirection(loanData.direction || "lent")
      setLender(loanData.lender || "")
      setDate(loanData.date ? loanData.date.split("T")[0] : "")
      setDueDate(loanData.due_date ? loanData.due_date.split("T")[0] : "")
      setInterestRate(loanData.interest_rate ? String(loanData.interest_rate) : "")
      setNotes(loanData.notes || "")
      setStatus(loanData.status || "active")
    }
  }, [loanData])

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
  const primaryColor = isLent ? "bg-teal-600" : "bg-orange-500"
  const primaryHover = isLent ? "hover:bg-teal-700" : "hover:bg-orange-600"

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
      {/* HEADER */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#f6f7f8]/90 dark:bg-slate-950/85 border-b border-black/5 dark:border-white/5 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { vibrate([5]); router.back(); }} className="h-10 w-10 rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 active:scale-95 bg-white/80 dark:bg-slate-800/80 border border-black/5 dark:border-white/10">
            <ArrowLeft size={22} />
          </button>
          <div className="text-center">
            <h1 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100">{editId ? "Editar" : "Novo"} Empréstimo</h1>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">{contextTitle}</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-28 space-y-4 animate-in fade-in duration-300">
        
        {/* DIREÇÃO */}
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-black/5 dark:border-white/10 shadow-[0_6px_30px_rgba(15,23,42,0.04)] dark:shadow-none p-5">
          <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 ml-1 mb-2 block">
            Direção
          </label>
          <div className="flex gap-2 bg-gray-50/80 dark:bg-slate-800/50 p-1 rounded-[18px] border border-black/5 dark:border-white/10">
            <button onClick={() => { vibrate([5]); setDirection("lent"); }} className={`flex-1 h-12 rounded-[16px] text-[13px] font-semibold transition-all active:scale-[0.98] ${direction === "lent" ? "bg-teal-600 text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700/50"}`}>Emprestei Dinheiro</button>
            <button onClick={() => { vibrate([5]); setDirection("borrowed"); }} className={`flex-1 h-12 rounded-[16px] text-[13px] font-semibold transition-all active:scale-[0.98] ${direction === "borrowed" ? "bg-orange-500 text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700/50"}`}>Peguei Emprestado</button>
          </div>
        </div>

        {/* DESCRIÇÃO */}
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-black/5 dark:border-white/10 shadow-[0_6px_30px_rgba(15,23,42,0.04)] dark:shadow-none p-5">
          <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
            Motivo / Descrição
          </label>
          <input type="text" placeholder="Ex: Empréstimo para capital de giro..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-transparent text-[15px] font-semibold text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500" autoFocus />
        </div>

        {/* VALOR */}
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-black/5 dark:border-white/10 shadow-[0_6px_30px_rgba(15,23,42,0.04)] dark:shadow-none p-5">
          <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
            Valor Total
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[18px] text-gray-400 font-medium">R$</span>
            <MoneyInput
              value={amountNum}
              onChange={(num) => { setAmountNum(num) }}
              placeholder="0,00"
              className="text-[28px] font-semibold bg-transparent outline-none w-full text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* CONTRAPARTE */}
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-black/5 dark:border-white/10 shadow-[0_6px_30px_rgba(15,23,42,0.04)] dark:shadow-none p-5">
          <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
            {direction === "lent" ? "Quem pegou? (opcional)" : "Quem emprestou? (opcional)"}
          </label>
          <input type="text" placeholder="Nome da pessoa ou empresa" value={lender} onChange={(e) => setLender(e.target.value)} className="w-full bg-transparent text-[15px] font-semibold text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500" />
        </div>

        {/* DATAS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-black/5 dark:border-white/10 shadow-[0_6px_30px_rgba(15,23,42,0.04)] dark:shadow-none p-5">
            <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
              Data
            </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent text-[14px] font-semibold text-gray-900 dark:text-gray-100 outline-none" />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-black/5 dark:border-white/10 shadow-[0_6px_30px_rgba(15,23,42,0.04)] dark:shadow-none p-5">
            <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
              Vencimento (opcional)
            </label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-transparent text-[14px] font-semibold text-gray-900 dark:text-gray-100 outline-none" />
          </div>
        </div>

        {/* JUROS E STATUS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-black/5 dark:border-white/10 shadow-[0_6px_30px_rgba(15,23,42,0.04)] dark:shadow-none p-5">
            <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
              Juros (% a.m.)
            </label>
            <input type="number" step="0.01" placeholder="Ex: 1,5" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} className="w-full bg-transparent text-[15px] font-semibold text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-black/5 dark:border-white/10 shadow-[0_6px_30px_rgba(15,23,42,0.04)] dark:shadow-none p-5">
            <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
              Status
            </label>
            <select value={status} onChange={(e) => { vibrate([5]); setStatus(e.target.value); }} className="w-full bg-transparent text-[15px] font-semibold text-gray-900 dark:text-gray-100 outline-none appearance-none cursor-pointer">
              <option value="active">Ativo</option>
              <option value="paid">Pago</option>
              <option value="overdue">Atrasado</option>
            </select>
          </div>
        </div>

        {/* OBSERVAÇÕES */}
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-black/5 dark:border-white/10 shadow-[0_6px_30px_rgba(15,23,42,0.04)] dark:shadow-none p-5">
          <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
            Observações Adicionais
          </label>
          <input type="text" placeholder="Detalhes extra..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-transparent text-[15px] font-medium text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500" />
        </div>
      </div>

      {/* BOTÃO SALVAR */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#f6f7f8] dark:from-slate-950 via-[#f6f7f8]/90 dark:via-slate-950/90 to-transparent px-4 py-5">
        <button onClick={() => { vibrate([10, 50]); handleSave(); }} disabled={saving} className={`w-full max-w-md mx-auto text-white py-4 rounded-[20px] font-semibold text-[15px] shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 ${primaryColor} ${primaryHover} shadow-${isLent ? 'teal' : 'orange'}-600/20`}>
          {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
          {editId ? "Atualizar Empréstimo" : "Criar Empréstimo"}
        </button>
      </div>
    </div>
  )
}

export default function NewLoanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] dark:bg-slate-950"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <NewLoanContent />
    </Suspense>
  )
}