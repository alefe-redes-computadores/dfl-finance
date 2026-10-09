import { db } from '@/lib/db'

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
    description: 'Abrir a área de transações para transferência',
    href: '/transactions',
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

function fuzzyTokenMatch(token: string, haystack: string) {
  if (haystack.includes(token)) return true
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

type DateIntent = { start: string; end: string; consumed: string[] }

function isoLocal(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateIntent(query: string): DateIntent | null {
  const q = norm(query)
  const today = new Date()
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

  for (const [name, month] of Object.entries(MONTHS)) {
    const re = new RegExp(`\\b${name}\\b(?:\\s+(?:de\\s+)?(20\\d{2}))?`)
    const match = q.match(re)
    if (!match) continue
    const year = Number(match[1] || today.getFullYear())
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const last = new Date(year, month, 0).getDate()
    const end = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
    return { start, end, consumed: match[0].split(/\s+/) }
  }

  // V79: tolerância de uma edição somente para nomes de mês com
  // quatro ou mais caracteres. Ex.: outubr -> outubro.
  const queryParts = q.split(/\s+/)
  for (let index = 0; index < queryParts.length; index += 1) {
    const resolved = resolveMonthIntentToken(queryParts[index])
    if (!resolved) continue

    const possibleYear =
      queryParts[index + 1] === 'de'
        ? queryParts[index + 2]
        : queryParts[index + 1]
    const year = /^20\d{2}$/.test(possibleYear || '')
      ? Number(possibleYear)
      : today.getFullYear()

    const start = `${year}-${String(resolved.month).padStart(2, '0')}-01`
    const last = new Date(year, resolved.month, 0).getDate()
    const end = `${year}-${String(resolved.month).padStart(2, '0')}-${String(last).padStart(2, '0')}`

    const consumed = [resolved.token]
    if (/^20\d{2}$/.test(possibleYear || '')) {
      if (queryParts[index + 1] === 'de') consumed.push('de')
      consumed.push(possibleYear)
    }

    return { start, end, consumed }
  }

  return null
}

function searchableTokens(query: string, intent: DateIntent | null) {
  const consumed = new Set(intent?.consumed.map(norm) || [])
  return norm(query)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !consumed.has(token) && token !== 'de')
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

  const [rows, categories, accounts, contacts] = await Promise.all([
    Promise.all(names.map((name) => (db as any)[name].where('[user_id+context]').equals([userId, context]).toArray())),
    db.categories.where('[user_id+context]').equals([userId, context]).toArray(),
    db.accounts.where('[user_id+context]').equals([userId, context]).toArray(),
    db.contacts.where('[user_id+context]').equals([userId, context]).toArray(),
  ])

  const categoryMap = new Map(categories.map((row: any) => [row.id, row]))
  const accountMap = new Map(accounts.map((row: any) => [row.id, row]))
  const contactMap = new Map(contacts.map((row: any) => [row.id, row]))
  const dateIntent = parseDateIntent(query)
  const tokens = searchableTokens(query, dateIntent)
  const out: Array<GlobalSearchResult & { _score: number }> = []

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
      const date = row.date || row.due_date || row.updated_at || row.created_at
      if (dateIntent && date && (String(date).slice(0, 10) < dateIntent.start || String(date).slice(0, 10) > dateIntent.end)) return
      if (dateIntent && !date) return

      const fields = [
        row.description, row.name, row.title, row.person_name, row.lender, row.notes,
        category?.name, account?.name, account?.bank, account?.bank_name,
        contact?.name, contact?.person_name,
        row.receipt_url ? 'comprovante anexo recibo' : '',
        ...moneyTokens(row.amount), ...moneyTokens(row.balance),
        ...moneyTokens(row.total_amount), ...moneyTokens(row.remaining_amount),
      ].map(norm).filter(Boolean)
      const haystack = fields.join(' ')
      if (tokens.length && !tokens.every((token) => fuzzyTokenMatch(token, haystack))) return
      if (!tokens.length && !dateIntent) return

      let score = 0
      for (const token of tokens) {
        if (norm(row.description).includes(token) || norm(row.name).includes(token) || norm(row.title).includes(token)) score += 8
        else if (norm(category?.name).includes(token)) score += 6
        else if (norm(account?.name).includes(token) || norm(account?.bank).includes(token) || norm(account?.bank_name).includes(token)) score += 5
        else if (haystack.includes(token)) score += 2
        else if (fuzzyTokenMatch(token, haystack)) score += 1
      }
      if (dateIntent) score += 4
      if (row.receipt_url && tokens.some((t) => ['comprovante','anexo','recibo'].includes(t))) score += 5

      const cfg = config[name]
      const title = row.description || row.name || row.title || row.person_name || row.lender || cfg.label
      out.push({
        id: row.id,
        kind: cfg.kind,
        title,
        subtitle: name === 'transactions' && account?.name ? `${cfg.label} • ${account.name}` : cfg.label,
        href: name === 'categories' ? cfg.base : `${cfg.base}${encodeURIComponent(row.id)}`,
        amount: numberOrUndefined(row.amount ?? row.balance ?? row.total_amount ?? row.remaining_amount),
        date,
        transactionType: name === 'transactions' ? row.type : undefined,
        categoryName: category?.name,
        categoryIcon: name === 'categories' ? row.icon : category?.icon,
        categoryColor: name === 'categories' ? row.color : category?.color,
        hasAttachment: name === 'transactions' ? Boolean(row.receipt_url) : false,
        status: row.status,
        _score: score,
      })
    })
  })

  return out
    .sort((a, b) => b._score - a._score || String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, limit)
    .map(({ _score, ...item }) => item)
}
