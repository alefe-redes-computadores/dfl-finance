'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Loader2, Check, ArrowRightLeft, Building2, User, Calendar,
} from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '@/contexts/ToastContext'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'

export default function NewLoanPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [sourceContext, setSourceContext] = useState(context === 'dfl' ? 'personal' : 'dfl')
  const [destContext, setDestContext] = useState(context === 'dfl' ? 'dfl' : 'personal')
  const [amount, setAmount] = useState('0,00')
  const [amountNum, setAmountNum] = useState(0)
  const [installments, setInstallments] = useState(1)
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setAmount('0,00')
      setAmountNum(0)
      return
    }
    const num = parseFloat(digits) / 100
    setAmountNum(num)
    setAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handleSave = async () => {
    if (!user?.id) { showToast('Sessão expirada.', 'error'); return }
    if (amountNum <= 0) { showToast('Informe um valor válido.', 'warning'); return }
    if (sourceContext === destContext) { showToast('Origem e destino devem ser diferentes.', 'warning'); return }

    setSaving(true)

    try {
      const { error } = await supabase
        .from('loans')
        .insert({
          user_id: user.id,
          source_context: sourceContext,
          dest_context: destContext,
          total_amount: amountNum,
          remaining_amount: amountNum,
          total_installments: installments,
          paid_installments: 0,
          due_date: dueDate,
          status: 'active',
          description: description || null,
        })

      if (error) throw error

      showToast('Empréstimo criado com sucesso!', 'success')
      router.push('/loans')
    } catch (err: any) {
      showToast(`Erro ao criar: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const getContextLabel = (ctx: string) => ctx === 'dfl' ? 'PJ' : 'PF'
  const getContextIcon = (ctx: string) =>
    ctx === 'dfl' ? <Building2 size={16} className="text-blue-500" /> : <User size={16} className="text-emerald-500" />

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-24 font-sans transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Novo Empréstimo</h1>
          <div className="w-10" />
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Card de contexto */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700">
          <p className="text-xs font-bold text-gray-500 uppercase block mb-4">Fluxo do empréstimo</p>

          {/* Origem */}
          <div className="mb-4">
            <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Origem (quem empresta)</label>
            <div className="flex gap-2">
              {(['dfl', 'personal'] as const).map(ctx => (
                <button
                  key={ctx}
                  onClick={() => {
                    setSourceContext(ctx)
                    if (ctx === destContext) setDestContext(ctx === 'dfl' ? 'personal' : 'dfl')
                  }}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    sourceContext === ctx
                      ? 'bg-teal-50 dark:bg-teal-900/30 border-2 border-teal-500 text-teal-700 dark:text-teal-400'
                      : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 border-2 border-transparent'
                  }`}
                >
                  {getContextIcon(ctx)}
                  {getContextLabel(ctx)}
                </button>
              ))}
            </div>
          </div>

          {/* Seta */}
          <div className="flex justify-center mb-4">
            <ArrowRightLeft size={20} className="text-gray-400" />
          </div>

          {/* Destino */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Destino (quem recebe)</label>
            <div className="flex gap-2">
              {(['dfl', 'personal'] as const).map(ctx => (
                <button
                  key={ctx}
                  onClick={() => {
                    setDestContext(ctx)
                    if (ctx === sourceContext) setSourceContext(ctx === 'dfl' ? 'personal' : 'dfl')
                  }}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    destContext === ctx
                      ? 'bg-teal-50 dark:bg-teal-900/30 border-2 border-teal-500 text-teal-700 dark:text-teal-400'
                      : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 border-2 border-transparent'
                  }`}
                >
                  {getContextIcon(ctx)}
                  {getContextLabel(ctx)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Valor */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Valor total</label>
          <div className="flex items-center gap-1 text-2xl font-bold">
            <span className="text-gray-400">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={handleAmountChange}
              className="bg-transparent outline-none w-full text-gray-800 dark:text-gray-200"
              placeholder="0,00"
            />
          </div>
        </div>

        {/* Parcelas */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-3">Número de parcelas</label>
          <select
            value={installments}
            onChange={(e) => setInstallments(Number(e.target.value))}
            className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl p-3 text-sm font-bold outline-none text-gray-800 dark:text-gray-200"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
              <option key={n} value={n}>{n}x</option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-2">
            {installments > 1
              ? `Valor da parcela: R$ ${(amountNum / installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : 'Pagamento único'}
          </p>
        </div>

        {/* Vencimento */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Data de vencimento</label>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
            <Calendar size={18} className="text-gray-400" />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        {/* Descrição */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Descrição (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Empréstimo para pagar fornecedor"
            className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200"
          />
        </div>

        {/* Botão salvar */}
        <button
          onClick={handleSave}
          disabled={saving || amountNum <= 0}
          className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold disabled:opacity-50 hover:bg-teal-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-teal-700/20 active:scale-[0.98]"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
          {saving ? 'Criando...' : 'Criar Empréstimo'}
        </button>
      </div>
    </div>
  )
}
