import type { UserSettingsSnapshot } from '@/lib/userSettings'

type DefaultAccountCandidate = { id?: string; context?: string; is_archived?: boolean | null }
export type AccountContext = 'dfl' | 'personal'

export function validDefaultAccountId(
  settings: Pick<UserSettingsSnapshot, 'preferences'> | null | undefined,
  context: AccountContext,
  accounts: readonly DefaultAccountCandidate[] | null | undefined,
): string {
  const configured = settings?.preferences?.default_accounts?.[context]
  if (typeof configured !== 'string' || !configured.trim() || !Array.isArray(accounts)) return ''
  return accounts.some((a) => a?.id === configured && a.context === context && a.is_archived !== true)
    ? configured : ''
}

export function defaultAccountPatch(
  settings: Pick<UserSettingsSnapshot, 'preferences'> | null | undefined,
  context: AccountContext,
  id: string,
) {
  return {
    default_accounts: {
      dfl: String(settings?.preferences?.default_accounts?.dfl || ''),
      personal: String(settings?.preferences?.default_accounts?.personal || ''),
      [context]: id,
    },
  }
}
