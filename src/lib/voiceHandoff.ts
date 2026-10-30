// Sessão efêmera para transcrito; nunca em query-string, banco, analytics ou servidor.
const KEY = 'dfl.finance.voice.transcript.v1'
const MAX_AGE_MS = 60_000
export function stageFinancialVoiceTranscript(text: string): boolean {
  if (typeof window === 'undefined') return false
  const value = text.trim().slice(0, 400)
  if (!value) return false
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ text: value, at: Date.now() }))
    return true
  } catch { return false }
}
export function consumeFinancialVoiceTranscript(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(KEY)
    window.sessionStorage.removeItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { text?: unknown; at?: unknown }
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > MAX_AGE_MS || parsed.at > Date.now() + 5000) return null
    if (typeof parsed.text !== 'string') return null
    return parsed.text.trim().slice(0, 400) || null
  } catch { return null }
}
