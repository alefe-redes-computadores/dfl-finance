// V177 — Indicadores históricos consultivos.
// Usa V175 como autoridade econômica.
// Sem escrita, previsão de saldo, RPC ou sincronização adicional.

import {
  buildMonthlyReview,
  type MonthlyRow,
  type MonthlyCategory,
  type MonthlyLine
} from './financeMonthlyReview'
import type { PaceContext } from './financePace'

export type TrendLevel =
  'attention' | 'observe' | 'stable' | 'unknown'

export type TrendSignal = {
  id: string
  title: string
  level: TrendLevel
  value: string
  detail: string
  href: string
  priority: number
}

export type TrendSnapshot = {
  context: PaceContext
  today: string
  completeHistory: MonthlyLine[]
  currentIncome: number
  currentExpense: number
  monthsWithRecords: number
  monthsWithIncome: number
  monthsWithExpenses: number
  incomeAverage: number | null
  incomeVariability: number | null
  expenseAverage: number | null
  expenseTrendPercent: number | null
  largestCategory: string | null
  largestCategoryShare: number | null
  signals: TrendSignal[]
  limitations: string[]
}

const round = (n: number) => Math.round(n * 100) / 100

const brl = (n: number) =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })

const pct = (n: number) =>
  `${round(n).toFixed(1).replace('.', ',')}%`

const average = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length

const variation = (values: number[]) => {
  if (values.length < 3) return null
  const mean = average(values)
  if (mean <= 0) return null
  const variance = average(
    values.map(v => Math.pow(v - mean, 2))
  )
  return round(Math.sqrt(variance) / mean * 100)
}

const previousMonth = (today: string) => {
  const [y, m] = today.slice(0, 7).split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1, 12))
  return `${d.getUTCFullYear()}-${String(
    d.getUTCMonth() + 1
  ).padStart(2, '0')}`
}

/**
 * Histórico: seis meses civis COMPLETOS anteriores.
 *
 * Um mês sem lançamentos não é prova de receita zero:
 * esse mês é tratado como sem evidência.
 *
 * Tendência de despesa exige seis meses com registros,
 * evitando comparar amostras não equivalentes.
 */
