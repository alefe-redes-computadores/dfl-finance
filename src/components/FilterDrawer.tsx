'use client'

import { useState, useEffect } from 'react'
import { X, Filter, Check } from 'lucide-react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

interface FilterDrawerProps {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: { types: string[], accounts: string[], categories: string[] }) => void
  accounts?: any[]
  categories?: any[]
  initialFilters?: { types: string[], accounts: string[], categories: string[] }
}

export default function FilterDrawer({ 
  isOpen, 
  onClose, 
  onApply, 
  accounts = [], 
  categories = [], 
  initialFilters 
}: FilterDrawerProps) {
  const { vibrate, success } = useHapticFeedback()

  // Estados locais para os filtros selecionados
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // Quando o Drawer abrir, carrega os filtros que já estavam aplicados
  useEffect(() => {
    if (isOpen) {
      setSelectedTypes(initialFilters?.types || [])
      setSelectedAccounts(initialFilters?.accounts || [])
      setSelectedCategories(initialFilters?.categories || [])
    }
  }, [isOpen, initialFilters])

  if (!isOpen) return null

  // Função genérica para alternar seleção múltipla
  const toggleSelection = (item: string, list: string[], setList: (val: string[]) => void) => {
    vibrate([10])
    if (list.includes(item)) {
      setList(list.filter(i => i !== item))
    } else {
      setList([...list, item])
    }
  }

  const handleClear = () => {
    vibrate([10, 20])
    setSelectedTypes([])
    setSelectedAccounts([])
    setSelectedCategories([])
  }

  const handleApply = () => {
    success()
    onApply({
      types: selectedTypes,
      accounts: selectedAccounts,
      categories: selectedCategories
    })
    onClose()
  }

  const txTypes = [
    { id: 'income', label: 'Receitas' },
    { id: 'expense', label: 'Despesas' },
    { id: 'transfer', label: 'Transferências' }
  ]

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
      <div
        className="relative bg-white dark:bg-slate-800 w-full max-w-md rounded-t-[32px] p-6 max-h-[85vh] overflow-y-auto shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Puxador (Handle) */}
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />

        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Filter size={20} className="text-teal-600 dark:text-teal-400" /> Filtros
          </h3>
          <div className="flex items-center gap-2">
            {(selectedTypes.length > 0 || selectedAccounts.length > 0 || selectedCategories.length > 0) && (
              <button onClick={handleClear} className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors mr-2 active:scale-95">
                Limpar
              </button>
            )}
            <button onClick={() => { vibrate([10]); onClose(); }} className="p-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-full active:scale-95 transition-transform">
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Tipos de Transação */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 block">Tipo de Transação</label>
            <div className="flex flex-wrap gap-2">
              {txTypes.map(type => {
                const isSelected = selectedTypes.includes(type.id)
                return (
                  <button
                    key={type.id}
                    onClick={() => toggleSelection(type.id, selectedTypes, setSelectedTypes)}
                    className={`px-4 py-2 rounded-[16px] text-sm font-bold transition-all active:scale-[0.95] flex items-center gap-2 ${
                      isSelected
                        ? 'bg-teal-700 text-white shadow-sm shadow-teal-700/20'
                        : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-slate-600'
                    }`}
                  >
                    {type.label}
                    {isSelected && <Check size={14} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Contas */}
          {accounts && accounts.length > 0 && (
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 block">Contas</label>
              <div className="flex flex-wrap gap-2">
                {accounts.map((acc: any) => {
                  const isSelected = selectedAccounts.includes(acc.id)
                  return (
                    <button
                      key={acc.id}
                      onClick={() => toggleSelection(acc.id, selectedAccounts, setSelectedAccounts)}
                      className={`px-4 py-2 rounded-[16px] text-sm font-bold transition-all active:scale-[0.95] flex items-center gap-2 ${
                        isSelected
                          ? 'bg-teal-700 text-white shadow-sm shadow-teal-700/20'
                          : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-slate-600'
                      }`}
                    >
                      {acc.name}
                      {isSelected && <Check size={14} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Categorias */}
          {categories && categories.length > 0 && (
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 block">Categorias</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat: any) => {
                  const isSelected = selectedCategories.includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleSelection(cat.id, selectedCategories, setSelectedCategories)}
                      className={`px-4 py-2 rounded-[16px] text-sm font-bold transition-all active:scale-[0.95] flex items-center gap-2 ${
                        isSelected
                          ? 'bg-teal-700 text-white shadow-sm shadow-teal-700/20'
                          : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-slate-600'
                      }`}
                    >
                      {cat.name}
                      {isSelected && <Check size={14} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleApply}
          className="w-full bg-teal-700 hover:bg-teal-800 text-white py-4 rounded-[24px] font-bold mt-8 active:scale-[0.98] transition-transform shadow-lg shadow-teal-700/20 flex items-center justify-center gap-2"
        >
          <Check size={20} /> Aplicar Filtros
        </button>
      </div>
    </div>
  )
}
