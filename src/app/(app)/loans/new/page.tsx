"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Save, RefreshCw } from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from '@/hooks/useSafeDb'
import MoneyInput from '@/components/MoneyInput'

export default function NewLoanPage() {
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
  const [amountFormatted, setAmountFormatted] = useState("0,00")
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
      setAmountFormatted(val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
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

  const contextTitle = effectiveContext === "dfl" ? "da Empresa" : "Pessoal"

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-gray-50/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { vibrate([5]); router.back(); }} className="p-2 -ml-2 rounded-full text-gray-800 dark:text-gray-200 active:scale-95 transition-transform"><ArrowLeft size={24} /></button>
          <div className="text-center">
            <h1 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{editId ? "Editar" : "Novo"} Empréstimo</h1>
            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{contextTitle}</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-28 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block">Direção</label>
          <div className="flex gap-2 bg-gray-50 dark:bg-slate-700/50 p-1 rounded-full border border-gray-100 dark:border-slate-700/50">
            <button onClick={() => { vibrate([5]); setDirection("lent"); }} className={`flex-1 py-3 rounded-full text-[13px] font-bold transition-all active:scale-95 ${direction === "lent" ? "bg-teal-600 text-white shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>Emprestei Dinheiro</button>
            <button onClick={() => { vibrate([5]); setDirection("borrowed"); }} className={`flex-1 py-3 rounded-full text-[13px] font-bold transition-all active:scale-95 ${direction === "borrowed" ? "bg-orange-500 text-white shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>Peguei Emprestado</button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Motivo / Descrição</label>
          <input type="text" placeholder="Ex: Empréstimo para capital de giro..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-transparent text-[16px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" autoFocus />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Valor Total</label>
          <div className="flex items-center gap-2">
            <span className="text-[18px] text-gray-400 font-medium">R$</span>
            <MoneyInput
              value={amountNum}
              onChange={(num, formatted) => { setAmountNum(num); setAmountFormatted(formatted) }}
              placeholder="0,00"
              className="text-[28px] font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">{direction === "lent" ? "Quem pegou? (Opcional)" : "Quem emprestou? (Opcional)"}</label>
          <input type="text" placeholder="Nome da pessoa ou empresa" value={lender} onChange={(e) => setLender(e.target.value)} className="w-full bg-transparent text-[15px] font-medium text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none" />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Vencimento (Opcional)</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Juros (% a.m.)</label>
            <input type="number" step="0.01" placeholder="Ex: 1,5" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Status</label>
            <select value={status} onChange={(e) => { vibrate([5]); setStatus(e.target.value); }} className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none appearance-none cursor-pointer">
              <option value="active">Ativo</option>
              <option value="paid">Pago</option>
              <option value="overdue">Atrasado</option>
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Observações Adicionais</label>
          <input type="text" placeholder="Detalhes extra..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-transparent text-[15px] font-medium text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" />
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 dark:from-slate-900 via-gray-50/80 dark:via-slate-900/80 to-transparent z-20">
          <button onClick={() => { vibrate([10, 50]); handleSave(); }} disabled={saving} className={`w-full max-w-md mx-auto text-white py-4 rounded-[24px] font-bold text-[16px] shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 ${direction === 'lent' ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/30' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30'}`}>
            {saving ? <RefreshCw size={22} className="animate-spin" /> : <Save size={22} />}{editId ? "Atualizar Empréstimo" : "Criar Empréstimo"}
          </button>
        </div>
      </div>
    </div>
  )
}
