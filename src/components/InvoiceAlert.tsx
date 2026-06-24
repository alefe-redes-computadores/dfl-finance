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
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-3">
        <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
        <div>
          <p className="font-bold text-red-700 dark:text-red-300 text-sm">
            {cardName ? `${cardName}: ` : ''}Sua fatura vence hoje!
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">Dia {dueDay} • Fecha dia {closingDay}</p>
        </div>
      </div>
    )
  }

  if (diffDays < 0) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-3">
        <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
        <div>
          <p className="font-bold text-red-700 dark:text-red-300 text-sm">
            {cardName ? `${cardName}: ` : ''}Fatura vencida há {Math.abs(diffDays)} dias!
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">Venceu dia {dueDay} • Fecha dia {closingDay}</p>
        </div>
      </div>
    )
  }

  if (diffDays <= 5) {
    return (
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 flex items-center gap-3">
        <Clock size={20} className="text-orange-600 dark:text-orange-400" />
        <div>
          <p className="font-bold text-orange-700 dark:text-orange-300 text-sm">
            {cardName ? `${cardName}: ` : ''}Fatura vence em {diffDays} dias
          </p>
          <p className="text-xs text-orange-600 dark:text-orange-400">Dia {dueDay} • Fecha dia {closingDay}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-3">
      <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
      <div>
        <p className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">
          {cardName ? `${cardName}: ` : ''}Fatura vence em {diffDays} dias
        </p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Dia {dueDay} • Fecha dia {closingDay}</p>
      </div>
    </div>
  )
}
