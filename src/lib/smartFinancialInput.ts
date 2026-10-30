/**
 * R411 — Comando financeiro em linguagem natural, local e deterministico.
 * NUNCA grava transacoes, nao escolhe conta nem categoria automaticamente.
 * O resultado serve SOMENTE para preencher o formulario de confirmacao.
 */
export type SmartFinancialDraft = {
  type: 'income' | 'expense'
  amount: number
  description: string
  date: string
  paid: boolean
  warnings: string[]
}

const fold = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

const expenseCommand = /^(?:eu\s+)?(?:paguei|gastei|comprei|desembolsei|vou\s+pagar|preciso\s+pagar|tenho\s+que\s+pagar|devo\s+pagar|(?:nova|criar|registrar|lancar|anotar)\s+(?:uma\s+)?despesa(?:\s+de)?)\b/
const incomeCommand = /^(?:eu\s+)?(?:recebi|ganhei|vendi|entrou|vou\s+receber|preciso\s+receber|tenho\s+que\s+receber|(?:nova|criar|registrar|lancar|anotar)\s+(?:uma\s+)?receita(?:\s+de)?)\b/
const pendingCommand = /\b(?:vou|preciso|devo|tenho\s+que)\s+(?:pagar|receber)\b/
const amountPattern = /(?:r\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2}|\.\d{1,2})?)(?![\d.,])/i

function isoLocal(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-')
}

function validDay(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || year < 2000 || year > 2099 ||
      !Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isInteger(day) || day < 1) return false
  const date = new Date(year, month - 1, day, 12)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function extractDate(raw: string, reference: Date): { date: string; warning?: string } {
  const normalized = fold(raw)
  const iso = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) {
    const [, y, m, d] = iso
    return validDay(Number(y), Number(m), Number(d))
      ? { date: `${y}-${m}-${d}` }
      : { date: isoLocal(reference), warning: 'Data informada invalida. Confira antes de salvar.' }
  }
  const brazilian = normalized.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/)
  if (brazilian) {
    const [, d, m, y] = brazilian
    return validDay(Number(y), Number(m), Number(d))
      ? { date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` }
      : { date: isoLocal(reference), warning: 'Data informada invalida. Confira antes de salvar.' }
  }
  const date = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate(), 12)
  if (/\banteontem\b/.test(normalized)) date.setDate(date.getDate() - 2)
  else if (/\bontem\b/.test(normalized)) date.setDate(date.getDate() - 1)
  else if (/\bamanha\b/.test(normalized)) date.setDate(date.getDate() + 1)
  const warning = /\bdia\s+\d{1,2}\b/.test(normalized) && !iso && !brazilian
    ? 'Dia mencionado sem data completa. Confira a data.'
    : undefined
  return { date: isoLocal(date), warning }
}

export function interpretFinancialInput(input: string, reference = new Date()): SmartFinancialDraft | null {
  const original = input.trim().slice(0, 400)
  const normalized = fold(original)
  if (!normalized || /^(?:quanto|quantos|qual|quais|como|mostra|mostrar|busca|buscar|pesquisa|pesquisar|lista|listar|onde)\b/.test(normalized)) return null
  const expense = normalized.match(expenseCommand)
  const income = normalized.match(incomeCommand)
  if (!expense && !income) return null
  const type = income ? 'income' : 'expense'
  // Uma frase com varios lancamentos nao pode gerar um lancamento parcial.
  if (/\b(?:paguei|gastei|comprei|recebi|ganhei|vendi)\b/.test(normalized.slice((income || expense)![0].length))) return null

  // Remove datas antes de procurar o valor: '30/10/2026' nao e R$ 30.
  const amountText = normalized
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/g, ' ')
  const amountMatch = amountText.match(amountPattern)
  if (!amountMatch) return null
  const moneyString = amountMatch[1]
  const amount = Number(moneyString.includes(',')
    ? moneyString.replace(/\./g, '').replace(',', '.')
    : moneyString.replace(/\.(?=\d{3}(?:\.|$))/g, ''))
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) return null
  const rounded = Math.round(amount * 100) / 100
  if (rounded <= 0) return null

  const dateResult = extractDate(original, reference)
  const warnings: string[] = []
  if (dateResult.warning) warnings.push(dateResult.warning)
  let paid = !pendingCommand.test(normalized)
  const today = isoLocal(reference)
  if (dateResult.date > today && paid) {
    paid = false
    warnings.push('Data futura: o lancamento foi marcado como pendente.')
  }

  // Apenas remove tokens estruturais; NUNCA infere conta ou categoria sem evidencia.
  let description = original
    .replace(/^(?:eu\s+)?(?:paguei|gastei|comprei|desembolsei|recebi|ganhei|vendi|entrou|vou\s+pagar|vou\s+receber|preciso\s+pagar|preciso\s+receber|tenho\s+que\s+pagar|tenho\s+que\s+receber|devo\s+pagar|(?:nova|criar|registrar|lancar|lançar|anotar)\s+(?:uma\s+)?(?:despesa|receita)(?:\s+de)?)/i, ' ')
    .replace(/\b(?:r\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2}|\.\d{1,2})?\b/i, ' ')
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/g, ' ')
    .replace(/\b(?:anteontem|ontem|hoje|amanh[ãa])\b/gi, ' ')
    .replace(/\b(?:reais|real)\b/gi, ' ')
    .replace(/^[\s,;:.]+|[\s,;:.]+$/g, ' ')
    .trim()
    .replace(/^(?:de|do|da|no|na|em|por|com)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  description = description.slice(0, 160) || (type === 'income' ? 'Receita por comando' : 'Despesa por comando')
  warnings.push('Confira a categoria e a conta no cadastro completo.')
  return { type, amount: rounded, description, date: dateResult.date, paid, warnings }
}

export function smartDraftUrl(draft: SmartFinancialDraft): string {
  const params = new URLSearchParams({
    type: draft.type,
    intent: 'smart',
    amount: draft.amount.toFixed(2),
    description: draft.description.slice(0, 160),
    date: draft.date,
    paid: draft.paid ? '1' : '0',
  })
  return `/transactions/new?${params.toString()}`
}
