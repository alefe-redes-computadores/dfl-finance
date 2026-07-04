'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import * as Icons from 'lucide-react'
import { ChevronLeft, Check, Loader2, X, Tag } from 'lucide-react'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import IconPicker from '@/components/IconPicker'
import MoneyInput from '@/components/MoneyInput'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'

const COLORS = ['#14b8a6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308', '#64748b', '#000000']

function NewBudgetContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { context } = useContext_()
  const { showToast } = useToast()
  const editId = searchParams.get('edit')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<any[]>([])

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

  // ============================================================
  // 🔥 BUSCAS LOCAIS (INDEXEDDB)
  // ============================================================
  const { data: localCategories, reload: reloadCategories } = useLocalData({
    table: 'categories',
    filters: { context, type: 'expense', parent_id: null },
    realtime: false,
  })

  const { data: localBudget, loading: budgetLoading, reload: reloadBudget } = useLocalData({
    table: 'budgets' as any,
    filters: { id: editId || '' },
    realtime: false,
  })

  // ============================================================
  // LOAD DATA
  // ============================================================
  useEffect(() => {
    if (localCategories) {
      setCategories(localCategories)
    }
  }, [localCategories])

  useEffect(() => {
    if (editId && localBudget && localBudget.length > 0) {
      const data = localBudget[0] as any
      setName(data.name)
      const numValue = Number(data.amount) || 0
      setAmountNum(numValue)
      setAmountFormatted(numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      setCategoryId(data.category_id || '')
      setColor(data.color)
      setPeriod(data.period)
      setAccumulate(data.accumulate)

      if (data.icon) {
        const iconName = data.icon.charAt(0).toUpperCase() + data.icon.slice(1)
        setIcon(iconName)
      }
      setLoading(false)
    } else if (!editId) {
      setLoading(false)
    }
  }, [editId, localBudget])

  useEffect(() => {
    if (user?.id) {
      reloadCategories()
      if (editId) reloadBudget()
    }
  }, [user?.id, editId])

  // ============================================================
  // HANDLE SAVE
  // ============================================================
  const handleSave = async () => {
    if (!user?.id || !name.trim() || amountNum <= 0) {
      showToast('Preencha todos os campos obrigatórios.', 'warning')
      return
    }
    setSaving(true)

    const payload = {
      user_id: user.id,
      context,
      name: name.trim(),
      amount: amountNum,
      category_id: categoryId || null,
      color,
      icon: icon.toLowerCase(),
      period,
      accumulate
    }

    try {
      const { create, update } = useLocalData({ table: 'budgets' as any })
      
      if (editId) {
        await update(editId, payload)
        showToast('Orçamento atualizado!', 'success')
      } else {
        await create(payload)
        showToast('Orçamento criado!', 'success')
      }
      router.push('/budgets')
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

  const selectedCat = categories.find(c => c.id === categoryId)
  const IconComp = (Icons as any)[icon] || Icons.Tag

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">

      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{editId ? 'Editar Orçamento' : 'Novo Orçamento'}</h2>
        <button onClick={handleSave} disabled={saving} className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center">
          {saving ? <Loader2 size={20} className="text-white animate-spin" /> : <Check size={22} className="text-white" />}
        </button>
      </div>

      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Valor do orçamento</label>
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

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Nome</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Alimentação, Moradia..."
            className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"
          />
        </div>

        <button
          onClick={() => setShowCatModal(true)}
          className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Tag size={18} className="text-gray-400 dark:text-gray-500" />
            <div className="text-left">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider block">Categoria</span>
              <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{selectedCat ? selectedCat.name : 'Todas as categorias'}</span>
            </div>
          </div>
          <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
        </button>

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

        <button
          onClick={() => setShowIconModal(true)}
          className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20`, color: color }}>
              <IconComp size={18} />
            </div>
            <div className="text-left">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider block">Ícone</span>
              <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{icon}</span>
            </div>
          </div>
          <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
        </button>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-3 block">Período</label>
          <div className="flex gap-2">
            {[
              { key: 'monthly' as const, label: 'Mensal' },
              { key: 'biweekly' as const, label: 'Quinzenal' },
              { key: 'weekly' as const, label: 'Semanal' }
            ].map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${
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

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Acumular saldo</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">O valor não gasto acumula para o mês seguinte</p>
          </div>
          <button
            onClick={() => setAccumulate(!accumulate)}
            className={`w-11 h-6 rounded-full relative transition-colors ${accumulate ? 'bg-teal-700' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${accumulate ? 'right-1' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Categorias</h3>
              <button onClick={() => setShowCatModal(false)} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setCategoryId(''); setShowCatModal(false) }}
                className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${!categoryId ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200 dark:bg-slate-700 text-gray-400">
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
                    onClick={() => { setCategoryId(cat.id); setShowCatModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
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