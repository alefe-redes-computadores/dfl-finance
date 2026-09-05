// src/lib/pendingOperations.ts
import type { LocalTransaction } from '@/lib/db'
import { getDebtDueState } from '@/lib/debtOperations'

export type PendingDirection = 'payable' | 'receivable'

type PendingTransactionLike = Pick<
  LocalTransaction,
  'type' | 'status' | 'debt_id'
>

export function getPendingDirection(
  tx: PendingTransactionLike
): PendingDirection | null {
  if (tx.status !== 'pending') return null

  if (tx.type === 'income') return 'receivable'

  if (tx.type === 'expense' || tx.type === 'sangria') {
    return 'payable'
  }

  return null
}

export function getPendingLabel(
  tx: PendingTransactionLike
): 'A receber' | 'A pagar' | 'Pendente' {
  const direction = getPendingDirection(tx)

  if (direction === 'receivable') return 'A receber'
  if (direction === 'payable') return 'A pagar'

  return 'Pendente'
}

export function getTransactionStatusLabel(
  tx: PendingTransactionLike
) {
  if (tx.status === 'pending') {
    if (tx.type === 'transfer') return 'Transferência pendente'
    return getPendingLabel(tx)
  }

  if (tx.type === 'income') return 'Recebido'

  if (tx.type === 'expense' || tx.type === 'sangria') {
    return 'Pago'
  }

  if (tx.type === 'transfer') return 'Efetivada'

  return 'Efetivada'
}

export function isStandalonePendingReceivable(
  tx: PendingTransactionLike
) {
  return (
    getPendingDirection(tx) === 'receivable' &&
    !tx.debt_id
  )
}


/** Card/fila de urgência: somente vencido ou vencendo hoje. */
export function isUrgentDebtDue(dueDate?: string | null, now = new Date()) {
  const due = getDebtDueState(dueDate, now)
  return due.isOverdue || due.isToday
}
