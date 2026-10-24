// V176 - Diagnóstico explicável; exclusivamente leitura.
// O motor V175 continua sendo a autoridade dos valores econômicos.
import {
  buildMonthlyReview,
  type MonthlyRow,
  type MonthlyCategory,
  type MonthlyReview
} from './financeMonthlyReview'
import type { PaceContext } from './financePace'

export type HealthLevel = 'attention' | 'observe' | 'stable' | 'unknown'

export type HealthSignal = {
  id: string
  title: string
  level: HealthLevel
  value: string
  evidence: string
  href: string
  priority: number
}

export type HealthSnapshot = {
  context: PaceContext
  month: string
  monthly: MonthlyReview
  coverage: number | null
  expenseChange: number | null
  historyMonths: number
  evidenceCount: number
  pendingShare: number | null
  categoryShare: number | null
  signals: HealthSignal[]
  limitations: string[]
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })

const pct = (n: number) =>
  `${n.toFixed(1).replace('.', ',')}%`

const safeRatio = (a: number, b: number) =>
  b > 0 ? Math.round(a / b * 1000) / 10 : null

/**
 * Diagnóstico sem score arbitrário.
 * A cobertura do mês compara recebimentos realizados com gastos
 * econômicos; não é liquidez, lucro contábil ou saldo em banco.
 */
export function buildFinanceHealth(
  rows: MonthlyRow[],
  categories: MonthlyCategory[],
  context: PaceContext,
  today: string
): HealthSnapshot {
  const month = today.slice(0, 7)
  const monthly = buildMonthlyReview(
    rows, categories, context, month, today
  )
  const coverage = safeRatio(monthly.income, monthly.expense)
  const expenseChange = monthly.expenseVariation

  const fullHistory = monthly.history.slice(0, -1)
  const observedHistory = fullHistory.filter(m => m.count > 0)
  const historyMonths = observedHistory.length

  const pendingShare = safeRatio(
    monthly.pendingAmount,
    monthly.pendingAmount + monthly.expense
  )

  const leading = monthly.categories[0]
  const categoryShare = leading ? leading.percent : null

  const signals: HealthSignal[] = []
  const add = (signal: HealthSignal) => signals.push(signal)

  if (monthly.economicCount === 0) {
    add({
      id: 'absence',
      title: 'Movimentações insuficientes',
      level: 'unknown',
      value: 'Sem diagnóstico',
      evidence: 'O período não possui registros econômicos realizados. Não é possível inferir estabilidade financeira.',
      href: '/monthly-review',
      priority: 1
    })
  } else if (coverage === null) {
    add({
      id: 'coverage',
      title: 'Cobertura de gastos',
      level: 'unknown',
      value: 'Sem despesas',
      evidence: `Foram registrados ${fmt(monthly.income)} em recebimentos e nenhuma despesa econômica no mês. Sem denominador, não há percentual válido.`,
      href: '/monthly-review',
      priority: 3
    })
  } else {
    const level: HealthLevel = monthly.income < monthly.expense
      ? 'attention'
      : 'stable'
    add({
      id: 'coverage',
      title: 'Receitas versus gastos',
      level,
      value: pct(coverage),
      evidence: `${fmt(monthly.income)} recebidos para ${fmt(monthly.expense)} em despesas econômicas. O indicador não considera obrigações futuras nem corresponde ao saldo bancário.`,
      href: '/monthly-review',
      priority: level === 'attention' ? 2 : 8
    })
  }

  if (monthly.economicCount > 0) {
    if (expenseChange === null) {
      add({
        id: 'trend',
        title: 'Variação dos gastos',
        level: 'unknown',
        value: 'Sem base',
        evidence: 'O período equivalente anterior não possui despesas suficientes para calcular uma variação percentual válida.',
        href: '/monthly-review',
        priority: 6
      })
    } else {
      const level: HealthLevel = expenseChange > 20
        ? 'attention'
        : expenseChange > 5 ? 'observe' : 'stable'
      add({
        id: 'trend',
        title: 'Variação das despesas',
        level,
        value: `${expenseChange > 0 ? '+' : ''}${pct(expenseChange)}`,
        evidence: `Comparação proporcional: ${fmt(monthly.expense)} neste mês e ${fmt(monthly.comparableExpense)} no período equivalente anterior. Aumento isolado não demonstra necessariamente descontrole.`,
        href: '/monthly-review',
        priority: level === 'attention' ? 3 : 9
      })
    }
  }

  if (monthly.pendingCount > 0) {
    add({
      id: 'pending',
      title: 'Pendências do período',
      level: 'observe',
      value: String(monthly.pendingCount),
      evidence: `${fmt(monthly.pendingAmount)} ainda não realizados. Pendências comuns ficam fora dos gastos realizados e não podem ser tratadas como pagamentos efetuados.`,
      href: '/conciliation',
      priority: 4
    })
  }

  const incomplete = monthly.missingCategories +
    monthly.missingAccounts

  if (incomplete > 0 || monthly.importsToReview > 0) {
    add({
      id: 'quality',
      title: 'Qualidade dos registros',
      level: 'observe',
      value: `${incomplete} sinalizações`,
      evidence: `${monthly.missingCategories} sem categoria, ${monthly.missingAccounts} sem conta/cartão e ${monthly.importsToReview} importações pendentes de conferência. As sinalizações podem se referir ao mesmo registro.`,
      href: '/review',
      priority: 5
    })
  }

  if (leading && categoryShare !== null &&
      categoryShare >= 50 && monthly.categories.length > 1) {
    add({
      id: 'concentration',
      title: 'Concentração de despesas',
      level: 'observe',
      value: pct(categoryShare),
      evidence: `${leading.name} representa ${fmt(leading.amount)} do gasto econômico do mês. Concentração não significa irregularidade; confira a composição.`,
      href: '/monthly-review',
      priority: 7
    })
  }

  const limitations: string[] = []
  if (historyMonths < 3) {
    limitations.push(
      'Menos de três meses anteriores com registros. Tendências de longo prazo ainda são pouco confiáveis.'
    )
  }
  if (monthly.invalidRows > 0) {
    limitations.push(
      `${monthly.invalidRows} registro(s) do contexto com data ou valor inválido foram ignorados pela revisão mensal.`
    )
  }
  if (monthly.pendingCount > 0) {
    limitations.push(
      'Recebíveis e despesas pendentes não integram o resultado realizado, salvo compras no cartão reconhecidas economicamente.'
    )
  }
  limitations.push(
    'O diagnóstico não mede patrimônio, lucro contábil, caixa disponível ou capacidade garantida de pagamento.'
  )

  signals.sort((a, b) =>
    a.priority - b.priority || a.id.localeCompare(b.id)
  )

  return {
    context,
    month,
    monthly,
    coverage,
    expenseChange,
    historyMonths,
    evidenceCount: monthly.economicCount,
    pendingShare,
    categoryShare,
    signals,
    limitations
  }
}
