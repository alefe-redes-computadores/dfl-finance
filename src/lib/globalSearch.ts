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

// R425: palavras de uso diario nao podem virar meses por diferenca de uma letra.
// Meses curtos exigem formato exato ou contexto temporal explicito; nomes
// longos continuam tolerando pequenos erros de digitacao.
const NON_MONTH_WORDS = new Set(['abrir', 'maior', 'junto', 'julgo'])
function resolveMonthIntentToken(token: string, shortFuzzyContext = false) {
  if (MONTHS[token]) return { token, month: MONTHS[token] }

  if (token.length < 4 || NON_MONTH_WORDS.has(token)) return null

  const candidate = Object.entries(MONTHS)
    .filter(([name]) => name.length >= 6 || (shortFuzzyContext && name.length >= 4))
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
    // O formato mes/ano eh evidencia explicita de periodo, inclusive com typo.
    const resolved = resolveMonthIntentToken(monthYear[1], true)
    const month = resolved?.month || Number(monthYear[1])
    const year = Number(monthYear[2]) + (monthYear[2].length === 2 ? 2000 : 0)
    if (month >= 1 && month <= 12) return monthRange(year, month, [monthYear[0]])
  }
  const parts = q.split(/\s+/).map(part => part.replace(/^[?!.,;:]+|[?!.,;:]+$/g, ''))
  for (let index = 0; index < parts.length; index++) {
    const before = parts[index - 1] || ''
    const after = parts[index + 1] || ''
    const afterNext = parts[index + 2] || ''
    const shortFuzzyContext = /^(?:em|de|do|da|no|na|mes)$/.test(before)
      || /^20\d{2}$/.test(after)
      || (after === 'de' && /^20\d{2}$/.test(afterNext))
    const resolved = resolveMonthIntentToken(parts[index], shortFuzzyContext)
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

// R425: comandos com entidade especifica devem pesquisar a entidade.
// "abrir cartoes do Nubank" nao deve procurar a palavra "abrir" no banco.
const LOOKUP_ACTION = /^(?:(?:por favor )?(?:abrir|abra|abre|ver|visualizar|mostrar|mostre|me mostre|me mostra|quero ver|buscar|pesquisar|procurar|procure|encontrar|localizar|consultar|consulte|acessar|acesse|ir para|ir))\b/
const LOOKUP_VERBS = new Set(['por', 'favor', 'abrir', 'abra', 'abre', 'ver', 'visualizar', 'mostrar', 'mostre', 'me', 'mostra', 'quero', 'buscar', 'pesquisar', 'procurar', 'procure', 'encontrar', 'localizar', 'consultar', 'consulte', 'acessar', 'acesse', 'ir', 'para'])
const LOOKUP_DOMAINS = new Set(['cartao', 'cartoes', 'fatura', 'faturas', 'conta', 'contas', 'transacao', 'transacoes', 'movimentacao', 'movimentacoes', 'despesa', 'despesas', 'gasto', 'gastos', 'pagamento', 'pagamentos', 'receita', 'receitas', 'entrada', 'entradas', 'comprovante', 'comprovantes', 'recibo', 'recibos', 'anexo', 'anexos'])
/** R426: preferência de relevância, sem filtrar nem inventar resultados. */
export function preferredFinancialSearchKind(query: string): string | null {
  const q = norm(query)
  if (!LOOKUP_ACTION.test(q)) return null
  const candidates: string[] = []
  const choices: ReadonlyArray<[string, RegExp]> = [
    ['card', /\b(cartoes?|faturas?)\b/],
    ['account', /\b(contas?|conta bancaria|contas bancarias)\b/],
    ['expense', /\b(despesas?|gastos?|pagamentos?)\b/],
    ['income', /\b(receitas?|entradas?|recebimentos?)\b/],
    ['transfer', /\b(transferencias?)\b/],
    ['subscription', /\b(assinaturas?|recorrencias?)\b/],
    ['goal', /\b(metas?|objetivos?)\b/],
    ['category', /\b(categorias?)\b/],
    ['tag', /\b(tags?|etiquetas?|marcadores?)\b/],
    ['budget', /\b(orcamentos?|limites? de gastos?)\b/],
    ['contact', /\b(contatos?|clientes?|fornecedores?)\b/],
    ['financing', /\b(financiamentos?)\b/],
    ['loan', /\b(emprestimos?)\b/],
    ['invoice', /\b(faturas?)\b/],
    ['receipt', /\b(comprovantes?|recibos?|anexos?)\b/],
  ]
  for (const [kind, words] of choices) if (words.test(q)) candidates.push(kind)
  return candidates.length === 1 ? candidates[0] : null
}

function searchableTokens(query: string, intent: DateIntent | null) {
  const consumed = new Set(intent?.consumed.map(norm) || [])
  const normalized = norm(query)
  const tokens = normalized.split(/\s+/)
    .map(token => token.replace(/^[?!.,;:]+|[?!.,;:]+$/g, ''))
    .filter(token => token.length >= 2 && !consumed.has(token) &&
      !['de', 'em', 'no', 'na', 'do', 'da', 'dos', 'das', 'nos', 'nas', 'meu', 'minha', 'meus', 'minhas', 'completo', 'inteiro', 'ano', 'r$', 'reais'].includes(token))
  if (!LOOKUP_ACTION.test(normalized)) return tokens
  const withoutAction = tokens.filter(token => !LOOKUP_VERBS.has(token))
  const entity = withoutAction.filter(token => !LOOKUP_DOMAINS.has(token))
  // So retirar nomes genericos se um qualificador verificavel permanecer.
  return entity.length ? entity : withoutAction
}

/** R435 — reconhecimento de entidades existentes. Nao cria nem altera registros. */
export type FinancialEntityQuery = { kind: string; qualifier: string }
const ENTITY_PREFIXES: ReadonlyArray<{ kind: string; prefix: RegExp }> = [
  { kind: 'debt', prefix: /^(?:valores? a receber|contas? a receber|dividas? a receber|devedores?|dividas?)\b/ },
  { kind: 'invoice', prefix: /^faturas?\b/ },
  { kind: 'tag', prefix: /^(?:tags?|etiquetas?|marcadores?)\b/ },
  { kind: 'budget', prefix: /^(?:orcamentos?|limites? de gastos?)\b/ },
  { kind: 'financing', prefix: /^financiamentos?\b/ },
  { kind: 'loan', prefix: /^emprestimos?\b/ },
  { kind: 'subscription', prefix: /^(?:assinaturas?|recorrencias?)\b/ },
  { kind: 'contact', prefix: /^(?:contatos?|clientes?|fornecedores?)\b/ },
  { kind: 'goal', prefix: /^(?:metas?|objetivos?)\b/ },
  { kind: 'category', prefix: /^categorias?\b/ },
  { kind: 'account', prefix: /^(?:contas? bancarias?|contas?)\b/ },
  { kind: 'card', prefix: /^(?:cartoes?|cartao)\b/ },
  { kind: 'receipt', prefix: /^(?:comprovantes?|recibos?|anexos?)\b/ },
  { kind: 'expense', prefix: /^(?:despesas?|gastos?|pagamentos?)\b/ },
  { kind: 'income', prefix: /^(?:receitas?|entradas?|recebimentos?)\b/ },
  { kind: 'transfer', prefix: /^transferencias?\b/ },
]
/** Uma palavra de dominio so define tipo; um nome adicional continua pesquisavel. */
export function parseFinancialEntityQuery(input: string): FinancialEntityQuery | null {
  let q = norm(input).replace(/[?!.,;:]+$/g, '').trim()
  q = q.replace(LOOKUP_ACTION, '').trim()
    .replace(/^(?:(?:por favor|meu|minha|meus|minhas|os|as|o|a|um|uma)\s+)+/, '')
  const matched = ENTITY_PREFIXES.map(spec => ({ spec, match: q.match(spec.prefix) }))
    .find(entry => entry.match !== null)
  if (!matched || !matched.match) return null
  const qualifier = q.slice(matched.match[0].length).trim()
    .replace(/^(?:(?:do|da|dos|das|de|no|na|nos|nas|em|sobre|com|chamado|chamada)\s+)*/, '')
    .replace(/[?!.,;:]+$/g, '').trim()
  // Nunca decidir um tipo quando a frase pede explicitamente dois dominios.
  if (/^(?:e|ou)\s/.test(qualifier) || /\s+(?:e|ou)\s+(?:conta|cartao|meta|financiamento|categoria|tag|orcamento|contato)\b/.test(qualifier)) return null
  return { kind: matched.spec.kind, qualifier }
}

/** Um tipo de resultado pode ter mais de uma fonte, sem misturar montantes. */
function financialKindMatches(kind: string, row: any, requested: string): boolean {
  if (requested === 'receipt') return kind === 'transaction' && !!row.receipt_url
  if (kind === 'transaction') {
    if (requested === 'expense') return row.type === 'expense' || row.type === 'sangria'
    if (requested === 'income') return row.type === 'income'
    if (requested === 'transfer') return row.type === 'transfer' || !!row.transfer_group_id
  }
  return kind === requested
}
/** Meses em nomes de metas/orcamentos nao sao datas implicitas. */
function financialEntityDateIntent(query: string, entity: FinancialEntityQuery | null): DateIntent | null {
  if (!entity || ['expense', 'income', 'transfer', 'invoice', 'receipt'].includes(entity.kind)) return parseDateIntent(query)
  const q = norm(query)
  if (!/\b(?:em|no|na|durante|mes|ano)\s+(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|20\d{2}|\d{1,2}\/\d{2,4})\b/.test(q)) return null
  return parseDateIntent(query)
}

/** R436-R2: escopo de leitura por tipo, sem deixar buscas livres incompletas. */
const FINANCIAL_ENTITY_READS: Readonly<Record<string, readonly string[]>> = {
  account: ['accounts'],
  card: ['credit_cards'],
  category: ['categories'],
  contact: ['contacts'],
  tag: ['tags'],
  goal: ['goals', 'categories'],
  budget: ['budgets', 'categories'],
  financing: ['financings'],
  loan: ['loans'],
  subscription: ['subscriptions'],
  debt: ['debts', 'contacts', 'categories', 'accounts'],
  invoice: ['credit_invoices', 'credit_cards'],
  receipt: ['transactions', 'accounts', 'categories', 'contacts', 'tags'],
  expense: ['transactions', 'accounts', 'categories', 'contacts', 'tags'],
  income: ['transactions', 'accounts', 'categories', 'contacts', 'tags'],
  transfer: ['transactions', 'accounts', 'categories', 'contacts', 'tags'],
}
/**
 * Tipos sem nome adicional consultam so as tabelas necessarias.
 * Consultas com nome, conta, periodo ou livres mantem a cobertura completa.
 * Null significa consulta sem restricao de tabelas, nunca ausência de dados.
 */
export function financialEntityReadSet(entity: FinancialEntityQuery | null): ReadonlySet<string> | null {
  if (!entity || entity.qualifier) return null
  const tables = FINANCIAL_ENTITY_READS[entity.kind]
  return tables ? new Set(tables) : null
}

export async function searchFinancialData(
  userId: string,
  context: 'dfl' | 'personal',
  query: string,
  limit = 40
): Promise<GlobalSearchResult[]> {
  const term = norm(query)
  if (term.length < 2) return []
  const entity = parseFinancialEntityQuery(query)
  const dateIntent = financialEntityDateIntent(query, entity)
  const tokens = searchableTokens(entity ? entity.qualifier : query, dateIntent)
  // R435: 'metas' lista metas; 'meta viagem' consulta o nome sem exigir 'meta' nele.
  // Comando vazio continua sem abrir qualquer tabela do IndexedDB.
  if (!entity) {
    if (!dateIntent && tokens.length === 0) return []
  }
  const preferredKind = preferredFinancialSearchKind(query) ?? entity?.kind ?? null
  const readSet = financialEntityReadSet(entity)
  const shouldRead = (name: string) => readSet === null || readSet.has(name)

  const names = [
    'transactions', 'accounts', 'credit_cards', 'debts', 'loans',
    'financings', 'subscriptions', 'goals', 'categories',
  ] as const

  // Cada tabela consulta exclusivamente o usuario/contexto atual. Faturas nao possuem
  // indice composto; filtramos contexto apos indice user_id sem varrer outras contas.
  const moreNames = ['tags', 'budgets', 'credit_invoices'] as const
  const [rows, contacts, moreRows] = await Promise.all([
    Promise.all(names.map((name) => shouldRead(name)
      ? (db as any)[name].where('[user_id+context]').equals([userId, context]).toArray()
      : Promise.resolve([] as any[]))),
    shouldRead('contacts')
      ? db.contacts.where('[user_id+context]').equals([userId, context]).toArray()
      : Promise.resolve([] as any[]),
    Promise.all(moreNames.map(async name => {
      if (!shouldRead(name)) return [] as any[]
      const table = (db as any)[name]
      if (!table || typeof table.where !== 'function') return [] as any[]
      if (name === 'credit_invoices') return table.where('user_id').equals(userId)
        .and((item: any) => item.context === context).toArray()
      return table.where('[user_id+context]').equals([userId, context]).toArray()
    })),
  ])
  const everyName: string[] = [...names, 'contacts', ...moreNames]
  const everyRows: any[][] = [...rows, contacts, ...moreRows]
  const tags = moreRows[0]
  const cards = rows[names.indexOf('credit_cards')]
  const tagMap = new Map(tags.map((tag: any) => [tag.id, tag]))
  const cardMap = new Map(cards.map((card: any) => [card.id, card]))

  const categories = rows[names.indexOf('categories')]
  const accounts = rows[names.indexOf('accounts')]
  const categoryMap = new Map(categories.map((row: any) => [row.id, row]))
  const accountMap = new Map(accounts.map((row: any) => [row.id, row]))
  const contactMap = new Map(contacts.map((row: any) => [row.id, row]))
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
    tags: { kind: 'tag', label: 'Tag', base: '/tags' },
    budgets: { kind: 'budget', label: 'Orçamento', base: '/budgets/details?id=' },
    contacts: { kind: 'contact', label: 'Contato', base: '/contacts/details?id=' },
    credit_invoices: { kind: 'invoice', label: 'Fatura', base: '/cards/details?id=' },
  }

  everyName.forEach((name, index) => {
    everyRows[index].forEach((row: any) => {
      const category: any = row.category_id ? categoryMap.get(row.category_id) : undefined
      const account: any = row.account_id ? accountMap.get(row.account_id) : undefined
      const contact: any = row.contact_id ? contactMap.get(row.contact_id) : undefined
      const card: any = row.credit_card_id ? cardMap.get(row.credit_card_id) : undefined
      const relatedTags = name === 'transactions' && Array.isArray(row.tag_ids)
        ? row.tag_ids.map((id: string) => tagMap.get(id)).filter(Boolean) : []
      const date = row.date || row.due_date || row.next_due_date || row.deadline
      const dates = name === 'credit_invoices' ? [row.due_date, row.start_date, row.end_date] : [date]
      if (dateIntent && !dates.some(value => civilDate(value) && String(value).slice(0, 10) >= dateIntent.start && String(value).slice(0, 10) <= dateIntent.end)) return
      const cfg = config[name]
      if (entity && tokens.length === 0 && !financialKindMatches(cfg.kind, row, entity.kind)) return

      const fields = [
        row.description, row.name, row.title, row.person_name, row.lender, row.notes,
        row.asset, row.asset_type, row.company, row.position, row.phone, row.email,
        row.brand, row.flag, row.institution, row.last_four, row.billing_cycle, row.category,
        category?.name, account?.name, account?.bank, account?.bank_name, account?.bank_slug, row.bank, row.bank_slug,
        contact?.name, contact?.person_name, card?.name, card?.institution,
        ...relatedTags.map((tag: any) => tag.name),
        row.receipt_url ? 'comprovante anexo recibo' : '',
        ...moneyTokens(row.amount), ...moneyTokens(row.balance), ...moneyTokens(row.target_amount),
        ...moneyTokens(row.saved_amount), ...moneyTokens(row.installment_amount),
        ...moneyTokens(row.installment_value), ...moneyTokens(row.limit_amount),
        ...moneyTokens(row.total_amount), ...moneyTokens(row.remaining_amount),
        ...moneyTokens(row.paid_amount),
      ].map(norm).filter(Boolean)
      const haystack = fields.join(' ')
      if (tokens.length && !tokens.every((token) => fuzzyTokenMatch(token, haystack))) return
      if (!tokens.length && !dateIntent && !entity) return

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

      const transfer = name === 'transactions' && (row.type === 'transfer' || row.transfer_group_id)
      const isPreferred = preferredKind === cfg.kind || (cfg.kind === 'transaction' && (
        (preferredKind === 'expense' && (row.type === 'expense' || row.type === 'sangria')) ||
        (preferredKind === 'income' && row.type === 'income') ||
        (preferredKind === 'transfer' && transfer) ||
        (preferredKind === 'receipt' && Boolean(row.receipt_url))
      ))
      // O pedido por um tipo sobe na lista, sem suprimir outras correspondencias.
      if (isPreferred) score += 24
      if (entity && financialKindMatches(cfg.kind, row, entity.kind)) score += 36
      if (transfer && row.transfer_direction === 'out') score += 0.1
      const title = name === 'credit_invoices'
        ? `${card?.name || 'Cartão'} · Fatura`
        : transfer ? 'Transferência' : row.description || row.name || row.title || row.person_name || row.lender || cfg.label
      out.push({
        id: row.id,
        kind: cfg.kind,
        title,
        subtitle: name === 'transactions' && account?.name ? `${cfg.label} • ${account.name}`
          : name === 'budgets' && category?.name ? `Orçamento • ${category.name}`
          : name === 'credit_invoices' ? `Fatura • ${row.status === 'paid' ? 'Paga' : 'Em aberto'}`
          : name === 'goals' ? 'Meta • valor-alvo'
          : name === 'financings' ? 'Financiamento • valor contratado'
          : cfg.label,
        href: name === 'categories' || name === 'tags' ? cfg.base
          : name === 'credit_invoices' ? (card ? `${cfg.base}${encodeURIComponent(row.credit_card_id)}` : '/cards')
          : `${cfg.base}${encodeURIComponent(row.id)}`,
        amount: name === 'credit_invoices'
          ? numberOrUndefined(Math.max(0, Number(row.total_amount || 0) - Number(row.paid_amount || 0)))
          : numberOrUndefined(row.amount ?? row.balance ?? row.total_amount ?? row.remaining_amount ?? row.target_amount),
        date,
        transactionType: transfer ? 'transfer' : name === 'transactions' ? row.type : undefined,
        categoryName: category?.name,
        categoryIcon: name === 'categories' ? row.icon : category?.icon,
        categoryColor: name === 'categories' || name === 'tags' ? row.color : category?.color,
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
