'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  Mic,
  MicOff,
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
  resolveFinancialCommands,
  searchFinancialData,
  preferredFinancialSearchKind,
  type FinancialSearchCommand,
  type GlobalSearchResult,
} from '@/lib/globalSearch'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useFinancialSpeech } from '@/hooks/useFinancialSpeech'
import { consumeFinancialVoiceTranscript } from '@/lib/voiceHandoff'
import { consumeContextualSearchQuery } from '@/lib/contextualSearchHandoff'
import { getDynamicIcon } from '@/lib/iconUtils'
import { interpretFinancialInput, smartDraftUrl } from '@/lib/smartFinancialInput'
import { resolveFinancialNavigationIntent } from '@/lib/financialNavigationIntent'
import { financialSearchRequestKey, financialSearchPhase } from '@/lib/financialSearchContinuity'
import FinancialCommandHub from '@/components/FinancialCommandHub'
import { isFinancialCommandOnlyQuery } from '@/lib/financialCommandOnly'
import { interpretFinancialReadOnlyQuestion } from '@/lib/financialReadOnlyQuestions'
import { interpretFinancialQuestion360 } from '@/lib/financialQuestion360'
import FinancialQuestion360Answer from '@/components/FinancialQuestion360Answer'
import FinancialReadOnlyAnswer from '@/components/FinancialReadOnlyAnswer'
import { stageAssistantQuestionHandoff } from '@/lib/assistantChatHandoff'
import { resolveFinancialHelp } from '@/lib/financialCommandHelp'
import FinancialCommandHelp from '@/components/FinancialCommandHelp'
import { resolveExtendedFinancialCommands, suggestFinancialRecovery, financialStarterExamples } from '@/lib/financialIntentExpansion'
import FinancialResultGuide from '@/components/FinancialResultGuide'
import { buildFinancialResultGuidance } from '@/lib/financialSearchGuidance'
import { buildFinancialSearchFacets, financialSearchFacet } from '@/lib/financialSearchFacets'
import { consumeCommandHubScope, rememberKnownHubRoute, type CommandHubScope } from '@/lib/financialCommandHub'

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
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
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
  // Um classificador comum alimenta os filtros antigos e os atalhos R426.
  return financialSearchFacet(item)
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

