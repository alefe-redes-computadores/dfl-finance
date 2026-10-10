import { db } from '@/lib/db'
import { civilDate } from '@/lib/financialForecast'

export type GlobalSearchResult = {
  id: string
  kind: string
  title: string
  subtitle: string
  href: string
  amount?: number
  date?: string
  transactionType?: string
  categoryName?: string
  categoryIcon?: string
  categoryColor?: string
  hasAttachment?: boolean
  status?: string
}

export type FinancialSearchCommand = {
  id: string
  title: string
  description: string
  href: string
  intent:
    | 'create'
    | 'review'
    | 'plan'
    | 'transfer'
    | 'receipt'
    | 'search'
}

export const FINANCIAL_COMMAND_SUGGESTIONS: FinancialSearchCommand[] = [
  {
    id: 'new-expense',
    title: 'Nova despesa',
    description: 'Abrir lançamento completo de despesa',
    href: '/transactions/new?type=expense',
    intent: 'create',
  },
  {
    id: 'new-income',
    title: 'Nova receita',
    description: 'Abrir lançamento completo de receita',
    href: '/transactions/new?type=income',
    intent: 'create',
  },
  {
    id: 'transfer',
    title: 'Transferir entre contas',
    description: 'Abrir transferência para você revisar e confirmar',
    href: '/transactions?action=transfer',
    intent: 'transfer',
  },
  {
    id: 'inbox',
    title: 'Abrir Inbox financeira',
    description: 'Revisar WhatsApp, comprovantes, importações e pendências',
    href: '/conciliation',
    intent: 'review',
  },
  {
    id: 'planning',
    title: 'Abrir planejamento',
    description: 'Ver futuro, compromissos e projeções',
    href: '/projections',
    intent: 'plan',
  },
  {
    id: 'receipts',
    title: 'Ver comprovantes',
    description: 'Abrir a Central de Comprovantes',
    href: '/receipts',
    intent: 'receipt',
  },
]

const norm = (v: unknown) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')

export function resolveFinancialCommands(
  query: string
): FinancialSearchCommand[] {
  const q = norm(query)

  if (!q) return FINANCIAL_COMMAND_SUGGESTIONS.slice(0, 4)

  const commands: FinancialSearchCommand[] = []

  const add = (id: string) => {
    const command = FINANCIAL_COMMAND_SUGGESTIONS.find(
      (item) => item.id === id
    )
    if (
      command &&
      !commands.some((item) => item.id === command.id)
    ) {
      commands.push(command)
    }
  }

  if (
    /\b(nova?|criar|adicionar|lancar|registrar)\b/.test(q) &&
    /\b(despesa|gasto|pagamento)\b/.test(q)
  ) {
    add('new-expense')
  }

  if (
    /\b(nova?|criar|adicionar|lancar|registrar)\b/.test(q) &&
    /\b(receita|entrada|recebimento)\b/.test(q)
  ) {
    add('new-income')
  }

  if (
    /\b(transferir|transferencia|transferir entre|mover dinheiro)\b/.test(q)
  ) {
    add('transfer')
  }

  if (
    /\b(inbox|conciliacao|conciliar|revisar|pendencias?|pendente)\b/.test(q)
  ) {
    add('inbox')
  }

  if (
    /\b(planejamento|planejar|projecao|projecoes|futuro|cenario)\b/.test(q)
  ) {
    add('planning')
  }

  if (
    /\b(comprovante|comprovantes|recibo|recibos|anexo|anexos)\b/.test(q)
  ) {
    add('receipts')
  }

  return commands.slice(0, 3)
}

const numberOrUndefined = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const moneyTokens = (value: unknown) => {
  const n = numberOrUndefined(value)
  if (n === undefined) return []
  return [
    String(n),
    n.toFixed(2),
    n.toFixed(2).replace('.', ','),
    n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  ].map(norm)
}

const MONTHS: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3,
  abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6,
  julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9,
  outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12,
}

function editDistanceAtMostOne(a: string, b: string) {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false

  let i = 0
  let j = 0
  let edits = 0

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1
      j += 1
      continue
    }

    edits += 1
    if (edits > 1) return false

    if (a.length > b.length) i += 1
    else if (b.length > a.length) j += 1
    else {
      i += 1
      j += 1
    }
  }

  if (i < a.length || j < b.length) edits += 1
  return edits <= 1
}

function exactTokenMatch(token: string, haystack: string) {
  if (/^[0-9.,]+$/.test(token)) return haystack.split(/\s+/).includes(token)
  return haystack.split(/[^a-z0-9]+/).some(word => word === token || (token.length >= 3 && word.startsWith(token)))
}

