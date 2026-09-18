// src/components/SelectField.tsx
'use client'

import { useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

export type SelectFieldOption = {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

type SelectFieldProps = {
  value: string
  onChange: (value: string) => void
  options: SelectFieldOption[]
  placeholder?: string
  title?: string
  disabled?: boolean
  className?: string
}

export default function SelectField({
  value,
  onChange,
  options,
  placeholder = 'Selecione',
  title = 'Selecionar',
  disabled = false,
  className = '',
}: SelectFieldProps) {
  const [open, setOpen] = useState(false)
  const { vibrate } = useHapticFeedback()
  const selected = options.find((option) => option.value === value)

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { vibrate([5]); setOpen(true) }}
        className={`app-select flex w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={selected ? 'truncate' : 'truncate text-gray-400 dark:text-gray-500'}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={17} className="shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[500] flex items-end justify-center" onClick={() => setOpen(false)}>
          <div className="app-overlay absolute" />
          <div role="dialog" aria-modal="true" aria-label={title} className="app-sheet-panel z-10 max-h-[72dvh] overflow-y-auto p-5 animate-in slide-in-from-bottom-6" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />
            <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-3 bg-white py-1 dark:bg-slate-800">
              <h3 className="text-[18px] font-black text-gray-900 dark:text-white">{title}</h3>
              <button type="button" onClick={() => setOpen(false)} className="app-icon-action" aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="space-y-2">
              {options.map((option) => {
                const active = option.value === value
                return (
                  <button key={option.value} type="button" disabled={option.disabled} onClick={() => { if (!option.disabled) { vibrate([5]); onChange(option.value); setOpen(false) } }} className={`flex w-full items-center gap-3 rounded-[18px] border p-3.5 text-left transition-all active:scale-[0.99] disabled:opacity-40 ${active ? 'border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-900/20' : 'border-transparent bg-gray-50 dark:bg-slate-900'}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[14px] font-bold ${active ? 'text-teal-700 dark:text-teal-300' : 'text-gray-800 dark:text-gray-200'}`}>{option.label}</p>
                      {option.description && <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{option.description}</p>}
                    </div>
                    {active && <Check size={18} className="shrink-0 text-teal-600" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
