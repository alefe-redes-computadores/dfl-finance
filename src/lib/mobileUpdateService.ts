/** Consultas somente de leitura à API pública do GitHub. Zero tokens, zero SQL. */
import {
  APK_REPOSITORY, APK_WORKFLOW_FILE,
  parseSuccessfulApkRun, releaseFromArtifacts,
  type ApkRelease,
} from '@/lib/mobileUpdatePolicy'

const API = `https://api.github.com/repos/${APK_REPOSITORY}`
const WORKFLOW_NAME = APK_WORKFLOW_FILE.split('/').pop() || 'android-build.yml'
const CHECK_CACHE_MS = 20 * 60 * 1000
const REQUEST_TIMEOUT_MS = 12_000
let recent: { at: number; value: ApkRelease | null } | null = null
let inFlight: Promise<ApkRelease | null> | null = null

async function githubJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`GitHub não respondeu à consulta: ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function readLatestRelease(): Promise<ApkRelease | null> {
  const url = `${API}/actions/workflows/${WORKFLOW_NAME}/runs?branch=main&status=success&per_page=6`
  const data = await githubJson(url)
  const entries = (data && typeof data === 'object' && 'workflow_runs' in data)
    ? (data as { workflow_runs?: unknown }).workflow_runs : null
  if (!Array.isArray(entries)) throw new Error('Resposta inesperada do GitHub.')
  const runs = entries.map(parseSuccessfulApkRun)
    .filter((run): run is NonNullable<typeof run> => run !== null)
    .sort((a, b) => b.build - a.build)

  // Limite consciente: não consultar dezenas de Actions / evitar rate limit.
  for (const run of runs.slice(0, 4)) {
    const artifacts = await githubJson(`${API}/actions/runs/${run.id}/artifacts?per_page=30`)
    const release = releaseFromArtifacts(run, artifacts)
    if (release) return release
  }
  return null
}

export async function fetchLatestApkRelease(force = false): Promise<ApkRelease | null> {
  if (inFlight) return inFlight
  if (!force && recent && Date.now() - recent.at < CHECK_CACHE_MS) return recent.value

  inFlight = readLatestRelease()
  try {
    const value = await inFlight
    recent = { at: Date.now(), value }
    return value
  } finally {
    inFlight = null
  }
}
