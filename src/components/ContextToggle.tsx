'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { Building2, User } from 'lucide-react'

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

// O BOTÃO VISUAL QUE FALTAVA!
export default function ContextToggle() {
  const { context, setContext, appMode } = useContext_()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Proteção contra erro de hidratação: mostra um "esqueleto" até carregar
  if (!mounted) {
    return <div className="w-[70px] h-[34px] bg-gray-200 dark:bg-slate-700 animate-pulse rounded-[16px]"></div>
  }

  if (appMode === 'personal_only') return null

  const isDfl = context === 'dfl'

  return (
    <button
      onClick={() => setContext(isDfl ? 'personal' : 'dfl')}
      className="flex items-center gap-2 bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700/50 px-3 py-1.5 rounded-[16px] transition-colors"
    >
      {isDfl ? (
        <>
          <Building2 size={16} className="text-blue-500" />
          <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">PJ</span>
        </>
      ) : (
        <>
          <User size={16} className="text-emerald-500" />
          <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">PF</span>
        </>
      )}
    </button>
  )
}
