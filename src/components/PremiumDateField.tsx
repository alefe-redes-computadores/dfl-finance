'use client'

import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import DatePickerSheet, { formatDateLabel } from '@/components/DatePickerSheet'

type PremiumDateFieldProps = {
  value: string
  onChange: (date: string) => void
  label: string
  disabled?: boolean
  className?: string
}

/** A date-only control: preserves YYYY-MM-DD without UTC conversion. */
export default function PremiumDateField({ value, onChange, label, disabled = false, className = '' }: PremiumDateFieldProps) {
  const [open, setOpen] = useState(false)
  return <>
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={() => setOpen(true)}
      className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 ${className}`}
    >
      <span className="truncate">{formatDateLabel(value)}</span>
      <CalendarDays aria-hidden="true" size={18} className="shrink-0 text-teal-600" />
    </button>
    <DatePickerSheet isOpen={open && !disabled} value={value} title={label} onChange={onChange} onClose={() => setOpen(false)} />
  </>
}
