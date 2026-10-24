// V175 — Revisão mensal econômica e consultiva.
// Não acessa banco, não altera ledger, não executa conciliação.
import {
  isPaceExpense,
  type PaceTransaction,
  type PaceContext,
} from './financePace'

export type MonthlyRow = PaceTransaction & {
  id?: string | null
  account_id?: string | null
  description?: string | null
  source?: string | null
  reviewed_at?: string | null
}

export type MonthlyCategory = {
  id?: string | null
  name?: string | null
}

export type MonthlyLine = {
  month: string
  income: number
  expense: number
  result: number
  count: number
  cardExpense: number
}

export type MonthlyImpact = {
  id: string
  name: string
  amount: number
  count: number
  percent: number
}

export type MonthlyReview = {
  context: PaceContext
  month: string
  cutoff: string
  closed: boolean
  income: number
  expense: number
  cardExpense: number
  cashExpense: number
  result: number
  economicCount: number
  pendingCount: number
  pendingAmount: number
  missingCategories: number
  missingAccounts: number
  importsToReview: number
  invalidRows: number
  comparisonMonth: string
  comparableIncome: number
  comparableExpense: number
  comparableResult: number
  expenseVariation: number | null
  incomeVariation: number | null
  history: MonthlyLine[]
  categories: MonthlyImpact[]
  alerts: string[]
}

const money = (n: number) => Math.round(n * 100) / 100

const amount = (n: unknown) => {
  const value = Number(n)
  return typeof n === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 1000000000
    ? Math.round(value * 100)
    : 0
}

const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' ||
      !/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) {
    return false
  }
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
}