function SearchCommandRow({
  command,
  onOpen,
}: {
  command: FinancialSearchCommand
  onOpen: (command: FinancialSearchCommand) => void
}) {
  const Icon =
    command.intent === 'transfer'
      ? ArrowLeftRight
      : command.intent === 'review'
        ? Check
        : command.intent === 'plan'
          ? Target
          : command.intent === 'receipt'
            ? Receipt
            : CircleDollarSign

  return (
    <button
      type="button"
      onClick={() => onOpen(command)}
      className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition active:scale-[0.99] active:bg-teal-50 dark:active:bg-teal-950/30"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-extrabold text-slate-800 dark:text-slate-100">
          {command.title}
        </p>
        <p className="mt-0.5 truncate text-[10.5px] font-medium text-slate-400">
          {command.description}
        </p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-slate-300 dark:text-slate-600" />
    </button>
  )
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
  const { effectiveContext: context } = useContext_()
  const { vibrate } = useHapticFeedback()

  const [query, setQuery] = useState('')
  const [items, setItems] = useState<GlobalSearchResult[]>([])
  const [resolvedQuery, setResolvedQuery] = useState('')
  const [resolvedSearchKey, setResolvedSearchKey] = useState('')
  const [failedSearchKey, setFailedSearchKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<SearchFilter[]>([])
  const { status: voiceStatus, notice: voiceNotice, transcript, start: startVoice, cancel: cancelVoice } = useFinancialSpeech()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const receivedVoiceRef = useRef(false)
  const [hubScope, setHubScope] = useState<CommandHubScope>('search')
  const [hubVoiceEntry, setHubVoiceEntry] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [geminiHandoffError, setGeminiHandoffError] = useState('')
  const [starterOffset, setStarterOffset] = useState(0)
  const starterScopeRef = useRef('')
  useEffect(() => {
    if (starterScopeRef.current === hubScope) return
    starterScopeRef.current = hubScope
    const key = `dfl.finance.command.starters.r429:${hubScope}`
    let offset = 0
    try {
      const raw = window.sessionStorage.getItem(key)
      const saved = raw === null ? 0 : Number(raw)
      offset = Number.isSafeInteger(saved) && saved >= 0 ? saved % 12 : 0
      window.sessionStorage.setItem(key, String((offset + 3) % 12))
    } catch { /* Preferencias efemeras sao opcionais. */ }
    setStarterOffset(offset)
  }, [hubScope])
  const starterExamples = useMemo(() => financialStarterExamples(hubScope, starterOffset), [hubScope, starterOffset])

  // Uma transcricao vinda do botao global passa pela memoria de sessao,
  // nunca pela URL e nunca por gravacao automatica.
  useEffect(() => {
    if (receivedVoiceRef.current) return
    const commandSource = consumeCommandHubScope()
    if (commandSource) {
      setHubScope(commandSource.scope)
      setHubVoiceEntry(commandSource.voice)
    }
    const incoming = consumeFinancialVoiceTranscript()
    const contextual = consumeContextualSearchQuery()
    if (incoming) {
      receivedVoiceRef.current = true
      setQuery(incoming)
      inputRef.current?.blur()
    } else if (contextual) {
      receivedVoiceRef.current = true
      setQuery(contextual)
      inputRef.current?.blur()
    } else if (commandSource?.voice) {
      inputRef.current?.blur()
    } else if (commandSource) {
      // R423: ao vir da barra contextual, mostrar os atalhos antes
      // do teclado Android cobrir as sugestoes.
      inputRef.current?.blur()
    } else {
      inputRef.current?.focus()
    }
  }, [])
  useEffect(() => {
    if (transcript) setQuery(transcript)
  }, [transcript])

  const toggleVoice = () => {
    vibrate([8])
    if (voiceStatus === 'listening') cancelVoice()
    else void startVoice()
  }

  const trimmedQuery = query.trim()
  const requestKey = financialSearchRequestKey(user?.id, context as 'dfl' | 'personal', trimmedQuery, searchAttempt)
  const searchPhase = financialSearchPhase(requestKey, resolvedSearchKey, failedSearchKey, loading)
  const smartDraft = useMemo(() => interpretFinancialInput(trimmedQuery), [trimmedQuery])
  const navigationIntent = useMemo(() => resolveFinancialNavigationIntent(trimmedQuery), [trimmedQuery])
  // R430: consultas com calculo verificavel ficam locais; interpretacao aberta pertence ao Gemini.
  const readOnlyIntent = useMemo(() => smartDraft || navigationIntent || !trimmedQuery ? null
    : interpretFinancialReadOnlyQuestion(trimmedQuery), [trimmedQuery, smartDraft, navigationIntent])

  // R432: consultas financeiras verificaveis sem competir com o Gemini.
  // O motor R430 tem prioridade; consultas abertas nunca produzem totais presumidos.
  const question360 = useMemo(() => smartDraft || navigationIntent || readOnlyIntent || !trimmedQuery
    ? null : interpretFinancialQuestion360(trimmedQuery),
    [trimmedQuery, smartDraft, navigationIntent, readOnlyIntent])

  const extendedCommands = useMemo(() => navigationIntent || !trimmedQuery
    ? [] : resolveExtendedFinancialCommands(trimmedQuery), [trimmedQuery, navigationIntent])
  const commands = useMemo(() => navigationIntent || !trimmedQuery ? []
    : [...extendedCommands, ...resolveFinancialCommands(trimmedQuery)].slice(0, 3),
    [trimmedQuery, navigationIntent, extendedCommands])
  // R429: cadastrar entidades existentes e comando exato dispensam consulta a tabelas.
  // Mantem o reconhecedor R428 para as intencoes legadas.
  const commandOnly = useMemo(() =>
    isFinancialCommandOnlyQuery(trimmedQuery, commands.map(command => command.id)) || extendedCommands.length > 0,
    [trimmedQuery, commands, extendedCommands])
  const helpIntent = useMemo(() => smartDraft || navigationIntent || commandOnly || readOnlyIntent || question360
    ? null : resolveFinancialHelp(trimmedQuery),
    [trimmedQuery, smartDraft, navigationIntent, commandOnly, readOnlyIntent, question360])
  const recoveryActions = useMemo(() => suggestFinancialRecovery(trimmedQuery, hubScope), [trimmedQuery, hubScope])

  const visibleItems = useMemo(() => {
    if (loading || trimmedQuery !== resolvedQuery) return []
    // R424: nao mostrar resultado de outra conta/contexto nem do retry anterior.
    if (searchPhase !== 'ready') return []
    if (activeFilters.length === 0) return items
    const selected = new Set(activeFilters)
    return items.filter((item) => {
      const filter = resultFilter(item)
      return filter ? selected.has(filter) : false
    })
  }, [items, activeFilters, loading, trimmedQuery, resolvedQuery, searchPhase])

  const resultFacets = useMemo(() => searchPhase === 'ready' && !loading
    ? buildFinancialSearchFacets(items) : [], [items, searchPhase, loading])

  // R427: somente dados da consulta resolvida, com contexto validado pela R424.
  // Nada é sugerido enquanto o teclado estiver ativo ou durante edição de lançamentos.
  const resultGuidance = useMemo(() => {
    if (searchPhase !== 'ready' || loading || smartDraft || navigationIntent || !trimmedQuery || inputFocused) return null
    if (helpIntent || question360) return null
    return buildFinancialResultGuidance(items, resultFacets, preferredFinancialSearchKind(trimmedQuery), activeFilters)
  }, [searchPhase, loading, smartDraft, navigationIntent, helpIntent, question360, trimmedQuery, inputFocused, items, resultFacets, activeFilters])

  // Ao trocar usuario/contexto, filtros anteriores nao devem causar lista vazia enganosa.
  useEffect(() => { setActiveFilters([]) }, [user?.id, context])

  const activeFilterLabels = useMemo(
    () =>
      activeFilters
        .map((id) => filterOptions.find((option) => option.id === id)?.label)
        .filter(Boolean) as string[],
    [activeFilters]
  )

  useEffect(() => {
    if (!user?.id || trimmedQuery.length < 2 || smartDraft || navigationIntent || commandOnly) {
      setItems([])
      setResolvedQuery('')
      setResolvedSearchKey('')
      setFailedSearchKey('')
      setLoading(false)
      setSearchError(false)
      return
    }
    if (helpIntent) {
      setItems([])
      setResolvedQuery('')
      setResolvedSearchKey('')
      setFailedSearchKey('')
      setLoading(false)
      setSearchError(false)
      return
    }
    if (readOnlyIntent) {
      // Perguntas analiticas usam o indice local exclusivo, sem varredura da Busca 360.
      setItems([])
      setResolvedQuery('')
      setResolvedSearchKey('')
      setFailedSearchKey('')
      setLoading(false)
      setSearchError(false)
      return
    }
    if (question360) {
      // R432: cada pergunta usa somente as tabelas necessarias no contexto atual.
      setItems([])
      setResolvedQuery('')
      setResolvedSearchKey('')
      setFailedSearchKey('')
      setLoading(false)
      setSearchError(false)
      return
    }

    let active = true

    const timer = setTimeout(async () => {
      setLoading(true)
      setSearchError(false)
      setFailedSearchKey('')
      try {
        const result = await searchFinancialData(
          user.id,
          context as 'dfl' | 'personal',
          trimmedQuery
        )
        if (active) {
          setItems(result)
          setResolvedQuery(trimmedQuery)
          setResolvedSearchKey(requestKey)
          setFailedSearchKey('')
        }
      } catch {
        if (active) {
          setItems([])
          setResolvedQuery('')
          setResolvedSearchKey('')
          setFailedSearchKey(requestKey)
          setSearchError(true)
        }
      } finally {
        if (active) setLoading(false)
      }
    }, 180)

    return () => {
      active = false
      clearTimeout(timer)
    }
  // R428 baseline dependency tail: navigationIntent, commandOnly])
  }, [trimmedQuery, user?.id, context, searchAttempt, requestKey, smartDraft, navigationIntent, commandOnly, readOnlyIntent, helpIntent, question360])

  const openResult = (item: GlobalSearchResult) => {
    vibrate([10])
    router.push(item.href)
  }

  const openCommand = (command: FinancialSearchCommand) => {
    vibrate([10])
    rememberKnownHubRoute(user?.id ?? null, context, command.href)
    router.push(command.href)
  }

  // R430: nao envia pergunta ao provedor nem coloca dados privados na URL.
  // O usuario revisa o texto no chat existente e toca em Enviar quando quiser.
  const continueWithGemini = () => {
    if (!stageAssistantQuestionHandoff(user?.id, context as 'dfl' | 'personal', trimmedQuery)) {
      setGeminiHandoffError('Não consegui preparar a pergunta para o chat. Abra o Assistente para digitá-la diretamente.')
      return
    }
    setGeminiHandoffError('')
    vibrate([8])
    inputRef.current?.blur()
    router.push('/assistant/chat')
  }

  const clearSearch = () => {
    vibrate([5])
    setQuery('')
    setHubVoiceEntry(false)
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

  const chooseQuickFacet = (facet: SearchFilter | null) => {
    vibrate([5])
    setActiveFilters(previous => facet === null || (previous.length === 1 && previous[0] === facet)
      ? [] : [facet])
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
              Buscar e comandar
            </h1>
            <p className="app-premium-subtitle">
              {context === 'dfl' ? 'Empresa' : 'Pessoal'} · Encontre dados ou diga o que quer fazer.
            </p>
          </div>
        </header>

        <div className="sticky top-0 z-20 -mx-1 bg-slate-50/95 px-1 pb-3 backdrop-blur-xl dark:bg-slate-950/95">
          <div className="app-premium-search dfl-command-search">
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
              ref={inputRef}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setHubVoiceEntry(false) }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') inputRef.current?.blur()
                if (event.key === 'Escape') setQuery('')
              }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Busque ou diga: paguei 48 de gasolina…"
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
              onClick={toggleVoice}
              aria-label={voiceStatus === 'listening' ? 'Parar reconhecimento de voz' : 'Ditar comando financeiro'}
              aria-pressed={voiceStatus === 'listening'}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] transition active:scale-90 ${voiceStatus === 'listening' ? 'bg-rose-500 text-white animate-pulse motion-reduce:animate-none' : 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'}`}
            >
              {voiceStatus === 'listening' ? <MicOff size={17} /> : <Mic size={17} />}
            </button>

            <button
              type="button"
              onClick={() => {
                vibrate([5])
                inputRef.current?.blur()
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

        {voiceNotice && (
          <p role="status" className="mb-3 px-2 text-[11px] leading-4 text-teal-700 dark:text-teal-300">
            {voiceNotice}
          </p>
        )}

        {!smartDraft && navigationIntent && (
          <section aria-label="Navegacao financeira reconhecida" className="mb-4 rounded-[22px] border border-amber-400/25 bg-white p-3.5 shadow-sm dark:border-amber-400/20 dark:bg-slate-900/90">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Comando de navegação entendido</span>
              <span className="text-[10px] font-semibold text-slate-400">Sem alterações financeiras</span>
            </div>
            <p className="text-[13px] leading-5 text-slate-500 dark:text-slate-400">{navigationIntent.description}</p>
            <button type="button" onClick={() => { vibrate([8]); rememberKnownHubRoute(user?.id ?? null, context, navigationIntent.href); router.push(navigationIntent.href) }}
              className="mt-3 flex min-h-11 w-full items-center justify-between rounded-[15px] bg-teal-600 px-3.5 py-2 text-left text-[13px] font-bold text-white shadow-sm transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:bg-teal-700">
              <span>{navigationIntent.title}</span><ChevronRight size={18} aria-hidden="true" />
            </button>
          </section>
        )}

        {smartDraft && (
          <section aria-label="Previa de lancamento inteligente" className="mb-4 rounded-[23px] border border-teal-500/25 bg-white p-4 shadow-sm dark:bg-slate-800/90">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-300">
                <CircleDollarSign size={15} /> Lancamento entendido
              </span>
              <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">Nao salvo</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-extrabold text-slate-900 dark:text-slate-100">{smartDraft.description}</p>
                <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {smartDraft.type === 'income' ? 'Receita' : 'Despesa'} • {smartDraft.paid ? 'Realizada' : 'Pendente'} • {formatDate(smartDraft.date)}
                </p>
              </div>
              <span className={`shrink-0 text-[17px] font-black tabular-nums ${smartDraft.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {money.format(smartDraft.amount)}
              </span>
            </div>
            <div className="mt-3 space-y-1">
              {smartDraft.warnings.map((warning) => (
                <p key={warning} className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">• {warning}</p>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { vibrate([10]); router.push(smartDraftUrl(smartDraft)) }}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-[15px] bg-teal-700 px-4 text-[12px] font-extrabold text-white transition active:scale-[0.98] dark:bg-teal-600"
            >
              Revisar no cadastro completo <ChevronRight size={16} />
            </button>
          </section>
        )}

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {question360 ? 'Consulta financeira local disponível' : navigationIntent ? 'Comando de navegação disponível'
            : commandOnly ? 'Ação pronta para abrir após confirmação'
            : searchPhase === 'loading' && trimmedQuery.length >= 2 && !smartDraft ? 'Buscando'
            : searchPhase === 'error' ? 'A busca falhou'
            : searchPhase === 'ready' && trimmedQuery.length >= 2
              ? `${visibleItems.length} ${visibleItems.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}`
            : ''}
        </div>

        {hubVoiceEntry && !trimmedQuery && (
          <p role="status" className="mb-3 rounded-[14px] border border-teal-500/20 bg-teal-50/60 px-3 py-2 text-[11px] font-medium text-teal-800 dark:bg-teal-950/30 dark:text-teal-300">
            Modo voz pronto: toque no microfone da barra para falar.
          </p>
        )}

        {!trimmedQuery && !inputFocused && (
          <FinancialCommandHub scope={hubScope} userId={user?.id ?? null} context={context as 'dfl' | 'personal'} />
        )}

        {!trimmedQuery && !inputFocused && (
          <section aria-label="Ideias para experimentar" className="mb-4 rounded-[19px] border border-slate-200/70 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200">Experimente dizer...</p>
              <button type="button" onClick={() => { vibrate([4]); setStarterOffset(value => (value + 3) % 12) }}
                className="min-h-8 rounded-lg px-2 text-[10px] font-bold text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:text-teal-300">
                Outras ideias
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {starterExamples.map(example => (
                <button key={example} type="button" onClick={() => { vibrate([5]); setQuery(example); setHubVoiceEntry(false); inputRef.current?.blur() }}
                  className="min-h-9 rounded-full border border-teal-600/15 bg-teal-50/70 px-3 py-1.5 text-[11px] font-semibold text-teal-800 transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-teal-400/15 dark:bg-teal-950/25 dark:text-teal-300">
                  {example}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">Toque para preencher a busca. Nenhuma ação é executada automaticamente.</p>
          </section>
        )}

        {commands.length > 0 && (
          <section className="mt-1 mb-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-teal-600 dark:text-teal-400">
                {trimmedQuery ? 'Ações entendidas' : 'Ações rápidas'}
              </p>
              <p className="text-[9.5px] font-semibold text-slate-400">
                toque para executar
              </p>
            </div>
            <div className="app-premium-card space-y-0.5 p-1.5">
              {commands.map((command) => (
                <SearchCommandRow
                  key={command.id}
                  command={command}
                  onOpen={openCommand}
                />
              ))}
            </div>
          </section>
        )}

        {geminiHandoffError && (
          <p role="status" className="mb-3 rounded-xl border border-amber-500/25 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{geminiHandoffError}</p>
        )}

        {readOnlyIntent && !smartDraft && !navigationIntent && !commandOnly && (
          <FinancialReadOnlyAnswer question={readOnlyIntent} userId={user?.id ?? null}
            context={context as 'dfl' | 'personal'} onTalk={continueWithGemini}
            onView={() => { vibrate([6]); router.push(`/transactions?month=${readOnlyIntent.month}&filter=${readOnlyIntent.kind === 'income' ? 'income' : readOnlyIntent.kind === 'flow' ? 'all' : 'expense'}`) }} />
        )}

        {question360 && !smartDraft && !navigationIntent && !commandOnly && (
          <FinancialQuestion360Answer question={question360} userId={user?.id ?? null}
            context={context as 'dfl' | 'personal'} onTalk={continueWithGemini} />
        )}

        {helpIntent && (
          <FinancialCommandHelp topic={helpIntent}
            onExample={(value) => { vibrate([5]); setQuery(value); setHubVoiceEntry(false); inputRef.current?.blur() }}
            onOpen={(href) => { vibrate([8]); rememberKnownHubRoute(user?.id ?? null, context, href); router.push(href) }}
            onTalk={continueWithGemini} />
        )}

        {resultGuidance && (
          <FinancialResultGuide guidance={resultGuidance} onRefine={chooseQuickFacet} onOpen={openResult} />
        )}

        {searchPhase === 'ready' && resultFacets.length > 1 && !smartDraft && !navigationIntent && !helpIntent && (
          <section aria-label="Refinar resultados desta busca" className="-mx-1 mb-3 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max items-center gap-1.5">
              <button type="button" onClick={() => chooseQuickFacet(null)} aria-pressed={activeFilters.length === 0}
                className={`min-h-9 shrink-0 rounded-full border px-3 text-[11px] font-bold transition active:scale-[0.98] ${activeFilters.length === 0 ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>
                Todos · {items.length}
              </button>
              {resultFacets.slice(0, 7).map(facet => {
                const selected = activeFilters.length === 1 && activeFilters[0] === facet.id
                return (
                  <button key={facet.id} type="button" onClick={() => chooseQuickFacet(facet.id)} aria-pressed={selected}
                    className={`min-h-9 shrink-0 rounded-full border px-3 text-[11px] font-bold transition active:scale-[0.98] ${selected ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>
                    {filterOptions.find(option => option.id === facet.id)?.label ?? facet.id} · {facet.count}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {helpIntent || readOnlyIntent || question360 ? null : smartDraft || navigationIntent || commandOnly || !trimmedQuery ? null : trimmedQuery.length < 2 ? (
          <div className="mt-10 flex flex-col items-center px-7 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
              <Search size={24} />
            </div>
            <p className="text-[15px] font-extrabold text-slate-800 dark:text-slate-200">
              Seu Command Center financeiro
            </p>
            <p className="mt-1.5 max-w-xs text-[12px] leading-5 text-slate-500 dark:text-slate-500">
              Busque valores, meses, contas e transações ou use comandos como
              “nova despesa”, “pendências” e “comprovantes”. Seus dados continuam locais e privados.
            </p>
          </div>
        ) : searchError && searchPhase === 'error' ? (
          <div className="mt-10 flex flex-col items-center px-7 text-center" role="alert">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-amber-500/10 text-amber-500">
              <Search size={24} />
            </div>
            <p className="text-[15px] font-extrabold text-slate-800 dark:text-slate-200">
              A busca não respondeu
            </p>
            <p className="mt-1.5 text-[12px] text-slate-500">
              Seus dados continuam preservados. Tente consultar novamente.
            </p>
            <button
              type="button"
              onClick={() => setSearchAttempt((current) => current + 1)}
              className="mt-4 rounded-full bg-teal-600 px-5 py-2.5 text-[12px] font-extrabold text-white active:scale-95"
            >
              Tentar novamente
            </button>
          </div>
        ) : searchPhase === 'loading' ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm font-semibold text-slate-400">
            <LoaderCircle size={17} className="animate-spin" />
            Buscando…
          </div>
        ) : visibleItems.length === 0 ? (
          <section aria-label="Orientacao para busca sem resultados" className="mt-4 rounded-[22px] border border-slate-200/70 bg-white/80 px-4 py-5 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                <Search size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[14px] font-extrabold text-slate-900 dark:text-slate-100">
                  {items.length > 0 && activeFilters.length > 0 ? 'Vamos ajustar os filtros' : 'Ainda não encontrei um registro'}
                </h2>
                <p className="mt-1 text-[11.5px] leading-[1.6] text-slate-500 dark:text-slate-400">
                  {items.length > 0 && activeFilters.length > 0
                    ? 'Existem resultados na consulta, mas nenhum com os filtros atuais.'
                    : `A pesquisa por “${trimmedQuery}” não retornou registros locais. Você pode tentar outra frase ou abrir uma área relacionada.`}
                </p>
              </div>
            </div>
            {items.length > 0 && activeFilters.length > 0 ? (
              <button type="button" onClick={clearFilters}
                className="mt-3 min-h-10 rounded-xl bg-teal-600 px-4 text-[12px] font-bold text-white transition active:scale-[0.98]">
                Limpar filtros e mostrar resultados
              </button>
            ) : (
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">Caminhos que podem ajudar</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {recoveryActions.map(action => (
                    <button key={action.id} type="button" onClick={() => { vibrate([8]); router.push(action.href) }}
                      className="flex min-h-[55px] items-center gap-2.5 rounded-[14px] border border-slate-200/70 bg-slate-50/70 px-3 text-left transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-slate-700/70 dark:bg-slate-800/60">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-extrabold text-slate-800 dark:text-slate-100">{action.title}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-slate-500 dark:text-slate-400">{action.detail}</span>
                      </span>
                      <ChevronRight size={15} className="shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <button type="button" onClick={continueWithGemini}
                  className="mt-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-[14px] border border-teal-500/25 bg-teal-50 px-3.5 text-left text-[12px] font-bold text-teal-800 transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-teal-500/20 dark:bg-teal-950/35 dark:text-teal-200">
                  <span>Conversar com Gemini sobre esta pergunta</span><ChevronRight size={16} aria-hidden="true" />
                </button>
                <p className="mt-2.5 text-[10px] leading-4 text-slate-400 dark:text-slate-500">Sugestões de navegação, não resultados encontrados. O envio ao Gemini ocorre só no chat, após sua confirmação, incluindo o contexto estruturado do Assistente. Dados não são alterados.</p>
              </div>
            )}
          </section>
        ) : (
          <section className="mt-1">
            <div className="mb-2.5 flex items-center justify-between px-1">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-600">
                Resultados
              </p>
              <p className="text-[11px] font-bold tabular-nums text-slate-400 dark:text-slate-600">
                {visibleItems.length}{items.length >= 40 ? ' · refine para encontrar mais' : ''}
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
          Busca e comandos locais e privados
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

          <div role="dialog" aria-modal="true" aria-label="Filtros da busca financeira" className="app-premium-sheet max-h-[86dvh] overflow-y-auto overscroll-contain pb-[calc(12px+var(--safe-area-bottom))]">
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
