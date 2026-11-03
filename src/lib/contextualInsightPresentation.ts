/** R421 — política pura para evitar sumiço/flicker de insights em atualizações do IndexedDB. */
import type { ContextualInsight } from '@/lib/contextualInsightEngine'

export type InsightPresentationDecision =
  | { kind: 'keep'; insight: ContextualInsight }
  | { kind: 'schedule'; insight: ContextualInsight }
  | { kind: 'wait'; insight: null }

export type InsightPresentationInput = {
  candidates: readonly ContextualInsight[]
  current: ContextualInsight | null
  previousId: string | null
  shownAt?: number
  dismissedUntil?: number
  nowMs: number
  foreground: boolean
  showCooldownMs: number
  repeatCooldownMs: number
}

export function planContextualInsight(input: InsightPresentationInput): InsightPresentationDecision {
  const { candidates, current, previousId, shownAt, dismissedUntil, nowMs, foreground, showCooldownMs, repeatCooldownMs } = input
  // Dados atualizados? Mantém a observação visível se a evidência ainda existir.
  // Usa a versão nova do texto sem repetir entrada/análise.
  if (current) {
    const refreshed = candidates.find(item => item.id === current.id)
    if (refreshed) return { kind: 'keep', insight: refreshed }
  }
  if (!foreground || !candidates.length || !Number.isFinite(nowMs)) return { kind: 'wait', insight: null }
  if (typeof dismissedUntil === 'number' && dismissedUntil > nowMs) return { kind: 'wait', insight: null }
  const elapsed = typeof shownAt === 'number' ? nowMs - shownAt : Number.POSITIVE_INFINITY
  if (elapsed >= 0 && elapsed < showCooldownMs) return { kind: 'wait', insight: null }
  if (candidates.length === 1 && previousId === candidates[0].id && elapsed >= 0 && elapsed < repeatCooldownMs) {
    return { kind: 'wait', insight: null }
  }
  const next = candidates.find(item => item.id !== previousId) ?? candidates[0]
  return next ? { kind: 'schedule', insight: next } : { kind: 'wait', insight: null }
}
