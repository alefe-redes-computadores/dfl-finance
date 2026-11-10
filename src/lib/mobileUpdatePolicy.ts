/** R456: Fonte pública e única da versão Android. Não processa dados financeiros. */
export const APK_REPOSITORY = 'alefe-redes-computadores/dfl-finance'
export const APK_ACTIONS_URL = `https://github.com/${APK_REPOSITORY}/actions`
export const APK_WORKFLOW_FILE = '.github/workflows/android-build.yml'
export const APK_ARTIFACT_NAME = 'DFL-Finance-App'

export type ApkRun = {
  id: number
  build: number
  sha: string
}

export type ApkRelease = ApkRun & {
  artifactId: number
  expiresAt: string | null
  direct?: { url: string; sha256: string; bytes: number }
  createdAt: string
  pageUrl: string
}

type RecordValue = Record<string, unknown>

function asRecord(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue : null
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/** O GitHub produz run_number; o Gradle usa GITHUB_RUN_NUMBER como versionCode. */
export function parseInstalledBuild(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{1,9}$/.test(value)) return null
  const number = Number(value)
  return positiveInteger(number) ? number : null
}

/** R464: mesma política para o APK de GitHub Releases e o artefato legado. */
const RELEASE_TAG_PREFIX = 'finance-android-'
const DIRECT_MAX_BYTES = 150 * 1024 * 1024

export function parseDirectApkRelease(raw: unknown, successfulRuns: readonly ApkRun[]): ApkRelease | null {
  const release = asRecord(raw)
  if (!release || release.draft !== false || release.prerelease !== false ||
      typeof release.published_at !== 'string' || !Number.isFinite(Date.parse(release.published_at))) return null
  if (typeof release.tag_name !== 'string') return null
  const match = /^finance-android-([1-9][0-9]{0,8})$/.exec(release.tag_name)
  if (!match) return null
  const build = Number(match[1])
  const target = release.target_commitish
  if (typeof target !== 'string' || !/^[a-f0-9]{40}$/.test(target)) return null
  const matched = successfulRuns.find(run => run.build === build)
  if (!matched || matched.sha !== target) return null
  const assets = release.assets
  if (!Array.isArray(assets)) return null
  const name = `DFL-Finance-${build}.apk`
  const expectedUrl = `https://github.com/${APK_REPOSITORY}/releases/download/${RELEASE_TAG_PREFIX}${build}/${name}`
  const asset = assets.map(asRecord).find(row => row?.name === name && row?.state === 'uploaded')
  if (!asset || !positiveInteger(asset.id) || !positiveInteger(asset.size) || asset.size > DIRECT_MAX_BYTES) return null
  if (asset.browser_download_url !== expectedUrl || typeof asset.digest !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/i.test(asset.digest)) return null
  return {
    ...matched,
    artifactId: asset.id,
    expiresAt: null,
    createdAt: release.published_at,
    pageUrl: `https://github.com/${APK_REPOSITORY}/releases/tag/${RELEASE_TAG_PREFIX}${build}`,
    direct: { url: expectedUrl, sha256: asset.digest.slice(7).toLowerCase(), bytes: asset.size },
  }
}

/** Nunca oferecer APK de workflow falho, de outro branch ou outra origem. */
export function parseSuccessfulApkRun(value: unknown): ApkRun | null {
  const run = asRecord(value)
  if (!run) return null
  if (!positiveInteger(run.id) || !positiveInteger(run.run_number)) return null
  if (run.status !== 'completed' || run.conclusion !== 'success') return null
  if (run.head_branch !== 'main') return null
  if (run.event !== 'push' && run.event !== 'workflow_dispatch') return null
  const path = run.path
  if (typeof path !== 'string' || !(path === APK_WORKFLOW_FILE || path.startsWith(`${APK_WORKFLOW_FILE}@`))) return null
  if (typeof run.head_sha !== 'string' || !/^[a-f0-9]{40}$/.test(run.head_sha)) return null
  return { id: run.id, build: run.run_number, sha: run.head_sha }
}

/** O próprio GitHub informa expires_at; não presumir 14 dias a partir do commit. */
export function releaseFromArtifacts(
  run: ApkRun,
  response: unknown,
  nowMs: number = Date.now(),
): ApkRelease | null {
  const body = asRecord(response)
  const rows = body?.artifacts
  if (!Array.isArray(rows)) return null

  for (const value of rows) {
    const artifact = asRecord(value)
    if (!artifact || artifact.name !== APK_ARTIFACT_NAME || artifact.expired !== false) continue
    if (!positiveInteger(artifact.id)) continue
    if (typeof artifact.expires_at !== 'string' || !Number.isFinite(Date.parse(artifact.expires_at))) continue
    if (Date.parse(artifact.expires_at) <= nowMs) continue
    const workflow = asRecord(artifact.workflow_run)
    if (!workflow || workflow.id !== run.id || workflow.head_sha !== run.sha || workflow.head_branch !== 'main') continue

    return {
      ...run,
      artifactId: artifact.id,
      expiresAt: artifact.expires_at,
      createdAt: typeof artifact.created_at === 'string' ? artifact.created_at : '',
      // Nunca utilizar href informado por terceiros nem o endpoint ZIP da API.
      pageUrl: `https://github.com/${APK_REPOSITORY}/actions/runs/${run.id}`,
    }
  }
  return null
}

export function hasNewApk(
  installedBuild: number | null,
  release: ApkRelease | null,
  nowMs: number = Date.now(),
): boolean {
  return installedBuild !== null && positiveInteger(installedBuild) &&
    release !== null && release.build > installedBuild &&
    (release.expiresAt === null || Date.parse(release.expiresAt) > nowMs)
}

/** Horário fixo para o público do DFL; não confundir UTC com hora do aparelho. */
export function formatApkExpiry(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'prazo indisponível'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}
