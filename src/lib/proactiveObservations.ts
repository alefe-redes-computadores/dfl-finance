/** R458 — apresentação proativa derivada somente dos motores financeiros oficiais.
 * Não calcula saldos, não persiste movimentações e não envia dados ao provedor IA.
 */
import type { FinancialIntelligenceOutput, InsightConfidence, InsightSeverity } from '@/lib/financial-intelligence'
import type { MonthlyReview } from '@/lib/financeMonthlyReview'

export type ProactiveFrequency = 'daily' | 'weekly' | 'off'
export type ProactiveObservation = {
  key: string
  source: 'intelligence' | 'monthly_review' | 'data_quality'
  title: string
  message: string
  why: string
  period: string
  severity: InsightSeverity
  confidence: InsightConfidence
  priority: number
  evidence: string
  route: string
  actionLabel: string
}
export type ProactiveHistoryEntry = { key: string; seenAt: string; snoozedUntil?: string }

const VALID_ROUTES = new Set([
  '/analysis', '/transactions', '/conciliation', '/budgets', '/goals', '/cards',
  '/debts', '/loans', '/financings', '/subscriptions', '/monthly-review',
  '/financial-health', '/spending-pulse', '/agenda', '/intelligence-center',
])
const safeRoute = (value: unknown) => typeof value === 'string' && VALID_ROUTES.has(value) ? value : '/intelligence-center'
const money = (value: number) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const percent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`

function isoMonth(value: string) { return /^20\d{2}-(0[1-9]|1[0-2])$/.test(value) ? value : null }
function monthLabel(ym: string) {
  const month = isoMonth(ym)
  if (!month) return 'período indisponível'
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 15, 12)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Deduplicação por fonte+período e prioridade, não por valores do usuário. */
export function buildProactiveObservations(
  intelligence: FinancialIntelligenceOutput,
  current: MonthlyReview,
  lastClosed: MonthlyReview,
): ProactiveObservation[] {
  if (intelligence.context !== current.context || intelligence.context !== lastClosed.context) return []
  if (!isoMonth(current.month) || !isoMonth(lastClosed.month) || !lastClosed.closed) return []
  const context = intelligence.context
  const result: ProactiveObservation[] = []
  const count = Math.max(0, Number(lastClosed.economicCount) || 0)

  // A Revisão Mensal V175 já exclui dupla contagem da liquidação da fatura.
  if (count >= 3) {
    const variation = lastClosed.expenseVariation
    const comparison = variation === null || !Number.isFinite(variation)
      ? 'Sem base de comparação suficiente com o mês anterior.'
      : `Variação de ${percent(variation)} em relação a ${monthLabel(lastClosed.comparisonMonth)}.`
    result.push({
      key: `${context}:monthly-close:${lastClosed.month}`,
      source: 'monthly_review',
      title: `Fechamento de ${monthLabel(lastClosed.month)}`,
      message: `Receitas ${money(lastClosed.income)} · despesas ${money(lastClosed.expense)} · resultado ${money(lastClosed.result)}.`,
      why: 'Consolidação do último mês civil encerrado. Compras no cartão entram uma vez, sem duplicar o pagamento da fatura.',
      period: monthLabel(lastClosed.month),
      severity: typeof variation === 'number' && variation >= 20 ? 'attention' : 'info',
      confidence: count >= 15 ? 'high' : 'medium',
      priority: typeof variation === 'number' && variation >= 20 ? 82 : 56,
      evidence: `${count} lançamentos econômicos. ${comparison}`,
      route: '/monthly-review', actionLabel: 'Conferir fechamento',
    })
  }

  // Qualidade é aviso de revisão, nunca conclusão sobre dinheiro em caixa.
  const missing = lastClosed.missingCategories + lastClosed.missingAccounts
  if (count >= 3 && (missing > 0 || lastClosed.importsToReview > 0)) {
    result.push({
      key: `${context}:data-quality:${lastClosed.month}`,
      source: 'data_quality',
      title: 'Lançamentos que merecem revisão',
      message: `${missing} campo(s) sem categoria/conta e ${lastClosed.importsToReview} importação(ões) pendentes no último fechamento.`,
      why: 'A Revisão Mensal identificou cadastros ou importações que precisam de conferência; não houve correção automática.',
      period: monthLabel(lastClosed.month),
      severity: 'attention', confidence: 'high', priority: 86,
      evidence: `Fonte: Revisão Mensal · ${count} registros econômicos.`,
      route: '/conciliation', actionLabel: 'Revisar registros',
    })
  }

  // Motor V54+ é autoridade de risco, prioridade, confiança e justificativa.
  for (const insight of intelligence.insights.slice(0, 20)) {
    if (!insight.id || !insight.title || !insight.message) continue
    const severity = insight.severity
    if (!['critical', 'warning', 'attention', 'opportunity', 'info'].includes(severity)) continue
    const confidence = insight.confidence
    if (!['low', 'medium', 'high'].includes(confidence)) continue
    const evidence = [
      `Amostra: ${Math.max(0, Number(insight.sampleSize) || 0)} registro(s)`,
      typeof insight.deltaPercent === 'number' && Number.isFinite(insight.deltaPercent)
        ? `Variação: ${percent(insight.deltaPercent)}` : '',
      `Confiança: ${confidence === 'high' ? 'alta' : confidence === 'medium' ? 'moderada' : 'preliminar'}`,
    ].filter(Boolean).join(' · ')
    result.push({
      key: `${context}:engine:${current.month}:${insight.id}`,
      source: 'intelligence', title: insight.title, message: insight.message,
      why: insight.explanation?.why || 'Sinal calculado pelo motor de inteligência a partir dos registros disponíveis neste dispositivo.',
      period: insight.explanation?.period || monthLabel(current.month),
      severity, confidence, priority: Math.min(100, Math.max(0, Number(insight.priorityScore) || 50)),
      evidence, route: safeRoute(insight.explanation?.actionRoute),
      actionLabel: insight.explanation?.actionRoute ? (insight.explanation.actionLabel || 'Entender observação') : 'Entender na Central',
    })
  }

  return result.sort((a,b) => b.priority-a.priority || a.key.localeCompare(b.key)).slice(0, 24)
}

/** Sem valores ou descrições financeiras persistidas: apenas estado de revisão. */
export function normalizeProactiveHistory(value: unknown, now: Date = new Date()): ProactiveHistoryEntry[] {
  if (!Array.isArray(value)) return []
  const nowMs = now.getTime()
  const oldest = nowMs - 180 * 86400000
  const best = new Map<string, ProactiveHistoryEntry>()
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const key = row.key
    const seenAt = row.seenAt
    if (typeof key !== 'string' || !/^(dfl|personal):[a-z0-9:_-]{3,110}$/.test(key)) continue
    if (typeof seenAt !== 'string') continue
    const seen = Date.parse(seenAt)
    if (!Number.isFinite(seen) || seen < oldest || seen > nowMs + 60000) continue
    const snoozedUntil = typeof row.snoozedUntil === 'string' && Number.isFinite(Date.parse(row.snoozedUntil)) &&
      Date.parse(row.snoozedUntil) <= nowMs + 31 * 86400000 ? row.snoozedUntil : undefined
    const prev = best.get(key)
    if (!prev || Date.parse(prev.seenAt) < seen) best.set(key, { key, seenAt, ...(snoozedUntil ? { snoozedUntil } : {}) })
  }
  return Array.from(best.values()).sort((a,b) => b.seenAt.localeCompare(a.seenAt)).slice(0, 80)
}

export function reviewObservation(
  history: readonly ProactiveHistoryEntry[], key: string, action: 'seen' | 'snooze' | 'reopen', now: Date,
): ProactiveHistoryEntry[] {
  if (!/^(dfl|personal):[a-z0-9:_-]{3,110}$/.test(key) || !Number.isFinite(now.getTime())) return normalizeProactiveHistory(history, now)
  const others = normalizeProactiveHistory(history, now).filter(item => item.key !== key)
  if (action === 'reopen') return others
  return normalizeProactiveHistory([{
    key, seenAt: now.toISOString(),
    ...(action === 'snooze' ? { snoozedUntil: new Date(now.getTime() + 7 * 86400000).toISOString() } : {}),
  }, ...others], now)
}

export function observationVisibility(
  history: readonly ProactiveHistoryEntry[], key: string, frequency: ProactiveFrequency,
  now: Date,
): 'active' | 'reviewed' | 'snoozed' | 'paused' {
  if (frequency === 'off') return 'paused'
  const item = history.find(entry => entry.key === key)
  if (!item) return 'active'
  if (item.snoozedUntil && Date.parse(item.snoozedUntil) > now.getTime()) return 'snoozed'
  const windowMs = frequency === 'weekly' ? 7 * 86400000 : 86400000
  return now.getTime() - Date.parse(item.seenAt) < windowMs ? 'reviewed' : 'active'
}
