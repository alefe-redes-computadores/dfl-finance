'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { ChevronLeft, Check, Loader2, X, Target, Calendar } from 'lucide-react'
import { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'
import { format } from 'date-fns'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import MoneyInput from '@/components/MoneyInput'

const COLORS = ['#14b8a6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308', '#64748b', '#000000']
const ICON_NAMES = ['target', 'piggy-bank', 'wallet', 'trending-up', 'home', 'car', 'graduation-cap', 'heart', 'briefcase', 'gift', 'shopping-bag', 'zap']

function NewGoalContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const editId = searchParams.get('edit')
  const { safeAdd, safeUpdate } = useSafeDb()

  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<any[]>([])

  const [name, setName] = useState('')
  const [targetAmountNum, setTargetAmountNum] = useState(0)
  const [targetAmountFormatted, setTargetAmountFormatted] = useState('0,00')
  const [deadline, setDeadline] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [color, setColor] = useState('#14b8a6')
  const [icon, setIcon] = useState('target')
  const [initialContributionNum, setInitialContributionNum] = useState(0)
  const [initialContributionFormatted, setInitialContributionFormatted] = useState('0,00')
  const [description, setDescription] = useState('')

  const [showCatModal, setShowCatModal] = useState(false)

  const { data: localCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext },
  })

  const { data: localGoal } = useLocalData({
    table: 'goals' as any,
    filters: { context: effectiveContext },
  })

  useEffect(() => {
    if (localCategories) setCategories(localCategories)
  }, [localCategories])

  useEffect(() => {
    if (editId && localGoal) {
      const data = localGoal.find((g: any) => g.id === editId) as any
      if (data) {
        setName(data.name)
        const numValue = Number(data.target_amount) || 0
        setTargetAmountNum(numValue)
        setTargetAmountFormatted(numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
        setDeadline(data.deadline || '')
        setCategoryId(data.category_id || '')
        setColor(data.color)
        setIcon(data.icon || 'target')
        setDescription(data.description || '')
      }
      setLoading(false)
    } else {
      setLoading(false)
    }
  }, [editId, localGoal])

  const handleSave = async () => {
    if (!user?.id || !name.trim() || targetAmountNum <= 0 || !deadline) {
      errorHaptic()
      showToast('⚠️ Preencha nome, valor e data limite.', 'warning')
      return
    }
    setSaving(true)

    const payload = {
      name: name.trim(),
      target_amount: targetAmountNum,
      deadline,
      category_id: categoryId || null,
      color,
      icon,
      description: description || null,
      status: 'active',
      context: effectiveContext,
      updated_at: new Date().toISOString(),
    }

    try {
      let goalId = editId

      if (editId) {
        const res = await safeUpdate('goals', editId, payload)
        if (!res.success) throw new Error(res.error)
        success()
        showToast('✅ Meta atualizada com sucesso!', 'success')
      } else {
        const newId = crypto.randomUUID()
        const fullPayload = {
          id: newId,
          user_id: user.id,
          ...payload,
          saved_amount: 0,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        const res = await safeAdd('goals', fullPayload)
        if (!res.success) throw new Error(res.error)
        goalId = newId
        success()
        showToast('🎯 Meta criada com sucesso!', 'success')
      }

      if (!editId && initialContributionNum > 0 && goalId) {
        const txId = crypto.randomUUID()
        const txPayload = {
          id: txId,
          user_id: user.id,
          context: effectiveContext,
          type: 'income',
          amount: initialContributionNum,
          description: `Contribuição inicial para ${name.trim()}`,
          date: format(new Date(), 'yyyy-MM-dd'),
          status: 'done',
          affects_balance: true,
          goal_id: goalId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        const resTx = await safeAdd('transactions', txPayload)
        if (!resTx.success) throw new Error(resTx.error)
      }

      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900 transition-colors duration-300">
      <Loader2 className="animate-spin text-teal-600" size={40} />
    </div>
  )

  const selectedCat = categories.find((c: any) => c.id === categoryId)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      <div className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-gray-50/90 dark:bg-slate-900/90 backdrop-blur-xl py-2">
        <button onClick={() => { vibrate([5]); router.back(); }} className="p-2 -ml-2 rounded-full text-gray-800 dark:text-gray-200 active:scale-95 transition-transform">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{editId ? 'Editar Meta' : 'Nova Meta'}</h2>
        <div className="w-10" />
      </div>

      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <section className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Nome da meta</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Viagem para Orlando"
            className="w-full bg-transparent text-[16px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
          />
        </section>

        <section className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Valor da meta</label>
          <div className="flex items-center gap-2">
            <span className="text-xl text-gray-400 dark:text-gray-500 font-medium">R$</span>
            <MoneyInput
              value={targetAmountNum}
              onChange={(num, formatted) => {
                setTargetAmountNum(num)
                setTargetAmountFormatted(formatted)
              }}
              placeholder="0,00"
              className="text-[28px] font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600"
            />
          </div>
        </section>

        <section className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Data limite</label>
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-gray-400 shrink-0" />
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none w-full"
            />
          </div>
        </section>

        <button onClick={() => { vibrate([5]); setShowCatModal(true); }} className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center shadow-sm">
              <Target size={18} className="text-gray-400 dark:text-gray-500" />
            </div>
            <div className="text-left">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest block">Categoria</span>
              <span className="text-[15px] font-bold text-gray-800 dark:text-gray-200">{selectedCat ? selectedCat.name : 'Geral'}</span>
            </div>
          </div>
          <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
        </button>

        <section className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-3 block">Cor</label>
          <div className="flex flex-wrap gap-3">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => { vibrate([5]); setColor(c); }}
                className={`w-9 h-9 rounded-full transition-all active:scale-90 ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-gray-400 shadow-sm' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-3 block">Ícone</p>
          <div className="flex flex-wrap gap-2">
            {ICON_NAMES.map(iconName => {
              const Ico = getDynamicIcon(iconName)
              const isSelected = icon === iconName
              return (
                <button
                  key={iconName}
                  onClick={() => { vibrate([5]); setIcon(iconName); }}
                  className={`w-12 h-12 flex items-center justify-center rounded-[16px] transition-all active:scale-90 ${isSelected ? 'shadow-sm' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  style={isSelected ? { backgroundColor: `${color}20`, color: color } : { backgroundColor: 'transparent', color: '#9ca3af' }}
                >
                  <Ico size={22} />
                </button>
              )
            })}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Descrição (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Detalhes sobre a meta..."
            className="w-full bg-transparent text-[15px] font-medium text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
          />
        </section>

        {!editId && (
          <section className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Contribuição inicial (opcional)</label>
            <div className="flex items-center gap-2">
              <span className="text-xl text-gray-400 dark:text-gray-500 font-medium">R$</span>
              <MoneyInput
                value={initialContributionNum}
                onChange={(num, formatted) => {
                  setInitialContributionNum(num)
                  setInitialContributionFormatted(formatted)
                }}
                placeholder="0,00"
                className="text-[24px] font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600"
              />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 font-bold uppercase tracking-widest">Valor já guardado.</p>
          </section>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 dark:from-slate-900 via-gray-50/80 dark:via-slate-900/80 to-transparent z-20">
        <button
          onClick={() => { vibrate([10, 50]); handleSave(); }}
          disabled={saving}
          className="w-full max-w-md mx-auto bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[16px] shadow-lg shadow-teal-600/30 active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} />}
          {editId ? 'Atualizar Meta' : 'Criar Meta'}
        </button>
      </div>

      {showCatModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowCatModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div
            className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Selecionar Categoria</h3>
              <button onClick={() => setShowCatModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 pb-10">
              <button
                onClick={() => { vibrate([5]); setCategoryId(''); setShowCatModal(false); }}
                className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${!categoryId ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent'}`}
              >
                <div className="w-12 h-12 rounded-[16px] flex items-center justify-center bg-white dark:bg-slate-800 text-gray-400 shadow-sm">
                  <Target size={20} />
                </div>
                <span className={`flex-1 text-left text-[15px] font-bold ${!categoryId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>
                  Geral
                </span>
                {!categoryId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>

              {categories.map((cat: any) => {
                const CatIconComp = getDynamicIcon(cat.icon)
                const isActive = cat.id === categoryId
                return (
                  <button
                    key={cat.id}
                    onClick={() => { vibrate([5]); setCategoryId(cat.id); setShowCatModal(false); }}
                    className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100'}`}
                  >
                    <div className="w-12 h-12 rounded-[16px] flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: cat.color || '#14b8a6' }}>
                      <CatIconComp size={20} />
                    </div>
                    <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>
                      {cat.name}
                    </span>
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