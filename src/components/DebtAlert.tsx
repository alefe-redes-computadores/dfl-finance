'use client'

import { AlertCircle } from 'lucide-react'
import { differenceInDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

  // 🔥 SÓ EXIBE SE O VALOR FOR MAIOR QUE ZERO (dívida efetivamente pendente)
  if (amount <= 0) return null

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-3">
      <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
      <div className="flex-1">
        <p className="font-bold text-red-700 dark:text-red-300 text-sm">
          {personName} deve {formatCurrency(amount)}
        </p>
        <p className="text-xs text-red-600 dark:text-red-400">
          Venceu em {format(due, "dd/MM/yyyy")} • {daysLate} dia(s) de atraso
        </p>
      </div>
    </div>
  )
}