export function buildFinanceTrends(
  rows: MonthlyRow[],
  categories: MonthlyCategory[],
  context: PaceContext,
  today: string
): TrendSnapshot {
  const current = buildMonthlyReview(
    rows, categories, context, today.slice(0, 7), today
  )

  const previous = previousMonth(today)
  const historical = buildMonthlyReview(
    rows, categories, context, previous, today
  )

  const history = historical.history
  const monthsWithRecords = history.filter(
    m => m.count > 0
  ).length

  const incomeRows = history.filter(
    m => m.income > 0
  )
  const expenseRows = history.filter(
    m => m.expense > 0
  )

  const monthsWithIncome = incomeRows.length
  const monthsWithExpenses = expenseRows.length

  const incomeAverage = monthsWithIncome >= 3
    ? round(average(incomeRows.map(m => m.income)))
    : null

  const incomeVariability = monthsWithIncome >= 3
    ? variation(incomeRows.map(m => m.income))
    : null

  const expenseAverage = monthsWithExpenses >= 3
    ? round(average(expenseRows.map(m => m.expense)))
    : null

  let expenseTrendPercent: number | null = null

  if (monthsWithRecords === 6 &&
      monthsWithExpenses === 6) {
    const first = average(history.slice(0, 3).map(m => m.expense))
    const last = average(history.slice(3, 6).map(m => m.expense))
    if (first > 0) {
      expenseTrendPercent = round((last - first) / first * 100)
    }
  }

  const leading = current.categories[0]
  const largestCategory = leading?.name || null
  const largestCategoryShare = leading?.percent ?? null

  const signals: TrendSignal[] = []

  const add = (signal: TrendSignal) => {
    signals.push(signal)
  }

  if (incomeVariability === null) {
    add({
      id: 'income-regularity',
      title: 'Regularidade de recebimentos',
      level: 'unknown',
      value: 'Histórico limitado',
      detail: 'São necessários pelo menos três meses com receitas realizadas para observar sua variação. Recebimentos semelhantes não comprovam contratos recorrentes.',
      href: '/monthly-review',
      priority: 5
    })
  } else {
    const level: TrendLevel = incomeVariability >= 60
      ? 'attention'
      : incomeVariability >= 25 ? 'observe' : 'stable'

    add({
      id: 'income-regularity',
      title: 'Variação das receitas',
      level,
      value: pct(incomeVariability),
      detail: `Variação relativa observada nos ${monthsWithIncome} meses com receitas. Média nesses meses: ${brl(incomeAverage || 0)}. Meses sem registros não foram interpretados como ausência comprovada de recebimentos.`,
      href: '/monthly-review',
      priority: level === 'attention' ? 2 : 7
    })
  }

  if (expenseTrendPercent === null) {
    add({
      id: 'expense-trend',
      title: 'Tendência de despesas',
      level: 'unknown',
      value: 'Amostra incompleta',
      detail: 'É necessário histórico com registros de despesas nos seis meses civis completos para comparar duas janelas de três meses.',
      href: '/monthly-review',
      priority: 6
    })
  } else {
    const level: TrendLevel = expenseTrendPercent > 20
      ? 'attention'
      : expenseTrendPercent > 5 ? 'observe' : 'stable'

    add({
      id: 'expense-trend',
      title: 'Tendência de gastos',
      level,
      value: `${expenseTrendPercent > 0 ? '+' : ''}${pct(expenseTrendPercent)}`,
      detail: `Variação da média dos três meses completos mais recentes em relação aos três anteriores. Média dos meses com despesas: ${brl(expenseAverage || 0)}. Não representa uma previsão de gastos.`,
      href: '/monthly-review',
      priority: level === 'attention' ? 1 : 8
    })
  }

  if (largestCategoryShare !== null &&
      largestCategoryShare >= 45 &&
      current.categories.length >= 2) {
    add({
      id: 'concentration',
      title: 'Concentração atual de gastos',
      level: 'observe',
      value: pct(largestCategoryShare),
      detail: `${largestCategory} representa ${pct(largestCategoryShare)} das despesas econômicas deste mês. Concentração é um indício para análise, não uma irregularidade.`,
      href: '/monthly-review',
      priority: 4
    })
  }

  if (current.pendingCount > 0) {
    add({
      id: 'pending',
      title: 'Pendências do mês',
      level: 'observe',
      value: String(current.pendingCount),
      detail: `${brl(current.pendingAmount)} em pendências comuns do período. Não são tratados como valores realizados e não alteram os saldos neste diagnóstico.`,
      href: '/conciliation',
      priority: 3
    })
  }

  if (current.missingCategories > 0 ||
      current.missingAccounts > 0) {
    add({
      id: 'quality',
      title: 'Qualidade do cadastro',
      level: 'observe',
      value: String(
        current.missingCategories + current.missingAccounts
      ),
      detail: 'Quantidade de sinalizações de conta ou categoria ausente. Um lançamento pode gerar mais de uma sinalização.',
      href: '/review',
      priority: 3
    })
  }

  const limitations = [
    'Seis meses anteriores são analisados como períodos completos. O mês atual é mostrado separadamente.',
    'Meses sem registros podem representar dados incompletos, e não ausência real de movimentações.',
    'Variação de receita não prova recorrência contratual, estabilidade de emprego ou previsibilidade de recebimento.',
    'Tendências não são saldo bancário, lucro contábil nem previsão garantida.'
  ]

  if (monthsWithRecords < 6) {
    limitations.unshift(
      `Somente ${monthsWithRecords} dos seis meses possuem movimentações observadas.`
    )
  }

  signals.sort((a, b) =>
    a.priority - b.priority || a.id.localeCompare(b.id)
  )

  return {
    context,
    today,
    completeHistory: history,
    currentIncome: current.income,
    currentExpense: current.expense,
    monthsWithRecords,
    monthsWithIncome,
    monthsWithExpenses,
    incomeAverage,
    incomeVariability,
    expenseAverage,
    expenseTrendPercent,
    largestCategory,
    largestCategoryShare,
    signals,
    limitations
  }
}
