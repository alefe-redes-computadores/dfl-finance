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
