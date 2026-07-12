'use client'

import { AlertCircle } from 'lucide-react'
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

  // SÓ EXIBE SE O VALOR FOR MAIOR QUE ZERO
  if (amount <= 0) return null

  return (
    <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-[24px] p-4 flex items-center gap-4 shadow-sm">
      <div className="w-10 h-10 rounded-[14px] bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
        <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-red-700 dark:text-red-300 text-[14px] truncate">
          {personName} deve {formatCurrency(amount)}
        </p>
        <p className="text-[12px] font-medium text-red-600/80 dark:text-red-400/80 mt-0.5">
          Venceu em {format(due, "dd/MM/yyyy")} • {daysLate} dia(s) atraso
        </p>
      </div>
    </div>
  )
}
