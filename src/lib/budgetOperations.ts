// src/lib/budgetOperations.ts

export type BudgetPeriod = 'monthly' | 'biweekly' | 'weekly'

export type BudgetLike = {
  amount: number
  category_id?: string | null
  period?: BudgetPeriod | null
  accumulate?: boolean | null
  created_at?: string | null
}

export type BudgetTransactionLike = {
  id?: string
  user_id?: string
  context?: string
  category_id?: string | null
  type?: string
  status?: string
  date?: string
  amount?: number | string
}

export type BudgetCycle = {
  start: Date
  end: Date
  startISO: string
  endISO: string
}

export type BudgetMetrics = {
  cycle: BudgetCycle
  transactions: BudgetTransactionLike[]
  spent: number
  baseAmount: number
  availableAmount: number
  remaining: number
  percent: number
  progressPercent: number
  isOverBudget: boolean
  isWarning: boolean
  accumulatedBalance: number
}

const DAY_MS = 24 * 60 * 60 * 1000

const safeNumber = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const cloneDate = (date: Date) => {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0,
    0
  )
}

const parseLocalDate = (value?: string | null) => {
  if (!value) return null

  const datePart = String(value).slice(0, 10)
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
      0,
      0,
      0
    )
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : cloneDate(parsed)
}

const formatLocalISO = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const lastDayOfMonth = (date: Date) => {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    12,
    0,
    0,
    0
  )
}

const addDays = (date: Date, days: number) => {
  const next = cloneDate(date)
  next.setDate(next.getDate() + days)
  return next
}

const startOfWeekMonday = (date: Date) => {
  const current = cloneDate(date)
  const day = current.getDay()
  const diff = day === 0 ? -6 : 1 - day
  current.setDate(current.getDate() + diff)
  return current
}

export const normalizeBudgetPeriod = (
  value?: string | null
): BudgetPeriod => {
  if (value === 'weekly' || value === 'biweekly') {
    return value
  }

  return 'monthly'
}

export const getBudgetCycle = (
  referenceDate: Date,
  periodInput?: string | null
): BudgetCycle => {
  const reference = cloneDate(referenceDate)
  const period = normalizeBudgetPeriod(periodInput)

  let start: Date
  let end: Date

  if (period === 'weekly') {
    start = startOfWeekMonday(reference)
    end = addDays(start, 6)
  } else if (period === 'biweekly') {
    if (reference.getDate() <= 15) {
      start = new Date(
        reference.getFullYear(),
        reference.getMonth(),
        1,
        12
      )

      end = new Date(
        reference.getFullYear(),
        reference.getMonth(),
        15,
        12
      )
    } else {
      start = new Date(
        reference.getFullYear(),
        reference.getMonth(),
        16,
        12
      )

      end = lastDayOfMonth(reference)
    }
  } else {
    start = new Date(
      reference.getFullYear(),
      reference.getMonth(),
      1,
      12
    )

    end = lastDayOfMonth(reference)
  }

  return {
    start,
    end,
    startISO: formatLocalISO(start),
    endISO: formatLocalISO(end),
  }
}

export const shiftBudgetReferenceDate = (
  referenceDate: Date,
  periodInput: string | null | undefined,
  direction: -1 | 1
) => {
  const period = normalizeBudgetPeriod(periodInput)

  if (period === 'weekly') {
    return addDays(referenceDate, 7 * direction)
  }

  if (period === 'biweekly') {
    const cycle = getBudgetCycle(referenceDate, period)

    return direction > 0
      ? addDays(cycle.end, 1)
      : addDays(cycle.start, -1)
  }

  const next = cloneDate(referenceDate)
  next.setDate(1)
  next.setMonth(next.getMonth() + direction)
  return next
}

export const getBudgetPeriodName = (
  periodInput?: string | null
) => {
  const period = normalizeBudgetPeriod(periodInput)

  if (period === 'weekly') return 'Semanal'
  if (period === 'biweekly') return 'Quinzenal'
  return 'Mensal'
}

export const getBudgetCycleLabel = (
  referenceDate: Date,
  periodInput?: string | null
) => {
  const cycle = getBudgetCycle(referenceDate, periodInput)
  const period = normalizeBudgetPeriod(periodInput)

  if (period === 'monthly') {
    return new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(cycle.start)
  }

  const start = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(cycle.start)

  const end = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(cycle.end)

  return `${start} – ${end}`
}

const getNextCycleReference = (
  cycle: BudgetCycle
) => {
  return addDays(cycle.end, 1)
}

