// src/lib/financialMetrics.ts
import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type FinancialContext = 'dfl' | 'personal'

export interface FinancialTransactionLike {
  id?: string
  context?: string | null
  type?: string | null
  amount?: number | null
  status?: string | null
  affects_balance?: boolean | null
  date?: string | null
  category_id?: string | null
  account_id?: string | null
  goal_id?: string | null
}

export interface FinancialAccountLike {
  id?: string
  context?: string | null
  balance?: number | null
  is_archived?: boolean | null
}

export interface FinancialCategoryLike {
  id?: string
  name?: string | null
  color?: string | null
}

export function isRealizedFinancialTransaction(
  transaction: FinancialTransactionLike
) {
  if (!transaction) return false
  if (transaction.status !== 'done') return false
  if (transaction.affects_balance === false) return false
  if (transaction.goal_id) return false

  return (
    transaction.type === 'income' ||
    transaction.type === 'expense' ||
    transaction.type === 'sangria'
  )
}

export function isExpenseTransaction(
  transaction: FinancialTransactionLike
) {
  return (
    transaction.type === 'expense' ||
    transaction.type === 'sangria'
  )
}

export function sumIncome(
  transactions: FinancialTransactionLike[]
) {
  return transactions
    .filter(
      (transaction) =>
        isRealizedFinancialTransaction(transaction) &&
        transaction.type === 'income'
    )
    .reduce(
      (sum, transaction) =>
        sum + (Number(transaction.amount) || 0),
      0
    )
}

export function sumExpense(
  transactions: FinancialTransactionLike[]
) {
  return transactions
    .filter(
      (transaction) =>
        isRealizedFinancialTransaction(transaction) &&
        isExpenseTransaction(transaction)
    )
    .reduce(
      (sum, transaction) =>
        sum + (Number(transaction.amount) || 0),
      0
    )
}

export function getContextBalance(
  accounts: FinancialAccountLike[],
  context?: FinancialContext
) {
  return accounts
    .filter(
      (account) =>
        !account.is_archived &&
        (!context || account.context === context)
    )
    .reduce(
      (sum, account) =>
        sum + (Number(account.balance) || 0),
      0
    )
}

export function getMonthRange(date: Date) {
  return {
    start: format(startOfMonth(date), 'yyyy-MM-dd'),
    end: format(endOfMonth(date), 'yyyy-MM-dd'),
  }
}

export function filterTransactionsByMonth(
  transactions: FinancialTransactionLike[],
  date: Date,
  context?: FinancialContext
) {
  const { start, end } = getMonthRange(date)

  return transactions.filter(
    (transaction) =>
      transaction.date &&
      transaction.date >= start &&
      transaction.date <= end &&
      (!context || transaction.context === context) &&
      isRealizedFinancialTransaction(transaction)
  )
}

export function getMonthlyFlow(
  transactions: FinancialTransactionLike[],
  date: Date,
  context?: FinancialContext
) {
  const monthTransactions = filterTransactionsByMonth(
    transactions,
    date,
    context
  )

  const income = sumIncome(monthTransactions)
  const expense = sumExpense(monthTransactions)

  return {
    income,
    expense,
    balance: income - expense,
  }
}

export function getHistoricalMonthlyAverages(
  transactions: FinancialTransactionLike[],
  referenceDate: Date,
  months = 6,
  context?: FinancialContext
) {
  const flows = Array.from({ length: months }, (_, index) =>
    getMonthlyFlow(
      transactions,
      subMonths(referenceDate, index + 1),
      context
    )
  )

  if (flows.length === 0) {
    return {
      averageIncome: 0,
      averageExpense: 0,
      averageNet: 0,
      monthsUsed: 0,
    }
  }

  const averageIncome =
    flows.reduce((sum, flow) => sum + flow.income, 0) /
    flows.length

  const averageExpense =
    flows.reduce((sum, flow) => sum + flow.expense, 0) /
    flows.length

  return {
    averageIncome,
    averageExpense,
    averageNet: averageIncome - averageExpense,
    monthsUsed: flows.length,
  }
}

export function buildMonthlyProjection({
  currentBalance,
  averageIncome,
  averageExpense,
  referenceDate,
  months = 12,
}: {
  currentBalance: number
  averageIncome: number
  averageExpense: number
  referenceDate: Date
  months?: number
}) {
  return Array.from({ length: months + 1 }, (_, index) => {
    if (index === 0) {
      return {
        name: 'HOJE',
        otimista: currentBalance,
        realista: currentBalance,
        pessimista: currentBalance,
      }
    }

    const monthDate = addMonths(referenceDate, index)
    const name = format(monthDate, 'MMM', {
      locale: ptBR,
    }).toUpperCase()

    const optimisticNet =
      averageIncome * 1.1 - averageExpense * 0.9

    const realisticNet =
      averageIncome - averageExpense

    const pessimisticNet =
      averageIncome * 0.9 - averageExpense * 1.2

    return {
      name,
      otimista:
        currentBalance + optimisticNet * index,
      realista:
        currentBalance + realisticNet * index,
      pessimista:
        currentBalance + pessimisticNet * index,
    }
  })
}

export function buildDailyProjection({
  currentBalance,
  averageIncome,
  averageExpense,
  referenceDate,
  days = 30,
}: {
  currentBalance: number
  averageIncome: number
  averageExpense: number
  referenceDate: Date
  days?: number
}) {
  const dailyNet =
    (averageIncome - averageExpense) / 30

  return Array.from({ length: days + 1 }, (_, index) => {
    const date = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() + index
    )

    return {
      projection_date: format(date, 'yyyy-MM-dd'),
      projected_balance:
        currentBalance + dailyNet * index,
    }
  })
}

export function buildCategoryDistribution(
  transactions: FinancialTransactionLike[],
  categories: FinancialCategoryLike[],
  date: Date,
  context: FinancialContext
) {
  const categoryById = new Map(
    categories.map((category) => [
      category.id,
      category,
    ])
  )

  const map = new Map<
    string,
    {
      name: string
      value: number
      color: string
    }
  >()

  filterTransactionsByMonth(
    transactions,
    date,
    context
  )
    .filter(isExpenseTransaction)
    .forEach((transaction) => {
      const category = categoryById.get(
        transaction.category_id
      )

      const name =
        category?.name || 'Geral'

      const color =
        category?.color || '#64748b'

      const current = map.get(name) || {
        name,
        value: 0,
        color,
      }

      current.value +=
        Number(transaction.amount) || 0

      map.set(name, current)
    })

  return Array.from(map.values()).sort(
    (a, b) => b.value - a.value
  )
}
