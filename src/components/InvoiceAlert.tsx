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

  const getAlertStyle = () => {
    if (diffDays <= 0) {
      return {
        bg: 'bg-red-50 dark:bg-red-500/10',
        border: 'border-red-200 dark:border-red-500/20',
        iconBg: 'bg-red-100 dark:bg-red-500/20',
        icon: <AlertCircle size={20} className="text-red-600 dark:text-red-400" />,
        text: 'text-red-700 dark:text-red-300',
        subtext: 'text-red-600/80 dark:text-red-400/80',
      }
    }
    if (diffDays <= 5) {
      return {
        bg: 'bg-orange-50 dark:bg-orange-500/10',
        border: 'border-orange-200 dark:border-orange-500/20',
        iconBg: 'bg-orange-100 dark:bg-orange-500/20',
        icon: <Clock size={20} className="text-orange-600 dark:text-orange-400" />,
        text: 'text-orange-700 dark:text-orange-300',
        subtext: 'text-orange-600/80 dark:text-orange-400/80',
      }
    }
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/20',
      iconBg: 'bg-emerald-100 dark:bg-emerald-500/20',
      icon: <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />,
      text: 'text-emerald-700 dark:text-emerald-300',
      subtext: 'text-emerald-600/80 dark:text-emerald-400/80',
    }
  }

  const style = getAlertStyle()

  let message = ''
  if (diffDays === 0) message = 'Sua fatura vence hoje!'
  else if (diffDays < 0) message = `Fatura vencida há ${Math.abs(diffDays)} dia(s)!`
  else if (diffDays <= 5) message = `Fatura vence em ${diffDays} dias`
  else message = `Fatura vence em ${diffDays} dias`

  return (
    <div className={`${style.bg} border ${style.border} rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-all hover:shadow-md`}>
      <div className={`w-10 h-10 rounded-xl ${style.iconBg} flex items-center justify-center shrink-0`}>
        {style.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-sm ${style.text} truncate`}>
          {cardName ? `${cardName}: ` : ''}{message}
        </p>
        <p className={`text-xs font-medium ${style.subtext} mt-0.5`}>
          Vence dia {dueDay} • Fecha dia {closingDay}
        </p>
      </div>
    </div>
  )
}