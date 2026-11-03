/**
 * R433 — DFL Comando: consultas deterministicas por periodo, conta e categoria.
 * Motor puro: sem acesso a dados, rede, armazenamento ou mutacao financeira.
 * Os registros/nomes sao resolvidos apenas apos consulta do usuario/contexto no Dexie.
 */
import {
  filterRealizedFinancialTransactions,
  getFinancialFlowSummary,
  type FinancialTransactionLike,
} from '@/lib/financialMetrics'

export type ScopedFinancialContext = 'dfl' | 'personal'
export type ScopedMetric = 'expense' | 'income'
export type ScopedFinancialPeriod = {
  start: string
  end: string
  label: string
  type: 'month' | 'days' | 'week' | 'year'
}
export type ScopedFinancialQuestion = {
  metric: ScopedMetric
  period: ScopedFinancialPeriod
  categoryQuery?: string
  accountQuery?: string
}
export type ScopedCategory = { id: string; name: string; type?: string | null }
export type ScopedAccount = { id: string; name: string }
export type ScopedTransaction = FinancialTransactionLike & {
  id?: string
  description?: string | null
}
export type ScopedRecord = { id: string; label: string; date: string; amount: number; href: string }
export type ScopedFinancialAnswer = {
  state: 'ready' | 'no-data' | 'missing-account' | 'missing-category' | 'ambiguous-account' | 'ambiguous-category'
  title: string
  detail: string
  count: number
  amount?: number
  account?: string
  category?: string
  records?: ScopedRecord[]
}

const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[!?.,;:]+$/g, '').replace(/\s+/g, ' ').trim()
const pad = (value: number) => String(value).padStart(2, '0')
const civil = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const MONTHS: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4,
  maio: 5, mai: 5, junho: 6, jun: 6, julho: 7, jul: 7, agosto: 8, ago: 8,
  setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12,
}
const NAME = '(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)'
const monthName = new RegExp(`\\s+(?:(?:em|no|de|do|nesse|neste) )?${NAME}(?: de (20\\d{2}))?$`)
const monthNumber = /\s+(?:(?:em|no|de|do) )?(0?[1-9]|1[0-2])\/(20\d{2}|\d{2})$/
const yearOnly = /\s+(?:(?:em|no|de|do) )?(20\d{2})$/
const relative = /\s+(?:(?:no|em|do|de|neste|nesse) )?(m[eê]s passado|m[eê]s anterior|este m[eê]s|esse m[eê]s|neste m[eê]s|mes atual|ano passado|ano anterior|este ano|esse ano|neste ano|esta semana|semana passada|hoje|ontem|(?:nos? )?[uú]ltimos (7|15|30|60|90) dias)$/
function periodMonth(year: number, month: number): ScopedFinancialPeriod {
  const start = new Date(year, month - 1, 1, 12)
  const end = new Date(year, month, 0, 12)
  return {
    type: 'month', start: civil(start), end: civil(end),
    label: start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  }
}
function periodYear(year: number): ScopedFinancialPeriod {
  return { type: 'year', start: `${year}-01-01`, end: `${year}-12-31`, label: `ano de ${year}` }
}
function periodDays(start: Date, end: Date, label: string, type: 'days' | 'week'): ScopedFinancialPeriod {
  return { type, start: civil(start), end: civil(end), label }
}
function removePeriod(input: string, reference: Date): { body: string; period: ScopedFinancialPeriod; explicit: boolean } | null {
  let body = input
  const now = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate(), 12)
  const a = body.match(relative)
  if (a) {
    body = body.slice(0, a.index).trim()
    const what = fold(a[1])
    if (what === 'hoje') return { body, period: periodDays(now, now, 'hoje', 'days'), explicit: true }
    if (what === 'ontem') {
      const prev = new Date(now); prev.setDate(prev.getDate() - 1)
      return { body, period: periodDays(prev, prev, 'ontem', 'days'), explicit: true }
    }
    if (what.includes('ultimos')) {
      const days = Number(a[2])
      const first = new Date(now); first.setDate(first.getDate() - (days - 1))
      return { body, period: periodDays(first, now, `últimos ${days} dias (até hoje)`, 'days'), explicit: true }
    }
    if (what.includes('semana')) {
      const monday = new Date(now)
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - (what.includes('passada') ? 7 : 0))
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 6)
      return { body, period: periodDays(monday, what.includes('passada') ? sunday : now,
        what.includes('passada') ? 'semana passada' : 'esta semana até hoje', 'week'), explicit: true }
    }
    if (what.includes('ano')) return { body,
      period: periodYear(now.getFullYear() - (what.includes('passado') || what.includes('anterior') ? 1 : 0)), explicit: true }
    const past = what.includes('passado') || what.includes('anterior')
    return { body, period: periodMonth(now.getFullYear(), now.getMonth() + 1 - (past ? 1 : 0)), explicit: true }
  }
  const m = body.match(monthName)
  if (m) {
    body = body.slice(0, m.index).trim()
    const year = m[2] ? Number(m[2]) : now.getFullYear()
    if (year < 2000 || year > 2099) return null
    return { body, period: periodMonth(year, MONTHS[m[1]]), explicit: true }
  }
  const numeric = body.match(monthNumber)
  if (numeric) {
    body = body.slice(0, numeric.index).trim()
    const y = numeric[2].length === 2 ? 2000 + Number(numeric[2]) : Number(numeric[2])
    if (y < 2000 || y > 2099) return null
    return { body, period: periodMonth(y, Number(numeric[1])), explicit: true }
  }
  const y = body.match(yearOnly)
  if (y) {
    body = body.slice(0, y.index).trim()
    return { body, period: periodYear(Number(y[1])), explicit: true }
  }
  return { body, period: periodMonth(now.getFullYear(), now.getMonth() + 1), explicit: false }
}

