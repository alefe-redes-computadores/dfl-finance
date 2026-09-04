// src/lib/userSettings.ts
import { supabase } from '@/lib/supabase'

export type ThemePreference = 'light' | 'dark'
export type AppMode = 'full' | 'personal_only'

export interface UserPreferences {
  ai_enabled: boolean
  auto_categorize: boolean
  weekly_report: boolean
  monthly_report: boolean
  push_notifications: boolean
  email_summary: boolean
  language: 'pt-BR'
  share_usage_data: boolean
  [key: string]: unknown
}

export interface UserSettingsSnapshot {
  user_id: string
  theme: ThemePreference
  app_mode: AppMode
  preferences: UserPreferences
  updated_at: string | null
}

export interface UserSettingsPatch {
  theme?: ThemePreference
  app_mode?: AppMode
  preferences?: Partial<UserPreferences>
}

export interface UserSettingsSaveResult {
  settings: UserSettingsSnapshot
  synced: boolean
  error?: string
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  ai_enabled: true,
  auto_categorize: true,
  weekly_report: true,
  monthly_report: true,
  push_notifications: true,
  email_summary: false,
  language: 'pt-BR',
  share_usage_data: false,
}

const THEME_KEY = 'theme'
const APP_MODE_KEY = 'dfl_app_mode'
const LEGACY_NOTIFICATIONS_KEY = 'dfl_notifications_enabled'
const SETTINGS_EVENT = 'dfl:user-settings-changed'

const writeChains = new Map<string, Promise<void>>()
const loadPromises = new Map<string, Promise<UserSettingsSaveResult>>()

function coreKey(userId: string) {
  return `dfl_user_settings_core_${userId}`
}

function preferencesKey(userId: string) {
  return `dfl_user_preferences_${userId}`
}

function pendingKey(userId: string) {
  return `dfl_user_settings_pending_${userId}`
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function normalizeTheme(value: unknown): ThemePreference {
  return value === 'dark' ? 'dark' : 'light'
}

function normalizeAppMode(value: unknown): AppMode {
  return value === 'personal_only' ? 'personal_only' : 'full'
}

function normalizePreferences(value: unknown): UserPreferences {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  return {
    ...DEFAULT_USER_PREFERENCES,
    ...raw,
    ai_enabled:
      typeof raw.ai_enabled === 'boolean'
        ? raw.ai_enabled
        : DEFAULT_USER_PREFERENCES.ai_enabled,
    auto_categorize:
      typeof raw.auto_categorize === 'boolean'
        ? raw.auto_categorize
        : DEFAULT_USER_PREFERENCES.auto_categorize,
    weekly_report:
      typeof raw.weekly_report === 'boolean'
        ? raw.weekly_report
        : DEFAULT_USER_PREFERENCES.weekly_report,
    monthly_report:
      typeof raw.monthly_report === 'boolean'
        ? raw.monthly_report
        : DEFAULT_USER_PREFERENCES.monthly_report,
    push_notifications:
      typeof raw.push_notifications === 'boolean'
        ? raw.push_notifications
        : DEFAULT_USER_PREFERENCES.push_notifications,
    email_summary:
      typeof raw.email_summary === 'boolean'
        ? raw.email_summary
        : DEFAULT_USER_PREFERENCES.email_summary,
    language: 'pt-BR',
    share_usage_data:
      typeof raw.share_usage_data === 'boolean'
        ? raw.share_usage_data
        : DEFAULT_USER_PREFERENCES.share_usage_data,
  }
}

function dispatchSettingsChanged(settings: UserSettingsSnapshot) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<UserSettingsSnapshot>(SETTINGS_EVENT, {
      detail: settings,
    })
  )
}

