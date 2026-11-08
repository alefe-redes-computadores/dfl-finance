import {
  APK_REPOSITORY,
  formatApkExpiry, hasNewApk,
  parseInstalledBuild, parseSuccessfulApkRun, releaseFromArtifacts,
} from '@/lib/mobileUpdatePolicy'

const sha = 'a'.repeat(40)
const run = {
  id: 42233887536, run_number: 1042,
  status: 'completed', conclusion: 'success',
  head_branch: 'main', head_sha: sha,
  path: '.github/workflows/android-build.yml@main', event: 'push',
}
const now = Date.parse('2026-11-07T20:00:00Z')
const artifacts = { artifacts: [{
  id: 13510529397, name: 'DFL-Finance-App', expired: false,
  created_at: '2026-11-06T14:33:58Z', expires_at: '2026-11-20T14:33:57Z',
  workflow_run: { id: 42233887536, head_sha: sha, head_branch: 'main' },
}] }

describe('R456 atualizações APK Android', () => {
  it('recusa workflow falho, outro branch, outro fluxo ou SHA inválido', () => {
    expect(parseSuccessfulApkRun(run)).not.toBeNull()
    expect(parseSuccessfulApkRun({ ...run, conclusion: 'failure' })).toBeNull()
    expect(parseSuccessfulApkRun({ ...run, status: 'in_progress' })).toBeNull()
    expect(parseSuccessfulApkRun({ ...run, head_branch: 'feature' })).toBeNull()
    expect(parseSuccessfulApkRun({ ...run, path: '.github/workflows/other.yml@main' })).toBeNull()
    expect(parseSuccessfulApkRun({ ...run, head_sha: '../other' })).toBeNull()
  })

  it('associa o APK ao commit exato e respeita o expires_at', () => {
    const parsed = parseSuccessfulApkRun(run)!
    const release = releaseFromArtifacts(parsed, artifacts, now)
    expect(release?.build).toBe(1042)
    expect(release?.pageUrl).toBe(`https://github.com/${APK_REPOSITORY}/actions/runs/42233887536`)
    expect(releaseFromArtifacts(parsed, artifacts, Date.parse('2026-11-21T00:00:00Z'))).toBeNull()
    expect(releaseFromArtifacts(parsed, { artifacts: [{ ...artifacts.artifacts[0], expired: true }] }, now)).toBeNull()
    expect(releaseFromArtifacts(parsed, { artifacts: [{ ...artifacts.artifacts[0], workflow_run: { id: 4, head_sha: sha, head_branch: 'main' } }] }, now)).toBeNull()
  })

  it('só oferece build maior que a versão Android instalada', () => {
    const release = releaseFromArtifacts(parseSuccessfulApkRun(run)!, artifacts, now)
    expect(parseInstalledBuild('1041')).toBe(1041)
    expect(parseInstalledBuild('1042junk')).toBeNull()
    expect(hasNewApk(1041, release, now)).toBe(true)
    expect(hasNewApk(1042, release, now)).toBe(false)
    expect(hasNewApk(1043, release, now)).toBe(false)
    expect(hasNewApk(null, release, now)).toBe(false)
    expect(hasNewApk(1041, release, Date.parse('2026-11-21T00:00:00Z'))).toBe(false)
  })

  it('mostra prazo em Brasília sem confundir expiração com instalação', () => {
    expect(formatApkExpiry('2026-11-20T14:33:57Z')).toContain('20/11/2026')
    expect(formatApkExpiry('2026-11-20T14:33:57Z')).toContain('11:33')
  })
})
