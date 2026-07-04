'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Check, Loader2, X, ArrowRightLeft,
  Calendar, DollarSign, Building2, User, Users
} from 'lucide-react'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'

function NewLoanContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { context, appMode } = useContext_()
  const { showToast } = useToast()
  const editId = searchParams.get('edit')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('0,00')
  const [totalAmountNum, setTotalAmountNum] = useState(0)
  const [installments, setInstallments] = useState('1')
  const [dueDate, setDueDate] = useState('')
  const [sourceContext, setSourceContext] = useState<'dfl' | 'personal'>('dfl')
  const [destContext, setDestContext] = useState<'dfl' | 'personal'>('personal')

  // ============================================================
  // 🔥 BUSCA LOCAL PARA EDIÇÃO
  // ============================================================
  const { data: localLoan, loading: loanLoading, reload: reloadLoan } = useLocalData({
    table: 'loans',
    filters: { id: editId || '' },
    realtime: false,
  })

  useEffect(() => {
    if (editId && localLoan && localLoan.length > 0) {
      const data = localLoan[0]
      setDescription(data.description || '')
      const numValue = Number(data.total_amount) || 0
      setTotalAmountNum(numValue)
      setTotalAmount(numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      setInstallments(String(data.total_installments || 1))
      setDueDate(data.due_date || '')
      setSourceContext(data.source_context || 'dfl')
      setDestContext(data.dest_context || 'personal')
      setLoading(false)
    } else if (!editId) {
      setLoading(false)
    }
  }, [editId, localLoan])

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setTotalAmount('0,00')
      setTotalAmountNum(0)
      return
    }
    const num = parseFloat(digits) / 100
    setTotalAmountNum(num)
    setTotalAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handleSave = async () => {
    if (!user?.id || totalAmountNum <= 0 || !dueDate) {
      showToast('Preencha todos os campos obrigatórios.', 'warning')
      return
    }

    if (sourceContext === destContext) {
      showToast('Os contextos devem ser diferentes.', 'warning')
      return
    }

    setSaving(true)

    const payload = {
      user_id: user.id,
      source_context: sourceContext,
      dest_context: destContext,
      total_amount: totalAmountNum,
      remaining_amount: totalAmountNum,
      paid_amount: 0,
      total_installments: parseInt(installments),
      paid_installments: 0,
      due_date: dueDate,
      description: description || null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      const { create, update } = useLocalData({ table: 'loans' })
      
      if (editId) {
        await update(editId, payload)
        showToast('Empréstimo atualizado!', 'success')
      } else {
        await create(payload)
        showToast('Empréstimo criado!', 'success')
      }
      router.push('/loans')
    } catch (err: any) {
      showToast(`Erro ao salvar: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
      <Loader2 className="animate-spin text-teal-700" size={40} />
    </div>
  )

  if (appMode === 'personal_only') {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">Novo Empréstimo</h2>
        </div>
        <div className="text-center py-20">
          <ArrowRightLeft size={56} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Modo Apenas PF</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[280px] mx-auto">
            Empréstimos entre contextos (PF e PJ) só estão disponíveis no modo completo.
          </p>
          <button onClick={() => router.push('/more')} className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors">
            Ativar modo PF e PJ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">

      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{editId ? 'Editar Empréstimo' : 'Novo Empréstimo'}</h2>
        <button onClick={handleSave} disabled={saving} className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center">
          {saving ? <Loader2 size={20} className="text-white animate-spin" /> : <Check size={22} className="text-white" />}
        </button>
      </div>

      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Valor total</label>
          <div className="flex items-center gap-2">
            <span className="text-xl text-gray-400 dark:text-gray-500 font-light">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={totalAmount}
              onChange={handleAmountChange}
              placeholder="0,00"
              className="text-2xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Descrição (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ex: Empréstimo para equipamentos"
            className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Data de vencimento</label>
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-gray-400 dark:text-gray-500" />
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Número de parcelas</label>
          <div className="flex items-center gap-3">
            <DollarSign size={18} className="text-gray-400 dark:text-gray-500" />
            <input
              type="number"
              min="1"
              max="60"
              value={installments}
              onChange={e => setInstallments(e.target.value)}
              className="bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none w-16"
            />
            <span className="text-[14px] text-gray-400">parcelas</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-3 block">Contextos</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 dark:text-gray-500 block mb-1">Origem</label>
              <div className="flex gap-2">
                {(['dfl', 'personal'] as const).map(ctx => (
                  <button
                    key={ctx}
                    onClick={() => setSourceContext(ctx)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                      sourceContext === ctx
                        ? 'bg-teal-700 text-white'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {ctx === 'dfl' ? <Building2 size={14} /> : <User size={14} />}
                    {ctx === 'dfl' ? 'PJ' : 'PF'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 dark:text-gray-500 block mb-1">Destino</label>
              <div className="flex gap-2">
                {(['dfl', 'personal'] as const).map(ctx => (
                  <button
                    key={ctx}
                    onClick={() => setDestContext(ctx)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                      destContext === ctx
                        ? 'bg-teal-700 text-white'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {ctx === 'dfl' ? <Building2 size={14} /> : <User size={14} />}
                    {ctx === 'dfl' ? 'PJ' : 'PF'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {sourceContext === destContext && (
            <p className="text-[10px] text-red-500 mt-2">Os contextos devem ser diferentes.</p>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-slate-700 rounded-[20px] p-4 border border-gray-100 dark:border-slate-600">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium text-center">
            💡 {sourceContext === 'dfl' ? 'PJ' : 'PF'} → {destContext === 'dfl' ? 'PJ' : 'PF'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function NewLoanPage() {
  return (
    <ContextProvider>
      <NewLoanContent />
    </ContextProvider>
  )
}