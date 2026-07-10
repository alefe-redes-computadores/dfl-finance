'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

type Context = 'dfl' | 'personal'

interface ContextCtx {
  context: Context
  setContext: (c: Context) => void
  appMode: 'personal_only' | 'full' | null
  setAppMode: (m: 'personal_only' | 'full') => void
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
  const [appMode, setAppModeState] = useState<'personal_only' | 'full' | null>(null)
  const [context, setContextState] = useState<Context>('dfl')

  useEffect(() => {
    const cached = localStorage.getItem('dfl_app_mode') as 'personal_only' | 'full' | null
    if (cached) {
      setAppModeState(cached)
      setContextState(cached === 'personal_only' ? 'personal' : 'dfl')
    } else {
      setAppModeState('full')
      setContextState('dfl')
    }
  }, [])

  const effectiveContext: Context = appMode === 'personal_only' ? 'personal' : context

  return (
    <ContextCtx.Provider value={{
      context,
      setContext: (c) => appMode !== 'personal_only' && setContextState(c),
      appMode,
      setAppMode: (mode) => {
        setAppModeState(mode)
        localStorage.setItem('dfl_app_mode', mode)
        setContextState(mode === 'personal_only' ? 'personal' : 'dfl')
      },
      effectiveContext,
    }}>
      {children}
    </ContextCtx.Provider>
  )
}

export default function ContextToggle() {
  const { context, setContext, appMode } = useContext_()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="w-[100px] h-[32px] bg-gray-200 dark:bg-zinc-800 rounded-full animate-pulse" />
  }

  if (appMode === 'personal_only') return null

  return (
    <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-full p-1 gap-1">
      <button
        onClick={() => setContext('dfl')}
        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
          context === 'dfl'
            ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        PJ
      </button>
      <button
        onClick={() => setContext('personal')}
        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
          context === 'personal'
            ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        PF
      </button>
    </div>
  )
}