/**
 * Frases interpretadas somente com metricas/entidades explicitas. Periodos vagos,
 * cartoes, causas e multiplas entidades sao delegados para busca ou Gemini.
 */
export function interpretScopedFinancialQuestion(input: string, reference = new Date()): ScopedFinancialQuestion | null {
  if (input.length < 8 || input.length > 240) return null
  const phrase = fold(input)
  if (!phrase || /\b(porque|por que|explique|previsao|projecao|fatura|cartao|cartoes|transferir|pague|pagar|devo|saldo|excluir|remover|criar|cadastrar)\b/.test(phrase)) return null
  const parsed = removePeriod(phrase, reference)
  if (!parsed) return null
  const { body, period, explicit } = parsed
  // Nao utilizar o periodo atual implicitamente quando a frase sugere outra data.
  if (/\b(?:mes|ano|hoje|ontem|semana|dias|desde|ate|ultimo|passado|proximo|20\d{2}|\d{1,2}\/\d{2,4})\b/.test(body)) return null
  const expense = body.match(/^(?:quanto (?:eu )?(?:gastei|gasto)|total (?:de|das?) despesas|quanto foram minhas despesas|quanto foi gasto)(?: (.+))?$/)
  const income = body.match(/^(?:quanto (?:eu )?(?:recebi|ganhei)|total (?:de|das?) receitas|quanto entrou)(?: (.+))?$/)
  if (!expense && !income) return null
  const metric: ScopedMetric = expense ? 'expense' : 'income'
  const filters = (expense || income)?.[1] || ''
  let categoryQuery: string | undefined
  let accountQuery: string | undefined
  if (filters) {
    const both = filters.match(/^(?:com|na categoria|da categoria) (.+?) (?:na|pela|da) conta (.+)$/)
    const reverse = filters.match(/^(?:na|pela|da) conta (.+?) (?:com|na categoria|da categoria) (.+)$/)
    const account = filters.match(/^(?:na|pela|da) conta (.+)$/)
    const category = filters.match(/^(?:com|na categoria|da categoria) (.+)$/)
    if (both) { categoryQuery = both[1]; accountQuery = both[2] }
    else if (reverse) { accountQuery = reverse[1]; categoryQuery = reverse[2] }
    else if (account) accountQuery = account[1]
    else if (category) categoryQuery = category[1]
    else return null
  }
  for (const name of [categoryQuery, accountQuery]) {
    if (name && (!/^[a-z0-9 &+./'\-]{2,55}$/.test(name) || /\b(?:e|ou|contas?|cartoes?|periodo|semana|ultimos?|mes|ano)\b/.test(name))) return null
  }
  if (categoryQuery && /\b(?:nubank|itau|inter|bradesco|santander|banco do brasil)\b/.test(categoryQuery)) return null
  // As consultas mensais simples continuam com a R430 para evitar concorrencia.
  if (!accountQuery && period.type === 'month') return null
  if (!accountQuery && !categoryQuery && !explicit) return null
  return { metric, period, ...(categoryQuery ? { categoryQuery } : {}), ...(accountQuery ? { accountQuery } : {}) }
}

/** Mesma semantica de realizado das Analises; nada consulta ou altera saldo bancario. */
export function answerScopedFinancialQuestion(
  q: ScopedFinancialQuestion,
  transactions: readonly ScopedTransaction[],
  categories: readonly ScopedCategory[],
  accounts: readonly ScopedAccount[],
  context: ScopedFinancialContext,
): ScopedFinancialAnswer {
  const title = q.metric === 'expense' ? 'Despesas filtradas' : 'Receitas filtradas'
  const base = { title, count: 0 }
  const equal = (value: string) => fold(value)
  let category: ScopedCategory | undefined
  let account: ScopedAccount | undefined
  if (q.categoryQuery) {
    const match = categories.filter(x => equal(x.name) === equal(q.categoryQuery!) && (!x.type || x.type === q.metric))
    if (match.length > 1) return { ...base, state: 'ambiguous-category', detail: 'Há mais de uma categoria com esse nome neste contexto. Abra Categorias para identificar a correta.' }
    if (!match.length) return { ...base, state: 'missing-category', detail: `Categoria “${q.categoryQuery}” não identificada neste contexto. Não presumi um valor.` }
    category = match[0]
  }
  if (q.accountQuery) {
    const match = accounts.filter(x => equal(x.name) === equal(q.accountQuery!))
    if (match.length > 1) return { ...base, state: 'ambiguous-account', detail: 'Há mais de uma conta com esse nome neste contexto. Abra Contas para identificar a correta.' }
    if (!match.length) return { ...base, state: 'missing-account', detail: `Conta “${q.accountQuery}” não identificada neste contexto. Não presumi um valor.` }
    account = match[0]
  }
  const realized = filterRealizedFinancialTransactions([...transactions], {
    context, start: q.period.start, end: q.period.end,
    ...(category ? { categoryId: category.id } : {}),
    ...(account ? { accountId: account.id } : {}),
  }).filter(tx => q.metric === 'income' ? tx.type === 'income' : tx.type === 'expense' || tx.type === 'sangria') as ScopedTransaction[]
  if (!realized.length) return {
    ...base, state: 'no-data', account: account?.name, category: category?.name,
    detail: `Nenhum lançamento compatível disponível neste dispositivo em ${q.period.label}. Não confunda ausência local com total zero.`,
  }
  const flow = getFinancialFlowSummary(realized)
  const amount = q.metric === 'income' ? flow.income : flow.expense
  const records = realized.filter(tx => Boolean(tx.id)).map(tx => ({
    id: tx.id!, label: tx.description || (q.metric === 'income' ? 'Receita' : 'Despesa'),
    date: tx.date || '', amount: Number(tx.amount) || 0,
    href: `/transactions/details?id=${encodeURIComponent(tx.id!)}`,
  })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  return {
    state: 'ready', title, count: realized.length, amount, records,
    category: category?.name, account: account?.name,
    detail: `${q.period.label} · movimentações realizadas conforme as regras de Análises; não é saldo bancário.`,
  }
}
