// src/lib/debtOperations.ts
import type { LocalTransaction } from '@/lib/db'

const DAY_MS = 24 * 60 * 60 * 1000

const toLocalDayNumber = (value: Date) =>
  Math.floor(
    Date.UTC(
      value.getFullYear(),
      value.getMonth(),
      value.getDate()
    ) / DAY_MS
  )

const parseIsoDayNumber = (value?: string | null) => {
  if (!value) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())

  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return Math.floor(
    Date.UTC(year, month - 1, day) / DAY_MS
  )
}

export function getDueDateState(
  dueDate?: string | null,
  now = new Date()
) {
  const dueDay = parseIsoDayNumber(dueDate)

  if (dueDay === null) {
    return {
      daysUntilDue: null as number | null,
      isOverdue: false,
      isToday: false,
      isNearDue: false,
    }
  }

  const daysUntilDue =
    dueDay - toLocalDayNumber(now)

  return {
    daysUntilDue,
    isOverdue: daysUntilDue < 0,
    isToday: daysUntilDue === 0,
    isNearDue:
      daysUntilDue > 0 &&
      daysUntilDue <= 7,
  }
}

export function getDebtDueState(
  dueDate?: string | null,
  now = new Date()
) {
  return getDueDateState(dueDate, now)
}

export function getDebtRemainingAmount(
  totalAmount: number,
  paidAmount: number
) {
  const totalCents = Math.max(
    0,
    Math.round(Number(totalAmount || 0) * 100)
  )
  const paidCents = Math.max(
    0,
    Math.round(Number(paidAmount || 0) * 100)
  )

  return Math.max(0, totalCents - paidCents) / 100
}

export function isDebtPayment(
  tx: Pick<
    LocalTransaction,
    'debt_id' | 'type' | 'status'
  >
) {
  return (
    Boolean(tx.debt_id) &&
    tx.type === 'income' &&
    tx.status === 'done'
  )
}

export interface DebtPaymentTransactionLike {
  debt_id?: string | null
  type?: string | null
  status?: string | null
  amount?: number | null
  debt_applied_amount?: number | null
}

export function getDebtAppliedPaymentAmount(tx: DebtPaymentTransactionLike) {
  if (!tx.debt_id || tx.type !== 'income' || tx.status !== 'done') return 0

  const applied = Number(tx.debt_applied_amount)
  if (Number.isFinite(applied) && applied > 0) return applied

  const amount = Number(tx.amount)
  return Number.isFinite(amount) ? Math.max(0, amount) : 0
}

export function buildDebtPaymentTotals(transactions: DebtPaymentTransactionLike[]) {
  const result = new Map<string, number>()
  for (const tx of transactions) {
    if (!tx.debt_id) continue
    const applied = getDebtAppliedPaymentAmount(tx)
    if (applied <= 0) continue
    result.set(tx.debt_id, (result.get(tx.debt_id) || 0) + Math.round(applied * 100))
  }
  return result
}


export interface DebtLedgerState {
  totalAmount: number
  totalCents: number
  paidAmount: number
  paidCents: number
  remainingAmount: number
  remainingCents: number
  percent: number
  status: 'pending' | 'partial' | 'paid'
}

/**
 * O ledger de transações é a fonte de verdade para a amortização.
 *
 * `debt.paid_amount` continua existindo como snapshot/cache sincronizado,
 * mas telas e operações financeiras devem preferir este cálculo quando
 * possuem acesso às transações vinculadas.
 */
export function getDebtPaidAmountFromTransactions(
  debtId: string,
  transactions: DebtPaymentTransactionLike[]
) {
  if (!debtId) return 0

  const cents = transactions.reduce(
    (sum, tx) => {
      if (
        tx.debt_id !== debtId
      ) {
        return sum
      }

      return (
        sum +
        Math.round(
          getDebtAppliedPaymentAmount(tx) *
            100
        )
      )
    },
    0
  )

  return Math.max(0, cents) / 100
}

export function getDebtLedgerState(
  totalAmount: number,
  debtId: string,
  transactions: DebtPaymentTransactionLike[]
): DebtLedgerState {
  const totalCents = Math.max(
    0,
    Math.round(
      Number(totalAmount || 0) * 100
    )
  )

  const ledgerPaidCents = Math.max(
    0,
    Math.round(
      getDebtPaidAmountFromTransactions(
        debtId,
        transactions
      ) * 100
    )
  )

  /*
   * A amortização jamais ultrapassa a cobrança.
   * Eventual excedente pertence ao ledger de crédito do contato,
   * não ao saldo pago desta dívida.
   */
  const paidCents = Math.min(
    totalCents,
    ledgerPaidCents
  )

  const remainingCents = Math.max(
    0,
    totalCents - paidCents
  )

  const percent =
    totalCents > 0
      ? Math.min(
          100,
          (paidCents / totalCents) * 100
        )
      : 0

  return {
    totalAmount: totalCents / 100,
    totalCents,
    paidAmount: paidCents / 100,
    paidCents,
    remainingAmount:
      remainingCents / 100,
    remainingCents,
    percent,
    status: getDebtStatusFromAmounts(
      totalCents,
      paidCents
    ),
  }
}

export function getDebtStatusFromAmounts(
  totalAmountCents: number,
  paidAmountCents: number
): 'pending' | 'partial' | 'paid' {
  if (
    totalAmountCents > 0 &&
    paidAmountCents >= totalAmountCents
  ) {
    return 'paid'
  }

  if (paidAmountCents > 0) {
    return 'partial'
  }

  return 'pending'
}


export function isDebtCreditApplication(
  tx: Pick<LocalTransaction, 'debt_id' | 'type' | 'status' | 'affects_balance' | 'contact_credit_delta'>
) {
  return (
    isDebtPayment(tx) &&
    tx.affects_balance === false &&
    Number(tx.contact_credit_delta || 0) < 0
  )
}