function fuzzyTokenMatch(token: string, haystack: string) {
  if (exactTokenMatch(token, haystack)) return true
  if (token.length < 4) return false

  return haystack
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4)
    .some((word) => editDistanceAtMostOne(token, word))
}

function resolveMonthIntentToken(token: string) {
  if (MONTHS[token]) return { token, month: MONTHS[token] }

  if (token.length < 4) return null

  const candidate = Object.entries(MONTHS)
    .filter(([name]) => name.length >= 4)
    .find(([name]) => editDistanceAtMostOne(token, name))

  return candidate
    ? { token, month: candidate[1] }
    : null
}

export type DateIntent = { start: string; end: string; consumed: string[] }

function isoLocal(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateIntent(query: string, reference = new Date()): DateIntent | null {
  const q = norm(query)
  const today = new Date(reference)
  today.setHours(12, 0, 0, 0)
  if (/\bhoje\b/.test(q)) {
    const day = isoLocal(today)
    return { start: day, end: day, consumed: ['hoje'] }
  }
  if (/\bontem\b/.test(q)) {
    const d = new Date(today); d.setDate(d.getDate() - 1)
    const day = isoLocal(d)
    return { start: day, end: day, consumed: ['ontem'] }
  }

  const dayMatch = q.match(/\b(20\d{2})-(\d{2})-(\d{2})\b|\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/)
  if (dayMatch) {
    const date = dayMatch[1] ? `${dayMatch[1]}-${dayMatch[2]}-${dayMatch[3]}` :
      `${dayMatch[6]}-${dayMatch[5].padStart(2, '0')}-${dayMatch[4].padStart(2, '0')}`
    return civilDate(date) ? { start: date, end: date, consumed: [dayMatch[0]] } : null
  }
  const monthRange = (year: number, month: number, consumed: string[]): DateIntent => ({
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    end: `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`,
    consumed,
  })
  const monthYear = q.match(/\b([a-z]+|\d{1,2})\/(20\d{2}|\d{2})\b/)
  if (monthYear) {
    const resolved = resolveMonthIntentToken(monthYear[1])
    const month = resolved?.month || Number(monthYear[1])
    const year = Number(monthYear[2]) + (monthYear[2].length === 2 ? 2000 : 0)
    if (month >= 1 && month <= 12) return monthRange(year, month, [monthYear[0]])
  }
  const parts = q.split(/\s+/)
  for (let index = 0; index < parts.length; index++) {
    const resolved = resolveMonthIntentToken(parts[index])
    if (!resolved) continue
    const possibleYear = parts[index + 1] === 'de' ? parts[index + 2] : parts[index + 1]
    const explicitYear = /^20\d{2}$/.test(possibleYear || '')
    const consumed = [parts[index]]
    if (explicitYear) {
      if (parts[index + 1] === 'de') consumed.push('de')
      consumed.push(possibleYear)
    }
    return monthRange(explicitYear ? Number(possibleYear) : today.getFullYear(), resolved.month, consumed)
  }
  const year = q.match(/\b(20\d{2})\b/)
  if (year) return { start: `${year[1]}-01-01`, end: `${year[1]}-12-31`, consumed: [year[1]] }

  return null
}

function searchableTokens(query: string, intent: DateIntent | null) {
  const consumed = new Set(intent?.consumed.map(norm) || [])
  return norm(query)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !consumed.has(token) && !['de', 'em', 'no', 'na', 'completo', 'inteiro', 'ano', 'r$', 'reais'].includes(token))
}

