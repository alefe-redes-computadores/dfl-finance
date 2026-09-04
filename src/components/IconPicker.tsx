// src/components/IconPicker.tsx
'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
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

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return ICON_CATEGORIES

    const filtered: Record<string, string[]> = {}

    Object.entries(ICON_CATEGORIES).forEach(([category, icons]) => {
      const matchingIcons = icons.filter((icon) =>
        icon.toLowerCase().includes(query) || category.toLowerCase().includes(query)
      )

      if (matchingIcons.length > 0) filtered[category] = matchingIcons
    })

    return filtered
  }, [searchQuery])

  if (!isOpen || typeof document === 'undefined') return null

  const closePicker = () => {
    setSearchQuery('')
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[160000] flex items-end justify-center bg-black/55 backdrop-blur-sm"
      onClick={closePicker}
      role="presentation"
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[32px] border border-b-0 border-gray-200/70 bg-white shadow-[0_-16px_60px_rgba(15,23,42,0.18)] animate-in slide-in-from-bottom-6 duration-200 dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Escolher ícone"
      >
        <div className="shrink-0 border-b border-gray-100 px-5 pb-4 pt-3 dark:border-slate-800">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">Escolha um ícone</h3>
              <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">Busque ou navegue por categoria</p>
            </div>

            <button
              type="button"
              onClick={closePicker}
              aria-label="Fechar seletor de ícones"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors active:scale-[0.97] dark:bg-slate-800 dark:text-gray-400"
            >
              <X size={19} />
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800">
            <Search size={18} className="shrink-0 text-gray-400" />
            <input
              type="search"
              placeholder="Ex: casa, comida, carro..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpar busca"
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-white dark:hover:bg-slate-700"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 custom-scrollbar">
          {Object.keys(filteredCategories).length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-slate-800">
                <Search size={24} />
              </div>
              <p className="text-[15px] font-semibold text-gray-700 dark:text-gray-300">Nenhum ícone encontrado</p>
              <p className="mt-1 text-[12px] text-gray-400">Tente outro termo.</p>
            </div>
          ) : (
            Object.entries(filteredCategories).map(([category, icons]) => (
              <section key={category} className="mb-7 last:mb-0">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                    {category}
                  </h4>
                  <span className="text-[10px] font-semibold text-gray-300 dark:text-slate-600">{icons.length}</span>
                </div>

                <div className="grid grid-cols-5 gap-2.5 sm:grid-cols-6">
                  {icons.map((iconName) => {
                    const LucideIcon = (Icons as any)[iconName]
                    if (!LucideIcon) return null

                    const isSelected = selectedIcon === iconName

                    return (
                      <button
                        type="button"
                        key={iconName}
                        title={iconName}
                        aria-label={`Ícone ${iconName}`}
                        aria-pressed={isSelected}
                        onClick={() => {
                          onSelect(iconName)
                          closePicker()
                        }}
                        className={`relative flex aspect-square items-center justify-center rounded-[16px] border transition-all active:scale-[0.92] ${
                          isSelected
                            ? 'border-teal-400 bg-teal-50 text-teal-700 shadow-sm ring-2 ring-teal-500/10 dark:border-teal-700 dark:bg-teal-900/25 dark:text-teal-400'
                            : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200 hover:bg-gray-100 dark:border-slate-800 dark:bg-slate-800 dark:text-gray-400 dark:hover:bg-slate-700'
                        }`}
                      >
                        <LucideIcon size={21} strokeWidth={isSelected ? 2.4 : 2} />
                        {isSelected && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-teal-500" />}
                      </button>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
