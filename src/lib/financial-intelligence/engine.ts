// src/lib/financial-intelligence/engine.ts

import {
  getContextBalance,
  getHistoricalMonthlyAverages,
  isExpenseTransaction,
  isRealizedFinancialTransaction,
} from '@/lib/financialMetrics'

import type {
  BuildFinancialIntelligenceInput,
  FinancialInsight,
  FinancialIntelligenceOutput,
  InsightConfidence,
  IntelligenceTransactionLike,
} from './types'

const safeNumber = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const round = (value: number) =>
  Math.round(value * 100) / 100

const iso = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12)

const startOfMonth = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), 1, 12)

const endOfMonth = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth() + 1, 0, 12)

const addDays = (value: Date, days: number) => {
  const next = startOfDay(value)
  next.setDate(next.getDate() + days)
  return next
}

const startOfWeekMonday = (value: Date) => {
  const date = startOfDay(value)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

const comparablePreviousMonthRange = (now: Date) => {
  const previousStart = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1,
    12
  )
  const previousLastDay = endOfMonth(previousStart).getDate()
  const comparableDay = Math.min(now.getDate(), previousLastDay)

  return {
    start: iso(previousStart),
    end: iso(
      new Date(
        previousStart.getFullYear(),
        previousStart.getMonth(),
        comparableDay,
        12
      )
    ),
  }
}

const filterRange = (
  transactions: IntelligenceTransactionLike[],
  start: string,
  end: string
) =>
  transactions.filter((transaction) => {
    const date = String(transaction.date || '').slice(0, 10)
    return date >= start && date <= end
  })

const sumIncome = (transactions: IntelligenceTransactionLike[]) =>
  transactions.reduce(
    (sum, transaction) =>
      transaction.type === 'income'
        ? sum + safeNumber(transaction.amount)
        : sum,
    0
  )

const sumExpense = (transactions: IntelligenceTransactionLike[]) =>
  transactions.reduce(
    (sum, transaction) =>
      isExpenseTransaction(transaction)
        ? sum + safeNumber(transaction.amount)
        : sum,
    0
  )

const deltaPercent = (
  current: number,
  baseline: number
): number | null => {
  if (Math.abs(baseline) < 0.000001) return null
  return ((current - baseline) / Math.abs(baseline)) * 100
}

const confidenceFromSample = (
  sampleSize: number
): InsightConfidence => {
  if (sampleSize >= 40) return 'high'
  if (sampleSize >= 15) return 'medium'
  return 'low'
}

const subscriptionMonthlyEquivalent = (
  amount: number,
  cycle?: string | null
) => {
  switch (cycle) {
    case 'yearly':
      return amount / 12
    case 'weekly':
      return amount * 4.33
    case 'quarterly':
      return amount / 3
    case 'semiannually':
      return amount / 6
    default:
      return amount
  }
}

const severityOrder = {
  critical: 5,
  warning: 4,
  attention: 3,
  opportunity: 2,
  info: 1,
} as const

