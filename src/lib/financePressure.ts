// V174 — Radar de fôlego: simulação em leitura, sem acesso a banco e sem alterar saldos.
// Base autoritativa: compromissos já conciliados pela Agenda Financeira.
export type PressureContext = 'dfl' | 'personal'
export type PressureAccount = { id?: string; context?: string | null; balance?: number | null; is_archived?: boolean | null }
export type PressureEvent = {
  id: string; date: string; amount: number; direction: 'expense' | 'income'
  scope: 'known' | 'planning'; label: string; href?: string; kind?: string
}
export type PressureReserve = { context: PressureContext; target_date: string; outstanding: number; monthlySuggested: number; name: string }
export type PressurePriority = { key: string; severity: 'critical' | 'warning' | 'info'; title: string; detail: string; href: string }
export type PressureDay = {
  date: string; dueExpense: number; potentialIncome: number; subscriptionPlanning: number
  conservative: number | null; withReceipts: number | null; simulated: number | null
  eventCount: number
}
export type PressureSnapshot = {
  context: PressureContext; today: string; end: string; days: number; accountCount: number
  openingBalance: number | null; overdueExpense: number; overdueIncomeIgnored: number
  knownExpense: number; potentialIncome: number; plannedSubscriptions: number
  reserveMonthly: number; reserveOutstanding: number; reservesLate: number
  cushion: number; extraExpense: number; flexibleRemaining: number | null
  firstNegativeDate: string | null; firstBelowCushionDate: string | null
  worstConservative: number | null; worstWithReceipts: number | null
  endConservative: number | null; endWithReceipts: number | null; endSimulated: number | null
  priorities: PressurePriority[]; warnings: string[]; timeline: PressureDay[]
}
export type PressureInput = {
  context: PressureContext; today: string; days?: 7 | 30 | 90
  accounts: PressureAccount[]; agenda: PressureEvent[]; reserves?: PressureReserve[]
  reserveMonthly?: number; flexibleRemaining?: number | null; cushion?: number; extraExpense?: number
}
const cents = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}
const toMoney = (n: number) => Math.round(n) / 100
const validISO = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const check = new Date(Date.UTC(y, m - 1, d, 12))
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d
}
const offset = (iso: string, delta: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + delta, 12)).toISOString().slice(0, 10)
}
/**
 * A projeção parte dos saldos correntes das contas (não do patrimônio), desconta SOMENTE
 * obrigações conhecidas e mantém recebíveis, assinaturas e reservas separados.
 * Cenário com receita não é promessa de recebimento; cenário com gasto extra é hipotético.
 */
