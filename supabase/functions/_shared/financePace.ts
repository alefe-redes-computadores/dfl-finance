// V172 — Motor puro de ritmo financeiro, compartilhado por PWA e bot.
// Planejamento não é saldo. Nunca altera lançamentos nem contas.
export type PaceContext = 'dfl' | 'personal'
export type PaceTransaction = {
  context?: string | null; type?: string | null; amount?: number | null
  status?: string | null; affects_balance?: boolean | null; date?: string | null
  category_id?: string | null; credit_card_id?: string | null; invoice_id?: string | null
  transfer_group_id?: string | null; goal_id?: string | null
  loan_id?: string | null; financing_id?: string | null; debt_id?: string | null
}
export type PaceCategory = { id?: string; name?: string | null }
export type PaceCategoryResult = { id: string; name: string; amount: number; count: number; share: number }
export type PaceSnapshot = {
  context: PaceContext; today: string; monthStart: string; elapsedDays: number; daysInMonth: number
  currentExpense: number; previousComparableExpense: number; previousFullExpense: number
  currentCount: number; weekExpense: number; previousWeekExpense: number; topCategories: PaceCategoryResult[]
  monthlyLimit: number | null; paceReference: number | null; remainingLimit: number | null
  suggestedDailyMaximum: number | null; projectedExpense: number | null; monthProgress: number
  paceDifference: number | null; previousPeriodChange: number | null; confidence: 'insufficient' | 'observed'
}
const isoPattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const money = (v: number) => Math.round(v * 100) / 100
const amountOf = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? money(n) : 0
}
const validISO = (s: unknown): s is string => {
  if (typeof s !== 'string' || !isoPattern.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const v = new Date(Date.UTC(y, m - 1, d, 12))
  return v.getUTCFullYear() === y && v.getUTCMonth() === m - 1 && v.getUTCDate() === d
}
const isoFromUTC = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
export const shiftCivilDay = (iso: string, delta: number) => {
  if (!validISO(iso)) return iso
  const [y, m, d] = iso.split('-').map(Number)
  return isoFromUTC(new Date(Date.UTC(y, m - 1, d + delta, 12)))
}
const previousMonth = (iso: string) => {
  const [y, m] = iso.slice(0, 7).split('-').map(Number)
  return isoFromUTC(new Date(Date.UTC(y, m - 2, 1, 12))).slice(0, 7)
}
const monthDays = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0, 12)).getUTCDate()
}
/** O cartão entra na despesa econômica na COMPRA, nunca no pagamento da fatura. */
export const isPaceExpense = (row: PaceTransaction, context: PaceContext): boolean => {
  if (row.context !== context || !validISO(row.date) || !amountOf(row.amount)) return false
  if (row.goal_id || row.transfer_group_id || row.invoice_id || row.loan_id || row.financing_id || row.debt_id) return false
  if (row.credit_card_id) return row.type === 'expense' && (row.status === 'done' || row.status === 'pending')
  return (row.type === 'expense' || row.type === 'sangria') && row.status === 'done' && row.affects_balance !== false
}
export function buildFinancePace(
  rows: PaceTransaction[], context: PaceContext, today: string, limitInput: number | null | undefined,
  categories: PaceCategory[] = []
): PaceSnapshot {
  if (!validISO(today)) throw new Error('V172: data de referência inválida')
  const ym = today.slice(0, 7), prevYM = previousMonth(today)
  const daysInMonth = monthDays(ym), prevDays = monthDays(prevYM)
  const elapsedDays = Number(today.slice(8, 10))
  const prevComparableEnd = `${prevYM}-${String(Math.min(prevDays, elapsedDays)).padStart(2, '0')}`
  const weekStart = shiftCivilDay(today, -6), previousWeekEnd = shiftCivilDay(today, -7), previousWeekStart = shiftCivilDay(today, -13)
  const labels = new Map(categories.filter(x => x.id).map(c => [String(c.id), String(c.name || 'Sem nome')]))
  let currentExpense = 0, previousComparableExpense = 0, previousFullExpense = 0
  let weekExpense = 0, previousWeekExpense = 0, currentCount = 0
  const byCategory = new Map<string, { amount: number; count: number }>()
  for (const row of rows) {
    if (!isPaceExpense(row, context)) continue
    const value = amountOf(row.amount)
    const d = String(row.date)
    if (d.startsWith(prevYM)) {
      previousFullExpense += value
      if (d <= prevComparableEnd) previousComparableExpense += value
    }
    if (d >= weekStart && d <= today) weekExpense += value
    if (d >= previousWeekStart && d <= previousWeekEnd) previousWeekExpense += value
    if (!d.startsWith(ym) || d > today) continue
    currentExpense += value
    currentCount += 1
    const key = String(row.category_id || 'uncategorized')
    const group = byCategory.get(key) || { amount: 0, count: 0 }
    group.amount += value
    group.count++
    byCategory.set(key, group)
  }
  currentExpense = money(currentExpense)
  const monthlyLimit = amountOf(limitInput) || null
  const remainingLimit = monthlyLimit === null ? null : money(Math.max(0, monthlyLimit - currentExpense))
  const paceReference = monthlyLimit === null ? null : money(monthlyLimit * elapsedDays / daysInMonth)
  const paceDifference = paceReference === null ? null : money(currentExpense - paceReference)
  const remainingDays = daysInMonth - elapsedDays
  const suggestedDailyMaximum = remainingLimit === null ? null : (remainingDays ? money(remainingLimit / remainingDays) : 0)
  const confidence: PaceSnapshot['confidence'] = elapsedDays >= 7 && currentCount >= 5 ? 'observed' : 'insufficient'
  const projectedExpense = confidence === 'observed' ? money(currentExpense / elapsedDays * daysInMonth) : null
  const previousPeriodChange = previousComparableExpense > 0
    ? money((currentExpense - previousComparableExpense) / previousComparableExpense * 100)
    : null
  const topCategories = Array.from(byCategory.entries()).map(([id, info]) => ({
    id, name: id === 'uncategorized' ? 'Sem categoria' : labels.get(id) || 'Categoria não encontrada',
    amount: money(info.amount), count: info.count,
    share: currentExpense > 0 ? money(info.amount / currentExpense * 100) : 0
  })).sort((a,b)=>b.amount-a.amount || a.name.localeCompare(b.name, 'pt-BR')).slice(0,8)
  return {
    context, today, monthStart: `${ym}-01`, elapsedDays, daysInMonth, currentExpense,
    previousComparableExpense: money(previousComparableExpense), previousFullExpense: money(previousFullExpense),
    currentCount, weekExpense: money(weekExpense), previousWeekExpense: money(previousWeekExpense), topCategories,
    monthlyLimit, paceReference, remainingLimit, suggestedDailyMaximum, projectedExpense,
    monthProgress: money(elapsedDays / daysInMonth * 100), paceDifference, previousPeriodChange, confidence
  }
}
