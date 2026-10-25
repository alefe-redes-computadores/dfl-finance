'use client'

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, X } from 'lucide-react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { searchPremiumOptions } from '@/lib/premiumFieldPolicy'

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
  const [query, setQuery] = useState('')
  const { vibrate } = useHapticFeedback()
  const titleId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  // DFL_V160_R3_SELECT_FOCUS
  const selected = options.find((option) => option.value === value)
  const searchable = options.length >= 10
  const visibleOptions = useMemo(
    () => searchable ? searchPremiumOptions(options, query) : options,
    [options, query, searchable]
  )

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => {
      const selectedOption = sheetRef.current?.querySelector<HTMLButtonElement>(
        'button[data-selected="true"]:not(:disabled)'
      )
      const firstOption = sheetRef.current?.querySelector<HTMLButtonElement>(
        'button[data-option="true"]:not(:disabled)'
      )
      const searchInput = sheetRef.current?.querySelector<HTMLInputElement>('input[type="search"]')
      ;(searchInput || selectedOption || firstOption || sheetRef.current?.querySelector<HTMLButtonElement>(
        'button:not(:disabled)'
      ))?.focus()
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
      if (event.key === 'Tab' && sheetRef.current) {
        const candidates = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex]:not([tabindex="-1"])'))
        if (!candidates.length) return
        const first = candidates[0]
        const last = candidates[candidates.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }

    window.addEventListener('keydown', onKeyDown)

    const triggerAtOpen = triggerRef.current
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
      else triggerAtOpen?.focus()
    }
  }, [open])

  const sheet =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:px-4"
            onClick={() => setOpen(false)}
          >
            <div className="app-overlay absolute inset-0" />
            <div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              id={titleId}
              className="app-sheet-panel relative z-10 max-h-[78dvh] overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-6 motion-reduce:animate-none sm:rounded-[30px] sm:border-b"
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

              {searchable && (
                <div className="mb-3">
                  <label htmlFor={`${titleId}-search`}
                    className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-200">
                    Buscar opção
                  </label>
                  <input
                    id={`${titleId}-search`}
                    type="search"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Pesquisar pelo nome..."
                    className="app-input min-h-11 w-full rounded-xl px-3 text-sm"
                    autoComplete="off"
                  />
                  <p role="status" className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                    {visibleOptions.length} de {options.length} opções
                  </p>
                </div>
              )}
              {visibleOptions.length === 0 ? (
                <div className="app-empty-region py-10">
                  <p className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">
                    {options.length === 0 ? 'Nenhuma opção disponível' : 'Nenhum resultado encontrado'}
                  </p>
                  <p className="mt-1 max-w-[260px] text-[12px] text-gray-400 dark:text-gray-500">
                    Cadastre ou habilite uma opção antes de continuar.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pb-[max(0px,env(safe-area-inset-bottom))]">
                  {visibleOptions.map((option) => {
                    const active = option.value === value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={option.disabled}
                        data-option="true"
                        data-selected={active ? 'true' : 'false'}
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
                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25`}
                      >
                        {option.icon && (
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${active ? 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' : 'bg-white text-gray-500 shadow-sm dark:bg-slate-800 dark:text-gray-300'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25`} aria-hidden="true">
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
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          vibrate([5])
          setQuery('')
          setOpen(true)
        }}
        className={`app-select flex w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
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
