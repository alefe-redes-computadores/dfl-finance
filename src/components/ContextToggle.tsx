'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { Montserrat } from 'next/font/google'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['200', '400', '700'],
  display: 'swap',
})

type Context = 'dfl' | 'personal'

interface ContextCtx {
  context: Context
  setContext: (c: Context) => void
  appMode: 'personal_only' | 'full' | null
  setAppMode: (m: 'personal_only' | 'full') => void
}

const ContextCtx = createContext<ContextCtx>({
  context: 'dfl',
  setContext: () => {},
  appMode: null,
  setAppMode: () => {},
})

export const useContext_ = () => useContext(ContextCtx)

export function ContextProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [context, setContext] = useState<Context>('dfl')
  const [appMode, setAppModeState] = useState<'personal_only' | 'full' | null>(null)

  // Carrega a preferência do usuário do Supabase
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('user_settings')
      .select('app_mode')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        const mode = data?.app_mode || 'full'
        setAppModeState(mode)
        if (mode === 'personal_only') {
          setContext('personal')
        }
      })
  }, [user?.id])

  const setAppMode = useCallback(async (mode: 'personal_only' | 'full') => {
    if (!user?.id) return
    setAppModeState(mode)
    if (mode === 'personal_only') {
      setContext('personal')
    }
    await supabase.from('user_settings').upsert({
      user_id: user.id,
      app_mode: mode,
      updated_at: new Date().toISOString(),
    })
  }, [user?.id])

  return (
    <ContextCtx.Provider value={{ context, setContext, appMode, setAppMode }}>
      {children}
    </ContextCtx.Provider>
  )
}

// Componente visual do toggle
export default function ContextToggle() {
  const { context, setContext, appMode } = useContext_()

  // Se o modo for "apenas PF", não renderiza o toggle
  if (appMode === 'personal_only') return null

  return (
    <div className={`flex bg-gray-200 dark:bg-slate-700 p-1 rounded-full ${montserrat.className}`}>
      <button
        onClick={() => setContext('dfl')}
        className={`flex-1 py-1.5 px-3 rounded-full text-[11px] font-extralight uppercase tracking-tighter transition-all duration-300 ${
          context === 'dfl'
            ? 'bg-white dark:bg-slate-600 shadow-[0_2px_10px_rgba(0,0,0,0.1)] scale-[1.02] text-gray-900 dark:text-gray-100'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        Pessoa Jurídica
      </button>
      <button
        onClick={() => setContext('personal')}
        className={`flex-1 py-1.5 px-3 rounded-full text-[11px] font-extralight uppercase tracking-tighter transition-all duration-300 ${
          context === 'personal'
            ? 'bg-white dark:bg-slate-600 shadow-[0_2px_10px_rgba(0,0,0,0.1)] scale-[1.02] text-gray-900 dark:text-gray-100'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        Pessoa Física
      </button>
    </div>
  )
}