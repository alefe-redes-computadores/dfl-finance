'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import * as Icons from 'lucide-react'
import { ChevronLeft, Check, Loader2, X, Tag } from 'lucide-react'
import { ContextProvider, useContext_ } from '@/components/ContextToggle'
import IconPicker from '@/components/IconPicker'
import MoneyInput from '@/components/MoneyInput'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'

const COLORS = ['#14b8a6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308', '#64748b', '#000000']

function lightTap() {
  if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
}

function safeNum(val: any): number {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

function NewBudgetContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { context } = useContext_()
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { safeAdd, safeUpdate } = useSafeDb()
  const editId = searchParams.get('edit')

  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const [name, setName] = useState('')
  const [amountNum, setAmountNum] = useState(0)
  const [amountFormatted, setAmountFormatted] = useState('0,00')
  const [categoryId, setCategoryId] = useState('')
  const [color, setColor] = useState('#14b8a6')
  const [icon, setIcon] = useState('Tag')
  const [period, setPeriod] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly')
  const [accumulate, setAccumulate] = useState(false)

  const [showCatModal, setShowCatModal] = useState(false)
  const [showIconModal, setShowIconModal] = useState(false)

  // 🔒 Local-First: leitura sempre via useLocalData
  const { data: localCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context, type: 'expense', parent_id: null },
  })
  const categories = localCategories || []

  const { data: localBudget, loading: budgetLoading } = useLocalData({
    table: 'budgets' as any,
    filters: { id: editId || '' },
  })

  useEffect(() => {
    if (!editId) {
      setInitialized(true)
      return
    }
    if (!budgetLoading && !initialized && localBudget && localBudget.length > 0) {
      const data = localBudget[0] as any
      setName(data.name || '')
      const numValue = safeNum(data.amount)
      setAmountNum(numValue)
      setAmountFormatted(numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      setCategoryId(data.category_id || '')
      setColor(data.color || '#14b8a6')
      setPeriod(data.period || 'monthly')
      setAccumulate(!!data.accumulate)

      if (data.icon) {
        const iconName = data.icon.charAt(0).toUpperCase() + data.icon.slice(1)
        setIcon(iconName)
      }
      setInitialized(true)
    }
  }, [editId, budgetLoading, localBudget, initialized])

  // 🔥 Blindagem + Local-First: safeAdd/safeUpdate cuidam da atomicidade e da fila de sync
  const handleSave = async () => {
    if (!user?.id || !(name || '').trim() || amountNum <= 0) {
      showToast('Preencha todos os campos obrigatórios.', 'warning')
      errorHaptic()
      return
    }
    setSaving(true)

    const payload = {
      name: name.trim(),
      amount: amountNum,
      category_id: categoryId || null,
      color,
      icon: icon.toLowerCase(),
      period,
      accumulate,
      context,
      updated_at: new Date().toISOString(),
    }

    try {
      if (editId) {
        const result = await safeUpdate('budgets', editId, payload)
        if (!result.success) throw new Error(result.error)
        showToast('Orçamento atualizado!', 'success')
      } else {
        const id = crypto.randomUUID()
        const fullPayload = {
          id,
          user_id: user.id,
          ...payload,
          spent: 0,
          remaining: amountNum,
          percent: 0,
          status: 'active',
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        const result = await safeAdd('budgets', fullPayload)
        if (!result.success) throw new Error(result.error)
        showToast('Orçamento criado!', 'success')
      }
      success()
      router.push('/budgets')
    } catch (err: any) {
      showToast(`Erro ao salvar: ${err.message}`, 'error')
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }

  if (!initialized) return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900 px-4 pt-6">
      <div className="max-w-md mx-auto space-y-4 animate-pulse">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 rounded-[16px] bg-gray-200 dark:bg-slate-700" />
          <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700" />
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 rounded-[24px] bg-white dark:bg-slate-800 border border-gray-50 dark:border-slate-700" />
        ))}
      </div>
    </div>
  )

  const selectedCat = categories.find((c: any) => c.id === categoryId)
  const IconComp = (Icons as any)[icon] || Icons.Tag

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">

      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => { lightTap(); router.back() }}
          className="p-2 -ml-2 rounded-[16px] text-gray-800 dark:text-gray-200 transition-all active:scale-[0.98]"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{editId ? 'Editar Orçamento' : 'Novo Orçamento'}</h2>
        <button
          onClick={() => { lightTap(); handleSave() }}
          disabled={saving}
          className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center shadow-lg shadow-teal-600/30 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? <Loader2 size={20} className="text-white animate-spin" /> : <Check size={22} className="text-white" />}
        </button>
      </div>

      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Valor do orçamento</label>
          <div className="flex items-center gap-2">
            <span className="text-xl text-gray-400 dark:text-gray-500 font-light">R$</span>
            <MoneyInput
              value={amountNum}
              onChange={(num, formatted) => {
                setAmountNum(num)
                setAmountFormatted(formatted)
              }}
              className="text-2xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Nome</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Alimentação, Moradia..."
            className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"
          />
        </div>

        <button
          onClick={() => { lightTap(); setShowCatModal(true) }}
          className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <Tag size={18} className="text-gray-400 dark:text-gray-500" />
            <div className="text-left">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest block">Categoria</span>
              <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{selectedCat ? selectedCat.name : 'Todas as categorias'}</span>
            </div>
          </div>
          <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
        </button>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-3 block">Cor</label>
          <div className="flex flex-wrap gap-3">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => { lightTap(); setColor(c) }}
                className={`w-9 h-9 rounded-full transition-all active:scale-[0.98] ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-gray-400' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={() => { lightTap(); setShowIconModal(true) }}
          className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[14px] flex items-center justify-center" style={{ backgroundColor: `${color}20`, color: color }}>
              <IconComp size={18} />
            </div>
            <div className="text-left">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest block">Ícone</span>
              <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{icon}</span>
            </div>
          </div>
          <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
        </button>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-3 block">Período</label>
          <div className="flex gap-2">
            {[
              { key: 'monthly' as const, label: 'Mensal' },
              { key: 'biweekly' as const, label: 'Quinzenal' },
              { key: 'weekly' as const, label: 'Semanal' }
            ].map(p => (
              <button
                key={p.key}
                onClick={() => { lightTap(); setPeriod(p.key) }}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-all active:scale-[0.98] ${
                  period === p.key
                    ? 'bg-teal-700 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Acumular saldo</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">O valor não gasto acumula para o mês seguinte</p>
          </div>
          <button
            onClick={() => { lightTap(); setAccumulate(!accumulate) }}
            className={`w-11 h-6 rounded-full relative transition-all active:scale-[0.98] ${accumulate ? 'bg-teal-700' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${accumulate ? 'right-1' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* Botão flutuante fixo no rodapé */}
      <div className="fixed bottom-20 left-0 right-0 px-4 z-20">
        <button
          onClick={() => { lightTap(); handleSave() }}
          disabled={saving}
          className="w-full py-4 rounded-[28px] bg-teal-700 hover:bg-teal-800 text-white font-black text-base shadow-xl shadow-teal-600/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
          {editId ? 'Atualizar Orçamento' : 'Criar Orçamento'}
        </button>
      </div>

      {/* Bottom Sheet: seleção de categoria */}
      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCatModal(false)}>
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl w-full max-w-lg rounded-t-[32px] p-5 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-8 duration-300" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Categorias</h3>
              <button onClick={() => setShowCatModal(false)} className="text-gray-400 dark:text-gray-500 p-2 rounded-full transition-all active:scale-[0.98]"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { lightTap(); setCategoryId(''); setShowCatModal(false) }}
                className={`w-full p-3 flex items-center gap-4 rounded-[20px] transition-all active:scale-[0.98] ${!categoryId ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                <div className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-gray-200 dark:bg-slate-700 text-gray-400">
                  <Tag size={20} />
                </div>
                <span className={`flex-1 text-left font-medium ${!categoryId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Todas as categorias</span>
                {!categoryId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>
              {categories.map((cat: any) => {
                const catIconName = cat.icon ? cat.icon.charAt(0).toUpperCase() + cat.icon.slice(1) : 'Tag'
                const CatIconComp = (Icons as any)[catIconName] || Icons.Tag
                const isActive = cat.id === categoryId

                return (
                  <button
                    key={cat.id}
                    onClick={() => { lightTap(); setCategoryId(cat.id); setShowCatModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-[20px] transition-all active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-10 h-10 rounded-[14px] flex items-center justify-center" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                      <CatIconComp size={20} />
                    </div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{cat.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <IconPicker
        isOpen={showIconModal}
        onClose={() => setShowIconModal(false)}
        selectedIcon={icon}
        onSelect={setIcon}
      />

    </div>
  )
}

export default function NewBudgetPage() {
  return (
    <ContextProvider>
      <NewBudgetContent />
    </ContextProvider>
  )
}
