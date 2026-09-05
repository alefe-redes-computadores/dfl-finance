// src/components/ModalEmprestimo.tsx
'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, HandCoins, Loader2, Percent, User, X } from 'lucide-react'
import MoneyInput from '@/components/MoneyInput'
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

interface ModalEmprestimoProps {
  isOpen: boolean
  onClose: () => void
  onSave: (id: string) => void
}

export default function ModalEmprestimo({ isOpen, onClose, onSave }: ModalEmprestimoProps) {
  const { user } = useAuth()
  const { context, appMode } = useContext_()
  const { safeAdd } = useSafeDb()
  const { showToast } = useToast()
  const { vibrate, success, error: hapticError } = useHapticFeedback()

  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  const [saving, setSaving] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [direction, setDirection] = useState<'lent' | 'borrowed'>('lent')
  const [lender, setLender] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [loanContext, setLoanContext] = useState<'dfl' | 'personal'>('dfl')

  useEffect(() => {
    if (!isOpen) return
    setDescription('')
    setAmount(0)
    setDirection('lent')
    setLender('')
    setDate(new Date().toISOString().split('T')[0])
    setDueDate('')
    setInterestRate('')
    setLoanContext(effectiveContext)
  }, [isOpen, effectiveContext])

  const close = () => {
    if (saving) return
    vibrate([5])
    onClose()
  }

  const handleSave = async () => {
    if (!user?.id) {
      hapticError()
      showToast('Sessão expirada. Entre novamente.', 'error')
      return
    }
    if (!description.trim()) {
      hapticError()
      showToast('Informe uma descrição para o empréstimo.', 'warning')
      return
    }
    if (amount <= 0) {
      hapticError()
      showToast('Informe um valor maior que zero.', 'warning')
      return
    }

    const parsedInterest = interestRate.trim() ? Number(interestRate.replace(',', '.')) : null
    if (parsedInterest !== null && (!Number.isFinite(parsedInterest) || parsedInterest < 0)) {
      hapticError()
      showToast('Informe uma taxa de juros válida.', 'warning')
      return
    }

    setSaving(true)
    try {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const result = await safeAdd('loans', {
        id,
        user_id: user.id,
        context: loanContext,
        description: description.trim(),
        amount,
        remaining_amount: amount,
        direction,
        lender: lender.trim() || null,
        date,
        due_date: dueDate || null,
        interest_rate: parsedInterest,
        status: 'active',
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
        sync_attempts: 0,
      })

      if (!result.success) throw new Error(result.error || 'Falha ao criar empréstimo')

      success()
      showToast('Empréstimo criado e vinculado à transação.', 'success')
      onSave(id)
      onClose()
    } catch (err: any) {
      hapticError()
      showToast(`Não foi possível criar o empréstimo: ${err?.message || 'erro desconhecido'}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center" onClick={close}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Novo empréstimo"
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-[32px] bg-[#f6f7f8] dark:bg-slate-900 p-5 pb-8 shadow-[0_-16px_50px_rgba(0,0,0,0.18)] animate-in slide-in-from-bottom-8 duration-300"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <HandCoins size={21} />
            </div>
            <h2 className="text-[22px] font-black tracking-tight text-gray-900 dark:text-white">Novo empréstimo</h2>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">Crie o registro e vincule esta transação ao empréstimo.</p>
          </div>
          <button onClick={close} disabled={saving} aria-label="Fechar" className="h-10 w-10 rounded-full bg-white dark:bg-slate-800 border border-black/5 dark:border-white/10 text-gray-500 flex items-center justify-center active:scale-95 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <section className="rounded-[24px] border border-black/5 dark:border-white/10 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-gray-400">Tipo</p>
            <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-gray-100 dark:bg-slate-900 p-1">
              <button onClick={() => { vibrate([5]); setDirection('lent') }} className={`h-11 rounded-[15px] text-[13px] font-bold transition-all ${direction === 'lent' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Eu emprestei</button>
              <button onClick={() => { vibrate([5]); setDirection('borrowed') }} className={`h-11 rounded-[15px] text-[13px] font-bold transition-all ${direction === 'borrowed' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Eu peguei</button>
            </div>
          </section>

          <section className="rounded-[24px] border border-black/5 dark:border-white/10 bg-white dark:bg-slate-800 p-4 shadow-sm space-y-4">
            <label className="block">
              <span className="mb-2 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">Descrição</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Empréstimo para capital de giro" className="h-12 w-full rounded-[16px] border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-4 text-[14px] font-semibold text-gray-900 dark:text-white outline-none focus:border-teal-500" />
            </label>

            <label className="block">
              <span className="mb-2 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">Valor</span>
              <div className="h-12 rounded-[16px] border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-4 flex items-center">
                <MoneyInput value={amount} onChange={setAmount} placeholder="0,00" className="w-full bg-transparent outline-none text-[16px] font-black text-gray-900 dark:text-white" />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 dark:text-gray-400"><User size={13} />{direction === 'lent' ? 'Quem pegou?' : 'Quem emprestou?'}</span>
              <input value={lender} onChange={(e) => setLender(e.target.value)} placeholder="Pessoa ou empresa" className="h-12 w-full rounded-[16px] border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-4 text-[14px] font-semibold text-gray-900 dark:text-white outline-none focus:border-teal-500" />
            </label>
          </section>

          <section className="rounded-[24px] border border-black/5 dark:border-white/10 bg-white dark:bg-slate-800 p-4 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 dark:text-gray-400"><CalendarDays size={13} />Data</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 w-full rounded-[16px] border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-3 text-[13px] font-semibold text-gray-900 dark:text-white outline-none" />
              </label>
              <label>
                <span className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 dark:text-gray-400"><CalendarDays size={13} />Vencimento</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-12 w-full rounded-[16px] border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-3 text-[13px] font-semibold text-gray-900 dark:text-white outline-none" />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 dark:text-gray-400"><Percent size={13} />Juros (%)</span>
              <input inputMode="decimal" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="0" className="h-12 w-full rounded-[16px] border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-4 text-[14px] font-semibold text-gray-900 dark:text-white outline-none focus:border-teal-500" />
            </label>
          </section>

          {appMode !== 'personal_only' && (
            <section className="rounded-[24px] border border-black/5 dark:border-white/10 bg-white dark:bg-slate-800 p-4 shadow-sm">
              <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-gray-400">Contexto</p>
              <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-gray-100 dark:bg-slate-900 p-1">
                {(['dfl', 'personal'] as const).map((item) => (
                  <button key={item} onClick={() => { vibrate([5]); setLoanContext(item) }} className={`h-10 rounded-[15px] text-[13px] font-bold transition-all ${loanContext === item ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>{item === 'dfl' ? 'Empresa' : 'Pessoal'}</button>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="mt-5 rounded-[24px] border border-teal-100 bg-teal-50/80 p-4 dark:border-teal-800/40 dark:bg-teal-900/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">Resumo</p>
              <p className="mt-1 text-[13px] font-semibold text-gray-700 dark:text-gray-200">{direction === 'lent' ? 'Valor a receber' : 'Valor a pagar'}</p>
            </div>
            <p className="text-[20px] font-black text-teal-700 dark:text-teal-300">{amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
        </div>

        <button onClick={() => { vibrate([10]); handleSave() }} disabled={saving} className="mt-4 h-14 w-full rounded-[20px] bg-teal-600 hover:bg-teal-700 text-white font-black text-[15px] shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60">
          {saving ? <Loader2 size={20} className="animate-spin" /> : <HandCoins size={19} />}
          {saving ? 'Salvando...' : 'Criar e vincular'}
        </button>
      </div>
    </div>
  )
}
