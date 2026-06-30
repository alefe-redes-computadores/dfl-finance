'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Filter, X, Tag, Wallet, CreditCard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'

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

const presets: Record<string, { label: string; start: string; end: string }> = {
  thisMonth: {
    label: 'Este mês',
    get start() {
      const now = new Date()
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    },
    get end() {
      return new Date().toISOString().split('T')[0]
    },
  },
  lastMonth: {
    label: 'Mês passado',
    get start() {
      const now = new Date()
      return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
    },
    get end() {
      const now = new Date()
      return new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
    },
  },
  last3Months: {
    label: 'Últimos 3 meses',
    get start() {
      const now = new Date()
      return new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0]
    },
    get end() {
      return new Date().toISOString().split('T')[0]
    },
  },
  thisYear: {
    label: 'Este ano',
    get start() {
      return new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    },
    get end() {
      return new Date().toISOString().split('T')[0]
    },
  },
}

export default function ReportFilters({ onChange, initialPreset = 'thisMonth', context }: ReportFiltersProps) {
  const { user } = useAuth()
  const [preset, setPreset] = useState(initialPreset)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  
  // 🆕 Estados para filtros cruzados
  const [tags, setTags] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [creditCards, setCreditCards] = useState<any[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [selectedCreditCards, setSelectedCreditCards] = useState<string[]>([])
  const [showTagFilter, setShowTagFilter] = useState(false)
  const [showAccountFilter, setShowAccountFilter] = useState(false)
  const [showCardFilter, setShowCardFilter] = useState(false)

  // Carrega opções dos filtros cruzados
  useEffect(() => {
    if (!user?.id) return
    const loadFilters = async () => {
      const [{ data: tagData }, { data: accData }, { data: cardData }] = await Promise.all([
        supabase.from('tags').select('id, name, color').eq('user_id', user.id).eq('context', context),
        supabase.from('accounts').select('id, name, color').eq('user_id', user.id).eq('context', context),
        supabase.from('credit_cards').select('id, name, color').eq('user_id', user.id).eq('context', context).eq('is_archived', false),
      ])
      setTags(tagData || [])
      setAccounts(accData || [])
      setCreditCards(cardData || [])
    }
    loadFilters()
  }, [user?.id, context])

  const applyPreset = (key: string) => {
    setPreset(key)
    setUseCustom(false)
    const p = presets[key]
    emitChange(p.start, p.end, key)
  }

  const applyCustom = () => {
    setUseCustom(true)
    if (customStart && customEnd) {
      emitChange(customStart, customEnd, 'custom')
    }
  }

  const emitChange = (start: string, end: string, presetKey: string) => {
    onChange({
      context,
      dateRange: { start, end },
      preset: presetKey,
      tags: selectedTags,
      accounts: selectedAccounts,
      creditCards: selectedCreditCards,
    })
  }

  const toggleFilter = (type: 'tag' | 'account' | 'card', id: string) => {
    if (type === 'tag') {
      setSelectedTags(prev => {
        const next = prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        return next
      })
    } else if (type === 'account') {
      setSelectedAccounts(prev => {
        const next = prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        return next
      })
    } else {
      setSelectedCreditCards(prev => {
        const next = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        return next
      })
    }
  }

  // Emite mudanças quando filtros cruzados mudam
  useEffect(() => {
    if (useCustom && customStart && customEnd) {
      emitChange(customStart, customEnd, 'custom')
    } else if (!useCustom) {
      const p = presets[preset]
      emitChange(p.start, p.end, preset)
    }
  }, [selectedTags, selectedAccounts, selectedCreditCards])

  // Dispara com valor inicial
  useEffect(() => {
    applyPreset(preset)
  }, [])

  const hasActiveFilters = selectedTags.length > 0 || selectedAccounts.length > 0 || selectedCreditCards.length > 0

  return (
    <div className="space-y-3">
      {/* Período */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <Filter size={14} />
            <span>Período</span>
          </div>
          <button
            onClick={() => setUseCustom(!useCustom)}
            className="text-xs text-teal-600 font-medium"
          >
            {useCustom ? 'Usar predefinição' : 'Personalizado'}
          </button>
        </div>

        {!useCustom ? (
          <div className="flex flex-wrap gap-2">
            {Object.entries(presets).map(([key, p]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  preset === key
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            />
            <span className="text-xs text-slate-500">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            />
          </div>
        )}
      </div>

      {/* 🆕 Filtros Cruzados */}
      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <Filter size={14} />
          <span>Filtros adicionais</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-teal-500 ml-1" />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Filtro de Tags */}
          <div className="relative">
            <button
              onClick={() => setShowTagFilter(!showTagFilter)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                selectedTags.length > 0
                  ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-700'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Tag size={12} />
              Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
            </button>
            {showTagFilter && tags.length > 0 && (
              <div className="absolute top-full mt-1 left-0 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-30 max-h-48 overflow-y-auto">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleFilter('tag', tag.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                      selectedTags.includes(tag.id)
                        ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                    {selectedTags.includes(tag.id) && <X size={12} className="ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filtro de Contas */}
          <div className="relative">
            <button
              onClick={() => setShowAccountFilter(!showAccountFilter)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                selectedAccounts.length > 0
                  ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-700'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Wallet size={12} />
              Contas {selectedAccounts.length > 0 && `(${selectedAccounts.length})`}
            </button>
            {showAccountFilter && accounts.length > 0 && (
              <div className="absolute top-full mt-1 left-0 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-30 max-h-48 overflow-y-auto">
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => toggleFilter('account', acc.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                      selectedAccounts.includes(acc.id)
                        ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.color }} />
                    {acc.name}
                    {selectedAccounts.includes(acc.id) && <X size={12} className="ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filtro de Cartões */}
          <div className="relative">
            <button
              onClick={() => setShowCardFilter(!showCardFilter)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                selectedCreditCards.length > 0
                  ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-700'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <CreditCard size={12} />
              Cartões {selectedCreditCards.length > 0 && `(${selectedCreditCards.length})`}
            </button>
            {showCardFilter && creditCards.length > 0 && (
              <div className="absolute top-full mt-1 left-0 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-30 max-h-48 overflow-y-auto">
                {creditCards.map(card => (
                  <button
                    key={card.id}
                    onClick={() => toggleFilter('card', card.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                      selectedCreditCards.includes(card.id)
                        ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: card.color }} />
                    {card.name}
                    {selectedCreditCards.includes(card.id) && <X size={12} className="ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}