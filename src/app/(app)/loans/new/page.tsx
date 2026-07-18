'use client'

import { useEffect, useState, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Save, RefreshCw, HandCoins, Calendar, Landmark, DollarSign,
  ChevronLeft, X, Check, Loader2, User, CalendarDays, Percent, FileText, Wallet
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLoanById } from '@/hooks/useLoanById'
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSafeDb } from '@/hooks/useSafeDb'
import MoneyInput from '@/components/MoneyInput'
import Skeleton from '@/components/Skeleton'

// ============================================================
// COMPONENTES VISUAIS (apenas estrutura, sem lógica)
// ============================================================

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-gray-100 dark:border-slate-800 pb-3 mb-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
    </div>
  )
}

function FormField({ label, children, error, helper }: { label: string; children: React.ReactNode; error?: string; helper?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {children}
      {helper && <p className="text-xs text-gray-500 dark:text-gray-400">{helper}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

function FieldCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

function NewLoanContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // ✅ useMemo para normalizar o ID
  const rawEditId = searchParams.get("edit")
  const editId = useMemo(() => rawEditId?.trim() || null, [rawEditId])
  
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { user } = useAuth()

  const { safeAdd, safeUpdate } = useSafeDb()
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const { data: loanData, loading, notFound } = useLoanById(editId)

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

  // ✅ SÓ REDIRECIONA SE NOTFOUND E NÃO ESTÁ CARREGANDO
  if (editId && notFound && !loading) {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 items-center justify-center px-4">
        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <HandCoins size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Empréstimo não encontrado</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs mb-6">
          O empréstimo que você está tentando editar pode ter sido excluído ou você não tem permissão para acessá-lo.
        </p>
        <button
          onClick={() => router.push('/loans')}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-full font-semibold transition-colors active:scale-95"
        >
          Voltar para listagem
        </button>
      </div>
    )
  }

  if (editId && loading) {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
        <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#f6f7f8]/90 dark:bg-slate-950/85 border-b border-black/5 dark:border-white/5 px-4 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="h-11 w-11 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
            <div className="h-6 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-11 w-11 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
          </div>
        </div>
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
  const accent = isLent ? {
    text: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-600",
    bgSoft: "bg-teal-50 dark:bg-teal-900/20",
    borderSoft: "border-teal-100 dark:border-teal-800/40",
    hover: "hover:bg-teal-700",
    shadow: "shadow-teal-600/20",
  } : {
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500",
    bgSoft: "bg-orange-50 dark:bg-orange-900/20",
    borderSoft: "border-orange-100 dark:border-orange-800/40",
    hover: "hover:bg-orange-600",
    shadow: "shadow-orange-500/20",
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)

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
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
              {editId ? 'Editar' : 'Novo'} empréstimo
            </p>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {editId ? 'Atualizar dados' : 'Criar empréstimo'}
            </h1>
          </div>

          <div className="w-11" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-28 space-y-4 animate-in fade-in duration-300">
        <FieldCard>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Resumo
          </p>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <p className={`text-sm font-semibold ${accent.text}`}>
                {direction === 'lent' ? 'Você emprestou' : 'Você pegou emprestado'}
              </p>
              <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(amountNum)}
              </p>
            </div>
            <div className="rounded-full px-3 py-1 text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400">
              {editId ? 'Edição' : 'Novo'}
            </div>
          </div>
        </FieldCard>

        <FieldCard>
          <SectionTitle 
            title="Informações principais" 
            description="Defina o valor, a descrição e a outra parte envolvida." 
          />

          <div className="space-y-4">
            <FormField label="Descrição">
              <input
                type="text"
                placeholder="Ex: Empréstimo para capital de giro"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:focus:border-teal-400"
                autoFocus
              />
            </FormField>

            <FormField label="Valor total">
              <div className="flex items-center gap-2 h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10 transition">
                <span className="text-sm font-medium text-gray-400 dark:text-gray-500">R$</span>
                <MoneyInput
                  value={amountNum}
                  onChange={(num) => setAmountNum(num)}
                  placeholder="0,00"
                  className="w-full bg-transparent outline-none text-sm font-semibold text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                />
              </div>
            </FormField>

            <FormField label={direction === "lent" ? "Quem pegou?" : "Quem emprestou?"}>
              <input
                type="text"
                placeholder="Nome da pessoa ou empresa"
                value={lender}
                onChange={(e) => setLender(e.target.value)}
                className="w-full h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:focus:border-teal-400"
              />
            </FormField>
          </div>
        </FieldCard>

        <FieldCard>
          <SectionTitle 
            title="Condições" 
            description="Data, vencimento, juros e status atual." 
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Data">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              />
            </FormField>

            <FormField label="Vencimento">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              />
            </FormField>

            <FormField label="Juros % a.m." helper="Deixe em branco se for sem juros.">
              <input
                type="number"
                step="0.01"
                placeholder="Ex: 1,5"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="w-full h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              />
            </FormField>

            <FormField label="Status">
              <select
                value={status}
                onChange={(e) => { vibrate([5]); setStatus(e.target.value); }}
                className="w-full h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              >
                <option value="active">Ativo</option>
                <option value="paid">Pago</option>
                <option value="overdue">Atrasado</option>
              </select>
            </FormField>
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Direção
            </label>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 dark:bg-slate-800/50 p-1.5 border border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => { vibrate([5]); setDirection("lent"); }}
                className={`h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                  direction === "lent"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:bg-white/70 dark:hover:bg-slate-700/50"
                }`}
              >
                Emprestei
              </button>
              <button
                type="button"
                onClick={() => { vibrate([5]); setDirection("borrowed"); }}
                className={`h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                  direction === "borrowed"
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:bg-white/70 dark:hover:bg-slate-700/50"
                }`}
              >
                Peguei
              </button>
            </div>
          </div>
        </FieldCard>

        <FieldCard>
          <SectionTitle 
            title="Observações" 
            description="Informações complementares para consulta futura." 
          />
          <FormField label="Observações">
            <textarea
              rows={3}
              placeholder="Detalhes extras..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 outline-none resize-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:focus:border-teal-400"
            />
          </FormField>
        </FieldCard>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#f6f7f8] dark:from-slate-950 via-[#f6f7f8]/90 dark:via-slate-950/90 to-transparent px-4 py-5">
        <button
          onClick={() => { vibrate([10, 50]); handleSave(); }}
          disabled={saving}
          className={`w-full max-w-md mx-auto text-white py-4 rounded-2xl font-semibold text-sm shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 ${accent.bg} ${accent.hover} ${accent.shadow}`}
        >
          {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
          {editId ? "Atualizar Empréstimo" : "Criar Empréstimo"}
        </button>
      </div>
    </div>
  )
}

export default function NewLoanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] dark:bg-slate-950">
        <Loader2 className="animate-spin text-teal-600" size={32} />
      </div>
    }>
      <NewLoanContent />
    </Suspense>
  )
}