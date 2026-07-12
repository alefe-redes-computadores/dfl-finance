'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Filter, X, Tag, Wallet, CreditCard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
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
  const { vibrate } = useHapticFeedback()
  
  const [preset, setPreset] = useState(initialPreset)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  
  const [tags, setTags] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [creditCards, setCreditCards] = useState<any[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [selectedCreditCards, setSelectedCreditCards] = useState<string[]>([])
  
  const [showTagFilter, setShowTagFilter] = useState(false)
  const [showAccountFilter, setShowAccountFilter] = useState(false)
  const [showCardFilter, setShowCardFilter] = useState(false)

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
    vibrate([5])
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
    vibrate([5])
    if (type === 'tag') {
      setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
    } else if (type === 'account') {
      setSelectedAccounts(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])
    } else {
      setSelectedCreditCards(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
    }
  }

  useEffect(() => {
    if (useCustom && customStart && customEnd) {
      emitChange(customStart, customEnd, 'custom')
    } else if (!useCustom) {
      const p = presets[preset]
      emitChange(p.start, p.end, preset)
    }
  }, [selectedTags, selectedAccounts, selectedCreditCards])

  useEffect(() => {
    applyPreset(preset)
  }, [])

  const hasActiveFilters = selectedTags.length > 0 || selectedAccounts.length > 0 || selectedCreditCards.length > 0

  return (
    <div className="space-y-4">
      <div className="space-y-3 bg-white dark:bg-slate-800 p-4 rounded-[24px] border border-gray-50 dark:border-slate-700/50 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 uppercase tracking-widest">
            <Filter size={14} />
            <span>Período</span>
          </div>
          <button
            onClick={() => { vibrate([5]); setUseCustom(!useCustom); }}
            className="text-[12px] text-teal-600 dark:text-teal-400 font-bold active:scale-95 transition-transform"
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
                className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all active:scale-[0.95] ${
                  preset === key
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                    : 'bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
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
              className="flex-1 px-3 py-2 text-[13px] font-bold border border-gray-100 dark:border-slate-700 rounded-[16px] bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-200 outline-none focus:border-teal-500"
            />
            <span className="text-[12px] font-bold text-gray-400">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 px-3 py-2 text-[13px] font-bold border border-gray-100 dark:border-slate-700 rounded-[16px] bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-200 outline-none focus:border-teal-500"
            />
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
          {/* Filtro de Tags */}
          <div className="relative">
            <button
              onClick={() => { vibrate([5]); setShowTagFilter(!showTagFilter); }}
              className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all flex items-center gap-1.5 active:scale-[0.95] ${
                selectedTags.length > 0
                  ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-700/50'
                  : 'bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
              }`}
            >
              <Tag size={12} />
              Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
            </button>
            {showTagFilter && tags.length > 0 && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTagFilter(false)} />
                <div className="absolute top-full mt-2 left-0 w-56 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-gray-100 dark:border-slate-700/50 p-2 z-50 max-h-56 overflow-y-auto animate-in zoom-in-95 duration-200">
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleFilter('tag', tag.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-[12px] text-[13px] font-bold transition-colors flex items-center gap-2 mb-1 last:mb-0 ${
                        selectedTags.includes(tag.id)
                          ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                      {selectedTags.includes(tag.id) && <X size={12} className="ml-auto" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Filtro de Contas */}
          <div className="relative">
            <button
              onClick={() => { vibrate([5]); setShowAccountFilter(!showAccountFilter); }}
              className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all flex items-center gap-1.5 active:scale-[0.95] ${
                selectedAccounts.length > 0
                  ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-700/50'
                  : 'bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
              }`}
            >
              <Wallet size={12} />
              Contas {selectedAccounts.length > 0 && `(${selectedAccounts.length})`}
            </button>
            {showAccountFilter && accounts.length > 0 && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAccountFilter(false)} />
                <div className="absolute top-full mt-2 left-0 w-56 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-gray-100 dark:border-slate-700/50 p-2 z-50 max-h-56 overflow-y-auto animate-in zoom-in-95 duration-200">
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => toggleFilter('account', acc.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-[12px] text-[13px] font-bold transition-colors flex items-center gap-2 mb-1 last:mb-0 ${
                        selectedAccounts.includes(acc.id)
                          ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.color }} />
                      {acc.name}
                      {selectedAccounts.includes(acc.id) && <X size={12} className="ml-auto" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Filtro de Cartões */}
          <div className="relative">
            <button
              onClick={() => { vibrate([5]); setShowCardFilter(!showCardFilter); }}
              className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all flex items-center gap-1.5 active:scale-[0.95] ${
                selectedCreditCards.length > 0
                  ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-700/50'
                  : 'bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
              }`}
            >
              <CreditCard size={12} />
              Cartões {selectedCreditCards.length > 0 && `(${selectedCreditCards.length})`}
            </button>
            {showCardFilter && creditCards.length > 0 && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCardFilter(false)} />
                <div className="absolute top-full mt-2 left-0 w-56 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-gray-100 dark:border-slate-700/50 p-2 z-50 max-h-56 overflow-y-auto animate-in zoom-in-95 duration-200">
                  {creditCards.map(card => (
                    <button
                      key={card.id}
                      onClick={() => toggleFilter('card', card.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-[12px] text-[13px] font-bold transition-colors flex items-center gap-2 mb-1 last:mb-0 ${
                        selectedCreditCards.includes(card.id)
                          ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: card.color }} />
                      {card.name}
                      {selectedCreditCards.includes(card.id) && <X size={12} className="ml-auto" />}
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
