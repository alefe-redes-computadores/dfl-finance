import { parseDirectApkRelease, hasNewApk, parseSuccessfulApkRun, releaseFromArtifacts } from '@/lib/mobileUpdatePolicy'

const sha = 'a'.repeat(40)
const digest = 'b'.repeat(64)
const build = 1052
const run = { id: 98765, run_number: build, status: 'completed', conclusion: 'success',
  head_branch: 'main', head_sha: sha, path: '.github/workflows/android-build.yml@refs/heads/main', event: 'push' }
const asset = { id: 45678, name: 'DFL-Finance-1052.apk', size: 9000000, state: 'uploaded',
  digest: `sha256:${digest}`, browser_download_url: 'https://github.com/alefe-redes-computadores/dfl-finance/releases/download/finance-android-1052/DFL-Finance-1052.apk' }
const release = { id: 876543, tag_name: 'finance-android-1052', target_commitish: sha,
  draft: false, prerelease: false, published_at: '2026-11-10T12:00:00Z', assets: [asset] }
const okRun = parseSuccessfulApkRun(run)!

describe('R464: distribuição nativa segura', () => {
  it('reconhece apenas APK da release cuja Action aprovada possui build e SHA idênticos', () => {
    const parsed = parseDirectApkRelease(release, [okRun])!
    expect(parsed.build).toBe(1052)
    expect(parsed.sha).toBe(sha)
    expect(parsed.direct?.sha256).toBe(digest)
    expect(parsed.expiresAt).toBeNull()
    expect(hasNewApk(1051, parsed)).toBe(true)
    expect(hasNewApk(1052, parsed)).toBe(false)
  })

  it('recusa release diferente, arquivo ZIP, digest ausente e URL de terceiro', () => {
    expect(parseDirectApkRelease(release, [])).toBeNull()
    expect(parseDirectApkRelease({ ...release, draft: true }, [okRun])).toBeNull()
    expect(parseDirectApkRelease({ ...release, target_commitish: 'f'.repeat(40) }, [okRun])).toBeNull()
    expect(parseDirectApkRelease({ ...release, tag_name: 'finance-android-9999' }, [okRun])).toBeNull()
    expect(parseDirectApkRelease({ ...release, assets: [{ ...asset, name: 'app.zip' }] }, [okRun])).toBeNull()
    expect(parseDirectApkRelease({ ...release, assets: [{ ...asset, digest: '' }] }, [okRun])).toBeNull()
    expect(parseDirectApkRelease({ ...release, assets: [{ ...asset, browser_download_url: 'https://evil.example/evil.apk' }] }, [okRun])).toBeNull()
    expect(parseDirectApkRelease({ ...release, assets: [{ ...asset, size: 200000000 }] }, [okRun])).toBeNull()
    expect(parseDirectApkRelease({ ...release, assets: [{ ...asset, state: 'starter' }] }, [okRun])).toBeNull()
  })

  it('preserva o fallback legado de Action e expiração de artefatos', () => {
    const now = Date.parse('2026-11-11T00:00:00Z')
    const old = releaseFromArtifacts(okRun, { artifacts: [{
      id: 1234, name: 'DFL-Finance-App', expired: false,
      expires_at: '2026-11-23T00:00:00Z', created_at: '2026-11-10T00:00:00Z',
      workflow_run: { id: run.id, head_sha: sha, head_branch: 'main' },
    }] }, now)
    expect(old?.direct).toBeUndefined()
    expect(old?.expiresAt).not.toBeNull()
    expect(hasNewApk(1051, old, now)).toBe(true)
    expect(hasNewApk(1051, old, Date.parse('2026-11-24T00:00:00Z'))).toBe(false)
  })
})
