/** R430 — handoff explicito entre Busca local e Gemini.
 * Apenas a frase escolhida pelo usuario, sem snapshots, saldos ou IDs na URL.
 * Uma leitura, validade curta e isolamento por usuario/contexto.
 */
const KEY = 'dfl.finance.assistant.question.r430'
const TTL_MS = 120_000
export type AssistantContext = 'dfl' | 'personal'

export function stageAssistantQuestionHandoff(userId: string | null | undefined, context: AssistantContext, query: string): boolean {
  if (typeof window === 'undefined' || !userId || !/^[\w-]{8,100}$/.test(userId)) return false
  if (context !== 'dfl' && context !== 'personal') return false
  const text = query.replace(/\s+/g, ' ').trim()
  if (!text || text.length > 240) return false
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ userId, context, text, at: Date.now() }))
    return true
  } catch { return false }
}
export function consumeAssistantQuestionHandoff(userId: string | null | undefined, context: AssistantContext): string | null {
  if (typeof window === 'undefined' || !userId) return null
  try {
    const value = window.sessionStorage.getItem(KEY)
    window.sessionStorage.removeItem(KEY)
    if (!value) return null
    const data = JSON.parse(value) as { userId?: string; context?: string; text?: string; at?: number }
    const age = Date.now() - Number(data.at)
    if (data.userId !== userId || data.context !== context || !Number.isFinite(age) || age < 0 || age > TTL_MS) return null
    return typeof data.text === 'string' && data.text.length >= 1 && data.text.length <= 240 ? data.text : null
  } catch { return null }
}
