'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

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

  // 🔥 Skeleton atualizado
  if (!mounted) {
    return (
      <div className="h-10 w-[148px] rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm animate-pulse" />
    )
  }

  if (appMode === 'personal_only') return null

  // 🔥 Seletor refatorado
  return (
    <div className="inline-flex h-10 items-center rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-sm shrink-0 transition-colors duration-300">
      <button
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