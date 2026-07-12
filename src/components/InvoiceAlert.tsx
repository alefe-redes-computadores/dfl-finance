'use client'

import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'

interface InvoiceAlertProps {
  dueDay: number
  closingDay: number
  cardName?: string
}

export default function InvoiceAlert({ dueDay, closingDay, cardName }: InvoiceAlertProps) {
  const today = new Date()
  const currentDay = today.getDate()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  let dueDate = new Date(currentYear, currentMonth, dueDay)
  if (currentDay > dueDay) {
    dueDate = new Date(currentYear, currentMonth + 1, dueDay)
  }

  const diffTime = dueDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-[24px] p-4 flex items-center gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-[14px] bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
          <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-red-700 dark:text-red-300 text-[14px] truncate">
            {cardName ? `${cardName}: ` : ''}Sua fatura vence hoje!
          </p>
          <p className="text-[12px] font-medium text-red-600/80 dark:text-red-400/80 mt-0.5">Dia {dueDay} • Fecha dia {closingDay}</p>
        </div>
      </div>
    )
  }

  if (diffDays < 0) {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-[24px] p-4 flex items-center gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-[14px] bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
          <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-red-700 dark:text-red-300 text-[14px] truncate">
            {cardName ? `${cardName}: ` : ''}Fatura vencida há {Math.abs(diffDays)} dia(s)!
          </p>
          <p className="text-[12px] font-medium text-red-600/80 dark:text-red-400/80 mt-0.5">Venceu dia {dueDay} • Fecha dia {closingDay}</p>
        </div>
      </div>
    )
  }

  if (diffDays <= 5) {
    return (
      <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-[24px] p-4 flex items-center gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-[14px] bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
          <Clock size={20} className="text-orange-600 dark:text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-orange-700 dark:text-orange-300 text-[14px] truncate">
            {cardName ? `${cardName}: ` : ''}Fatura vence em {diffDays} dias
          </p>
          <p className="text-[12px] font-medium text-orange-600/80 dark:text-orange-400/80 mt-0.5">Dia {dueDay} • Fecha dia {closingDay}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-[24px] p-4 flex items-center gap-4 shadow-sm">
      <div className="w-10 h-10 rounded-[14px] bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
        <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-emerald-700 dark:text-emerald-300 text-[14px] truncate">
          {cardName ? `${cardName}: ` : ''}Fatura vence em {diffDays} dias
        </p>
        <p className="text-[12px] font-medium text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Dia {dueDay} • Fecha dia {closingDay}</p>
      </div>
    </div>
  )
}
