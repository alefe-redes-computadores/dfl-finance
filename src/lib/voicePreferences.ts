// R412: preferência exclusivamente local, sem vincular áudio aos dados financeiros.
export const VOICE_PREFERENCE_KEY = 'dfl.finance.voice-fab.enabled.v1'
export const VOICE_PREFERENCE_EVENT = 'dfl.finance.voice-fab.change'

export function financialVoiceFabEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try { return window.localStorage.getItem(VOICE_PREFERENCE_KEY) !== 'off' }
  catch { return true }
}

export function setFinancialVoiceFabEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(VOICE_PREFERENCE_KEY, enabled ? 'on' : 'off') }
  catch { /* preferência opcional: continua funcional sem storage */ }
  window.dispatchEvent(new Event(VOICE_PREFERENCE_EVENT))
}
