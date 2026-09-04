// src/components/reports/ReportFilters.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { CreditCard, Filter, Tag, Wallet, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

export interface ReportFilterValues {
  context: string
  dateRange: {
    start: string
    end: string
  }
  preset: string
  tags: string[]
  accounts: string[]
  creditCards: string[]
}

interface ReportFiltersProps {
  onChange: (values: ReportFilterValues) => void
  initialPreset?: string
  context: string
}

function localISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type PresetDefinition = {
  label: string
  getRange: () => { start: string; end: string }
}

const presets: Record<string, PresetDefinition> = {
  thisMonth: {
    label: 'Este mês',
    getRange: () => {
      const now = new Date()
      return {
        start: localISODate(
          new Date(now.getFullYear(), now.getMonth(), 1)
        ),
        end: localISODate(now),
      }
    },
  },
  lastMonth: {
    label: 'Mês passado',
    getRange: () => {
      const now = new Date()
      return {
        start: localISODate(
          new Date(now.getFullYear(), now.getMonth() - 1, 1)
        ),
        end: localISODate(
          new Date(now.getFullYear(), now.getMonth(), 0)
        ),
      }
    },
  },
  last3Months: {
    label: 'Últimos 3 meses',
    getRange: () => {
      const now = new Date()
      return {
        start: localISODate(
          new Date(now.getFullYear(), now.getMonth() - 2, 1)
        ),
        end: localISODate(now),
      }
    },
  },
  thisYear: {
    label: 'Este ano',
    getRange: () => {
      const now = new Date()
      return {
        start: localISODate(new Date(now.getFullYear(), 0, 1)),
        end: localISODate(now),
      }
    },
  },
}

function normalizeContext(
  context: string
): 'dfl' | 'personal' | undefined {
  if (context === 'dfl' || context === 'personal') return context
  return undefined
}

