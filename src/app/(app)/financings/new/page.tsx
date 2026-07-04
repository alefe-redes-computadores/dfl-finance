'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Check, Loader2, X, Home, Car, Briefcase, Calendar, DollarSign, Tag } from 'lucide-react'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'

const COLORS = ['#14b8a6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308', '#64748b', '#000000']
const ICON_NAMES = ['home', 'car', 'briefcase', 'shopping-bag', 'laptop', 'heart', 'gift', 'trending-up', 'zap', 'target']

function NewFinancingContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { context } = useContext_()
  const { showToast } = useToast()
  const editId = searchParams.get('edit')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [totalAmount, setTotalAmount] = useState('0,00')
  const [totalAmountNum, setTotalAmountNum] = useState(0)
  const [installmentValue, setInstallmentValue] = useState('0,00')
  const [installmentValueNum, setInstallmentValueNum] = useState(0)
  const [totalInstallments, setTotalInstallments] = useState('')
  const [startDate, setStartDate] = useState('')
  const [icon, setIcon] = useState('home')
  const [color, setColor] = useState('#14b8a6')
  const [description, setDescription] = useState('')

  // ============================================================
  // 🔥 BUSCA LOCAL PARA EDIÇÃO
  // ============================================================
  const { data: localFinancing, loading: financingLoading, reload: reloadFinancing } = useLocalData({
    table: 'financings',
    filters: { id: editId || '' },
    realtime: false,
  })

  useEffect(() => {
    if (editId && localFinancing && localFinancing.length > 0) {
      const data = localFinancing[0]
      setName(data.name || '')
      const totalNum = Number(data.total_amount) || 0
      setTotalAmountNum(totalNum)
      setTotalAmount(totalNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      const installNum = Number(data.installment_value) || 0
      setInstallmentValueNum(installNum)
      setInstallmentValue(installNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      setTotalInstallments(String(data.total_installments || ''))
      setStartDate(data.start_date || '')
      setIcon(data.icon || 'home')
      setColor(data.color || '#14b8a6')
      setDescription(data.description || '')
      setLoading(false)
    } else if (!editId) {
      setLoading(false)
    }
  }, [editId, localFinancing])

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (num: number) => void, displaySetter: (val: string) => void) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      displaySetter('0,00')
      setter(0)
      return
    }
    const num = parseFloat(digits) / 100
    setter(num)
    displaySetter(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handleSave = async () => {
    if (!user?.id || !name.trim() || totalAmountNum <= 0 || installmentValueNum <= 0 || !totalInstallments || !startDate) {
      showToast('Preencha todos os campos obrigatórios.', 'warning')
      return
    }

    const totalInstall = parseInt(totalInstallments)
    if (totalInstall <= 0) {
      showToast('Número de parcelas inválido.', 'warning')
      return
    }

    setSaving(true)

    const payload = {
      user_id: user.id,
      context,
      name: name.trim(),
      total_amount: totalAmountNum,
      installment_value: installmentValueNum,
      total_installments: totalInstall,
      current_installment: 0,
      start_date: startDate,
      next_due_date: startDate,
      icon,
      color,
      description: description || null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      const { create, update } = useLocalData({ table: 'financings' })
      
      if (editId) {
        await update(editId, payload)
        showToast('Financiamento atualizado!', 'success')
      } else {
        await create(payload)
        showToast('Financiamento criado!', 'success')
      }
      router.push('/financings')
    } catch (err: any) {
      showToast(`Erro ao salvar: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
      <Loader2 className="animate-spin text-teal-700" size={40} />
    </div>
  )

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">

      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{editId ? 'Editar Financiamento' : 'Novo Financiamento'}</h2>
        <button onClick={handleSave} disabled={saving} className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center">
          {saving ? <Loader2 size={20} className="text-white animate-spin" /> : <Check size={22} className="text-white" />}
        </button>
      </div>

      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Nome</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Financiamento do Carro"
            className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Valor total</label>
          <div className="flex items-center gap-2">
            <span className="text-xl text-gray-400 dark:text-gray-500 font-light">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={totalAmount}
              onChange={(e) => handleAmountChange(e, setTotalAmountNum, setTotalAmount)}
              placeholder="0,00"
              className="text-2xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Valor da parcela</label>
          <div className="flex items-center gap-2">
            <span className="text-xl text-gray-400 dark:text-gray-500 font-light">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={installmentValue}
              onChange={(e) => handleAmountChange(e, setInstallmentValueNum, setInstallmentValue)}
              placeholder="0,00"
              className="text-2xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Número de parcelas</label>
          <div className="flex items-center gap-3">
            <Tag size={18} className="text-gray-400 dark:text-gray-500" />
            <input
              type="number"
              min="1"
              max="360"
              value={totalInstallments}
              onChange={e => setTotalInstallments(e.target.value)}
              className="bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none w-16"
            />
            <span className="text-[14px] text-gray-400">parcelas</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Data de início</label>
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-gray-400 dark:text-gray-500" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-3">Ícone</p>
          <div className="flex flex-wrap gap-3">
            {ICON_NAMES.map(iconName => {
              const Ico = getDynamicIcon(iconName)
              const isSelected = icon === iconName
              return (
                <button
                  key={iconName}
                  onClick={() => setIcon(iconName)}
                  className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all ${isSelected ? 'scale-110 shadow-md' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                  style={isSelected ? { backgroundColor: `${color}20`, color: color } : { backgroundColor: '#f9fafb', color: '#9ca3af' }}
                >
                  <Ico size={22} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-3 block">Cor</label>
          <div className="flex flex-wrap gap-3">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-9 h-9 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-gray-400' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Descrição (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Detalhes sobre o financiamento..."
            className="w-full bg-transparent text-[14px] text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-400"
          />
        </div>
      </div>
    </div>
  )
}

export default function NewFinancingPage() {
  return (
    <ContextProvider>
      <NewFinancingContent />
    </ContextProvider>
  )
}