export function getCachedUserSettings(userId: string): UserSettingsSnapshot {
  const defaultSnapshot: UserSettingsSnapshot = {
    user_id: userId,
    theme: 'light',
    app_mode: 'full',
    preferences: { ...DEFAULT_USER_PREFERENCES },
    updated_at: null,
  }

  if (!canUseStorage()) return defaultSnapshot

  const cachedCore = safeParse<{
    theme?: unknown
    app_mode?: unknown
    updated_at?: unknown
  }>(localStorage.getItem(coreKey(userId)))

  const cachedPreferences = safeParse<Record<string, unknown>>(
    localStorage.getItem(preferencesKey(userId))
  )

  const legacyNotifications = localStorage.getItem(LEGACY_NOTIFICATIONS_KEY)

  const preferences = normalizePreferences({
    ...(cachedPreferences || {}),
    ...(legacyNotifications !== null &&
    cachedPreferences?.push_notifications === undefined
      ? { push_notifications: legacyNotifications !== 'false' }
      : {}),
  })

  return {
    user_id: userId,
    theme: normalizeTheme(
      cachedCore?.theme ?? localStorage.getItem(THEME_KEY)
    ),
    app_mode: normalizeAppMode(
      cachedCore?.app_mode ?? localStorage.getItem(APP_MODE_KEY)
    ),
    preferences,
    updated_at:
      typeof cachedCore?.updated_at === 'string'
        ? cachedCore.updated_at
        : null,
  }
}

export function cacheUserSettings(
  settings: UserSettingsSnapshot,
  emit = false
) {
  if (canUseStorage()) {
    localStorage.setItem(THEME_KEY, settings.theme)
    localStorage.setItem(APP_MODE_KEY, settings.app_mode)
    localStorage.setItem(
      coreKey(settings.user_id),
      JSON.stringify({
        theme: settings.theme,
        app_mode: settings.app_mode,
        updated_at: settings.updated_at,
      })
    )
    localStorage.setItem(
      preferencesKey(settings.user_id),
      JSON.stringify(settings.preferences)
    )
    localStorage.setItem(
      LEGACY_NOTIFICATIONS_KEY,
      String(settings.preferences.push_notifications)
    )
  }

  if (emit) {
    dispatchSettingsChanged(settings)
  }
}

function getPendingSettings(userId: string): UserSettingsSnapshot | null {
  if (!canUseStorage()) return null
  return safeParse<UserSettingsSnapshot>(localStorage.getItem(pendingKey(userId)))
}

function clearPendingSettings(userId: string) {
  if (!canUseStorage()) return
  localStorage.removeItem(pendingKey(userId))
}

function mergeSettings(
  current: UserSettingsSnapshot,
  patch: UserSettingsPatch
): UserSettingsSnapshot {
  return {
    ...current,
    theme: patch.theme ?? current.theme,
    app_mode: patch.app_mode ?? current.app_mode,
    preferences: patch.preferences
      ? normalizePreferences({
          ...current.preferences,
          ...patch.preferences,
        })
      : current.preferences,
    updated_at: new Date().toISOString(),
  }
}

async function persistSnapshot(
  settings: UserSettingsSnapshot
): Promise<{ synced: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('user_settings').upsert(
      {
        user_id: settings.user_id,
        theme: settings.theme,
        app_mode: settings.app_mode,
        preferences: settings.preferences,
        updated_at: settings.updated_at || new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      return { synced: false, error: error.message }
    }

    return { synced: true }
  } catch (error: any) {
    return {
      synced: false,
      error: error?.message || 'Falha ao sincronizar configurações.',
    }
  }
}

async function persistSnapshotSerialized(
  settings: UserSettingsSnapshot
): Promise<{ synced: boolean; error?: string }> {
  const previous = writeChains.get(settings.user_id) || Promise.resolve()

  let remoteResult: { synced: boolean; error?: string } = {
    synced: false,
  }

  const current = previous
    .catch(() => undefined)
    .then(async () => {
      remoteResult = await persistSnapshot(settings)
    })

  writeChains.set(settings.user_id, current)

  await current

  if (writeChains.get(settings.user_id) === current) {
    writeChains.delete(settings.user_id)
  }

  return remoteResult
}


