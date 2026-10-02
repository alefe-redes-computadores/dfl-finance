'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Landmark,
  LoaderCircle,
  Paperclip,
  PiggyBank,
  Receipt,
  Repeat2,
  Search,
  Tags,
  Target,
  UserRound,
  X,
  SlidersHorizontal,
  Check,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import {
  searchFinancialData,
  type GlobalSearchResult,
} from '@/lib/globalSearch'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { getDynamicIcon } from '@/lib/iconUtils'

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const formatDate = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return dateFormatter.format(date).replace('.', '')
}


type SearchFilter =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'account'
  | 'card'
  | 'debt'
  | 'loan'
  | 'financing'
  | 'subscription'
  | 'goal'
  | 'category'

const filterOptions: Array<{
  id: SearchFilter
  label: string
  icon: typeof Receipt
}> = [
  { id: 'income', label: 'Receitas', icon: CircleDollarSign },
  { id: 'expense', label: 'Despesas', icon: Receipt },
  { id: 'transfer', label: 'Transferências', icon: ArrowLeftRight },
  { id: 'account', label: 'Contas', icon: Landmark },
  { id: 'card', label: 'Cartões', icon: CreditCard },
  { id: 'debt', label: 'Quem me deve', icon: UserRound },
  { id: 'loan', label: 'Empréstimos', icon: Banknote },
  { id: 'financing', label: 'Financiamentos', icon: CircleDollarSign },
  { id: 'subscription', label: 'Assinaturas', icon: Repeat2 },
  { id: 'goal', label: 'Metas', icon: Target },
  { id: 'category', label: 'Categorias', icon: Tags },
]

function resultFilter(item: GlobalSearchResult): SearchFilter | null {
  if (item.kind !== 'transaction') return item.kind as SearchFilter
  const type = String(item.transactionType || '').toLowerCase()
  if (type === 'income') return 'income'
  if (type === 'expense' || type === 'sangria') return 'expense'
  if (type === 'transfer') return 'transfer'
  return null
}

const kindPresentation: Record<
  string,
  { label: string; icon: typeof Receipt; shell: string; iconClass: string }
> = {
  account: {
    label: 'Conta',
    icon: Landmark,
    shell: 'bg-violet-50 dark:bg-violet-950/35',
    iconClass: 'text-violet-600 dark:text-violet-300',
  },
  card: {
    label: 'Cartão',
    icon: CreditCard,
    shell: 'bg-fuchsia-50 dark:bg-fuchsia-950/35',
    iconClass: 'text-fuchsia-600 dark:text-fuchsia-300',
  },
  debt: {
    label: 'Quem me deve',
    icon: UserRound,
    shell: 'bg-amber-50 dark:bg-amber-950/35',
    iconClass: 'text-amber-600 dark:text-amber-300',
  },
  loan: {
    label: 'Empréstimo',
    icon: Banknote,
    shell: 'bg-orange-50 dark:bg-orange-950/35',
    iconClass: 'text-orange-600 dark:text-orange-300',
  },
  financing: {
    label: 'Financiamento',
    icon: CircleDollarSign,
    shell: 'bg-indigo-50 dark:bg-indigo-950/35',
    iconClass: 'text-indigo-600 dark:text-indigo-300',
  },
  subscription: {
    label: 'Recorrência',
    icon: Repeat2,
    shell: 'bg-cyan-50 dark:bg-cyan-950/35',
    iconClass: 'text-cyan-600 dark:text-cyan-300',
  },
  goal: {
    label: 'Meta',
    icon: Target,
    shell: 'bg-emerald-50 dark:bg-emerald-950/35',
    iconClass: 'text-emerald-600 dark:text-emerald-300',
  },
  category: {
    label: 'Categoria',
    icon: Tags,
    shell: 'bg-slate-100 dark:bg-slate-800',
    iconClass: 'text-slate-600 dark:text-slate-300',
  },
}

