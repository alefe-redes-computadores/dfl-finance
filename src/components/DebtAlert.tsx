'use client'

import { AlertCircle, Clock, User } from 'lucide-react'
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

  const handleNavigate = () => {
    if (debtId) {
      router.push(`/debts/details?id=${debtId}`)
    }
  }

  // Determina cores com base no status
  const getStatusStyles = () => {
    if (isOverdue) {
      return {
        bg: 'bg-red-50 dark:bg-red-500/10',
        border: 'border-red-200 dark:border-red-500/20',
        iconBg: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
        text: 'text-red-700 dark:text-red-300',
        subtext: 'text-red-600/80 dark:text-red-400/80',
        icon: AlertCircle,
      }
    }
    if (isDueSoon) {
      return {
        bg: 'bg-orange-50 dark:bg-orange-500/10',
        border: 'border-orange-200 dark:border-orange-500/20',
        iconBg: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
        text: 'text-orange-700 dark:text-orange-300',
        subtext: 'text-orange-600/80 dark:text-orange-400/80',
        icon: Clock,
      }
    }
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/20',
      iconBg: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      text: 'text-emerald-700 dark:text-emerald-300',
      subtext: 'text-emerald-600/80 dark:text-emerald-400/80',
      icon: Clock,
    }
  }

  const styles = getStatusStyles()
  const Icon = styles.icon

  return (
    <div
      data-debt-id={debtId}
      onClick={handleNavigate}
      className={`rounded-[16px] px-4 py-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-opacity-70 active:scale-[0.98] ${styles.bg} ${styles.border}`}
    >
      <div
        className={`w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 ${styles.iconBg}`}
      >
        <Icon size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[13px] font-semibold truncate ${styles.text}`}>
            {personName || 'Pessoa'}
          </p>
          <p className={`text-[13px] font-bold shrink-0 ${styles.text}`}>
            {formatCurrency(amount)}
          </p>
        </div>

        <p className={`text-[11px] font-medium mt-0.5 ${styles.subtext}`}>
          {isOverdue
            ? `Venceu em ${format(due, 'dd/MM')} • ${daysLate} dia(s) atraso`
            : `Vence em ${format(due, 'dd/MM')} • ${daysToDue} dia(s)`}
        </p>
      </div>
    </div>
  )
}