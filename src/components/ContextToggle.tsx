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

  if (!mounted) {
    return <div className="w-[120px] h-[32px] bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
  }

  if (appMode === 'personal_only') return null

  return (
    <div className="inline-flex bg-[#f0f2f5] dark:bg-slate-800/80 backdrop-blur-md rounded-full p-0.5 gap-0.5 border border-gray-100 dark:border-slate-700/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] shrink-0 transition-colors duration-300">
      <button
        onClick={() => handleToggle('dfl')}
        className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-all duration-300 active:scale-[0.95] ${
          context === 'dfl'
            ? 'bg-white dark:bg-slate-600 text-teal-700 dark:text-teal-400 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        Empresa
      </button>
      <button
        onClick={() => handleToggle('personal')}
        className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-all duration-300 active:scale-[0.95] ${
          context === 'personal'
            ? 'bg-white dark:bg-slate-600 text-teal-700 dark:text-teal-400 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        Pessoal
      </button>
    </div>
  )
}
