'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  ChevronDown,
  Landmark,
  Plus,
  Search,
  X,
} from 'lucide-react'

import BankLogo from '@/components/BankLogo'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import {
  COMMON_BANKS,
  canonicalizeBankName,
} from '@/lib/accountPresentation'

type BankPickerFieldProps = {
  value: string
  onChange: (bank: string) => void
  disabled?: boolean
}

const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')

export default function BankPickerField({
  value,
  onChange,
  disabled = false,
}: BankPickerFieldProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { vibrate } = useHapticFeedback()

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

  const canonicalValue = canonicalizeBankName(value)
  const query = search.trim()
  const normalizedQuery = normalizeSearch(query)

  const filteredBanks = useMemo(() => {
    if (!normalizedQuery) return COMMON_BANKS

    return COMMON_BANKS.filter((bank) =>
      normalizeSearch(bank).includes(normalizedQuery),
    )
  }, [normalizedQuery])

  const exactMatch = COMMON_BANKS.some(
    (bank) => normalizeSearch(bank) === normalizedQuery,
  )

  const customCandidate =
    query.length > 0 && !exactMatch
      ? canonicalizeBankName(query)
      : ''

  const selectBank = (bank: string) => {
    const canonical = canonicalizeBankName(bank)
    if (!canonical) return

    vibrate([5])
    onChange(canonical)
    setSearch('')
    setOpen(false)
  }

  const sheet =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[120000] flex items-end justify-center sm:items-center sm:p-5"
            onClick={() => setOpen(false)}
          >
            <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="Selecionar banco ou instituição"
              className="relative max-h-[88dvh] w-full max-w-lg overflow-hidden rounded-t-[32px] border border-black/5 bg-white shadow-[0_-20px_60px_rgba(15,23,42,0.22)] animate-in slide-in-from-bottom-8 duration-300 dark:border-white/10 dark:bg-slate-900 sm:rounded-[32px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-5 pb-3 pt-3 sm:pt-5">
                <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-gray-200 dark:bg-slate-700 sm:hidden" />

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                      Conta
                    </p>
                    <h3 className="mt-0.5 text-[21px] font-semibold tracking-tight text-gray-950 dark:text-white">
                      Banco / Instituição
                    </h3>
                    <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500">
                      Escolha da lista ou cadastre um nome personalizado
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gray-100 text-gray-500 active:scale-95 dark:bg-slate-800 dark:text-gray-300"
                    aria-label="Fechar seleção de banco"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="relative mt-4">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar ou digitar outra instituição"
                    autoFocus
                    className="h-12 w-full rounded-[17px] border border-black/5 bg-gray-50 pl-11 pr-10 text-[14px] font-medium text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25 transition focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-gray-100"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 active:bg-gray-100 dark:active:bg-slate-700"
                      aria-label="Limpar busca"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[58dvh] overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {customCandidate && (
                  <button
                    type="button"
                    onClick={() => selectBank(customCandidate)}
                    className="mb-2 flex min-h-16 w-full items-center gap-3 rounded-[20px] border border-teal-200 bg-teal-50 p-3.5 text-left active:scale-[0.99] dark:border-teal-800 dark:bg-teal-500/10"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-teal-600 text-white">
                      <Plus size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-teal-600 dark:text-teal-300">
                        Usar instituição personalizada
                      </p>
                      <p className="mt-0.5 truncate text-[14px] font-bold text-gray-900 dark:text-white">
                        {customCandidate}
                      </p>
                    </div>
                  </button>
                )}

                {filteredBanks.length === 0 && !customCandidate ? (
                  <div className="py-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[19px] bg-gray-100 text-gray-400 dark:bg-slate-800">
                      <Landmark size={24} />
                    </div>
                    <p className="mt-3 text-[13px] font-semibold text-gray-700 dark:text-gray-200">
                      Nenhuma instituição encontrada
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredBanks.map((bank) => {
                      const active =
                        normalizeSearch(canonicalValue) === normalizeSearch(bank)

                      return (
                        <button
                          key={bank}
                          type="button"
                          onClick={() => selectBank(bank)}
                          aria-pressed={active}
                          className={`flex min-h-14 w-full items-center gap-3 rounded-[18px] border p-3 text-left transition-all active:scale-[0.99] ${
                            active
                              ? 'border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-500/10'
                              : 'border-transparent bg-gray-50 dark:bg-slate-800/65'
                          }`}
                        >
                          <BankLogo name={bank} size="sm" />

                          <span
                            className={`min-w-0 flex-1 truncate text-[14px] font-semibold ${
                              active
                                ? 'text-teal-700 dark:text-teal-300'
                                : 'text-gray-800 dark:text-gray-200'
                            }`}
                          >
                            {bank}
                          </span>

                          {active && (
                            <Check
                              size={17}
                              className="shrink-0 text-teal-600"
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
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
          setSearch('')
          setOpen(true)
        }}
        className="flex min-h-14 w-full items-center gap-3 rounded-[17px] border border-black/5 bg-gray-50 px-3.5 py-3 text-left transition-all active:scale-[0.99] disabled:opacity-50 dark:border-white/10 dark:bg-slate-800"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <BankLogo name={canonicalValue || 'Banco'} size="md" />

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">
            Instituição
          </p>
          <p
            className={`mt-0.5 truncate text-[14px] font-semibold ${
              canonicalValue
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {canonicalValue || 'Selecionar ou cadastrar banco'}
          </p>
        </div>

        <ChevronDown size={17} className="shrink-0 text-gray-400" />
      </button>

      {sheet}
    </>
  )
}