export async function searchFinancialData(
  userId: string,
  context: 'dfl' | 'personal',
  query: string,
  limit = 40
): Promise<GlobalSearchResult[]> {
  const term = norm(query)
  if (term.length < 2) return []

  const names = [
    'transactions', 'accounts', 'credit_cards', 'debts', 'loans',
    'financings', 'subscriptions', 'goals', 'categories',
  ] as const

  const [rows, contacts] = await Promise.all([
    Promise.all(names.map((name) => (db as any)[name].where('[user_id+context]').equals([userId, context]).toArray())),
    db.contacts.where('[user_id+context]').equals([userId, context]).toArray(),
  ])

  const categories = rows[names.indexOf('categories')]
  const accounts = rows[names.indexOf('accounts')]
  const categoryMap = new Map(categories.map((row: any) => [row.id, row]))
  const accountMap = new Map(accounts.map((row: any) => [row.id, row]))
  const contactMap = new Map(contacts.map((row: any) => [row.id, row]))
  const dateIntent = parseDateIntent(query)
  const tokens = searchableTokens(query, dateIntent)
  const out: Array<GlobalSearchResult & { _score: number; _fuzzy: number; _group?: string }> = []

  const config: Record<string, { kind: string; label: string; base: string }> = {
    transactions: { kind: 'transaction', label: 'Transação', base: '/transactions/details?id=' },
    accounts: { kind: 'account', label: 'Conta', base: '/accounts/details?id=' },
    credit_cards: { kind: 'card', label: 'Cartão', base: '/cards/details?id=' },
    debts: { kind: 'debt', label: 'Quem me deve', base: '/debts/details?id=' },
    loans: { kind: 'loan', label: 'Empréstimo', base: '/loans/details?id=' },
    financings: { kind: 'financing', label: 'Financiamento', base: '/financings/details?id=' },
    subscriptions: { kind: 'subscription', label: 'Recorrência', base: '/subscriptions/details?id=' },
    goals: { kind: 'goal', label: 'Meta', base: '/goals/details?id=' },
    categories: { kind: 'category', label: 'Categoria', base: '/categories' },
  }

  names.forEach((name, index) => {
    rows[index].forEach((row: any) => {
      const category: any = name === 'transactions' && row.category_id ? categoryMap.get(row.category_id) : undefined
      const account: any = name === 'transactions' && row.account_id ? accountMap.get(row.account_id) : undefined
      const contact: any = name === 'transactions' && row.contact_id ? contactMap.get(row.contact_id) : undefined
      const date = row.date || row.due_date || row.next_due_date
      if (dateIntent && !civilDate(date)) return
      if (dateIntent && date && (String(date).slice(0, 10) < dateIntent.start || String(date).slice(0, 10) > dateIntent.end)) return
      if (dateIntent && !date) return

      const fields = [
        row.description, row.name, row.title, row.person_name, row.lender, row.notes,
        category?.name, account?.name, account?.bank, account?.bank_name, account?.bank_slug, row.bank, row.bank_slug,
        contact?.name, contact?.person_name,
        row.receipt_url ? 'comprovante anexo recibo' : '',
        ...moneyTokens(row.amount), ...moneyTokens(row.balance),
        ...moneyTokens(row.total_amount), ...moneyTokens(row.remaining_amount),
      ].map(norm).filter(Boolean)
      const haystack = fields.join(' ')
      if (tokens.length && !tokens.every((token) => fuzzyTokenMatch(token, haystack))) return
      if (!tokens.length && !dateIntent) return

      let score = 0
      const fuzzyCount = tokens.filter(token => !exactTokenMatch(token, haystack)).length
      for (const token of tokens) {
        if (exactTokenMatch(token, norm(row.description)) || exactTokenMatch(token, norm(row.name)) || exactTokenMatch(token, norm(row.title))) score += 8
        else if (exactTokenMatch(token, norm(category?.name))) score += 6
        else if (exactTokenMatch(token, norm(account?.name)) || exactTokenMatch(token, norm(account?.bank)) || exactTokenMatch(token, norm(account?.bank_name))) score += 5
        else if (exactTokenMatch(token, haystack)) score += 2
        else if (fuzzyTokenMatch(token, haystack)) score += 1
      }
      if (dateIntent) score += 4
      if (row.receipt_url && tokens.some((t) => ['comprovante','anexo','recibo'].includes(t))) score += 5

      const cfg = config[name]
      const transfer = name === 'transactions' && (row.type === 'transfer' || row.transfer_group_id)
      if (transfer && row.transfer_direction === 'out') score += 0.1
      const title = transfer ? 'Transferência' : row.description || row.name || row.title || row.person_name || row.lender || cfg.label
      out.push({
        id: row.id,
        kind: cfg.kind,
        title,
        subtitle: name === 'transactions' && account?.name ? `${cfg.label} • ${account.name}` : cfg.label,
        href: name === 'categories' ? cfg.base : `${cfg.base}${encodeURIComponent(row.id)}`,
        amount: numberOrUndefined(row.amount ?? row.balance ?? row.total_amount ?? row.remaining_amount),
        date,
        transactionType: transfer ? 'transfer' : name === 'transactions' ? row.type : undefined,
        categoryName: category?.name,
        categoryIcon: name === 'categories' ? row.icon : category?.icon,
        categoryColor: name === 'categories' ? row.color : category?.color,
        hasAttachment: name === 'transactions' ? Boolean(row.receipt_url) : false,
        status: row.status,
        _score: score, _fuzzy: fuzzyCount, _group: transfer ? row.transfer_group_id : undefined,
      })
    })
  })

  const precise = out.some(item => item._fuzzy === 0)
  const seenGroups = new Set<string>()
  return out
    .filter(item => !precise || item._fuzzy === 0)
    .sort((a, b) => b._score - a._score || String(b.date || '').localeCompare(String(a.date || '')))
    .filter(item => {
      if (!item._group) return true
      if (seenGroups.has(item._group)) return false
      seenGroups.add(item._group); return true
    })
    .slice(0, limit)
    .map(({ _score, _fuzzy, _group, ...item }) => item)
}
