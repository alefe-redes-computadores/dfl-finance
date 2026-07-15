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
  CalendarRange,
  ArrowLeft
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

const COLORS = ['#14b8a6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308', '#64748b', '#000000']

function lightTap() {
  if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
}

function safeNum(val: any): number {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

// ============================================================
// COMPONENTES VISUAIS (apenas estrutura, sem lógica)
// ============================================================

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-gray-100 dark:border-slate-800 pb-3">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
    </div>
  )
}

function FormField({ label, children, error, helper }: { label: string; children: React.ReactNode; error?: string; helper?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {children}
      {helper && <p className="text-xs text-gray-500 dark:text-gray-400">{helper}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

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

  // ✅ HOOKS (mantidos exatamente iguais)
  const { data: budgetData, loading: budgetLoading, notFound } = useBudgetById(editId)

  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(!editId)

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

  // ✅ HIDRATAÇÃO (mantida exatamente igual)
  useEffect(() => {
    if (editId && budgetData && !initialized) {
      setName(budgetData.name || '')
      const numValue = safeNum(budgetData.amount)
      setAmountNum(numValue)
      setAmountFormatted(numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      setCategoryId(budgetData.category_id || '')
      setColor(budgetData.color || '#14b8a6')
      setPeriod(budgetData.period || 'monthly')
      setAccumulate(!!budgetData.accumulate)

      if (budgetData.icon) {
        const iconName = budgetData.icon.charAt(0).toUpperCase() + budgetData.icon.slice(1)
        setIcon(iconName)
      }

      setInitialized(true)
    }
    
    if (!editId && !initialized) {
      setInitialized(true)
    }
  }, [editId, budgetData, initialized])

  // ✅ TRATAMENTO DE LOADING
  if (editId && budgetLoading) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-slate-950 px-4 pt-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="w-11 h-11 rounded-2xl bg-gray-200 dark:bg-slate-700 animate-pulse" />
            <div className="h-5 w-36 rounded-full bg-gray-200 dark:bg-slate-700 animate-pulse" />
            <div className="w-11 h-11 rounded-2xl bg-gray-200 dark:bg-slate-700 animate-pulse" />
          </div>
          <Skeleton count={5} />
        </div>
      </div>
    )
  }

  // ✅ TRATAMENTO DE NÃO ENCONTRADO
  if (editId && notFound) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-slate-950 flex flex-col items-center justify-center px-4">
        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <Tag size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Orçamento não encontrado</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs mb-6">
          O orçamento que você está tentando editar pode ter sido excluído ou você não tem permissão para acessá-lo.
        </p>
        <button
          onClick={() => router.push('/budgets')}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-full font-semibold transition-colors active:scale-95"
        >
          Voltar para listagem
        </button>
      </div>
    )
  }

  // ✅ SKELETON ENQUANTO NÃO INICIALIZADO
  if (!initialized) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-slate-950 px-4 pt-6">
        <div className="max-w-md mx-auto">
          <Skeleton count={5} />
        </div>
      </div>
    )
  }

  // ✅ FUNÇÃO DE SALVAR (mantida exatamente igual)
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

  // ✅ DADOS DERIVADOS (mantidos exatamente iguais)
  const selectedCat = categories.find((c: any) => c.id === categoryId)
  const IconComp = (Icons as any)[icon] || Icons.Tag

  // ✅ RENDERIZAÇÃO REFATORADA
  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
      <div className="mx-auto w-full max-w-3xl px-4 py-4 md:py-6">
        {/* ============================================================
            BLOCO 1: HEADER
            ============================================================ */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Orçamentos</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isEditing ? 'Editar orçamento' : 'Novo orçamento'}
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {isEditing
                ? 'Atualize os dados do orçamento sem alterar sua lógica atual.'
                : 'Cadastre um novo orçamento com os mesmos campos e regras atuais.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.98]"
          >
            Voltar
          </button>
        </div>

        {/* ============================================================
            BLOCO 2: CARD DE CONTEXTO
            ============================================================ */}
        <div className="mb-6 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Resumo
              </p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                Preencha os campos do orçamento. Os cálculos, validações e salvamento permanecem iguais.
              </p>
            </div>

            <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isEditing
                ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            }`}>
              {isEditing ? 'Modo edição' : 'Novo registro'}
            </div>
          </div>
        </div>

        {/* ============================================================
            BLOCO 3: FORMULÁRIO
            ============================================================ */}
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-6">

            {/* SEÇÃO 1: INFORMAÇÕES PRINCIPAIS */}
            <section className="space-y-4">
              <SectionHeader
                title="Informações principais"
                description="Defina os dados centrais do orçamento."
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Nome */}
                <div className="md:col-span-2">
                  <FormField label="Nome do orçamento">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Alimentação, Moradia..."
                      className="w-full h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:focus:border-teal-400"
                    />
                  </FormField>
                </div>

                {/* Categoria */}
                <div>
                  <FormField label="Categoria">
                    <button
                      type="button"
                      onClick={() => { lightTap(); setShowCatModal(true); }}
                      className="w-full h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-left text-gray-900 dark:text-gray-100 flex items-center justify-between transition hover:bg-gray-50 dark:hover:bg-slate-800 active:scale-[0.98]"
                    >
                      <span className="truncate">{selectedCat ? selectedCat.name : 'Todas as categorias'}</span>
                      <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>
                  </FormField>
                </div>

                {/* Valor */}
                <div>
                  <FormField label="Valor do orçamento" helper="Informe o valor total previsto para este orçamento.">
                    <div className="flex items-center gap-2 h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10 transition">
                      <span className="text-sm font-medium text-gray-400 dark:text-gray-500">R$</span>
                      <MoneyInput
                        value={amountNum}
                        onChange={(num, formatted) => {
                          setAmountNum(num)
                          setAmountFormatted(formatted)
                        }}
                        placeholder="0,00"
                        className="w-full bg-transparent outline-none text-sm font-semibold text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                      />
                    </div>
                  </FormField>
                </div>
              </div>
            </section>

            {/* SEÇÃO 2: PERSONALIZAÇÃO */}
            <section className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-800">
              <SectionHeader
                title="Personalização"
                description="Escolha cor e ícone para identificar o orçamento."
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Cor */}
                <div>
                  <FormField label="Cor">
                    <div className="flex flex-wrap gap-3 pt-1">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { lightTap(); setColor(c); }}
                          className={`w-10 h-10 rounded-full transition-all active:scale-[0.98] ${
                            color === c
                              ? 'scale-110 ring-2 ring-gray-300 dark:ring-slate-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
                              : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </FormField>
                </div>

                {/* Ícone */}
                <div>
                  <FormField label="Ícone">
                    <button
                      type="button"
                      onClick={() => { lightTap(); setShowIconModal(true); }}
                      className="w-full h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-left text-gray-900 dark:text-gray-100 flex items-center justify-between transition hover:bg-gray-50 dark:hover:bg-slate-800 active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${color}18`, color }}
                        >
                          <IconComp size={16} />
                        </div>
                        <span className="truncate">{icon}</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>
                  </FormField>
                </div>
              </div>
            </section>

            {/* SEÇÃO 3: CONFIGURAÇÃO */}
            <section className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-800">
              <SectionHeader
                title="Configuração"
                description="Defina a frequência e comportamento do orçamento."
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Período */}
                <div>
                  <FormField label="Período" helper="Como o orçamento será renovado.">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'monthly' as const, label: 'Mensal' },
                        { key: 'biweekly' as const, label: 'Quinzenal' },
                        { key: 'weekly' as const, label: 'Semanal' }
                      ].map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => { lightTap(); setPeriod(p.key); }}
                          className={`h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                            period === p.key
                              ? 'bg-teal-600 text-white shadow-sm'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </FormField>
                </div>

                {/* Acumular saldo */}
                <div>
                  <FormField label="Acumular saldo" helper="O valor não gasto acumula para o mês seguinte.">
                    <div className="flex items-center justify-between h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                          <Sparkles size={14} />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Acumular</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => { lightTap(); setAccumulate(!accumulate); }}
                        className={`w-12 h-7 rounded-full relative transition-all active:scale-[0.98] shrink-0 ${
                          accumulate ? 'bg-teal-600' : 'bg-gray-300 dark:bg-slate-600'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                            accumulate ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </FormField>
                </div>
              </div>
            </section>

          </div>

          {/* ============================================================
              BLOCO 4: BARRA DE AÇÃO FIXA
              ============================================================ */}
          <div className="sticky bottom-0 mt-6 -mx-4 px-4 py-4 bg-white/95 dark:bg-slate-900/95 border-t border-gray-200 dark:border-slate-700 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.98]"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="h-11 rounded-xl bg-teal-600 px-6 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving
                  ? 'Salvando...'
                  : isEditing
                  ? 'Salvar alterações'
                  : 'Criar orçamento'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ============================================================
          MODAIS (mantidos exatamente iguais)
          ============================================================ */}

      {/* MODAL DE CATEGORIA */}
      {showCatModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCatModal(false)}
        >
          <div
            className="w-full max-w-lg h-[60vh] overflow-y-auto rounded-t-[32px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-5">
              <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl py-2 z-10">
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
        </div>,
        document.body
      )}

      {/* IconPicker */}
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