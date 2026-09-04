// src/hooks/useUserSettings.ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  getCachedUserSettings,
  loadUserSettings,
  saveUserSettings,
  subscribeToUserSettings,
  type UserSettingsPatch,
  type UserSettingsSaveResult,
  type UserSettingsSnapshot,
} from '@/lib/userSettings'

export function useUserSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<UserSettingsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setSettings(null)
      setLoading(false)
      return null
    }

    const cached = getCachedUserSettings(user.id)
    setSettings(cached)
    setLoading(true)

    const result = await loadUserSettings(user.id)
    setSettings(result.settings)
    setLoading(false)

    return result
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      setSettings(null)
      setLoading(false)
      return
    }

    const cached = getCachedUserSettings(user.id)
    setSettings(cached)
    setLoading(true)

    let active = true

    loadUserSettings(user.id).then((result) => {
      if (!active) return
      setSettings(result.settings)
      setLoading(false)
    })

    const unsubscribe = subscribeToUserSettings((nextSettings) => {
      if (nextSettings.user_id !== user.id) return
      setSettings(nextSettings)
    })

    const handleOnline = () => {
      loadUserSettings(user.id).then((result) => {
        if (!active) return
        setSettings(result.settings)
      })
    }

    window.addEventListener('online', handleOnline)

    return () => {
      active = false
      unsubscribe()
      window.removeEventListener('online', handleOnline)
    }
  }, [user?.id])

  const updateSettings = useCallback(
    async (patch: UserSettingsPatch): Promise<UserSettingsSaveResult> => {
      if (!user?.id) {
        throw new Error('Usuário não autenticado.')
      }

      const result = await saveUserSettings(user.id, patch)
      setSettings(result.settings)
      return result
    },
    [user?.id]
  )

  return {
    settings,
    loading,
    refresh,
    updateSettings,
  }
}
