/** R459 — decisão pura de agenda, sem I/O ou segunda contabilidade. */
import type { ProactiveObservation, ProactiveFrequency } from '@/lib/proactiveObservations'

export type ProactiveDigestSettings = {
  enabled: boolean
  frequency: ProactiveFrequency
  privacy: 'private' | 'full'
  hour: number
}

export type ProactiveDigestPlan = {
  at: Date
  id: number
  signature: string
  title: string
  body: string
  context: 'dfl' | 'personal'
  route: '/intelligence-center/observations'
}

const safeHour = (value: number) => Number.isInteger(value) ? Math.min(21, Math.max(6, value)) : 9
const stableHash = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
const day = (value: Date) => [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-')

/** Apenas uma próxima entrega por revisão. Nunca promete monitoramento em background. */
export function planProactiveDigest(
  userId: string,
  context: 'dfl' | 'personal',
  observations: readonly ProactiveObservation[],
  settings: ProactiveDigestSettings,
  now: Date = new Date(),
): ProactiveDigestPlan | null {
  if (!userId || !Number.isFinite(now.getTime()) || settings.enabled !== true || settings.frequency === 'off') return null
  const actionable = observations
    .filter(item => item.key.startsWith(`${context}:`) &&
      ['critical', 'warning', 'attention'].includes(item.severity) &&
      ['high', 'medium'].includes(item.confidence) &&
      Number.isFinite(item.priority))
    .sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key))
  if (!actionable.length) return null
  const offset = settings.frequency === 'weekly' ? 7 : 1
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, safeHour(settings.hour), 0, 0, 0)
  const token = stableHash(`${userId}:${context}`)
  // 2,050,000,000+ separa o ID do intervalo de IDs do motor antigo (<= 1,999,999,999).
  const id = 2050000000 + token % 40000000
  const fingerprint = stableHash(actionable.map(item => item.key).slice(0, 8).join('|')).toString(36)
  const signature = `${context}:${day(at)}:${safeHour(settings.hour)}:${settings.frequency}:${fingerprint}:${settings.privacy}`
  const title = settings.privacy === 'full'
    ? actionable[0].title.slice(0, 78)
    : 'Observações do Finance'
  const body = `${actionable.length} ${actionable.length === 1 ? 'observação prioritária' : 'observações prioritárias'} ${context === 'dfl' ? 'da empresa' : 'pessoais'} para conferir. Abra para revisar dados atualizados.`
  return { id, at, signature, title, body, context, route: '/intelligence-center/observations' }
}