export async function saveUserSettings(
  userId: string,
  patch: UserSettingsPatch
): Promise<UserSettingsSaveResult> {
  const cached = getCachedUserSettings(userId)
  const pending = getPendingSettings(userId)

  const base = pending
    ? {
        ...cached,
        ...pending,
        preferences: normalizePreferences({
          ...cached.preferences,
          ...pending.preferences,
        }),
      }
    : cached

  const next = mergeSettings(base, patch)

  cacheUserSettings(next, true)

  if (canUseStorage()) {
    localStorage.setItem(pendingKey(userId), JSON.stringify(next))
  }

  const remote = await persistSnapshotSerialized(next)

  if (remote.synced) {
    clearPendingSettings(userId)
  }

  return {
    settings: next,
    synced: remote.synced,
    error: remote.error,
  }
}

export async function flushPendingUserSettings(
  userId: string
): Promise<UserSettingsSaveResult | null> {
  const pending = getPendingSettings(userId)

  if (!pending) return null

  const normalized: UserSettingsSnapshot = {
    ...pending,
    user_id: userId,
    theme: normalizeTheme(pending.theme),
    app_mode: normalizeAppMode(pending.app_mode),
    preferences: normalizePreferences(pending.preferences),
    updated_at: pending.updated_at || new Date().toISOString(),
  }

  const remote = await persistSnapshotSerialized(normalized)

  if (remote.synced) {
    clearPendingSettings(userId)
    cacheUserSettings(normalized, true)
  }

  return {
    settings: normalized,
    synced: remote.synced,
    error: remote.error,
  }
}

async function loadUserSettingsInternal(
  userId: string
): Promise<UserSettingsSaveResult> {
  const cached = getCachedUserSettings(userId)

  const flushed = await flushPendingUserSettings(userId)

  if (flushed && !flushed.synced) {
    return flushed
  }

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('user_id, theme, app_mode, preferences, updated_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      return {
        settings: cached,
        synced: false,
        error: error.message,
      }
    }

    if (!data) {
      const created: UserSettingsSnapshot = {
        ...cached,
        updated_at: new Date().toISOString(),
      }

      const remote = await persistSnapshotSerialized(created)

      if (!remote.synced && canUseStorage()) {
        localStorage.setItem(pendingKey(userId), JSON.stringify(created))
      }

      cacheUserSettings(created, true)

      return {
        settings: created,
        synced: remote.synced,
        error: remote.error,
      }
    }

    const settings: UserSettingsSnapshot = {
      user_id: userId,
      theme: normalizeTheme(data.theme),
      app_mode: normalizeAppMode(data.app_mode),
      preferences: normalizePreferences(data.preferences),
      updated_at:
        typeof data.updated_at === 'string' ? data.updated_at : null,
    }

    cacheUserSettings(settings, true)

    return {
      settings,
      synced: true,
    }
  } catch (error: any) {
    return {
      settings: cached,
      synced: false,
      error: error?.message || 'Falha ao carregar configurações.',
    }
  }
}


export async function loadUserSettings(
  userId: string
): Promise<UserSettingsSaveResult> {
  const existing = loadPromises.get(userId)
  if (existing) return existing

  const request = loadUserSettingsInternal(userId)
  loadPromises.set(userId, request)

  try {
    return await request
  } finally {
    if (loadPromises.get(userId) === request) {
      loadPromises.delete(userId)
    }
  }
}

export function subscribeToUserSettings(
  listener: (settings: UserSettingsSnapshot) => void
) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<UserSettingsSnapshot>
    if (customEvent.detail) {
      listener(customEvent.detail)
    }
  }

  window.addEventListener(SETTINGS_EVENT, handler)

  return () => {
    window.removeEventListener(SETTINGS_EVENT, handler)
  }
}
