'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Check, Loader2, X, Target, Calendar, DollarSign } from 'lucide-react'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'

const COLORS = ['#14b8a6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308', '#64748b', '#000000']
const ICON_NAMES = ['target', 'piggy-bank', 'wallet', 'trending-up', 'home', 'car', 'graduation-cap', 'heart', 'briefcase', 'gift', 'shopping-bag', 'zap']

function NewGoalContent() {
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
  const [targetAmount, setTargetAmount] = useState('0,00')
  const [targetAmountNum, setTargetAmountNum] = useState(0)
  const [deadline, setDeadline] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [color, setColor] = useState('#14b8a6')
  const [icon, setIcon] = useState('target')
  const [initialContribution, setInitialContribution] = useState('0,00')
  const [initialContributionNum, setInitialContributionNum] = useState(0)
  const [description, setDescription] = useState('')

  const [showCatModal, setShowCatModal] = useState(false)
  const [showIconModal, setShowIconModal] = useState(false)

  // ============================================================
  // 🔥 BUSCAS LOCAIS (INDEXEDDB)
  // ============================================================
  const { data: localCategories, reload: reloadCategories } = useLocalData({
    table: 'categories',
    filters: { context },
    realtime: false,
  })

  const { data: localGoal, loading: goalLoading, reload: reloadGoal } = useLocalData({
    table: 'goals',
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
    if (editId && localGoal && localGoal.length > 0) {
      const data = localGoal[0]
      setName(data.name)
      const numValue = Number(data.target_amount) || 0
      setTargetAmountNum(numValue)
      setTargetAmount(numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      setDeadline(data.deadline || '')
      setCategoryId(data.category_id || '')
      setColor(data.color)
      setIcon(data.icon || 'target')
      setDescription(data.description || '')
      setLoading(false)
    } else if (!editId) {
      setLoading(false)
    }
  }, [editId, localGoal])

  useEffect(() => {
    if (user?.id) {
      reloadCategories()
      if (editId) reloadGoal()
    }
  }, [user?.id, editId])

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
    if (!user?.id || !name.trim() || targetAmountNum <= 0 || !deadline) {
      showToast('Preencha todos os campos obrigatórios.', 'warning')
      return
    }
    setSaving(true)

    const payload = {
      user_id: user.id,
      context,
      name: name.trim(),
      target_amount: targetAmountNum,
      deadline,
      category_id: categoryId || null,
      color,
      icon,
      description: description || null,
      status: 'active',
    }

    try {
      const { create, update } = useLocalData({ table: 'goals' })
      
      let goalId: string | undefined
      if (editId) {
        await update(editId, payload)
        goalId = editId
        showToast('Meta atualizada!', 'success')
      } else {
        const result = await create(payload)
        goalId = result?.id
        showToast('Meta criada!', 'success')
      }

      // Se houver contribuição inicial, registrar
      if (initialContributionNum > 0 && goalId) {
        const { create: createTx } = useLocalData({ table: 'transactions' })
        await createTx({
          user_id: user.id,
          context,
          type: 'income',
          amount: initialContributionNum,
          description: `Contribuição inicial para ${name.trim()}`,
          date: format(new Date(), 'yyyy-MM-dd'),
          status: 'done',
          affects_balance: true,
          goal_id: goalId,
        })
      }

      router.push('/goals')
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

  const selectedCat = categories.find((c: any) => c.id === categoryId)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">

      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{editId ? 'Editar Meta' : 'Nova Meta'}</h2>
        <button onClick={handleSave} disabled={saving} className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center">
          {saving ? <Loader2 size={20} className="text-white animate-spin" /> : <Check size={22} className="text-white" />}
        </button>
      </div>

      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Nome da meta</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Viagem para Orlando"
            className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Valor da meta</label>
          <div className="flex items-center gap-2">
            <span className="text-xl text-gray-400 dark:text-gray-500 font-light">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={targetAmount}
              onChange={(e) => handleAmountChange(e, setTargetAmountNum, setTargetAmount)}
              placeholder="0,00"
              className="text-2xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Data limite</label>
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-gray-400 dark:text-gray-500" />
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none"
            />
          </div>
        </div>

        <button
          onClick={() => setShowCatModal(true)}
          className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Target size={18} className="text-gray-400 dark:text-gray-500" />
            <div className="text-left">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider block">Categoria</span>
              <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{selectedCat ? selectedCat.name : 'Geral'}</span>
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
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Descrição (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Detalhes sobre a meta..."
            className="w-full bg-transparent text-[14px] text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-400"
          />
        </div>

        {!editId && (
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Contribuição inicial (opcional)</label>
            <div className="flex items-center gap-2">
              <span className="text-xl text-gray-400 dark:text-gray-500 font-light">R$</span>
              <input
                type="text"
                inputMode="numeric"
                value={initialContribution}
                onChange={(e) => handleAmountChange(e, setInitialContributionNum, setInitialContribution)}
                placeholder="0,00"
                className="text-2xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Valor já guardado para esta meta.</p>
          </div>
        )}
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
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200 dark:bg-slate-700 text-gray-400"><Target size={20} /></div>
                <span className={`flex-1 text-left font-medium ${!categoryId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Geral</span>
                {!categoryId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>
              {categories.map((cat: any) => {
                const CatIconComp = getDynamicIcon(cat.icon)
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
    </div>
  )
}

export default function NewGoalPage() {
  return (
    <ContextProvider>
      <NewGoalContent />
    </ContextProvider>
  )
}