'use client'

import { AlertCircle, Clock } from 'lucide-react'
import { differenceInDays, format } from 'date-fns'

interface DebtAlertProps {
  personName: string
  amount: number
  dueDate: string
  debtId: string
}

export default function DebtAlert({ personName, amount, dueDate, debtId }: DebtAlertProps) {
  const today = new Date()
  const due = new Date(dueDate)
  const daysLate = differenceInDays(today, due)

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (amount <= 0) return null

  const isOverdue = daysLate > 0
  const isDueSoon = daysLate <= 0 && differenceInDays(due, today) <= 5

  return (
    <div className={`rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-all hover:shadow-md border ${
      isOverdue 
        ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' 
        : isDueSoon
        ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20'
        : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        isOverdue 
          ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' 
          : isDueSoon
          ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
          : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
      }`}>
        {isOverdue ? <AlertCircle size={20} /> : <Clock size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-sm truncate ${
          isOverdue 
            ? 'text-red-700 dark:text-red-300' 
            : isDueSoon
            ? 'text-orange-700 dark:text-orange-300'
            : 'text-emerald-700 dark:text-emerald-300'
        }`}>
          {personName} deve {formatCurrency(amount)}
        </p>
        <p className={`text-xs font-medium mt-0.5 ${
          isOverdue 
            ? 'text-red-600/80 dark:text-red-400/80' 
            : isDueSoon
            ? 'text-orange-600/80 dark:text-orange-400/80'
            : 'text-emerald-600/80 dark:text-emerald-400/80'
        }`}>
          {isOverdue 
            ? `Venceu em ${format(due, "dd/MM/yyyy")} • ${daysLate} dia(s) atraso` 
            : `Vence em ${format(due, "dd/MM/yyyy")} • ${Math.abs(daysLate)} dia(s)`}
        </p>
      </div>
    </div>
  )
}