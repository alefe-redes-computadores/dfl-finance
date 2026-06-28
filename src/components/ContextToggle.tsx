'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
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
  const [context, setContextState] = useState<Context>('dfl')
  const [appMode, setAppModeState] = useState<'personal_only' | 'full' | null>(null)

  useEffect(() => {
    const savedMode = localStorage.getItem('dfl_app_mode') as 'personal_only' | 'full' | null
    if (savedMode) {
      setAppModeState(savedMode)
      if (savedMode === 'personal_only') {
        setContextState('personal')
      }
    }
  }, [])

    useEffect(() => {
    // Carrega do Supabase APENAS SE o localStorage estiver vazio
    async function loadInitialSettings() {
      if (!user?.id || localStorage.getItem('dfl_app_mode')) return; 
      
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('app_mode')
          .eq('user_id', user.id)
          .single();

        if (data?.app_mode) {
          setAppModeState(data.app_mode);
          localStorage.setItem('dfl_app_mode', data.app_mode);
          if (data.app_mode === 'personal_only') setContextState('personal');
        }
      } catch (err) {
        console.error('Erro:', err);
      }
    }
    loadInitialSettings();
  }, [user?.id]);


  function setContext(c: Context) {
    if (appMode === 'personal_only') return
    setContextState(c)
  }

  function setAppMode(mode: 'personal_only' | 'full') {
    setAppModeState(mode)
    if (mode === 'personal_only') {
      setContextState('personal')
    }
  }

  return (
    <ContextCtx.Provider value={{ context, setContext, appMode, setAppMode }}>
      {children}
    </ContextCtx.Provider>
  )
}

export default function ContextToggle() {
  const { context, setContext, appMode } = useContext_()

  if (appMode !== 'full') return null

  return (
    <div className="flex justify-center my-2">
      <div className={`flex bg-gray-200 dark:bg-slate-700 p-1 rounded-full ${montserrat.className}`}>
        <button
          onClick={() => setContext('dfl')}
          className={`px-5 py-1.5 rounded-full text-[11px] font-extralight uppercase tracking-tighter transition-all duration-300 ${
            context === 'dfl'
              ? 'bg-white dark:bg-slate-600 shadow-[0_2px_10px_rgba(0,0,0,0.1)] scale-[1.02] text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Pessoa Jurídica
        </button>
        <button
          onClick={() => setContext('personal')}
          className={`px-5 py-1.5 rounded-full text-[11px] font-extralight uppercase tracking-tighter transition-all duration-300 ${
            context === 'personal'
              ? 'bg-white dark:bg-slate-600 shadow-[0_2px_10px_rgba(0,0,0,0.1)] scale-[1.02] text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Pessoa Física
        </button>
      </div>
    </div>
  )
}