export default function ReportFilters({
  onChange,
  initialPreset = 'thisMonth',
  context,
}: ReportFiltersProps) {
  const { user } = useAuth()
  const { vibrate } = useHapticFeedback()

  const validInitialPreset =
    initialPreset in presets ? initialPreset : 'thisMonth'

  const [preset, setPreset] = useState(validInitialPreset)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [selectedCreditCards, setSelectedCreditCards] = useState<
    string[]
  >([])

  const [showTagFilter, setShowTagFilter] = useState(false)
  const [showAccountFilter, setShowAccountFilter] = useState(false)
  const [showCardFilter, setShowCardFilter] = useState(false)

  const effectiveContext = normalizeContext(context)

  const tags = useLiveQuery(async () => {
    if (!user?.id) return []

    const rows = await db.tags
      .where('user_id')
      .equals(user.id)
      .toArray()

    return effectiveContext
      ? rows.filter((tag: any) => tag.context === effectiveContext)
      : rows
  }, [user?.id, effectiveContext])

  const accounts = useLiveQuery(async () => {
    if (!user?.id) return []

    const rows = await db.accounts
      .where('user_id')
      .equals(user.id)
      .toArray()

    return rows.filter(
      (account: any) =>
        !account.is_archived &&
        (!effectiveContext || account.context === effectiveContext)
    )
  }, [user?.id, effectiveContext])

  const creditCards = useLiveQuery(async () => {
    if (!user?.id) return []

    const rows = await db.credit_cards
      .where('user_id')
      .equals(user.id)
      .toArray()

    return rows.filter(
      (card: any) =>
        !card.is_archived &&
        (!effectiveContext || card.context === effectiveContext)
    )
  }, [user?.id, effectiveContext])

  const activeRange = useMemo(() => {
    if (useCustom && customStart && customEnd) {
      return {
        start: customStart,
        end: customEnd,
        presetKey: 'custom',
      }
    }

    const definition = presets[preset] || presets.thisMonth
    const range = definition.getRange()

    return {
      ...range,
      presetKey: preset in presets ? preset : 'thisMonth',
    }
  }, [useCustom, customStart, customEnd, preset])

  useEffect(() => {
    setSelectedTags([])
    setSelectedAccounts([])
    setSelectedCreditCards([])
    setShowTagFilter(false)
    setShowAccountFilter(false)
    setShowCardFilter(false)
  }, [context])

  useEffect(() => {
    const validTagIds = new Set((tags || []).map((item: any) => item.id))
    const validAccountIds = new Set(
      (accounts || []).map((item: any) => item.id)
    )
    const validCardIds = new Set(
      (creditCards || []).map((item: any) => item.id)
    )

    setSelectedTags((current) =>
      current.filter((id) => validTagIds.has(id))
    )
    setSelectedAccounts((current) =>
      current.filter((id) => validAccountIds.has(id))
    )
    setSelectedCreditCards((current) =>
      current.filter((id) => validCardIds.has(id))
    )
  }, [tags, accounts, creditCards])

  useEffect(() => {
    if (!activeRange.start || !activeRange.end) return

    onChange({
      context,
      dateRange: {
        start: activeRange.start,
        end: activeRange.end,
      },
      preset: activeRange.presetKey,
      tags: selectedTags,
      accounts: selectedAccounts,
      creditCards: selectedCreditCards,
    })
  }, [
    context,
    activeRange.start,
    activeRange.end,
    activeRange.presetKey,
    selectedTags,
    selectedAccounts,
    selectedCreditCards,
    onChange,
  ])

  const applyPreset = (key: string) => {
    if (!(key in presets)) return
    vibrate([5])
    setPreset(key)
    setUseCustom(false)
  }

  const applyCustom = () => {
    vibrate([5])
    setUseCustom(true)
  }

  const toggleFilter = (
    type: 'tag' | 'account' | 'card',
    id: string
  ) => {
    vibrate([5])

    if (type === 'tag') {
      setSelectedTags((current) =>
        current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id]
      )
      return
    }

    if (type === 'account') {
      setSelectedAccounts((current) =>
        current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id]
      )
      return
    }

    setSelectedCreditCards((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  const hasActiveFilters =
    selectedTags.length > 0 ||
    selectedAccounts.length > 0 ||
    selectedCreditCards.length > 0

  return (
    <div className="space-y-4">
      <div className="space-y-3 bg-white dark:bg-slate-800 p-4 rounded-[24px] border border-gray-50 dark:border-slate-700/50 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 uppercase tracking-widest">
            <Filter size={14} />
            <span>Período</span>
          </div>

          <button
            type="button"
            onClick={() => {
              vibrate([5])
              setUseCustom((current) => !current)
            }}
            className="text-[12px] text-teal-600 dark:text-teal-400 font-bold active:scale-95 transition-transform"
          >
            {useCustom ? 'Usar predefinição' : 'Personalizado'}
          </button>
        </div>

        {!useCustom ? (
          <div className="flex flex-wrap gap-2">
            {Object.entries(presets).map(([key, definition]) => (
              <button
                type="button"
                key={key}
                onClick={() => applyPreset(key)}
                className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all active:scale-[0.95] ${
                  preset === key
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                    : 'bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                {definition.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(event) =>
                  setCustomStart(event.target.value)
                }
                max={customEnd || undefined}
                className="min-w-0 flex-1 px-3 py-2 text-[13px] font-bold border border-gray-100 dark:border-slate-700 rounded-[16px] bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-200 outline-none focus:border-teal-500"
              />
              <span className="text-[12px] font-bold text-gray-400">
                até
              </span>
              <input
                type="date"
                value={customEnd}
                onChange={(event) =>
                  setCustomEnd(event.target.value)
                }
                min={customStart || undefined}
                className="min-w-0 flex-1 px-3 py-2 text-[13px] font-bold border border-gray-100 dark:border-slate-700 rounded-[16px] bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-200 outline-none focus:border-teal-500"
              />
            </div>

            {(!customStart || !customEnd) && (
              <p className="text-[11px] font-medium text-gray-400 px-1">
                Escolha a data inicial e final para aplicar o período personalizado.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 bg-white dark:bg-slate-800 p-4 rounded-[24px] border border-gray-50 dark:border-slate-700/50 shadow-sm">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 uppercase tracking-widest">
          <Filter size={14} />
          <span>Filtros Cruzados</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)] ml-1" />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                vibrate([5])
                setShowTagFilter((current) => !current)
              }}
              disabled={!tags?.length}
              className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all flex items-center gap-1.5 active:scale-[0.95] disabled:opacity-50 ${
                selectedTags.length > 0
                  ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-700/50'
                  : 'bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
              }`}
            >
              <Tag size={12} />
              Tags
              {selectedTags.length > 0 &&
                ` (${selectedTags.length})`}
            </button>

            {showTagFilter && (tags?.length || 0) > 0 && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowTagFilter(false)}
                />
                <div className="absolute top-full mt-2 left-0 w-56 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-gray-100 dark:border-slate-700/50 p-2 z-50 max-h-56 overflow-y-auto animate-in zoom-in-95 duration-200">
                  {(tags || []).map((tag: any) => (
                    <button
                      type="button"
                      key={tag.id}
                      onClick={() => toggleFilter('tag', tag.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-[12px] text-[13px] font-bold transition-colors flex items-center gap-2 mb-1 last:mb-0 ${
                        selectedTags.includes(tag.id)
                          ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color || '#94a3b8' }}
                      />
                      <span className="truncate">{tag.name}</span>
                      {selectedTags.includes(tag.id) && (
                        <X size={12} className="ml-auto shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                vibrate([5])
                setShowAccountFilter((current) => !current)
              }}
              disabled={!accounts?.length}
              className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all flex items-center gap-1.5 active:scale-[0.95] disabled:opacity-50 ${
                selectedAccounts.length > 0
                  ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-700/50'
                  : 'bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
              }`}
            >
              <Wallet size={12} />
              Contas
              {selectedAccounts.length > 0 &&
                ` (${selectedAccounts.length})`}
            </button>

            {showAccountFilter && (accounts?.length || 0) > 0 && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAccountFilter(false)}
                />
                <div className="absolute top-full mt-2 left-0 w-56 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-gray-100 dark:border-slate-700/50 p-2 z-50 max-h-56 overflow-y-auto animate-in zoom-in-95 duration-200">
                  {(accounts || []).map((account: any) => (
                    <button
                      type="button"
                      key={account.id}
                      onClick={() =>
                        toggleFilter('account', account.id)
                      }
                      className={`w-full text-left px-3 py-2.5 rounded-[12px] text-[13px] font-bold transition-colors flex items-center gap-2 mb-1 last:mb-0 ${
                        selectedAccounts.includes(account.id)
                          ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: account.color || '#94a3b8' }}
                      />
                      <span className="truncate">{account.name}</span>
                      {selectedAccounts.includes(account.id) && (
                        <X size={12} className="ml-auto shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                vibrate([5])
                setShowCardFilter((current) => !current)
              }}
              disabled={!creditCards?.length}
              className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all flex items-center gap-1.5 active:scale-[0.95] disabled:opacity-50 ${
                selectedCreditCards.length > 0
                  ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-700/50'
                  : 'bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
              }`}
            >
              <CreditCard size={12} />
              Cartões
              {selectedCreditCards.length > 0 &&
                ` (${selectedCreditCards.length})`}
            </button>

            {showCardFilter && (creditCards?.length || 0) > 0 && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowCardFilter(false)}
                />
                <div className="absolute top-full mt-2 left-0 w-56 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-gray-100 dark:border-slate-700/50 p-2 z-50 max-h-56 overflow-y-auto animate-in zoom-in-95 duration-200">
                  {(creditCards || []).map((card: any) => (
                    <button
                      type="button"
                      key={card.id}
                      onClick={() =>
                        toggleFilter('card', card.id)
                      }
                      className={`w-full text-left px-3 py-2.5 rounded-[12px] text-[13px] font-bold transition-colors flex items-center gap-2 mb-1 last:mb-0 ${
                        selectedCreditCards.includes(card.id)
                          ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: card.color || '#94a3b8' }}
                      />
                      <span className="truncate">{card.name}</span>
                      {selectedCreditCards.includes(card.id) && (
                        <X size={12} className="ml-auto shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
