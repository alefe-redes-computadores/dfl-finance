import { apkUpdateNotificationId, shouldAnnounceApkUpdate } from '@/lib/apkUpdateAlertPolicy'
import type { ApkRelease } from '@/lib/mobileUpdatePolicy'

const release: ApkRelease = {
  id: 1, build: 1070, sha: 'a'.repeat(40), artifactId: 2,
  expiresAt: null, createdAt: '2026-11-11T00:00:00Z', pageUrl: 'https://github.com/',
  direct: { url: 'https://github.com/', sha256: 'b'.repeat(64), bytes: 4_000_000 },
}

describe('R467: aviso opt-in apenas de APK novo, íntegro e uma vez por build', () => {
  it('não avisa sem consentimento, sem build instalado ou sobre versão atual', () => {
    expect(shouldAnnounceApkUpdate(false, 1069, release, null)).toBe(false)
    expect(shouldAnnounceApkUpdate(true, null, release, null)).toBe(false)
    expect(shouldAnnounceApkUpdate(true, 1070, release, null)).toBe(false)
    expect(shouldAnnounceApkUpdate(true, 1071, release, null)).toBe(false)
  })
  it('avisa uma única vez e não confunde release legada com APK direto', () => {
    expect(shouldAnnounceApkUpdate(true, 1069, release, null)).toBe(true)
    expect(shouldAnnounceApkUpdate(true, 1069, release, 1070)).toBe(false)
    expect(shouldAnnounceApkUpdate(true, 1069, { ...release, direct: undefined }, null)).toBe(false)
  })
  it('usa faixa positiva de IDs sem misturar avisos financeiros', () => {
    expect(apkUpdateNotificationId(1070)).toBe(1867001070)
    expect(apkUpdateNotificationId(1071)).not.toBe(apkUpdateNotificationId(1070))
  })
})
