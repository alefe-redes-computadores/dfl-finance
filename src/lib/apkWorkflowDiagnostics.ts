/** R459 — diagnóstico técnico, nunca fonte de ofertas de atualização. */
export type WorkflowHealth = {
  kind: 'building' | 'failed' | 'ready' | 'expired' | 'unavailable' | 'none'
  build: number | null
  url: string | null
  expiresAt: string | null
}
const empty: WorkflowHealth = { kind: 'none', build: null, url: null, expiresAt: null }
const WORKFLOW = '.github/workflows/android-build.yml'
export function classifyLatestWorkflow(data: unknown): WorkflowHealth {
  if (!data || typeof data !== 'object') return empty
  const rows = (data as { workflow_runs?: unknown }).workflow_runs
  if (!Array.isArray(rows)) return empty
  const run = rows[0]
  if (!run || typeof run !== 'object') return empty
  const row = run as Record<string, unknown>
  if (row.head_branch !== 'main' || ![WORKFLOW, `${WORKFLOW}@refs/heads/main`].includes(String(row.path)) ||
    typeof row.id !== 'number' || !Number.isSafeInteger(row.id) || typeof row.run_number !== 'number' || !Number.isSafeInteger(row.run_number)) return empty
  const build = Number(row.run_number)
  const url = `https://github.com/alefe-redes-computadores/dfl-finance/actions/runs/${row.id}`
  if (row.status !== 'completed') return { kind: 'building', build, url, expiresAt: null }
  if (row.conclusion !== 'success') return { kind: 'failed', build, url, expiresAt: null }
  return { kind: 'ready', build, url, expiresAt: null }
}

export function classifyLatestArtifact(health: WorkflowHealth, response: unknown, nowMs = Date.now()): WorkflowHealth {
  if (health.kind !== 'ready') return health
  const rows = response && typeof response === 'object' ? (response as { artifacts?: unknown }).artifacts : null
  if (!Array.isArray(rows)) return { ...health, kind: 'unavailable' }
  const artifact = rows.find(item => item && typeof item === 'object' && (item as Record<string, unknown>).name === 'DFL-Finance-App') as Record<string, unknown> | undefined
  if (!artifact) return { ...health, kind: 'unavailable' }
  if (typeof artifact.expires_at !== 'string' || !Number.isFinite(Date.parse(artifact.expires_at))) return { ...health, kind: 'unavailable' }
  const expired = artifact.expired === true || Date.parse(artifact.expires_at) <= nowMs
  if (artifact.expired !== false && !expired) return { ...health, kind: 'unavailable' }
  return { ...health, kind: expired ? 'expired' : 'ready', expiresAt: artifact.expires_at }
}
