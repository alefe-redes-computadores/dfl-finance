// src/components/ContextToggle.tsx
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { supabase } from '@/lib/supabase'
import {
  getCachedUserSettings,
  loadUserSettings,
  saveUserSettings,
  subscribeToUserSettings,
  type AppMode,
} from '@/lib/userSettings'

type Context = 'dfl' | 'personal'

interface ContextCtx {
  context: Context
  setContext: (c: Context) => void
  appMode: AppMode | null
  setAppMode: (m: AppMode) => void
  effectiveContext: Context
}

const ContextCtx = createContext<ContextCtx>({
  context: 'dfl',
  setContext: () => {},
  appMode: null,
  setAppMode: () => {},
  effectiveContext: 'dfl',
})

export const useContext_ = () => useContext(ContextCtx)

export function ContextProvider({ children }: { children: React.ReactNode }) {
  const [appMode, setAppModeState] = useState<AppMode | null>(null)
  const [context, setContextState] = useState<Context>('dfl')
  const [userId, setUserId] = useState<string | null>(null)

  const applyAppMode = (mode: AppMode, resetContext = false) => {
    setAppModeState(mode)

    if (typeof window !== 'undefined') {
      localStorage.setItem('dfl_app_mode', mode)
    }

    setContextState((current) => {
      if (mode === 'personal_only') return 'personal'
      if (resetContext) return 'dfl'
      return current
    })
  }

  useEffect(() => {
    const cachedMode =
      typeof window !== 'undefined'
        ? localStorage.getItem('dfl_app_mode')
        : null

    const initialMode: AppMode =
      cachedMode === 'personal_only' ? 'personal_only' : 'full'

    applyAppMode(initialMode, true)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUserId(data?.session?.user?.id || null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user?.id || null)
      }
    )

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    const cached = getCachedUserSettings(userId)
    applyAppMode(cached.app_mode, true)

    let active = true

    loadUserSettings(userId).then((result) => {
      if (!active) return
      applyAppMode(result.settings.app_mode, true)
    })

    const unsubscribe = subscribeToUserSettings((settings) => {
      if (settings.user_id !== userId) return
      applyAppMode(settings.app_mode)
    })

    const handleOnline = () => {
      loadUserSettings(userId).then((result) => {
        if (!active) return
        applyAppMode(result.settings.app_mode)
      })
    }

    window.addEventListener('online', handleOnline)

    return () => {
      active = false
      unsubscribe()
      window.removeEventListener('online', handleOnline)
    }
  }, [userId])

  const effectiveContext: Context =
    appMode === 'personal_only' ? 'personal' : context

  return (
    <ContextCtx.Provider
      value={{
        context,
        setContext: (nextContext) => {
          if (appMode !== 'personal_only') {
            setContextState(nextContext)
          }
        },
        appMode,
        setAppMode: (mode) => {
          applyAppMode(mode)

          if (userId) {
            void saveUserSettings(userId, { app_mode: mode })
          }
        },
        effectiveContext,
      }}
    >
      {children}
    </ContextCtx.Provider>
  )
}

export default function ContextToggle() {
  const { context, setContext, appMode } = useContext_()
  const [mounted, setMounted] = useState(false)
  const { vibrate } = useHapticFeedback()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleToggle = (newContext: Context) => {
    if (context !== newContext) {
      vibrate([10])
      setContext(newContext)
    }
  }

  if (!mounted || appMode === null) {
    return (
      <div className="h-10 w-[148px] rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm animate-pulse" />
    )
  }

  if (appMode === 'personal_only') return null

  return (
    <div className="inline-flex h-10 items-center rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-sm shrink-0 transition-colors duration-300">
      <button
        type="button"
        onClick={() => handleToggle('dfl')}
        className={`h-8 px-3 rounded-[14px] text-[13px] font-semibold transition-all duration-200 active:scale-[0.98] ${
          context === 'dfl'
            ? 'bg-gray-900 dark:bg-slate-700 text-white dark:text-gray-100 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-700 dark:hover:text-gray-200'
        }`}
      >
        Empresa
      </button>

      <button
        type="button"
        onClick={() => handleToggle('personal')}
        className={`h-8 px-3 rounded-[14px] text-[13px] font-semibold transition-all duration-200 active:scale-[0.98] ${
          context === 'personal'
            ? 'bg-gray-900 dark:bg-slate-700 text-white dark:text-gray-100 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-700 dark:hover:text-gray-200'
        }`}
      >
        Pessoal
      </button>
    </div>
  )
}