export function buildFinancialIntelligence({
  context,
  now: nowInput = new Date(),
  transactions,
  accounts,
  categories,
  debts = [],
  subscriptions = [],
}: BuildFinancialIntelligenceInput): FinancialIntelligenceOutput {
  const now = startOfDay(nowInput)
  const todayISO = iso(now)
  const currentMonthStart = iso(startOfMonth(now))
  const previousComparable = comparablePreviousMonthRange(now)

  const currentWeekStart = startOfWeekMonday(now)
  const previousWeekStart = addDays(currentWeekStart, -7)
  const previousWeekEnd = addDays(currentWeekStart, -1)

  const realized = transactions.filter(
    (transaction) =>
      transaction.context === context &&
      isRealizedFinancialTransaction(transaction)
  )

  const currentMonth = filterRange(
    realized,
    currentMonthStart,
    todayISO
  )

  const previousMonthComparable = filterRange(
    realized,
    previousComparable.start,
    previousComparable.end
  )

  const currentWeek = filterRange(
    realized,
    iso(currentWeekStart),
    todayISO
  )

  const previousWeek = filterRange(
    realized,
    iso(previousWeekStart),
    iso(previousWeekEnd)
  )

  const currentMonthIncome = sumIncome(currentMonth)
  const currentMonthExpense = sumExpense(currentMonth)
  const currentMonthNet = currentMonthIncome - currentMonthExpense

  const previousComparableIncome = sumIncome(previousMonthComparable)
  const previousComparableExpense = sumExpense(previousMonthComparable)
  const previousComparableNet =
    previousComparableIncome - previousComparableExpense

  const currentWeekIncome = sumIncome(currentWeek)
  const currentWeekExpense = sumExpense(currentWeek)
  const previousWeekIncome = sumIncome(previousWeek)
  const previousWeekExpense = sumExpense(previousWeek)

  const accountBalance = getContextBalance(accounts, context)

  const history = getHistoricalMonthlyAverages(
    realized,
    now,
    3,
    context
  )

  const threshold = iso(
    new Date(
      now.getFullYear(),
      now.getMonth() - 3,
      now.getDate(),
      12
    )
  )

  const sampleSize = realized.filter((transaction) => {
    const date = String(transaction.date || '')
    return date >= threshold && date <= todayISO
  }).length

  const confidence = confidenceFromSample(sampleSize)

  const savingsRate =
    currentMonthIncome > 0
      ? (currentMonthNet / currentMonthIncome) * 100
      : null

  const elapsedDays = Math.max(1, now.getDate())
  const monthDays = endOfMonth(now).getDate()

  const projectedMonthExpense =
    (currentMonthExpense / elapsedDays) * monthDays

  const projectedMonthIncome =
    (currentMonthIncome / elapsedDays) * monthDays

  const projectedMonthNet =
    projectedMonthIncome - projectedMonthExpense

  const categoryById = new Map(
    categories.map((category) => [category.id, category])
  )

  const currentCategoryMap = new Map<string, number>()
  const previousCategoryMap = new Map<string, number>()

  for (const transaction of currentMonth) {
    if (!isExpenseTransaction(transaction)) continue
    const id = transaction.category_id || '__uncategorized__'
    currentCategoryMap.set(
      id,
      (currentCategoryMap.get(id) || 0) +
        safeNumber(transaction.amount)
    )
  }

  for (const transaction of previousMonthComparable) {
    if (!isExpenseTransaction(transaction)) continue
    const id = transaction.category_id || '__uncategorized__'
    previousCategoryMap.set(
      id,
      (previousCategoryMap.get(id) || 0) +
        safeNumber(transaction.amount)
    )
  }

  const topExpenseCategories =
    [...currentCategoryMap.entries()]
      .map(([id, amount]) => {
        const previousAmount = previousCategoryMap.get(id) || 0
        return {
          id,
          name:
            categoryById.get(id)?.name ||
            'Sem categoria',
          amount: round(amount),
          share:
            currentMonthExpense > 0
              ? amount / currentMonthExpense
              : 0,
          previousAmount: round(previousAmount),
          deltaPercent: deltaPercent(amount, previousAmount),
        }
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)

  const debtPaymentsById = new Map<string, number>()

  for (const transaction of transactions) {
    if (
      transaction.context !== context ||
      !transaction.debt_id ||
      transaction.type !== 'income' ||
      transaction.status !== 'done'
    ) continue

    const appliedCandidate = safeNumber(transaction.debt_applied_amount)
    const applied = appliedCandidate > 0 ? appliedCandidate : safeNumber(transaction.amount)
    if (applied <= 0) continue

    debtPaymentsById.set(
      transaction.debt_id,
      (debtPaymentsById.get(transaction.debt_id) || 0) + applied
    )
  }

  let receivablesOpen = 0
  let receivablesOverdue = 0
  let overdueReceivablesCount = 0

  for (const debt of debts) {
    if (debt.context !== context || debt.status === 'cancelled') continue

    const paidFromLedger = debt.id ? debtPaymentsById.get(debt.id) || 0 : 0
    const paid = paidFromLedger > 0 ? paidFromLedger : safeNumber(debt.paid_amount)
    const remaining = Math.max(0, safeNumber(debt.total_amount) - paid)

    if (remaining <= 0) continue

    receivablesOpen += remaining

    if (debt.due_date && String(debt.due_date).slice(0, 10) < todayISO) {
      receivablesOverdue += remaining
      overdueReceivablesCount += 1
    }
  }

  const recurringMonthlyEquivalent =
    subscriptions
      .filter(
        (subscription) =>
          subscription.context === context &&
          subscription.status === 'active'
      )
      .reduce(
        (sum, subscription) =>
          sum +
          subscriptionMonthlyEquivalent(
            safeNumber(subscription.amount),
            subscription.billing_cycle
          ),
        0
      )

  const insights: FinancialInsight[] = []

  const addInsight = (
    insight:
      Omit<FinancialInsight, 'sampleSize' | 'confidence'> & {
        sampleSize?: number
        confidence?: InsightConfidence
      }
  ) => {
    insights.push({
      ...insight,
      sampleSize: insight.sampleSize ?? sampleSize,
      confidence: insight.confidence ?? confidence,
    })
  }

  if (accountBalance < 0) {
    addInsight({
      id: 'negative-balance',
      type: 'cash_position',
      severity: 'critical',
      title: 'Saldo das contas está negativo',
      message:
        'O saldo consolidado das contas deste contexto está abaixo de zero.',
      currentValue: accountBalance,
      suggestedQuestion:
        'O que mais está pressionando meu caixa agora?',
    })
  } else if (
    accountBalance > 0 &&
    history.averageExpense > 0 &&
    accountBalance < history.averageExpense
  ) {
    addInsight({
      id: 'low-cash-buffer',
      type: 'cash_position',
      severity: 'warning',
      title: 'Margem de caixa reduzida',
      message:
        'O saldo atual é menor que a média mensal recente de despesas.',
      currentValue: accountBalance,
      baselineValue: history.averageExpense,
      suggestedQuestion:
        'Como posso aumentar minha margem de segurança?',
    })
  }

  if (currentMonthNet < 0) {
    addInsight({
      id: 'negative-month-net',
      type: 'monthly_result',
      severity: 'warning',
      title: 'O mês está negativo',
      message:
        'As despesas realizadas superam as receitas realizadas até agora.',
      currentValue: currentMonthNet,
      suggestedQuestion:
        'Por que meu resultado do mês está negativo?',
    })
  } else if (currentMonthNet > 0 && currentMonthIncome > 0) {
    addInsight({
      id: 'positive-month-net',
      type: 'monthly_result',
      severity: 'opportunity',
      title: 'O mês está positivo',
      message:
        'As receitas realizadas estão acima das despesas realizadas.',
      currentValue: currentMonthNet,
      suggestedQuestion:
        'Onde estou evoluindo financeiramente neste mês?',
    })
  }

  const expenseMonthDelta = deltaPercent(
    currentMonthExpense,
    previousComparableExpense
  )

  if (
    expenseMonthDelta !== null &&
    currentMonthExpense > 0 &&
    previousComparableExpense > 0
  ) {
    if (expenseMonthDelta >= 20) {
      addInsight({
        id: 'expense-month-spike',
        type: 'expense_trend',
        severity:
          expenseMonthDelta >= 40
            ? 'warning'
            : 'attention',
        title: 'Despesas aceleraram',
        message:
          'O gasto deste mês está acima do mesmo intervalo do mês anterior.',
        currentValue: currentMonthExpense,
        baselineValue: previousComparableExpense,
        deltaValue:
          currentMonthExpense - previousComparableExpense,
        deltaPercent: expenseMonthDelta,
        suggestedQuestion:
          'O que fez minhas despesas aumentarem?',
      })
    } else if (expenseMonthDelta <= -15) {
      addInsight({
        id: 'expense-month-improvement',
        type: 'expense_trend',
        severity: 'opportunity',
        title: 'Despesas recuaram',
        message:
          'O gasto está abaixo do mesmo intervalo do mês anterior.',
        currentValue: currentMonthExpense,
        baselineValue: previousComparableExpense,
        deltaValue:
          currentMonthExpense - previousComparableExpense,
        deltaPercent: expenseMonthDelta,
        suggestedQuestion:
          'Onde consegui reduzir gastos?',
      })
    }
  }

  const incomeMonthDelta = deltaPercent(
    currentMonthIncome,
    previousComparableIncome
  )

  if (
    incomeMonthDelta !== null &&
    previousComparableIncome > 0
  ) {
    if (incomeMonthDelta <= -20) {
      addInsight({
        id: 'income-month-drop',
        type: 'income_trend',
        severity:
          incomeMonthDelta <= -40
            ? 'warning'
            : 'attention',
        title: 'Receitas perderam ritmo',
        message:
          'As receitas realizadas estão abaixo do mesmo intervalo do mês anterior.',
        currentValue: currentMonthIncome,
        baselineValue: previousComparableIncome,
        deltaValue:
          currentMonthIncome - previousComparableIncome,
        deltaPercent: incomeMonthDelta,
        suggestedQuestion:
          'O que pode explicar a queda das minhas receitas?',
      })
    } else if (incomeMonthDelta >= 20) {
      addInsight({
        id: 'income-month-growth',
        type: 'income_trend',
        severity: 'opportunity',
        title: 'Receitas ganharam força',
        message:
          'As receitas realizadas estão acima do mesmo intervalo do mês anterior.',
        currentValue: currentMonthIncome,
        baselineValue: previousComparableIncome,
        deltaValue:
          currentMonthIncome - previousComparableIncome,
        deltaPercent: incomeMonthDelta,
        suggestedQuestion:
          'O que mais contribuiu para o crescimento das receitas?',
      })
    }
  }

  const expenseWeekDelta = deltaPercent(
    currentWeekExpense,
    previousWeekExpense
  )

  if (
    expenseWeekDelta !== null &&
    previousWeekExpense > 0 &&
    expenseWeekDelta >= 30
  ) {
    addInsight({
      id: 'expense-week-spike',
      type: 'weekly_expense',
      severity: 'attention',
      title: 'Semana mais cara',
      message:
        'As despesas desta semana estão acima da semana anterior.',
      currentValue: currentWeekExpense,
      baselineValue: previousWeekExpense,
      deltaPercent: expenseWeekDelta,
      suggestedQuestion:
        'Por que esta semana ficou mais cara?',
    })
  }

  if (savingsRate !== null && currentMonthIncome > 0) {
    if (savingsRate < 0) {
      addInsight({
        id: 'negative-savings-rate',
        type: 'savings_rate',
        severity: 'warning',
        title: 'Taxa de poupança negativa',
        message:
          'O resultado líquido representa uma parcela negativa das receitas do mês.',
        currentValue: savingsRate,
        suggestedQuestion:
          'Como posso melhorar minha taxa de poupança?',
      })
    } else if (savingsRate >= 20) {
      addInsight({
        id: 'strong-savings-rate',
        type: 'savings_rate',
        severity: 'opportunity',
        title: 'Boa retenção de receita',
        message:
          'Uma parcela relevante da receita do mês permanece como resultado positivo.',
        currentValue: savingsRate,
        suggestedQuestion:
          'Como posso aproveitar melhor meu resultado positivo?',
      })
    }
  }

  if (
    projectedMonthExpense > history.averageExpense * 1.2 &&
    history.averageExpense > 0
  ) {
    addInsight({
      id: 'expense-pace-risk',
      type: 'expense_pace',
      severity: 'attention',
      title: 'Ritmo de gasto elevado',
      message:
        'Mantido o ritmo atual, a despesa do mês tende a superar a média dos meses anteriores.',
      currentValue: projectedMonthExpense,
      baselineValue: history.averageExpense,
      deltaPercent:
        deltaPercent(
          projectedMonthExpense,
          history.averageExpense
        ) || undefined,
      periodsUsed: history.monthsUsed,
      suggestedQuestion:
        'Meu ritmo de gastos é sustentável até o fim do mês?',
    })
  }

  const leadingCategory = topExpenseCategories[0]

  if (
    leadingCategory &&
    leadingCategory.share >= 0.45 &&
    currentMonthExpense > 0
  ) {
    addInsight({
      id: 'category-concentration',
      type: 'category_concentration',
      severity:
        leadingCategory.share >= 0.65
          ? 'attention'
          : 'info',
      title:
        'Gastos concentrados em uma categoria',
      message:
        `${leadingCategory.name} representa uma fatia relevante das despesas do mês.`,
      currentValue: leadingCategory.amount,
      evidence: {
        category: leadingCategory.name,
        sharePercent: round(leadingCategory.share * 100),
      },
      suggestedQuestion:
        `Por que estou gastando tanto com ${leadingCategory.name}?`,
    })
  }

  for (const category of topExpenseCategories.slice(0, 4)) {
    if (
      category.previousAmount <= 0 ||
      category.deltaPercent === null ||
      category.deltaPercent < 35 ||
      category.amount < currentMonthExpense * 0.1
    ) continue

    addInsight({
      id: `category-spike-${category.id}`,
      type: 'category_spike',
      severity: 'attention',
      title: `${category.name} acelerou`,
      message:
        `O gasto com ${category.name} aumentou em relação ao mesmo intervalo do mês anterior.`,
      currentValue: category.amount,
      baselineValue: category.previousAmount,
      deltaPercent: category.deltaPercent,
      evidence: {
        category: category.name,
      },
      suggestedQuestion:
        `O que aumentou meus gastos com ${category.name}?`,
    })

    break
  }

  if (receivablesOverdue > 0) {
    addInsight({
      id: 'overdue-receivables',
      type: 'receivables',
      severity:
        overdueReceivablesCount >= 3
          ? 'warning'
          : 'attention',
      title: 'Há valores vencidos a receber',
      message:
        'Existem cobranças de Quem me deve com vencimento anterior a hoje.',
      currentValue: receivablesOverdue,
      evidence: {
        overdueCount: overdueReceivablesCount,
      },
      suggestedQuestion:
        'Quanto tenho vencido para receber e qual a prioridade?',
    })
  }

  if (
    recurringMonthlyEquivalent > 0 &&
    currentMonthExpense > 0
  ) {
    const recurringShare =
      recurringMonthlyEquivalent /
      Math.max(
        currentMonthExpense,
        projectedMonthExpense,
        1
      )

    if (recurringShare >= 0.35) {
      addInsight({
        id: 'recurring-weight',
        type: 'recurring_expense',
        severity: 'info',
        title: 'Recorrências têm peso relevante',
        message:
          'O equivalente mensal das assinaturas ativas representa uma parcela importante do ritmo de despesas.',
        currentValue: recurringMonthlyEquivalent,
        evidence: {
          estimatedSharePercent:
            round(recurringShare * 100),
        },
        suggestedQuestion:
          'Quais despesas recorrentes mais pesam no meu mês?',
      })
    }
  }

  insights.sort((a, b) => {
    const severityDiff =
      severityOrder[b.severity] -
      severityOrder[a.severity]

    if (severityDiff !== 0) return severityDiff

    const confidenceOrder = {
      high: 3,
      medium: 2,
      low: 1,
    }

    return (
      confidenceOrder[b.confidence] -
      confidenceOrder[a.confidence]
    )
  })

  return {
    context,
    generatedAt: new Date().toISOString(),
    snapshot: {
      accountBalance: round(accountBalance),
      currentMonthIncome: round(currentMonthIncome),
      currentMonthExpense: round(currentMonthExpense),
      currentMonthNet: round(currentMonthNet),
      previousComparableIncome: round(previousComparableIncome),
      previousComparableExpense: round(previousComparableExpense),
      previousComparableNet: round(previousComparableNet),
      currentWeekIncome: round(currentWeekIncome),
      currentWeekExpense: round(currentWeekExpense),
      previousWeekIncome: round(previousWeekIncome),
      previousWeekExpense: round(previousWeekExpense),
      historicalAverageIncome: round(history.averageIncome),
      historicalAverageExpense: round(history.averageExpense),
      historicalAverageNet: round(history.averageNet),
      historicalMonthsUsed: history.monthsUsed,
      savingsRate:
        savingsRate === null ? null : round(savingsRate),
      transactionCount: currentMonth.length,
      sampleSize,
      confidence,
      projectedMonthExpense: round(projectedMonthExpense),
      projectedMonthNet: round(projectedMonthNet),
      receivablesOpen: round(receivablesOpen),
      receivablesOverdue: round(receivablesOverdue),
      overdueReceivablesCount,
      recurringMonthlyEquivalent: round(recurringMonthlyEquivalent),
      topExpenseCategories,
    },
    insights,
  }
}
