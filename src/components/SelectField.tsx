'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, X } from 'lucide-react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

export type SelectFieldOption = {
  value: string
  label: string
  icon?: ReactNode
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
  const titleId = useId()
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const sheet =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-end justify-center"
            onClick={() => setOpen(false)}
          >
            <div className="app-overlay absolute inset-0" />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="app-sheet-panel relative z-10 max-h-[78dvh] overflow-y-auto overscroll-contain p-5 animate-in slide-in-from-bottom-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

              <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-3 bg-white/95 py-1 backdrop-blur-xl dark:bg-slate-800/95">
                <h3 id={titleId} className="text-[18px] font-black text-gray-900 dark:text-white">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="app-icon-action"
                  aria-label={`Fechar ${title}`}
                >
                  <X size={18} />
                </button>
              </div>

              {options.length === 0 ? (
                <div className="app-empty-region py-10">
                  <p className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">
                    Nenhuma opção disponível
                  </p>
                  <p className="mt-1 max-w-[260px] text-[12px] text-gray-400 dark:text-gray-500">
                    Cadastre ou habilite uma opção antes de continuar.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pb-[max(0px,env(safe-area-inset-bottom))]">
                  {options.map((option) => {
                    const active = option.value === value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={option.disabled}
                        aria-pressed={active}
                        onClick={() => {
                          if (option.disabled) return
                          vibrate([5])
                          onChange(option.value)
                          setOpen(false)
                        }}
                        className={`flex min-h-14 w-full items-center gap-3 rounded-[18px] border p-3.5 text-left transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${
                          active
                            ? 'border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-900/20'
                            : 'border-transparent bg-gray-50 dark:bg-slate-900'
                        }`}
                      >
                        {option.icon && (
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${active ? 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' : 'bg-white text-gray-500 shadow-sm dark:bg-slate-800 dark:text-gray-300'}`} aria-hidden="true">
                            {option.icon}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-[14px] font-bold ${
                              active
                                ? 'text-teal-700 dark:text-teal-300'
                                : 'text-gray-800 dark:text-gray-200'
                            }`}
                          >
                            {option.label}
                          </p>
                          {option.description && (
                            <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
                              {option.description}
                            </p>
                          )}
                        </div>
                        {active && <Check size={18} className="shrink-0 text-teal-600" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          vibrate([5])
          setOpen(true)
        }}
        className={`app-select flex w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {selected?.icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-white text-teal-700 shadow-sm dark:bg-slate-800 dark:text-teal-300" aria-hidden="true">
              {selected.icon}
            </span>
          )}
          <span className={selected ? 'truncate' : 'truncate text-gray-400 dark:text-gray-500'}>
            {selected?.label || placeholder}
          </span>
        </span>
        <ChevronDown size={17} className="shrink-0 text-gray-400" />
      </button>

      {sheet}
    </>
  )
}
