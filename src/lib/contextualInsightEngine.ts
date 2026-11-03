/**
 * R419 — Observações locais, explicáveis e determinísticas.
 * Apenas dados já armazenados para usuário/contexto; nunca grava, projeta ou
 * atribui causalidade. Usa períodos equivalentes (dia do mês) para comparação.
 */
export type InsightScope = 'home' | 'transactions' | 'analysis' | 'cards'
export type InsightContext = 'dfl' | 'personal'
export type InsightTransaction = {
  context?: string
  id?: string
  type?: string
  status?: string
  date?: string
  amount?: number | string | null
  category_id?: string | null
  credit_card_id?: string | null
}
export type ContextualInsight = {
  id: string
  title: string
  detail: string
  href: string
  /** Identifica o fundamento do insight, para auditoria/QA. */
  basis: 'completed' | 'pending' | 'category' | 'card' | 'comparison'
}

const fmt = (d: Date) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
const plural = (n: number, singular: string, multiple: string) => `${n} ${n === 1 ? singular : multiple}`
const safeAmount = (value: unknown) => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? n : 0
}
const cleanDate = (date: unknown) => {
  if (typeof date !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) return ''
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(year, month - 1, day, 12)
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day ? date : ''
}

export function buildContextualInsights(
  scope: InsightScope,
  context: InsightContext,
  transactions: readonly InsightTransaction[],
  reference = new Date()
): ContextualInsight[] {
  if (!Number.isFinite(reference.getTime()) || !Array.isArray(transactions)) return []
  const today = fmt(reference)
  const currentStart = fmt(new Date(reference.getFullYear(), reference.getMonth(), 1, 12))
  const previousStart = fmt(new Date(reference.getFullYear(), reference.getMonth() - 1, 1, 12))
  const previousEnd = fmt(new Date(reference.getFullYear(), reference.getMonth() - 1,
    Math.min(reference.getDate(), new Date(reference.getFullYear(), reference.getMonth(), 0).getDate()), 12))
  const month = currentStart.slice(0, 7)
  const expenseHref = `/transactions?filter=expense&month=${month}`
  const incomeHref = `/transactions?filter=income&month=${month}`

  const valid = transactions.filter(item =>
    item.context === context && cleanDate(item.date) && item.date! <= today &&
    (item.type === 'income' || item.type === 'expense') && safeAmount(item.amount) > 0
  )
  const current = valid.filter(item => item.date! >= currentStart)
  const previous = valid.filter(item => item.date! >= previousStart && item.date! <= previousEnd)
  const currentDone = current.filter(item => item.status === 'done')
  const previousDone = previous.filter(item => item.status === 'done')
  const currentExpenses = currentDone.filter(item => item.type === 'expense')
  const previousExpenses = previousDone.filter(item => item.type === 'expense')
  const currentIncome = currentDone.filter(item => item.type === 'income')
  const due = current.filter(item => item.status === 'pending')
  const cards = currentExpenses.filter(item => typeof item.credit_card_id === 'string' && !!item.credit_card_id)
  const categories = new Set(currentExpenses.map(item => item.category_id).filter(Boolean))

  const options: ContextualInsight[] = []
  if (due.length > 0) options.push({
    id: 'pending-this-month',
    title: 'Pendências para conferir',
    detail: `${plural(due.length, 'lançamento pendente', 'lançamentos pendentes')} com data até hoje neste mês. Confira no extrato antes de agir.`,
    href: '/transactions?filter=pending', basis: 'pending'
  })
  if (currentExpenses.length >= 3 && previousExpenses.length >= 3) {
    const a = currentExpenses.reduce((sum, item) => sum + safeAmount(item.amount), 0)
    const b = previousExpenses.reduce((sum, item) => sum + safeAmount(item.amount), 0)
    if (b >= 100 && a > 0) {
      const change = ((a - b) / b) * 100
      const rounded = Math.round(Math.abs(change))
      if (rounded >= 15 && rounded <= 300) options.push({
        id: 'expense-comparison',
        title: change > 0 ? 'Despesas registradas em alta' : 'Despesas registradas em queda',
        detail: `As despesas concluídas estão ${rounded}% ${change > 0 ? 'acima' : 'abaixo'} do mesmo intervalo de dias do mês anterior, nos dados locais.`,
        href: expenseHref, basis: 'comparison'
      })
    }
  }
  if (currentExpenses.length >= 2 || currentIncome.length >= 2) options.push({
    id: 'monthly-activity',
    title: 'Movimentação do mês',
    detail: `Até hoje: ${plural(currentExpenses.length, 'despesa concluída', 'despesas concluídas')} e ${plural(currentIncome.length, 'receita concluída', 'receitas concluídas')} registradas.`,
    href: '/transactions', basis: 'completed'
  })
  if (categories.size >= 2 && currentExpenses.length >= 3) options.push({
    id: 'category-activity',
    title: 'Despesas distribuídas',
    detail: `${plural(categories.size, 'categoria', 'categorias')} com despesas concluídas neste mês. Veja como elas se distribuem nas análises.`,
    href: '/analysis', basis: 'category'
  })
  if (cards.length >= 2) options.push({
    id: 'card-activity',
    title: 'Compras vinculadas a cartões',
    detail: `${plural(cards.length, 'despesa concluída', 'despesas concluídas')} vinculadas a cartão neste mês. Consulte as movimentações registradas.`,
    href: expenseHref, basis: 'card'
  })
  if (currentIncome.length >= 2) options.push({
    id: 'income-activity',
    title: 'Receitas registradas',
    detail: `${plural(currentIncome.length, 'entrada concluída', 'entradas concluídas')} neste mês nos dados locais. Abra o extrato para conferir.`,
    href: incomeHref, basis: 'completed'
  })

  // Cada seção dá preferência à evidência pertinente, sem repetir sempre o mesmo cartão.
  const priorities: Record<InsightScope, readonly string[]> = {
    home: ['pending-this-month', 'expense-comparison', 'monthly-activity', 'income-activity', 'category-activity', 'card-activity'],
    transactions: ['pending-this-month', 'monthly-activity', 'category-activity', 'card-activity', 'expense-comparison', 'income-activity'],
    analysis: ['expense-comparison', 'category-activity', 'monthly-activity', 'income-activity', 'pending-this-month', 'card-activity'],
    cards: ['card-activity', 'expense-comparison', 'category-activity', 'monthly-activity', 'pending-this-month', 'income-activity'],
  }
  return options.sort((a, b) => priorities[scope].indexOf(a.id) - priorities[scope].indexOf(b.id))
}

export function nextContextualInsight(insights: readonly ContextualInsight[], previousId: string | null) {
  return insights.find(item => item.id !== previousId) ?? insights[0] ?? null
}
