/** R467: política sem I/O para avisos únicos de atualização. */
import { hasNewApk, type ApkRelease } from '@/lib/mobileUpdatePolicy'

export const UPDATE_ALERT_ENABLED_KEY = 'dfl_apk_alert_opt_in_r467'
export const UPDATE_ALERT_LAST_BUILD_KEY = 'dfl_apk_alert_last_build_r467'

export function shouldAnnounceApkUpdate(
  optedIn: boolean,
  installedBuild: number | null,
  release: ApkRelease | null,
  lastNotifiedBuild: number | null,
): boolean {
  return optedIn && release !== null && release.direct !== undefined && hasNewApk(installedBuild, release) &&
    lastNotifiedBuild !== release.build
}

/** ID Android int32 positivo, exclusivo da faixa R467. */
export function apkUpdateNotificationId(build: number): number {
  return 1_867_000_000 + (build % 100_000)
}
