'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import * as Icons from 'lucide-react'
import { ChevronLeft, Check, Loader2, X, Tag } from 'lucide-react'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import IconPicker from '@/components/IconPicker'

const COLORS = ['#14b8a6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308', '#64748b', '#000000']

function NewBudgetContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { context } = useContext_()
  const editId = searchParams.get('edit')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<any[]>([])

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('0,00')
  const [amountNum, setAmountNum] = useState(0)
  const [categoryId, setCategoryId] = useState('')
  const [color, setColor] = useState('#14b8a6')
  const [icon, setIcon] = useState('Tag') // Usando um ícone padrão no formato PascalCase
  const [period, setPeriod] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly')
  const [accumulate, setAccumulate] = useState(false)

  const [showCatModal, setShowCatModal] = useState(false)
  const [showIconModal, setShowIconModal] = useState(false)

  const loadCategories = async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('categories')
      .select('id, name, color, icon')
      .match({ user_id: user.id, context: context })
      .eq('type', 'expense')
      .is('parent_id', null)
    setCategories(Array.isArray(data) ? data : [])
  }

  const loadBudget = async () => {
    if (!editId || !user?.id) return
    setLoading(true)
    const { data } = await supabase.from('budgets').select('*').match({ id: editId, user_id: user.id }).single()
    if (data) {
      setName(data.name)
      setAmountNum(Number(data.amount))
      setAmount(Number(data.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      setCategoryId(data.category_id || '')
      setColor(data.color)
      setPeriod(data.period)
      setAccumulate(data.accumulate)
      
      // Ajuste para compatibilidade com ícones antigos em minúsculo
      if (data.icon) {
        const iconName = data.icon.charAt(0).toUpperCase() + data.icon.slice(1)
        setIcon(iconName)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCategories()
    if (editId) loadBudget()
  }, [user, context, editId])

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
    if (!user?.id || !name.trim() || amountNum <= 0) {
      alert('Preencha todos os campos obrigatórios.')
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
      icon,
      period,
      accumulate
    }

    try {
      if (editId) {
        await supabase.from('budgets').update(payload).eq('id', editId)
      } else {
        await supabase.from('budgets').insert(payload)
      }
      router.push('/budgets')
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message)
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
  
  // Renderização dinâmica do ícone selecionado
  const IconComp = (Icons as any)[icon] || Icons.Tag

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      
      {/* Header */}
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
        {/* Valor */}
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Valor do orçamento</label>
          <div className="flex items-center gap-2">
            <span className="text-xl text-gray-400 dark:text-gray-500 font-light">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0,00"
              className="text-2xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        {/* Nome */}
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

        {/* Categoria */}
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

        {/* Cor */}
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

        {/* Ícone */}
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

        {/* Período */}
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

        {/* Acumular saldo */}
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

      {/* Modal Categorias */}
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
              {categories.map(cat => {
                // Ajuste para renderizar os ícones corretos das categorias listadas
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

      {/* Novo Componente de Seleção de Ícone */}
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