function SearchResultRow({
  item,
  onOpen,
}: {
  item: GlobalSearchResult
  onOpen: (item: GlobalSearchResult) => void
}) {
  const isTransaction = item.kind === 'transaction'
  const type = String(item.transactionType || '').toLowerCase()
  const isIncome = type === 'income'
  const isExpense = type === 'expense' || type === 'sangria'
  const isTransfer = type === 'transfer'

  const CategoryIcon = useMemo(
    () =>
      isTransfer
        ? ArrowLeftRight
        : isTransaction || item.kind === 'category'
          ? getDynamicIcon(item.categoryIcon)
          : null,
    [isTransfer, isTransaction, item.kind, item.categoryIcon]
  )

  const presentation = kindPresentation[item.kind]
  const FallbackIcon = presentation?.icon || Receipt
  const Icon = CategoryIcon || FallbackIcon

  let amountClass = 'text-slate-900 dark:text-slate-100'
  let amountPrefix = ''
  let typeLabel = presentation?.label || item.subtitle

  if (isIncome) {
    amountClass = 'text-emerald-600 dark:text-emerald-400'
    amountPrefix = '+'
    typeLabel = 'Receita'
  } else if (isExpense) {
    amountClass = 'text-rose-600 dark:text-rose-400'
    amountPrefix = '-'
    typeLabel = type === 'sangria' ? 'Sangria' : 'Despesa'
  } else if (isTransfer) {
    amountClass = 'text-blue-600 dark:text-blue-400'
    typeLabel = 'Transferência'
  }

  const iconStyle =
    item.categoryColor && (isTransaction || item.kind === 'category')
      ? {
          color: item.categoryColor,
          backgroundColor: `${item.categoryColor}16`,
        }
      : undefined

  const shellClass =
    item.categoryColor && (isTransaction || item.kind === 'category')
      ? ''
      : presentation?.shell || 'bg-slate-100 dark:bg-slate-800'

  const iconClass =
    item.categoryColor && (isTransaction || item.kind === 'category')
      ? ''
      : presentation?.iconClass || 'text-slate-600 dark:text-slate-300'

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group flex w-full items-center gap-3.5 rounded-[22px] px-3.5 py-3 text-left transition duration-150 hover:bg-slate-50 active:scale-[0.99] active:bg-slate-100 dark:hover:bg-slate-800/70 dark:active:bg-slate-800"
    >
      <div
        style={iconStyle}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] ${shellClass}`}
      >
        <Icon size={20} strokeWidth={2.15} className={iconClass} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate text-[14px] font-extrabold tracking-[-0.01em] text-slate-900 dark:text-slate-50">
            {item.title}
          </p>

          {typeof item.amount === 'number' && (
            <span
              className={`shrink-0 text-[13px] font-black tabular-nums tracking-[-0.02em] ${amountClass}`}
            >
              {amountPrefix}
              {money.format(Math.abs(item.amount))}
            </span>
          )}
        </div>

        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
          <span className="shrink-0">{typeLabel}</span>

          {item.categoryName && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="truncate">{item.categoryName}</span>
            </>
          )}

          {item.date && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="inline-flex shrink-0 items-center gap-1">
                <CalendarDays size={11} />
                {formatDate(item.date)}
              </span>
            </>
          )}

          {item.hasAttachment && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <Paperclip
                size={12}
                className="shrink-0 text-sky-500"
                aria-label="Possui anexo"
              />
            </>
          )}
        </div>
      </div>

      <ChevronRight
        size={17}
        className="shrink-0 text-slate-300 transition-transform group-active:translate-x-0.5 dark:text-slate-600"
      />
    </button>
  )
}

export default function Page() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { vibrate } = useHapticFeedback()

  const [query, setQuery] = useState('')
  const [items, setItems] = useState<GlobalSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<SearchFilter[]>([])

  const trimmedQuery = query.trim()

  const visibleItems = useMemo(() => {
    if (activeFilters.length === 0) return items
    const selected = new Set(activeFilters)
    return items.filter((item) => {
      const filter = resultFilter(item)
      return filter ? selected.has(filter) : false
    })
  }, [items, activeFilters])

  const activeFilterLabels = useMemo(
    () =>
      activeFilters
        .map((id) => filterOptions.find((option) => option.id === id)?.label)
        .filter(Boolean) as string[],
    [activeFilters]
  )

  useEffect(() => {
    if (!user?.id || trimmedQuery.length < 2) {
      setItems([])
      setLoading(false)
      return
    }

    let active = true

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const result = await searchFinancialData(
          user.id,
          context as 'dfl' | 'personal',
          trimmedQuery
        )
        if (active) setItems(result)
      } finally {
        if (active) setLoading(false)
      }
    }, 180)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [trimmedQuery, user?.id, context])

  const openResult = (item: GlobalSearchResult) => {
    vibrate([10])
    router.push(item.href)
  }

  const clearSearch = () => {
    vibrate([5])
    setQuery('')
  }

  const toggleFilter = (filter: SearchFilter) => {
    vibrate([5])
    setActiveFilters((current) =>
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter]
    )
  }

  const clearFilters = () => {
    vibrate([5])
    setActiveFilters([])
  }

  useEffect(() => {
    if (!filtersOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [filtersOpen])

  return (
    <div className="app-premium-page px-4 pb-10 pt-3">
      <div className="mx-auto max-w-2xl">
        <header className="app-premium-header mb-5">
          <button
            type="button"
            onClick={() => {
              vibrate([5])
              router.back()
            }}
            aria-label="Voltar"
            className="app-premium-back"
          >
            <ArrowLeft size={20} className="text-slate-800 dark:text-slate-100" />
          </button>

          <div className="min-w-0">
            <h1 className="app-premium-title">
              Busca global
            </h1>
            <p className="app-premium-subtitle">
              Encontre qualquer coisa nas suas finanças.
            </p>
          </div>
        </header>

        <div className="sticky top-0 z-20 -mx-1 bg-slate-50/95 px-1 pb-3 backdrop-blur-xl dark:bg-slate-950/95">
          <div className="app-premium-search">
            {loading ? (
              <LoaderCircle
                size={19}
                className="shrink-0 animate-spin text-teal-600 dark:text-teal-400"
              />
            ) : (
              <Search
                size={19}
                className="shrink-0 text-teal-600 dark:text-teal-400"
              />
            )}

            <input
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Buscar nas finanças"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar transação, conta, cartão…"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-600"
            />

            {query && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Limpar busca"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90 dark:bg-slate-800 dark:text-slate-400"
              >
                <X size={15} />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                vibrate([5])
                setFiltersOpen(true)
              }}
              aria-label="Filtrar busca"
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] transition active:scale-90 ${
                activeFilters.length
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/20'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <SlidersHorizontal size={16} />
              {activeFilters.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-slate-950 px-1 text-[9px] font-black text-white dark:border-slate-900 dark:bg-white dark:text-slate-950">
                  {activeFilters.length}
                </span>
              )}
            </button>
          </div>

          {activeFilters.length > 0 && (
            <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="shrink-0 rounded-full bg-teal-50 px-3 py-1.5 text-[11px] font-extrabold text-teal-700 active:scale-[0.98] dark:bg-teal-950/40 dark:text-teal-300"
              >
                {activeFilterLabels.length === 1
                  ? activeFilterLabels[0]
                  : `${activeFilterLabels[0]} + ${activeFilterLabels.length - 1}`}
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 rounded-full px-2 py-1.5 text-[11px] font-bold text-slate-400 active:text-slate-700 dark:text-slate-600"
              >
                Limpar
              </button>
            </div>
          )}
        </div>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {trimmedQuery.length >= 2 && !loading
            ? `${visibleItems.length} ${visibleItems.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}`
            : loading ? 'Buscando' : ''}
        </div>

        {trimmedQuery.length < 2 ? (
          <div className="mt-10 flex flex-col items-center px-7 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
              <Search size={24} />
            </div>
            <p className="text-[15px] font-extrabold text-slate-800 dark:text-slate-200">
              Suas finanças, em uma busca
            </p>
            <p className="mt-1.5 max-w-xs text-[12px] leading-5 text-slate-500 dark:text-slate-500">
              Digite pelo menos 2 caracteres. A pesquisa usa seus dados locais e
              continua disponível offline.
            </p>
          </div>
        ) : loading && items.length === 0 ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm font-semibold text-slate-400">
            <LoaderCircle size={17} className="animate-spin" />
            Buscando…
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="mt-10 flex flex-col items-center px-7 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600">
              <Search size={24} />
            </div>
            <p className="text-[15px] font-extrabold text-slate-800 dark:text-slate-200">
              Nada por aqui
            </p>
            <p className="mt-1.5 text-[12px] text-slate-500">
              {items.length > 0 && activeFilters.length > 0
                ? 'Nenhum resultado corresponde aos filtros selecionados.'
                : `Nenhum resultado para “${trimmedQuery}”.`}
            </p>
          </div>
        ) : (
          <section className="mt-1">
            <div className="mb-2.5 flex items-center justify-between px-1">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-600">
                Resultados
              </p>
              <p className="text-[11px] font-bold tabular-nums text-slate-400 dark:text-slate-600">
                {visibleItems.length}
              </p>
            </div>

            <div className="app-premium-card space-y-1 p-1.5">
              {visibleItems.map((item) => (
                <SearchResultRow
                  key={`${item.kind}:${item.id}`}
                  item={item}
                  onOpen={openResult}
                />
              ))}
            </div>
          </section>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-semibold text-slate-400 dark:text-slate-700">
          <PiggyBank size={13} />
          Busca local e privada
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:px-4">
          <button
            type="button"
            aria-label="Fechar filtros"
            onClick={() => setFiltersOpen(false)}
            className="app-overlay absolute inset-0"
          />

          <div className="app-premium-sheet max-h-[86dvh] overflow-y-auto overscroll-contain">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />

            <div className="mb-4 flex items-start justify-between gap-3 px-1">
              <div>
                <h2 className="text-[18px] font-black tracking-[-0.025em] text-slate-950 dark:text-white">
                  Onde buscar?
                </h2>
                <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                  Escolha um ou mais tipos de resultado.
                </p>
              </div>

              {activeFilters.length > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {filterOptions.map((option) => {
                const selected = activeFilters.includes(option.id)
                const FilterIcon = option.icon

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleFilter(option.id)}
                    className={`flex min-h-[54px] items-center gap-3 rounded-[18px] border px-3.5 text-left transition active:scale-[0.98] ${
                      selected
                        ? 'border-teal-500/30 bg-teal-50 text-teal-800 ring-1 ring-teal-500/10 dark:border-teal-500/30 dark:bg-teal-950/35 dark:text-teal-200'
                        : 'border-slate-200/80 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${
                        selected
                          ? 'bg-teal-600 text-white'
                          : 'bg-white text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      <FilterIcon size={17} />
                    </span>
                    <span className="min-w-0 flex-1 text-[12px] font-extrabold leading-tight">
                      {option.label}
                    </span>
                    {selected && <Check size={15} className="shrink-0 text-teal-600 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                vibrate([8])
                setFiltersOpen(false)
              }}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-[17px] bg-slate-950 text-[13px] font-black text-white transition active:scale-[0.99] dark:bg-white dark:text-slate-950"
            >
              Ver {visibleItems.length} {visibleItems.length === 1 ? 'resultado' : 'resultados'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
