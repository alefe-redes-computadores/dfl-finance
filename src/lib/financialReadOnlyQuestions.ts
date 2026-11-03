/** R430 — perguntas financeiras locais, deterministicas e apenas de leitura.
 * O Gemini continua sendo o dono da conversa aberta; este motor so responde
 * frases com periodo e metrica inequivocos. Nunca calcula saldo bancario.
 */
import {
  filterRealizedFinancialTransactions,
  getFinancialFlowSummary,
  isExpenseTransaction,
  type FinancialTransactionLike,
} from '@/lib/financialMetrics'

export type ReadOnlyQuestionKind = 'expense' | 'income' | 'flow' | 'top-category' | 'category-expense'
export type ReadOnlyFinancialQuestion = {
  kind: ReadOnlyQuestionKind
  start: string
  end: string
  month: string
  periodLabel: string
  category?: string
}
export type LocalNamedCategory = { id: string; name: string }
export type ReadOnlyFinancialAnswer = {
  state: 'ready' | 'no-data' | 'missing-category'
  title: string
  detail: string
  count: number
  income: number
  expense: number
  net: number
  category?: string
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[?!.,:;]+$/g, '').replace(/\s+/g, ' ').trim()
}
const MONTHS: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3,
  abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6,
  julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9,
  outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12,
}
function pad(value: number): string { return String(value).padStart(2, '0') }
function monthAt(year: number, month: number): { start: string; end: string; month: string; periodLabel: string } {
  const ym = `${year}-${pad(month)}`
  return {
    start: `${ym}-01`, end: `${ym}-${pad(new Date(year, month, 0).getDate())}`,
    month: ym,
    periodLabel: new Date(year, month - 1, 15, 12).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  }
}
const MONTH_WORDS = '(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)'

/** Nao interpreta datas complexas, periodos vagos ou classificacoes duvidosas. */
export function interpretFinancialReadOnlyQuestion(input: string, reference = new Date()): ReadOnlyFinancialQuestion | null {
  if (input.length > 240) return null
  let base = fold(input)
  if (!base || /\b(?:pendentes?|proximos?|futuro|previst[oa]s?|cartao|cartoes|nubank|comparar|por que|porque|deveria)\b/.test(base)) return null
  const today = new Date(reference.getFullYear(), reference.getMonth(), 15, 12)
  let year = today.getFullYear(), month = today.getMonth() + 1
  let matched = false
  const relative = base.match(/\s+(?:(?:em|no|neste|nesse|deste|do) )?(mes passado|mes anterior|mes atual|este mes|esse mes|neste mes|nesse mes)$/)
  if (relative) {
    base = base.slice(0, relative.index).trim()
    if (/passado|anterior/.test(relative[1])) {
      const prev = new Date(year, month - 2, 15, 12)
      year = prev.getFullYear(); month = prev.getMonth() + 1
    }
    matched = true
  }
  if (!matched) {
    const textMonth = new RegExp(`\\s+(?:(?:em|de|do|no) )?${MONTH_WORDS}(?: de (20\\d{2}))?$`)
    const found = base.match(textMonth)
    if (found) {
      base = base.slice(0, found.index).trim()
      year = found[2] ? Number(found[2]) : year
      month = MONTHS[found[1]]
      matched = true
    }
  }
  if (!matched) {
    const numeric = base.match(/\s+(?:(?:em|de|do|no) )?(0?[1-9]|1[0-2])\/(20\d{2}|\d{2})$/)
    if (numeric) {
      base = base.slice(0, numeric.index).trim()
      month = Number(numeric[1])
      year = numeric[2].length === 2 ? 2000 + Number(numeric[2]) : Number(numeric[2])
      matched = true
    }
  }
  // Nunca faz suposicoes sobre periodo ou entidade desconhecida.
  if (/\b(?:mes|ano|ontem|hoje|periodo|semana|desde|ate|durante|nos ultimos|20\d{2})\b/.test(base)) return null
  if (year < 2000 || year > 2099 || month < 1 || month > 12) return null
  const span = monthAt(year, month)
  const expense = base.match(/^(?:quanto (?:eu )?(?:gastei|gasto)|total de despesas|quanto foram minhas despesas)(?: com (.{2,60}))?$/)
  if (expense) return { ...span, kind: expense[1] ? 'category-expense' : 'expense', category: expense[1] }
  if (/^(?:quanto (?:eu )?(?:recebi|ganhei)|total de receitas|quanto entrou)$/.test(base)) return { ...span, kind: 'income' }
  if (/^(?:como (?:estao|andam) (?:minhas )?financas|resumo financeiro|balanco financeiro)$/.test(base)) return { ...span, kind: 'flow' }
  if (/^(?:qual (?:foi )?a categoria (?:com )?mais gastos|onde (?:eu )?mais gastei)$/.test(base)) return { ...span, kind: 'top-category' }
  return null
}

/** Mesma semantica de realizado usada nas Analises; nunca conta transferencias ou liquidacao de fatura como nova despesa. */
export function answerFinancialReadOnlyQuestion(
  question: ReadOnlyFinancialQuestion,
  transactions: readonly FinancialTransactionLike[],
  categories: readonly LocalNamedCategory[],
  context: 'dfl' | 'personal'
): ReadOnlyFinancialAnswer {
  const realized = filterRealizedFinancialTransactions([...transactions], {
    context, start: question.start, end: question.end,
  })
  const zero = { count: 0, income: 0, expense: 0, net: 0 }
  const categoryName = question.category ? fold(question.category) : ''
  const chosen = categoryName ? categories.find(item => fold(item.name) === categoryName) : null
  if (categoryName && !chosen) return {
    ...zero, state: 'missing-category', title: 'Categoria não identificada',
    detail: 'Não encontrei uma categoria com esse nome neste contexto. Confira o nome ou converse com o Gemini.',
  }
  const selected = chosen ? realized.filter(tx => tx.category_id === chosen.id && isExpenseTransaction(tx))
    : question.kind === 'income' ? realized.filter(tx => tx.type === 'income')
    : question.kind === 'expense' ? realized.filter(isExpenseTransaction)
    : realized
  if (!selected.length) return {
    ...zero, state: 'no-data', title: 'Sem lançamentos para essa consulta',
    detail: `Não há registros compatíveis disponíveis neste dispositivo em ${question.periodLabel}.`,
  }
  if (question.kind === 'top-category') {
    const expenseTxs = realized.filter(isExpenseTransaction)
    const totals = new Map<string, number>()
    expenseTxs.forEach(tx => {
      const id = tx.category_id || ''
      totals.set(id, (totals.get(id) || 0) + (Number(tx.amount) || 0))
    })
    const top = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0]
    if (!top) return { ...zero, state: 'no-data', title: 'Nenhuma despesa identificada', detail: `Não há despesas realizadas em ${question.periodLabel}.` }
    const name = categories.find(c => c.id === top[0])?.name || 'Sem categoria'
    return { ...zero, state: 'ready', title: 'Categoria com mais despesas', detail: `Maior total em ${question.periodLabel}, entre os lançamentos locais.`, expense: top[1], count: expenseTxs.filter(tx => (tx.category_id || '') === top[0]).length, category: name }
  }
  const flow = getFinancialFlowSummary(selected)
  return {
    state: 'ready',
    title: question.kind === 'income' ? 'Receitas do período' : question.kind === 'flow' ? 'Fluxo do período' : 'Despesas do período',
    detail: `${question.periodLabel} · Somente movimentações compatíveis com as regras das Análises.`,
    count: flow.count, income: flow.income, expense: flow.expense, net: flow.balance,
    ...(chosen ? { category: chosen.name } : {}),
  }
}