export function buildFinancePressure(input: PressureInput): PressureSnapshot {
  if (!validISO(input.today)) throw new Error('V174: data civil inválida')
  const { context, today } = input
  const days = input.days === 7 || input.days === 90 ? input.days : 30
  const end = offset(today, days - 1)
  const activeAccounts = (input.accounts || []).filter(a =>
    a && a.context === context && a.is_archived !== true && typeof a.balance === 'number' && Number.isFinite(a.balance)
  )
  // Ausência de contas é desconhecido, nunca saldo zero fictício.
  const openingCents = activeAccounts.length ? activeAccounts.reduce((s, a) => s + (cents(a.balance) || 0), 0) : null
  const openingBalance = openingCents === null ? null : toMoney(openingCents)
  const rawCushion = cents(input.cushion)
  const rawExtra = cents(input.extraExpense)
  const cushionCents = rawCushion !== null && rawCushion >= 0 ? Math.min(rawCushion, 10000000000) : 0
  const extraCents = rawExtra !== null && rawExtra >= 0 ? Math.min(rawExtra, 10000000000) : 0
  const expenseByDay = new Map<string, number>()
  const incomeByDay = new Map<string, number>()
  const subscriptionByDay = new Map<string, number>()
  const eventCounts = new Map<string, number>()
  const seen = new Set<string>()
  let overdueExpense = 0, overdueIncomeIgnored = 0
  const warnings: string[] = []
  for (const event of input.agenda || []) {
    if (!event || !event.id || seen.has(event.id) || !validISO(event.date)) continue
    if (event.scope !== 'known' && event.scope !== 'planning') continue
    if (event.direction !== 'income' && event.direction !== 'expense') continue
    const n = cents(event.amount)
    if (n === null || n <= 0 || event.date > end) continue
    seen.add(event.id)
    if (event.scope === 'planning') {
      // Assinaturas são exibidas, mas não diminuem novamente o caixa.
      if (event.direction !== 'expense' || event.date < today) continue
      subscriptionByDay.set(event.date, (subscriptionByDay.get(event.date) || 0) + n)
      continue
    }
    if (event.direction === 'income') {
      if (event.date < today) { overdueIncomeIgnored += n; continue }
      incomeByDay.set(event.date, (incomeByDay.get(event.date) || 0) + n)
      eventCounts.set(event.date, (eventCounts.get(event.date) || 0) + 1)
      continue
    }
    const date = event.date < today ? today : event.date
    if (event.date < today) overdueExpense += n
    expenseByDay.set(date, (expenseByDay.get(date) || 0) + n)
    eventCounts.set(date, (eventCounts.get(date) || 0) + 1)
  }
  let cash = openingCents, withReceipts = openingCents, simulated = openingCents
  let firstNegativeDate: string | null = null, firstBelowCushionDate: string | null = null
  let minCash: number | null = null, minReceipts: number | null = null
  let knownExpenseCents = 0, expectedIncomeCents = 0, plannedCents = 0
  const timeline: PressureDay[] = []
  for (let i = 0; i < days; i++) {
    const date = offset(today, i)
    const out = expenseByDay.get(date) || 0
    const income = incomeByDay.get(date) || 0
    const planned = subscriptionByDay.get(date) || 0
    knownExpenseCents += out; expectedIncomeCents += income; plannedCents += planned
    if (cash !== null && withReceipts !== null && simulated !== null) {
      cash -= out
      withReceipts += income - out
      simulated -= out + (i === 0 ? extraCents : 0)
      minCash = minCash === null ? cash : Math.min(minCash, cash)
      minReceipts = minReceipts === null ? withReceipts : Math.min(minReceipts, withReceipts)
      if (!firstNegativeDate && simulated < 0) firstNegativeDate = date
      if (!firstBelowCushionDate && simulated < cushionCents) firstBelowCushionDate = date
    }
    timeline.push({date, dueExpense: toMoney(out), potentialIncome: toMoney(income),
      subscriptionPlanning: toMoney(planned), conservative: cash === null ? null : toMoney(cash),
      withReceipts: withReceipts === null ? null : toMoney(withReceipts),
      simulated: simulated === null ? null : toMoney(simulated), eventCount: eventCounts.get(date) || 0})
  }
  const reserves = (input.reserves || []).filter(r => r.context === context)
  const reserveOutstanding = reserves.reduce((s, r) => s + Math.max(0, cents(r.outstanding) || 0), 0)
  const reservesLate = reserves.filter(r => validISO(r.target_date) && r.target_date < today && (cents(r.outstanding) || 0) > 0).length
  const reserveMonthly = Math.max(0, cents(input.reserveMonthly) || 0)
  const flexCents = input.flexibleRemaining === null || input.flexibleRemaining === undefined ? null : cents(input.flexibleRemaining)
  const flexibleRemaining = flexCents === null ? null : toMoney(flexCents)
  if (overdueIncomeIgnored > 0) warnings.push('Recebimentos vencidos ficaram fora do cenário com recebíveis: não há nova data confirmada.')
  if (openingBalance === null) warnings.push('Sem contas ativas com saldo válido. Não foi possível estimar insuficiência de caixa.')
  if (plannedCents) warnings.push('Assinaturas são previsões separadas; podem já estar incluídas em lançamentos conhecidos.')
  if (reserveMonthly) warnings.push('Reservas são metas declaradas. Não representam dinheiro bloqueado ou já transferido.')
  const priorities: PressurePriority[] = []
  const add = (key: string, severity: PressurePriority['severity'], title: string, detail: string, href: string) =>
    priorities.push({key, severity, title, detail, href})
  if (openingBalance === null) add('accounts', 'warning', 'Revise os saldos das contas', 'Não é possível calcular um aperto sem uma posição de caixa verificável.', '/accounts')
  if (firstNegativeDate) add('deficit', 'critical', 'Possível insuficiência de caixa', `O cenário conservador com gasto extra ultrapassa o saldo no dia ${firstNegativeDate}. Revise os compromissos identificados.`, '/agenda')
  else if (firstBelowCushionDate) add('cushion', 'warning', 'Reserva mínima ameaçada', `O cenário conservador fica abaixo da proteção escolhida em ${firstBelowCushionDate}.`, '/agenda')
  if (overdueExpense) add('due', 'warning', 'Pendências vencidas', 'Obrigações vencidas foram concentradas no primeiro dia do cenário, sem serem apagadas.', '/agenda')
  if (overdueIncomeIgnored) add('receivables', 'info', 'Recebíveis vencidos', 'Valores atrasados não foram considerados recebidos nem movidos para uma nova data.', '/debts')
  if (reservesLate) add('reserves', 'warning', 'Reservas planejadas atrasadas', `${reservesLate} reserva(s) declarada(s) ainda possuem valor a separar.`, '/planning')
  if (flexibleRemaining !== null && flexibleRemaining <= 0) add('flex', 'warning', 'Limite flexível esgotado', 'O limite orçamentário não é uma posição bancária. Reavalie os gastos variáveis.', '/planning')
  if (reserveMonthly && !firstNegativeDate) add('reserve-plan', 'info', 'Priorize reservas futuras', 'Avalie a meta mensal sugerida depois dos compromissos reais, sem contabilizá-la como pagamento.', '/planning')
  if (!priorities.length) add('review', 'info', 'Confira as datas e os vínculos', 'Nenhum aperto apareceu apenas entre os compromissos conhecidos. Gastos não cadastrados podem mudar o resultado.', '/review')
  return { context, today, end, days, accountCount: activeAccounts.length, openingBalance,
    overdueExpense: toMoney(overdueExpense), overdueIncomeIgnored: toMoney(overdueIncomeIgnored),
    knownExpense: toMoney(knownExpenseCents), potentialIncome: toMoney(expectedIncomeCents),
    plannedSubscriptions: toMoney(plannedCents), reserveMonthly: toMoney(reserveMonthly),
    reserveOutstanding: toMoney(reserveOutstanding), reservesLate, cushion: toMoney(cushionCents),
    extraExpense: toMoney(extraCents), flexibleRemaining, firstNegativeDate, firstBelowCushionDate,
    worstConservative: minCash === null ? null : toMoney(minCash),
    worstWithReceipts: minReceipts === null ? null : toMoney(minReceipts),
    endConservative: cash === null ? null : toMoney(cash),
    endWithReceipts: withReceipts === null ? null : toMoney(withReceipts),
    endSimulated: simulated === null ? null : toMoney(simulated), priorities, warnings, timeline }
}