const transactionBelongsToBudget = (
  tx: BudgetTransactionLike,
  budget: BudgetLike
) => {
  if (!tx?.date) return false

  if (
    tx.type !== 'expense' &&
    tx.type !== 'sangria'
  ) {
    return false
  }

  if (tx.status !== 'done') {
    return false
  }

  if (
    budget.category_id &&
    tx.category_id !== budget.category_id
  ) {
    return false
  }

  return true
}

const transactionsInCycle = (
  transactions: BudgetTransactionLike[],
  budget: BudgetLike,
  cycle: BudgetCycle
) => {
  return transactions.filter((tx) => {
    if (!transactionBelongsToBudget(tx, budget)) {
      return false
    }

    const date = String(tx.date).slice(0, 10)

    return (
      date >= cycle.startISO &&
      date <= cycle.endISO
    )
  })
}

const totalTransactions = (
  transactions: BudgetTransactionLike[]
) => {
  return transactions.reduce(
    (sum, tx) => sum + safeNumber(tx.amount),
    0
  )
}

export type BudgetTransactionIndex = Map<string, LocalTransaction[]>

export const buildBudgetTransactionIndex = (
  transactions: LocalTransaction[]
): BudgetTransactionIndex => {
  const index = new Map<string, LocalTransaction[]>()

  for (const tx of transactions) {
    if (tx.status !== 'done' || tx.type !== 'expense') continue

    const key = tx.category_id || '__uncategorized__'
    const current = index.get(key)

    if (current) current.push(tx)
    else index.set(key, [tx])
  }

  return index
}

export const getBudgetCandidateTransactions = (
  budget: { category_id?: string | null },
  transactions: LocalTransaction[],
  index?: BudgetTransactionIndex
) => {
  if (!index) return transactions
  return index.get(budget.category_id || '__uncategorized__') || []
}

export const calculateBudgetMetrics = ({
  budget,
  transactions,
  referenceDate,
}: {
  budget: BudgetLike
  transactions: BudgetTransactionLike[]
  referenceDate: Date
}): BudgetMetrics => {
  const period = normalizeBudgetPeriod(budget.period)
  const targetCycle = getBudgetCycle(referenceDate, period)
  const baseAmount = Math.max(0, safeNumber(budget.amount))

  let availableAmount = baseAmount
  let accumulatedBalance = 0

  if (budget.accumulate && budget.created_at) {
    const createdDate = parseLocalDate(budget.created_at)

    if (createdDate) {
      let cycle = getBudgetCycle(createdDate, period)
      let guard = 0

      while (
        cycle.startISO < targetCycle.startISO &&
        guard < 1500
      ) {
        const cycleSpent = totalTransactions(
          transactionsInCycle(
            transactions,
            budget,
            cycle
          )
        )

        const cycleAvailable =
          baseAmount + accumulatedBalance

        accumulatedBalance =
          cycleAvailable - cycleSpent

        cycle = getBudgetCycle(
          getNextCycleReference(cycle),
          period
        )

        guard += 1
      }

      if (guard >= 1500) {
        accumulatedBalance = 0
      }
    }
  }

  availableAmount =
    baseAmount +
    (budget.accumulate ? accumulatedBalance : 0)

  const cycleTransactions = transactionsInCycle(
    transactions,
    budget,
    targetCycle
  )

  const spent = totalTransactions(cycleTransactions)
  const remaining = availableAmount - spent

  const percent =
    availableAmount > 0
      ? (spent / availableAmount) * 100
      : spent > 0
        ? 100
        : 0

  return {
    cycle: targetCycle,
    transactions: cycleTransactions,
    spent,
    baseAmount,
    availableAmount,
    remaining,
    percent,
    progressPercent: Math.max(
      0,
      Math.min(percent, 100)
    ),
    isOverBudget: remaining < 0,
    isWarning:
      remaining >= 0 &&
      percent >= 75 &&
      percent < 100,
    accumulatedBalance:
      budget.accumulate
        ? accumulatedBalance
        : 0,
  }
}

export const getBudgetElapsedDays = (
  cycle: BudgetCycle,
  referenceDate = new Date()
) => {
  const today = cloneDate(referenceDate)

  if (today < cycle.start) {
    return 0
  }

  const effectiveEnd =
    today > cycle.end
      ? cycle.end
      : today

  return (
    Math.floor(
      (
        effectiveEnd.getTime() -
        cycle.start.getTime()
      ) / DAY_MS
    ) + 1
  )
}