const monthAt = (month: string, delta: number) => {
  const [year, number] = month.split('-').map(Number)
  const value = new Date(Date.UTC(year, number - 1 + delta, 1, 12))
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`
}

const monthLength = (month: string) => {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number, 0, 12)).getUTCDate()
}

const lastDate = (month: string) =>
  `${month}-${String(monthLength(month)).padStart(2, '0')}`

const deltaPercent = (current: number, previous: number) =>
  previous > 0 ? money((current - previous) / previous * 100) : null

const validMonth = (value: string) =>
  /^20\d{2}-(0[1-9]|1[0-2])$/.test(value)

const isReceivedIncome = (row: MonthlyRow, context: PaceContext) =>
  row.context === context &&
  row.type === 'income' &&
  row.status === 'done' &&
  row.affects_balance !== false &&
  !row.credit_card_id &&
  !row.invoice_id &&
  !row.transfer_group_id &&
  !row.goal_id &&
  !row.loan_id &&
  !row.financing_id &&
  !row.debt_id &&
  validDate(row.date) &&
  amount(row.amount) > 0

const imported = (row: MonthlyRow) =>
  ['whatsapp', 'ai_ocr', 'ofx_import', 'ofx_merged', 'csv_import', 'csv']
    .includes(String(row.source || ''))

/**
 * Lançamentos no cartão entram como despesa na compra.
 * Pagamento de fatura não representa uma nova despesa econômica.
 * Meses em andamento comparam períodos de igual quantidade de dias.
 * Seleção de mês futuro é bloqueada.
 */
export function buildMonthlyReview(
  rows: MonthlyRow[],
  categories: MonthlyCategory[],
  context: PaceContext,
  month: string,
  today: string
): MonthlyReview {
  if ((context !== 'dfl' && context !== 'personal') ||
      !validDate(today) ||
      !validMonth(month) ||
      month > today.slice(0, 7)) {
    throw new Error('V175: período ou contexto inválido')
  }

  const closed = month < today.slice(0, 7)
  const cutoff = closed ? lastDate(month) : today
  const previous = monthAt(month, -1)
  const previousCutoff = closed
    ? lastDate(previous)
    : `${previous}-${String(Math.min(
      Number(today.slice(8)),
      monthLength(previous)
    )).padStart(2, '0')}`

  const categoryNames = new Map(
    categories.filter(c => c.id).map(c => [
      String(c.id), String(c.name || 'Categoria sem nome')
    ])
  )
  const historyMonths = Array.from({ length: 6 }, (_, i) =>
    monthAt(month, i - 5)
  )
  const totals = new Map<string, {
    income: number
    expense: number
    card: number
    count: number
  }>()
  const categoriesOut = new Map<string, {
    amount: number
    count: number
  }>()

  let pendingCount = 0
  let pendingCents = 0
  let missingCategories = 0
  let missingAccounts = 0
  let importsToReview = 0
  let invalidRows = 0

  let previousIncome = 0
  let previousExpense = 0

  for (const row of rows || []) {
    if (!row || row.context !== context) continue

    if (!validDate(row.date) || amount(row.amount) === 0) {
      invalidRows++
      continue
    }

    const date = row.date
    const cents = amount(row.amount)
    const rowMonth = date.slice(0, 7)

    if (rowMonth === month && date <= cutoff &&
        row.status === 'pending' &&
        !row.transfer_group_id &&
        !row.invoice_id &&
        !row.credit_card_id &&
        (row.type === 'expense' || row.type === 'income' ||
          row.type === 'sangria')) {
      pendingCount++
      pendingCents += cents
      if (imported(row) && !row.reviewed_at) importsToReview++
    }

    const income = isReceivedIncome(row, context)
    const expense = isPaceExpense(row, context)

    if (!income && !expense) continue

    if (rowMonth === previous && date <= previousCutoff) {
      if (income) previousIncome += cents
      if (expense) previousExpense += cents
    }

    if (date > cutoff || !historyMonths.includes(rowMonth)) continue

    const current = totals.get(rowMonth) || {
      income: 0, expense: 0, card: 0, count: 0
    }
    if (income) current.income += cents
    if (expense) {
      current.expense += cents
      if (row.credit_card_id) current.card += cents
    }
    current.count++
    totals.set(rowMonth, current)

    if (rowMonth !== month) continue

    if (!row.category_id) missingCategories++
    if (!row.account_id && !row.credit_card_id) missingAccounts++

    if (expense) {
      const categoryId = String(row.category_id || 'uncategorized')
      const item = categoriesOut.get(categoryId) || {
        amount: 0, count: 0
      }
      item.amount += cents
      item.count++
      categoriesOut.set(categoryId, item)
    }
  }

  const history: MonthlyLine[] = historyMonths.map(m => {
    const data = totals.get(m) || {
      income: 0, expense: 0, card: 0, count: 0
    }
    return {
      month: m,
      income: money(data.income / 100),
      expense: money(data.expense / 100),
      result: money((data.income - data.expense) / 100),
      cardExpense: money(data.card / 100),
      count: data.count
    }
  })

  const current = history[history.length - 1]
  const cashExpense = money(current.expense - current.cardExpense)

  const impacts: MonthlyImpact[] = Array.from(categoriesOut.entries())
    .map(([id, data]) => ({
      id,
      name: id === 'uncategorized'
        ? 'Sem categoria'
        : categoryNames.get(id) || 'Categoria não encontrada',
      amount: money(data.amount / 100),
      count: data.count,
      percent: current.expense > 0
        ? money((data.amount / 100) / current.expense * 100)
        : 0
    }))
    .sort((a, b) =>
      b.amount - a.amount || a.name.localeCompare(b.name, 'pt-BR')
    )
    .slice(0, 10)

  const alerts: string[] = []
  if (pendingCount > 0)
    alerts.push(`${pendingCount} pendência(s) ainda não realizada(s) no período.`)
  if (missingCategories > 0)
    alerts.push(`${missingCategories} lançamento(s) sem categoria.`)
  if (missingAccounts > 0)
    alerts.push(`${missingAccounts} lançamento(s) sem conta ou cartão.`)
  if (importsToReview > 0)
    alerts.push(`${importsToReview} importação(ões) pendente(s) de revisão.`)
  if (invalidRows > 0)
    alerts.push('Há registros com data ou valor inválido, excluídos dos cálculos.')
  if (!current.count)
    alerts.push('Não há movimentações econômicas realizadas neste período.')
  if (!closed)
    alerts.push('Mês ainda aberto: o comparativo utiliza dias equivalentes.')

  const comparableIncome = money(previousIncome / 100)
  const comparableExpense = money(previousExpense / 100)

  return {
    context,
    month,
    cutoff,
    closed,
    income: current.income,
    expense: current.expense,
    cardExpense: current.cardExpense,
    cashExpense,
    result: current.result,
    economicCount: current.count,
    pendingCount,
    pendingAmount: money(pendingCents / 100),
    missingCategories,
    missingAccounts,
    importsToReview,
    invalidRows,
    comparisonMonth: previous,
    comparableIncome,
    comparableExpense,
    comparableResult: money(comparableIncome - comparableExpense),
    expenseVariation: deltaPercent(current.expense, comparableExpense),
    incomeVariation: deltaPercent(current.income, comparableIncome),
    history,
    categories: impacts,
    alerts
  }
}
