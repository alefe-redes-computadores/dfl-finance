'use client'

import { AlertCircle, Clock, CreditCard } from 'lucide-react'
import { differenceInDays, format, isValid, parseISO } from 'date-fns'
import { useRouter } from 'next/navigation'

interface InvoiceAlertProps {
  dueDay?: number
  closingDay?: number
  cardName?: string
  cardId?: string
  amount?: number
}

export default function InvoiceAlert({
  dueDay = 1,
  closingDay = 1,
  cardName = 'Cartão',
  cardId,
  amount = 0,
}: InvoiceAlertProps) {
  const router = useRouter()

  if (!dueDay || !cardName) return null
  if (amount <= 0) return null

  const today = new Date()
  const todayDay = today.getDate()

  // Calcula dias até o vencimento
  let daysUntilDue = dueDay - todayDay
  if (daysUntilDue < 0) {
    // Se já passou, calcula para o próximo mês
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, dueDay)
    daysUntilDue = differenceInDays(nextMonth, today)
  }

  const isOverdue = daysUntilDue < 0
  const isDueSoon = !isOverdue && daysUntilDue <= 5

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleNavigate = () => {
    if (cardId) {
      router.push(`/cards/details?id=${cardId}`)
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
        label: 'Vencida',
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
        label: 'Próxima',
      }
    }
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/20',
      iconBg: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      text: 'text-emerald-700 dark:text-emerald-300',
      subtext: 'text-emerald-600/80 dark:text-emerald-400/80',
      icon: Clock,
      label: 'Em dia',
    }
  }

  const styles = getStatusStyles()
  const Icon = styles.icon

  return (
    <div
      data-card-id={cardId}
      onClick={handleNavigate}
      className={`rounded-[16px] px-4 py-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-opacity-70 active:scale-[0.98] ${styles.bg} ${styles.border}`}
    >
      <div
        className={`w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 ${styles.iconBg}`}
      >
        <CreditCard size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[13px] font-semibold truncate ${styles.text}`}>
            {cardName}
          </p>
          <p className={`text-[13px] font-bold shrink-0 ${styles.text}`}>
            {formatCurrency(amount)}
          </p>
        </div>

        <p className={`text-[11px] font-medium mt-0.5 ${styles.subtext}`}>
          {isOverdue
            ? `Venceu dia ${dueDay} • ${Math.abs(daysUntilDue)} dia(s) atraso`
            : `Vence em ${daysUntilDue} dia(s) (dia ${dueDay})`}
        </p>
      </div>
    </div>
  )
}