'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import * as Icons from 'lucide-react'
import {
  getDynamicIcon,
  normalizeIconName,
} from '@/lib/iconUtils'
import {
  ChevronRight,
  Check,
  Loader2,
  X,
  Sparkles,
  ArrowLeft,
  WalletCards,
  Palette,
  Layers3,
  CalendarRange,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { ContextProvider, useContext_ } from '@/components/ContextToggle'
import IconPicker from '@/components/IconPicker'
import MoneyInput from '@/components/MoneyInput'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useBudgetById } from '@/hooks/useBudgetById'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
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
  '#0f172a',
]

function lightTap() {
  if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
}

function safeNum(val: unknown): number {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  description?: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400">
        <Icon size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-black tracking-[-0.02em] text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

function FieldShell({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <label className="block text-[12px] font-extrabold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
        {label}
      </label>
      {children}
      {helper && (
        <p className="text-[12px] leading-5 text-slate-500 dark:text-slate-400">{helper}</p>
      )}
    </div>
  )
}

function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-[18px] border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none',
        className
      )}
    >
      {children}
    </div>
  )
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
  const isEditing = Boolean(editId)

  const { data: budgetData, loading: budgetLoading, notFound } = useBudgetById(editId)

  const recordContext =
    isEditing && budgetData?.context
      ? budgetData.context
      : context

  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(!editId)

  const [name, setName] = useState('')
  const [amountNum, setAmountNum] = useState(0)
  const [categoryId, setCategoryId] = useState('')
  const [color, setColor] = useState('#14b8a6')
  const [icon, setIcon] = useState('Tag')
  const [period, setPeriod] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly')
  const [accumulate, setAccumulate] = useState(false)

  const [showCatModal, setShowCatModal] = useState(false)
  const [showIconModal, setShowIconModal] = useState(false)

  const { data: localCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context: recordContext, type: 'expense', parent_id: null },
  })

  const categories = localCategories || []

  useEffect(() => {
    if (editId && budgetData && !initialized) {
      setName(budgetData.name || '')
      const numValue = safeNum(budgetData.amount)
      setAmountNum(numValue)
      setCategoryId(budgetData.category_id || '')
      setColor(budgetData.color || '#14b8a6')
      setPeriod(budgetData.period || 'monthly')
      setAccumulate(!!budgetData.accumulate)

      if (budgetData.icon) {
        setIcon(
          normalizeIconName(budgetData.icon) ||
          'Tag'
        )
      }

      setInitialized(true)
    }

    if (!editId && !initialized) {
      setInitialized(true)
    }
  }, [editId, budgetData, initialized])

  const selectedCat = categories.find((c: any) => c.id === categoryId)
  const IconComp = getDynamicIcon(icon)

  const previewPeriodLabel = useMemo(() => {
    if (period === 'weekly') return 'Semanal'
    if (period === 'biweekly') return 'Quinzenal'
    return 'Mensal'
  }, [period])

  if (editId && budgetLoading) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-slate-950 px-4 pt-6">
        <div className="mx-auto max-w-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-11 w-11 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-6 w-40 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-11 w-20 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
          <Card className="p-4">
            <Skeleton count={6} />
          </Card>
        </div>
      </div>
    )
  }

  if (editId && notFound) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-slate-950 px-4">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400">
            <Icons.Tag size={32} />
          </div>
          <h2 className="text-[24px] font-black tracking-[-0.03em] text-slate-900 dark:text-slate-100">
            Orçamento não encontrado
          </h2>
          <p className="mt-2 max-w-xs text-[14px] leading-6 text-slate-500 dark:text-slate-400">
            O orçamento que você tentou abrir pode ter sido removido ou não está disponível neste contexto.
          </p>
          <button
            onClick={() => router.push('/budgets')}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-teal-600 px-6 text-[14px] font-bold text-white shadow-lg shadow-teal-600/25 transition-all active:scale-[0.98]"
          >
            Voltar para orçamentos
          </button>
        </div>
      </div>
    )
  }

  if (!initialized) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-slate-950 px-4 pt-6">
        <div className="mx-auto max-w-md">
          <Card className="p-4">
            <Skeleton count={6} />
          </Card>
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    if (!user?.id || !(name || '').trim() || amountNum <= 0) {
      showToast('Preencha nome e valor do orçamento.', 'warning')
      errorHaptic()
      return
    }

    setSaving(true)

    const payload = {
      name: name.trim(),
      amount: amountNum,
      category_id: categoryId || null,
      color,
      icon: normalizeIconName(icon) || 'Tag',
      period,
      accumulate,
      context: recordContext,
      updated_at: new Date().toISOString(),
    }

    try {
      if (editId) {
        const result = await safeUpdate('budgets', editId, payload)
        if (!result.success) throw new Error(result.error)
        showToast('Orçamento atualizado com sucesso!', 'success')
      } else {
        const id = crypto.randomUUID()
        const fullPayload = {
          id,
          user_id: user.id,
          ...payload,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }

        const result = await safeAdd('budgets', fullPayload)
        if (!result.success) throw new Error(result.error)
        showToast('Orçamento criado com sucesso!', 'success')
      }

      success()
      router.push('/budgets')
    } catch (err: any) {
      showToast(`Erro ao salvar: ${err?.message || 'tente novamente.'}`, 'error')
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f8] pb-28 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-md px-4 pt-3">
        <div className="mb-3 flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-slate-200 bg-white text-slate-700 shadow-sm transition-all active:scale-[0.97] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Orçamentos
            </p>
            <h1 className="mt-0.5 text-[27px] font-black tracking-[-0.04em] text-slate-900 dark:text-slate-100">
              {isEditing ? 'Editar orçamento' : 'Novo orçamento'}
            </h1>
            <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
              {isEditing
                ? 'Atualize os detalhes visuais e regras do orçamento.'
                : 'Crie um orçamento com identidade visual clara e configuração completa.'}
            </p>
          </div>
        </div>

        <Card className="mb-3 overflow-hidden border-teal-200/60 dark:border-teal-900/40">
          <div className="bg-gradient-to-br from-teal-50/80 via-white/60 to-white/40 px-4 py-3 dark:from-teal-950/30 dark:via-slate-900/80 dark:to-slate-900">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-400">
                Resumo
              </p>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]',
                  isEditing
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                    : 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300'
                )}
              >
                {isEditing ? 'Edição' : 'Novo'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/90 p-2 text-center shadow-sm ring-1 ring-teal-200/50 dark:bg-slate-900/90 dark:ring-teal-800/30">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-teal-600/70 dark:text-teal-400/70">
                  Valor
                </p>
                <p className="mt-1 text-[16px] font-black tracking-[-0.02em] text-slate-900 dark:text-slate-100">
                  R$ {amountNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="rounded-xl bg-white/90 p-2 text-center shadow-sm ring-1 ring-teal-200/50 dark:bg-slate-900/90 dark:ring-teal-800/30">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-teal-600/70 dark:text-teal-400/70">
                  Período
                </p>
                <p className="mt-1 text-[14px] font-black tracking-[-0.02em] text-slate-900 dark:text-slate-100">
                  {previewPeriodLabel}
                </p>
              </div>

              <div className="rounded-xl bg-white/90 p-2 text-center shadow-sm ring-1 ring-teal-200/50 dark:bg-slate-900/90 dark:ring-teal-800/30">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-teal-600/70 dark:text-teal-400/70">
                  Acumula
                </p>
                <p className="mt-1 text-[14px] font-black tracking-[-0.02em] text-slate-900 dark:text-slate-100">
                  {accumulate ? 'Sim' : 'Não'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* FORMULÁRIO */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="space-y-4"
        >
          <Card className="p-4">
            <div className="space-y-5">
              <SectionHeader
                icon={WalletCards}
                title="Informações principais"
                description="Defina os dados centrais do orçamento."
              />

              <FieldShell label="Nome do orçamento">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Alimentação, Moradia..."
                  className="h-12 w-full rounded-[16px] border border-slate-200 bg-slate-50 px-4 text-[15px] font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-400"
                />
              </FieldShell>

              <FieldShell label="Categoria">
                <button
                  type="button"
                  onClick={() => {
                    lightTap()
                    setShowCatModal(true)
                  }}
                  className="flex h-12 w-full items-center justify-between rounded-[16px] border border-slate-200 bg-slate-50 px-4 text-left transition active:scale-[0.98] dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                      {selectedCat ? selectedCat.name : 'Todas as categorias'}
                    </p>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-slate-400" />
                </button>
              </FieldShell>

              <FieldShell
                label="Valor do orçamento"
                helper="Informe o valor total previsto para este orçamento."
              >
                <div className="flex h-12 items-center gap-3 rounded-[16px] border border-slate-200 bg-slate-50 px-4 transition focus-within:border-teal-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-teal-500/10 dark:border-slate-800 dark:bg-slate-950">
                  <span className="text-[15px] font-black text-slate-400 dark:text-slate-500">R$</span>
                  <MoneyInput
                    value={amountNum}
                    onChange={(num) => {
                      setAmountNum(num)
                    }}
                    placeholder="0,00"
                    className="w-full bg-transparent text-[18px] font-black tracking-[-0.02em] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                  />
                </div>
              </FieldShell>
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-5">
              <SectionHeader
                icon={Palette}
                title="Personalização"
                description="Escolha cor e ícone para identificar o orçamento com mais clareza."
              />

              <FieldShell label="Cor">
                <div className="flex flex-wrap gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        lightTap()
                        setColor(c)
                      }}
                      className={cn(
                        'relative h-11 w-11 rounded-full transition-all active:scale-[0.96]',
                        color === c
                          ? 'scale-110 ring-2 ring-slate-300 ring-offset-2 ring-offset-[#f6f7f8] dark:ring-slate-600 dark:ring-offset-slate-950'
                          : 'hover:scale-105'
                      )}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && (
                        <span className="absolute inset-0 flex items-center justify-center text-white">
                          <Check size={16} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </FieldShell>

              <FieldShell label="Ícone">
                <button
                  type="button"
                  onClick={() => {
                    lightTap()
                    setShowIconModal(true)
                  }}
                  className="flex h-12 w-full items-center justify-between rounded-[16px] border border-slate-200 bg-slate-50 px-4 text-left transition active:scale-[0.98] dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      <IconComp size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                        {icon}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-slate-400" />
                </button>
              </FieldShell>
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-5">
              <SectionHeader
                icon={CalendarRange}
                title="Configuração"
                description="Defina a recorrência e o comportamento do orçamento."
              />

              <FieldShell label="Período" helper="Como esse orçamento será renovado.">
                <div className="grid grid-cols-3 gap-1.5 rounded-[18px] bg-slate-100 p-1 dark:bg-slate-800">
                  {[
                    { key: 'monthly' as const, label: 'Mensal' },
                    { key: 'biweekly' as const, label: '15 dias' },
                    { key: 'weekly' as const, label: 'Semanal' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        lightTap()
                        setPeriod(p.key)
                      }}
                      className={cn(
                        'h-10 rounded-[14px] px-2 text-[12px] font-black tracking-[-0.01em] transition-all active:scale-[0.98]',
                        period === p.key
                          ? 'bg-white text-teal-700 shadow-sm dark:bg-slate-900 dark:text-teal-400'
                          : 'text-slate-500 dark:text-slate-400'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </FieldShell>

              <FieldShell
                label="Acumular saldo"
                helper="Quando ativo, o valor não utilizado continua para o próximo ciclo."
              >
                <div className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex min-w-0 items-center gap-3 pr-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800">
                      <Sparkles size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-slate-900 dark:text-slate-100">
                        Acumular automaticamente
                      </p>
                      <p className="mt-0.5 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                        {accumulate
                          ? 'O saldo restante será carregado para o próximo período.'
                          : 'Cada ciclo reinicia com o valor definido no orçamento.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      lightTap()
                      setAccumulate(!accumulate)
                    }}
                    className={cn(
                      'relative h-8 w-14 shrink-0 rounded-full transition-all active:scale-[0.98]',
                      accumulate ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform',
                        accumulate ? 'translate-x-7' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              </FieldShell>
            </div>
          </Card>
        </form>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-12 flex-1 items-center justify-center rounded-[17px] border border-slate-200 bg-white text-[14px] font-bold text-slate-700 transition-all active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex h-12 flex-[1.3] items-center justify-center gap-2 rounded-[17px] bg-teal-600 px-5 text-[14px] font-black text-white shadow-[0_12px_30px_rgba(20,184,166,0.28)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar orçamento'}
          </button>
        </div>
      </div>

      {showCatModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/55 backdrop-blur-sm"
            onClick={() => setShowCatModal(false)}
          >
            <div
              className="h-[68vh] w-full max-w-lg overflow-y-auto rounded-t-[26px] bg-white dark:bg-slate-950"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 pb-4 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      Seleção
                    </p>
                    <h3 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-slate-900 dark:text-slate-100">
                      Categoria
                    </h3>
                  </div>

                  <button
                    onClick={() => setShowCatModal(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all active:scale-[0.98] dark:bg-slate-900 dark:text-slate-400"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 px-5 py-4">
                <button
                  onClick={() => {
                    lightTap()
                    setCategoryId('')
                    setShowCatModal(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[18px] border p-3.5 text-left transition-all active:scale-[0.98]',
                    !categoryId
                      ? 'border-teal-200 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-500/10'
                      : 'border-transparent bg-slate-50 dark:bg-slate-900'
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    <Icons.Tag size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-[14px] font-bold',
                        !categoryId
                          ? 'text-teal-700 dark:text-teal-400'
                          : 'text-slate-900 dark:text-slate-100'
                      )}
                    >
                      Todas as categorias
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                      O orçamento valerá para qualquer categoria de despesa.
                    </p>
                  </div>

                  {!categoryId && <Check size={18} className="text-teal-600 dark:text-teal-400" />}
                </button>

                {categories.map((cat: any) => {
                  const CatIconComp =
                    getDynamicIcon(
                      cat.icon || 'Tag'
                    )
                  const isActive = cat.id === categoryId

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        lightTap()
                        setCategoryId(cat.id)
                        setShowCatModal(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-[18px] border p-3.5 text-left transition-all active:scale-[0.98]',
                        isActive
                          ? 'border-teal-200 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-500/10'
                          : 'border-transparent bg-slate-50 dark:bg-slate-900'
                      )}
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
                        style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                      >
                        <CatIconComp size={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-[14px] font-bold',
                            isActive
                              ? 'text-teal-700 dark:text-teal-400'
                              : 'text-slate-900 dark:text-slate-100'
                          )}
                        >
                          {cat.name}
                        </p>
                        <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                          Aplicar este orçamento somente a esta categoria.
                        </p>
                      </div>

                      {isActive && <Check size={18} className="text-teal-600 dark:text-teal-400" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>,
          document.body
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