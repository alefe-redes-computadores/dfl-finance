'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import {
  Calendar,
  Check,
  ChevronLeft,
  Loader2,
  Target,
  X,
} from 'lucide-react'

import { useAuth } from '@/lib/hooks/useAuth'
import { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useGoalById } from '@/hooks/useGoalById'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import MoneyInput from '@/components/MoneyInput'
import Skeleton from '@/components/Skeleton'

const COLORS = [
  '#14b8a6',
  '#ef4444',
  '#f97316',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#eab308',
  '#64748b',
  '#000000',
]

const ICON_NAMES = [
  'target',
  'piggy-bank',
  'wallet',
  'trending-up',
  'home',
  'car',
  'graduation-cap',
  'heart',
  'briefcase',
  'gift',
  'shopping-bag',
  'zap',
]

function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-[28px] border border-black/5 dark:border-white/10 bg-white/95 dark:bg-slate-800/95 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-none ${className}`}
    >
      {children}
    </section>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-3 block text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
      {children}
    </label>
  )
}

function Header({
  title,
  onBack,
}: {
  title: string
  onBack: () => void
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-black/5 dark:border-white/10 bg-gray-50/92 dark:bg-slate-900/92 px-4 pb-4 pt-4 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-800 shadow-sm ring-1 ring-black/5 transition-transform active:scale-95 dark:bg-slate-800 dark:text-gray-100 dark:ring-white/10"
          aria-label="Voltar"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400 dark:text-gray-500">
            Goals
          </p>
          <h1 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h1>
        </div>

        <div className="h-11 w-11" />
      </div>
    </div>
  )
}

function GoalPreview({
  name,
  color,
  icon,
  targetAmountFormatted,
  deadline,
}: {
  name: string
  color: string
  icon: string
  targetAmountFormatted: string
  deadline: string
}) {
  const Icon = getDynamicIcon(icon)

  return (
    <SectionCard className="overflow-hidden p-4">
      <div
        className="relative overflow-hidden rounded-[24px] p-5 text-white"
        style={{
          background: `linear-gradient(135deg, ${color}, ${color}DD)`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_35%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="mb-2 inline-flex rounded-full bg-white/18 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/90">
              Prévia
            </span>
            <h2 className="truncate text-[22px] font-bold">
              {name.trim() || 'Sua nova meta'}
            </h2>
            <p className="mt-2 text-sm text-white/85">
              {targetAmountFormatted !== '0,00'
                ? `Objetivo de R$ ${targetAmountFormatted}`
                : 'Defina um valor para começar'}
            </p>
            <p className="mt-1 text-sm text-white/75">
              {deadline ? `Prazo até ${deadline}` : 'Escolha uma data limite'}
            </p>
          </div>

          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-white/16 backdrop-blur-sm">
            <Icon size={26} />
          </div>
        </div>
      </div>
    </SectionCard>
  )
}

function LoadingState() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-gray-50 transition-colors duration-300 dark:bg-slate-900">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50/90 px-4 pb-4 pt-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-slate-700" />
          <div className="h-6 w-32 animate-pulse rounded bg-gray-200 dark:bg-slate-700" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-slate-700" />
        </div>
      </div>

      <div className="px-4 pt-6">
        <Skeleton count={5} />
      </div>
    </div>
  )
}

function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-gray-50 px-4 dark:bg-slate-900">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
        <Target size={32} className="text-red-500" />
      </div>

      <h2 className="mb-2 text-xl font-bold text-gray-800 dark:text-gray-200">
        Meta não encontrada
      </h2>

      <p className="mb-6 max-w-xs text-center text-sm text-gray-500 dark:text-gray-400">
        A meta que você está tentando editar pode ter sido excluída ou você não tem permissão para acessá-la.
      </p>

      <button
        onClick={onBack}
        className="rounded-full bg-teal-600 px-6 py-3 font-semibold text-white transition-colors active:scale-95 hover:bg-teal-700"
      >
        Voltar para listagem
      </button>
    </div>
  )
}

function CategoryModal({
  open,
  onClose,
  categories,
  categoryId,
  onSelect,
  vibrate,
}: {
  open: boolean
  onClose: () => void
  categories: any[]
  categoryId: string
  onSelect: (id: string) => void
  vibrate: (pattern?: number | number[]) => void
}) {
  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative h-[70vh] w-full max-w-lg overflow-y-auto rounded-t-[32px] bg-white p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

        <div className="sticky top-0 mb-4 flex items-center justify-between bg-white py-2 dark:bg-slate-800">
          <h3 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">
            Selecionar Categoria
          </h3>
          <button
            onClick={onClose}
            className="rounded-full bg-gray-100 p-2 text-gray-400 transition-transform active:scale-95 dark:bg-slate-700"
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-2 pb-10">
          <button
            onClick={() => {
              vibrate([5])
              onSelect('')
              onClose()
            }}
            className={`flex w-full items-center gap-4 rounded-[20px] border p-4 transition-transform active:scale-[0.98] ${
              !categoryId
                ? 'border-teal-100 bg-teal-50 dark:border-teal-800/50 dark:bg-teal-900/30'
                : 'border-transparent bg-gray-50 dark:bg-slate-700/40'
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white text-gray-400 shadow-sm dark:bg-slate-800">
              <Target size={20} />
            </div>

            <span
              className={`flex-1 text-left text-[15px] font-bold ${
                !categoryId
                  ? 'text-teal-700 dark:text-teal-400'
                  : 'text-gray-800 dark:text-gray-200'
              }`}
            >
              Geral
            </span>

            {!categoryId && (
              <Check size={20} className="text-teal-700 dark:text-teal-400" />
            )}
          </button>

          {categories.map((cat: any) => {
            const CatIconComp = getDynamicIcon(cat.icon)
            const isActive = cat.id === categoryId

            return (
              <button
                key={cat.id}
                onClick={() => {
                  vibrate([5])
                  onSelect(cat.id)
                  onClose()
                }}
                className={`flex w-full items-center gap-4 rounded-[20px] border p-4 transition-transform active:scale-[0.98] ${
                  isActive
                    ? 'border-teal-100 bg-teal-50 dark:border-teal-800/50 dark:bg-teal-900/30'
                    : 'border-transparent bg-gray-50 hover:bg-gray-100 dark:bg-slate-700/40'
                }`}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-[16px] text-white shadow-sm"
                  style={{ backgroundColor: cat.color || '#14b8a6' }}
                >
                  <CatIconComp size={20} />
                </div>

                <span
                  className={`flex-1 text-left text-[15px] font-bold ${
                    isActive
                      ? 'text-teal-700 dark:text-teal-400'
                      : 'text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {cat.name}
                </span>

                {isActive && (
                  <Check size={20} className="text-teal-700 dark:text-teal-400" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

function NewGoalContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  
  // useMemo para normalizar o ID
  const rawEditId = searchParams.get('edit')
  const editId = useMemo(() => rawEditId?.trim() || null, [rawEditId])
  
  const { safeAdd, safeUpdate } = useSafeDb()

  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const { data: goalData, loading, notFound } = useGoalById(editId)

  const [initialized, setInitialized] = useState(!editId)
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

  useEffect(() => {
    if (localCategories) setCategories(localCategories)
  }, [localCategories])

  useEffect(() => {
    if (editId && goalData && !initialized) {
      setName(goalData.name || '')

      const numValue = Number(goalData.target_amount) || 0
      setTargetAmountNum(numValue)
      setTargetAmountFormatted(
        numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      )

      setDeadline(goalData.deadline || '')
      setCategoryId(goalData.category_id || '')
      setColor(goalData.color || '#14b8a6')
      setIcon(goalData.icon || 'target')
      setDescription(goalData.description || '')
      setInitialized(true)
    }

    if (!editId && !initialized) {
      setInitialized(true)
    }
  }, [editId, goalData, initialized])

  // SÓ REDIRECIONA SE NOTFOUND E NÃO ESTÁ CARREGANDO
  if (editId && notFound && !loading) {
    return <NotFoundState onBack={() => router.push('/goals')} />
  }

  if (editId && loading) {
    return <LoadingState />
  }

  if (!initialized) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-gray-50 transition-colors duration-300 dark:bg-slate-900">
        <div className="px-4 pt-6">
          <Skeleton count={5} />
        </div>
      </div>
    )
  }

  const selectedCat = useMemo(
    () => categories.find((c: any) => c.id === categoryId),
    [categories, categoryId]
  )

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
        showToast('Meta atualizada com sucesso!', 'success')
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
        showToast('Meta criada com sucesso!', 'success')
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

  return (
    <div className="min-h-screen bg-gray-50 transition-colors duration-300 dark:bg-slate-900">
      <div className="mx-auto max-w-md px-4 pb-32 pt-2 font-sans">
        <Header
          title={editId ? 'Editar Meta' : 'Nova Meta'}
          onBack={() => {
            vibrate([5])
            router.back()
          }}
        />

        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <GoalPreview
            name={name}
            color={color}
            icon={icon}
            targetAmountFormatted={targetAmountFormatted}
            deadline={deadline}
          />

          <SectionCard className="p-4">
            <SectionLabel>Nome da meta</SectionLabel>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Viagem para Orlando"
              className="w-full bg-transparent text-[18px] font-bold text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-200 dark:placeholder:text-gray-600"
            />
          </SectionCard>

          <SectionCard className="p-4">
            <SectionLabel>Valor da meta</SectionLabel>
            <div className="flex items-center gap-3">
              <span className="text-[22px] font-medium text-gray-400 dark:text-gray-500">
                R$
              </span>
              <MoneyInput
                value={targetAmountNum}
                onChange={(num, formatted) => {
                  setTargetAmountNum(num)
                  setTargetAmountFormatted(formatted)
                }}
                placeholder="0,00"
                className="w-full bg-transparent text-[30px] font-bold text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-200 dark:placeholder:text-gray-600"
              />
            </div>
          </SectionCard>

          <SectionCard className="p-4">
            <SectionLabel>Data limite</SectionLabel>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gray-50 text-gray-400 dark:bg-slate-700/50 dark:text-gray-500">
                <Calendar size={18} className="shrink-0" />
              </div>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-transparent text-[15px] font-bold text-gray-800 outline-none dark:text-gray-200"
              />
            </div>
          </SectionCard>

          <button
            onClick={() => {
              vibrate([5])
              setShowCatModal(true)
            }}
            className="w-full rounded-[28px] border border-black/5 bg-white/95 p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-transform active:scale-[0.985] dark:border-white/10 dark:bg-slate-800/95 dark:shadow-none"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-gray-50 text-gray-400 shadow-sm dark:bg-slate-700/50 dark:text-gray-500">
                  <Target size={18} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                    Categoria
                  </span>
                  <span className="truncate text-[15px] font-bold text-gray-800 dark:text-gray-200">
                    {selectedCat ? selectedCat.name : 'Geral'}
                  </span>
                </div>
              </div>

              <ChevronLeft
                size={18}
                className="rotate-180 text-gray-300 dark:text-gray-600"
              />
            </div>
          </button>

          <SectionCard className="p-4">
            <SectionLabel>Cor</SectionLabel>
            <div className="flex flex-wrap gap-3">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    vibrate([5])
                    setColor(c)
                  }}
                  className={`h-10 w-10 rounded-full transition-all active:scale-90 ${
                    color === c
                      ? 'scale-110 ring-2 ring-gray-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-800'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Selecionar cor ${c}`}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard className="p-4">
            <SectionLabel>Ícone</SectionLabel>
            <div className="grid grid-cols-4 gap-2">
              {ICON_NAMES.map((iconName) => {
                const Ico = getDynamicIcon(iconName)
                const isSelected = icon === iconName

                return (
                  <button
                    key={iconName}
                    onClick={() => {
                      vibrate([5])
                      setIcon(iconName)
                    }}
                    className={`flex h-14 items-center justify-center rounded-[18px] border transition-all active:scale-90 ${
                      isSelected
                        ? 'border-transparent shadow-sm'
                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: `${color}20`,
                            color: color,
                          }
                        : {
                            backgroundColor: 'transparent',
                            color: '#9ca3af',
                          }
                    }
                    aria-label={`Selecionar ícone ${iconName}`}
                  >
                    <Ico size={22} />
                  </button>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard className="p-4">
            <SectionLabel>Descrição (opcional)</SectionLabel>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes sobre a meta..."
              rows={3}
              className="w-full resize-none bg-transparent text-[15px] font-medium text-gray-700 outline-none placeholder:text-gray-300 dark:text-gray-300 dark:placeholder:text-gray-600"
            />
          </SectionCard>

          {!editId && (
            <SectionCard className="p-4">
              <SectionLabel>Contribuição inicial (opcional)</SectionLabel>
              <div className="flex items-center gap-3">
                <span className="text-[22px] font-medium text-gray-400 dark:text-gray-500">
                  R$
                </span>
                <MoneyInput
                  value={initialContributionNum}
                  onChange={(num, formatted) => {
                    setInitialContributionNum(num)
                    setInitialContributionFormatted(formatted)
                  }}
                  placeholder="0,00"
                  className="w-full bg-transparent text-[28px] font-bold text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-200 dark:placeholder:text-gray-600"
                />
              </div>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                Valor já guardado.
              </p>
            </SectionCard>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-gray-50 via-gray-50/92 to-transparent p-4 dark:from-slate-900 dark:via-slate-900/92">
        <button
          onClick={() => {
            vibrate([10, 50])
            handleSave()
          }}
          disabled={saving}
          className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-[26px] bg-teal-600 py-4 text-[16px] font-bold text-white shadow-lg shadow-teal-600/30 transition-all active:scale-[0.985] disabled:opacity-50 hover:bg-teal-700"
        >
          {saving ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <Check size={22} />
          )}
          {editId ? 'Atualizar Meta' : 'Criar Meta'}
        </button>
      </div>

      <CategoryModal
        open={showCatModal}
        onClose={() => setShowCatModal(false)}
        categories={categories}
        categoryId={categoryId}
        onSelect={setCategoryId}
        vibrate={vibrate}
      />
    </div>
  )
}

export default function NewGoalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <Loader2 className="animate-spin text-teal-600" size={32} />
      </div>
    }>
      <ContextProvider>
        <NewGoalContent />
      </ContextProvider>
    </Suspense>
  )
}