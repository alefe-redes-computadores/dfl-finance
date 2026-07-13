'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import * as Icons from 'lucide-react'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  X,
  Tag,
  Palette,
  Sparkles,
  CalendarRange
} from 'lucide-react'
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

  if (!initialized) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-slate-950 px-4 pt-6">
        <div className="max-w-md mx-auto animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div className="w-11 h-11 rounded-2xl bg-gray-200 dark:bg-slate-700" />
            <div className="h-5 w-36 rounded-full bg-gray-200 dark:bg-slate-700" />
            <div className="w-11 h-11 rounded-2xl bg-gray-200 dark:bg-slate-700" />
          </div>

          <div className="space-y-4">
            <div className="h-28 rounded-[28px] bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/60" />
            <div className="h-24 rounded-[28px] bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/60" />
            <div className="h-16 rounded-[24px] bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/60" />
            <div className="h-16 rounded-[24px] bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/60" />
            <div className="h-32 rounded-[28px] bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/60" />
          </div>
        </div>
      </div>
    )
  }

  const selectedCat = categories.find((c: any) => c.id === categoryId)
  const IconComp = (Icons as any)[icon] || Icons.Tag

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f6f7f8] dark:bg-slate-950 pb-36 px-4 pt-4 font-sans transition-colors duration-300">
      <div className="sticky top-0 z-20 -mx-4 px-4 pt-2 pb-4 bg-[#f6f7f8]/92 dark:bg-slate-950/92 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              lightTap()
              router.back()
            }}
            className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-800 dark:text-gray-200 flex items-center justify-center shadow-sm active:scale-[0.98] transition-transform"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="text-center px-3 min-w-0">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.16em]">
              {editId ? 'Editar orçamento' : 'Novo orçamento'}
            </p>
            <h2 className="text-[18px] font-bold text-gray-900 dark:text-gray-100 truncate">
              {editId ? 'Atualizar dados' : 'Criar orçamento'}
            </h2>
          </div>

          <button
            onClick={() => {
              lightTap()
              handleSave()
            }}
            disabled={saving}
            className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/25 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <section className="rounded-[30px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-[0_10px_28px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.16em] mb-2">
              Resumo
            </p>

            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-[18px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}18`, color }}
              >
                <IconComp size={24} />
              </div>

              <div className="min-w-0">
                <p className="text-[18px] font-bold text-gray-900 dark:text-gray-100 leading-tight">
                  {name?.trim() || 'Novo orçamento'}
                </p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
                  {selectedCat ? selectedCat.name : 'Todas as categorias'} •{' '}
                  {period === 'monthly' ? 'Mensal' : period === 'biweekly' ? 'Quinzenal' : 'Semanal'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 block mb-2">
              Valor do orçamento
            </label>
            <div className="flex items-end gap-2">
              <span className="text-[24px] font-medium text-gray-400 dark:text-gray-500 leading-none pb-1">
                R$
              </span>
              <MoneyInput
                value={amountNum}
                onChange={(num, formatted) => {
                  setAmountNum(num)
                  setAmountFormatted(formatted)
                }}
                className="w-full bg-transparent outline-none text-[34px] leading-none font-bold tracking-tight text-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="mt-5">
              <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 block mb-2">
                Nome
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Alimentação, Moradia..."
                className="w-full h-12 px-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-[15px] font-medium text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
          </div>
        </section>

        <section className="rounded-[30px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.16em] mb-1">
              Personalização
            </p>
            <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">
              Categoria, cor e ícone
            </h3>
          </div>

          <div className="p-3">
            <button
              onClick={() => {
                lightTap()
                setShowCatModal(true)
              }}
              className="w-full px-3 py-3.5 rounded-[22px] flex items-center justify-between active:scale-[0.98] transition-transform hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-[16px] bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0">
                  <Tag size={18} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Categoria</p>
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {selectedCat ? selectedCat.name : 'Todas as categorias'}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300 dark:text-gray-600 shrink-0" />
            </button>

            <div className="px-3 py-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-[16px] bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0">
                  <Palette size={18} />
                </div>
                <div>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Cor</p>
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                    Paleta do orçamento
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      lightTap()
                      setColor(c)
                    }}
                    className={`w-10 h-10 rounded-full transition-all active:scale-[0.98] ${
                      color === c
                        ? 'scale-110 ring-2 ring-gray-300 dark:ring-slate-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                lightTap()
                setShowIconModal(true)
              }}
              className="w-full px-3 py-3.5 rounded-[22px] flex items-center justify-between active:scale-[0.98] transition-transform hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}18`, color }}
                >
                  <IconComp size={18} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Ícone</p>
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {icon}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300 dark:text-gray-600 shrink-0" />
            </button>
          </div>
        </section>

        <section className="rounded-[30px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.16em] mb-1">
              Configuração
            </p>
            <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">
              Frequência e comportamento
            </h3>
          </div>

          <div className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-[16px] bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0">
                <CalendarRange size={18} />
              </div>
              <div>
                <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Período</p>
                <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                  Como o orçamento será renovado
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { key: 'monthly' as const, label: 'Mensal' },
                { key: 'biweekly' as const, label: 'Quinzenal' },
                { key: 'weekly' as const, label: 'Semanal' }
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    lightTap()
                    setPeriod(p.key)
                  }}
                  className={`h-11 rounded-full text-[12px] font-semibold transition-all active:scale-[0.98] ${
                    period === p.key
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="rounded-[22px] bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-4 py-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                    Acumular saldo
                  </p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed mt-1">
                    O valor não gasto acumula para o mês seguinte.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  lightTap()
                  setAccumulate(!accumulate)
                }}
                className={`w-12 h-7 rounded-full relative transition-all active:scale-[0.98] shrink-0 ${
                  accumulate ? 'bg-teal-600' : 'bg-gray-300 dark:bg-slate-600'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    accumulate ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="fixed bottom-20 left-0 right-0 px-4 z-30">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => {
              lightTap()
              handleSave()
            }}
            disabled={saving}
            className="w-full h-14 rounded-[26px] bg-teal-600 hover:bg-teal-700 text-white font-bold text-[15px] shadow-[0_14px_30px_rgba(13,148,136,0.28)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
            {editId ? 'Atualizar orçamento' : 'Criar orçamento'}
          </button>
        </div>
      </div>

      {showCatModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCatModal(false)}
        >
          <div
            className="w-full max-w-lg h-[60vh] overflow-y-auto rounded-t-[32px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-5">
              <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl py-2">
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.16em]">
                    Seleção
                  </p>
                  <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">
                    Categorias
                  </h3>
                </div>

                <button
                  onClick={() => setShowCatModal(false)}
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 flex items-center justify-center active:scale-[0.98] transition-transform"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    lightTap()
                    setCategoryId('')
                    setShowCatModal(false)
                  }}
                  className={`w-full p-3.5 rounded-[22px] flex items-center gap-4 active:scale-[0.98] transition-transform ${
                    !categoryId
                      ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/40'
                      : 'bg-gray-50 dark:bg-slate-800 border border-transparent'
                  }`}
                >
                  <div className="w-11 h-11 rounded-[16px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 text-gray-400 flex items-center justify-center shrink-0">
                    <Tag size={18} />
                  </div>
                  <span
                    className={`flex-1 text-left text-[14px] font-semibold ${
                      !categoryId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    Todas as categorias
                  </span>
                  {!categoryId && <Check size={18} className="text-teal-700 dark:text-teal-400" />}
                </button>

                {categories.map((cat: any) => {
                  const catIconName = cat.icon ? cat.icon.charAt(0).toUpperCase() + cat.icon.slice(1) : 'Tag'
                  const CatIconComp = (Icons as any)[catIconName] || Icons.Tag
                  const isActive = cat.id === categoryId

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        lightTap()
                        setCategoryId(cat.id)
                        setShowCatModal(false)
                      }}
                      className={`w-full p-3.5 rounded-[22px] flex items-center gap-4 active:scale-[0.98] transition-transform ${
                        isActive
                          ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/40'
                          : 'bg-gray-50 dark:bg-slate-800 border border-transparent'
                      }`}
                    >
                      <div
                        className="w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                      >
                        <CatIconComp size={18} />
                      </div>

                      <span
                        className={`flex-1 text-left text-[14px] font-semibold ${
                          isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {cat.name}
                      </span>

                      {isActive && <Check size={18} className="text-teal-700 dark:text-teal-400" />}
                    </button>
                  )
                })}
              </div>
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