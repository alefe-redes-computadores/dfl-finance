'use client'

import { AlertCircle, Clock } from 'lucide-react'
import { differenceInDays, format, isValid, parseISO } from 'date-fns'
import { useRouter } from 'next/navigation'

interface DebtAlertProps {
  personName?: string
  amount?: number
  dueDate?: string
  debtId?: string
}

export default function DebtAlert({ personName, amount = 0, dueDate, debtId }: DebtAlertProps) {
  const router = useRouter()

  if (!dueDate || amount <= 0) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const parsedDate = parseISO(dueDate)
  const due = isValid(parsedDate) ? parsedDate : null
  if (due) {
    due.setHours(0, 0, 0, 0)
  }

  if (!due) return null

  const daysLate = differenceInDays(today, due)
  const isOverdue = daysLate > 0
  const daysToDue = Math.abs(differenceInDays(due, today))
  const isDueSoon = !isOverdue && daysToDue <= 5

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Navegação Local-First Estrita: Usa router.push garantindo que o ID exista
  const handleNavigate = () => {
    if (debtId) {
      router.push(`/debts/details?id=${debtId}`)
    }
  }

  return (
    <div
      data-debt-id={debtId}
      onClick={handleNavigate}
      className={`rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-all hover:shadow-md border cursor-pointer active:scale-[0.98] ${
        isOverdue
          ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
          : isDueSoon
          ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20'
          : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isOverdue
            ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
            : isDueSoon
            ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
            : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
        }`}
      >
        {isOverdue ? <AlertCircle size={20} /> : <Clock size={20} />}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`font-bold text-sm truncate ${
            isOverdue
              ? 'text-red-700 dark:text-red-300'
              : isDueSoon
              ? 'text-orange-700 dark:text-orange-300'
              : 'text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {personName || 'Pessoa'} deve {formatCurrency(amount)}
        </p>

        <p
          className={`text-xs font-medium mt-0.5 ${
            isOverdue
              ? 'text-red-600/80 dark:text-red-400/80'
              : isDueSoon
              ? 'text-orange-600/80 dark:text-orange-400/80'
              : 'text-emerald-600/80 dark:text-emerald-400/80'
          }`}
        >
          {isOverdue
            ? `Venceu em ${format(due, 'dd/MM/yyyy')} • ${daysLate} dia(s) atraso`
            : `Vence em ${format(due, 'dd/MM/yyyy')} • ${daysToDue} dia(s)`}
        </p>
      </div>
    </div>
  )
}
