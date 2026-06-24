'use client'

import React, { useState, useMemo } from 'react'
import { X, Search } from 'lucide-react'
import * as Icons from 'lucide-react'
import { ICON_CATEGORIES } from '@/constants/iconLibrary'

interface IconPickerProps {
  isOpen: boolean
  onClose: () => void
  selectedIcon: string
  onSelect: (iconName: string) => void
}

export default function IconPicker({ isOpen, onClose, selectedIcon, onSelect }: IconPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filtra as categorias e ícones com base na busca
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return ICON_CATEGORIES

    const lowerQuery = searchQuery.toLowerCase()
    const filtered: Record<string, string[]> = {}

    Object.entries(ICON_CATEGORIES).forEach(([category, icons]) => {
      const matchingIcons = icons.filter(icon => 
        icon.toLowerCase().includes(lowerQuery) || category.toLowerCase().includes(lowerQuery)
      )
      if (matchingIcons.length > 0) {
        filtered[category] = matchingIcons
      }
    })

    return filtered
  }, [searchQuery])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}>
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl flex flex-col h-[85vh] animate-slide-up" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header Fixo */}
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-gray-800 dark:text-white">Escolha um ícone</h3>
            <button 
              onClick={onClose} 
              className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Barra de Busca */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar ícone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm font-medium text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>

        {/* Lista de Ícones (Scrollável) */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar pb-10">
          {Object.entries(filteredCategories).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Search size={40} className="mb-3 opacity-20" />
              <p>Nenhum ícone encontrado</p>
            </div>
          ) : (
            Object.entries(filteredCategories).map(([category, icons]) => (
              <div key={category} className="mb-8 last:mb-0">
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">
                  {category}
                </h4>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-4">
                  {icons.map((iconName) => {
                    // Renderização dinâmica do Lucide React
                    const LucideIcon = (Icons as any)[iconName]
                    if (!LucideIcon) return null

                    const isSelected = selectedIcon === iconName

                    return (
                      <button
                        key={iconName}
                        onClick={() => {
                          onSelect(iconName)
                          onClose()
                        }}
                        className={`flex items-center justify-center aspect-square rounded-xl transition-all ${
                          isSelected 
                            ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 border border-teal-500/50' 
                            : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-white border border-transparent'
                        }`}
                      >
                        <LucideIcon size={22} strokeWidth={isSelected ? 2.5 : 2} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
