// src/components/DatePickerSheet.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface DatePickerSheetProps {
  isOpen: boolean
  value: string
  onChange: (value: string) => void
  onClose: () => void
  title?: string
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return new Date()
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function toLocalISO(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysLocal(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function formatDateLabel(value: string) {
  if (!value) return 'Selecionar data'
  const formatted = DATE_FORMATTER.format(parseLocalDate(value)).replace('.', '')
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export default function DatePickerSheet({ isOpen, value, onChange, onClose, title = 'Selecionar data' }: DatePickerSheetProps) {
  const [viewDate, setViewDate] = useState(() => parseLocalDate(value))

  useEffect(() => {
    if (isOpen) setViewDate(parseLocalDate(value))
  }, [isOpen, value])

  const days = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstOfMonth = new Date(year, month, 1, 12)
    const mondayOffset = (firstOfMonth.getDay() + 6) % 7
    const gridStart = addDaysLocal(firstOfMonth, -mondayOffset)

    return Array.from({ length: 42 }, (_, index) => addDaysLocal(gridStart, index))
  }, [viewDate])

  if (!isOpen || typeof document === 'undefined') return null

  const selectedISO = value
  const today = new Date()
  const todayISO = toLocalISO(today)

  const choose = (date: Date) => {
    onChange(toLocalISO(date))
    onClose()
  }

  const changeMonth = (delta: number) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12))
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[145000] flex items-end justify-center bg-black/55 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-t-[32px] border border-b-0 border-gray-200/70 bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_60px_rgba(15,23,42,0.18)] animate-in slide-in-from-bottom-6 duration-200 dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-teal-50 text-teal-600 dark:bg-teal-900/25 dark:text-teal-400">
              <CalendarDays size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-[19px] font-bold text-gray-900 dark:text-gray-100">{title}</h3>
              <p className="mt-0.5 truncate text-[12px] text-gray-400">{formatDateLabel(value)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar calendário"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 active:scale-[0.97] dark:bg-slate-800 dark:text-gray-400"
          >
            <X size={19} />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Ontem', offset: -1 },
            { label: 'Hoje', offset: 0 },
            { label: 'Amanhã', offset: 1 },
          ].map((shortcut) => {
            const shortcutDate = addDaysLocal(today, shortcut.offset)
            const active = toLocalISO(shortcutDate) === selectedISO
            return (
              <button
                type="button"
                key={shortcut.label}
                onClick={() => choose(shortcutDate)}
                className={`rounded-[14px] border px-3 py-2.5 text-[12px] font-bold transition-all active:scale-[0.97] ${
                  active
                    ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-900/25 dark:text-teal-400'
                    : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-400'
                }`}
              >
                {shortcut.label}
              </button>
            )
          })}
        </div>

        <div className="rounded-[24px] border border-gray-200/70 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Mês anterior"
              className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-white text-gray-500 shadow-sm active:scale-[0.95] dark:bg-slate-900 dark:text-gray-400"
            >
              <ChevronLeft size={18} />
            </button>

            <p className="text-[14px] font-bold capitalize text-gray-800 dark:text-gray-200">
              {MONTH_FORMATTER.format(viewDate)}
            </p>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Próximo mês"
              className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-white text-gray-500 shadow-sm active:scale-[0.95] dark:bg-slate-900 dark:text-gray-400"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {weekday}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const iso = toLocalISO(day)
              const inMonth = day.getMonth() === viewDate.getMonth()
              const selected = iso === selectedISO
              const isToday = iso === todayISO

              return (
                <button
                  type="button"
                  key={iso}
                  onClick={() => choose(day)}
                  className={`relative flex aspect-square items-center justify-center rounded-[13px] text-[12px] font-bold transition-all active:scale-[0.9] ${
                    selected
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                      : inMonth
                        ? 'text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-slate-700'
                        : 'text-gray-300 dark:text-slate-600'
                  }`}
                >
                  {day.getDate()}
                  {isToday && !selected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-teal-500" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
