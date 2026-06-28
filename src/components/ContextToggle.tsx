'use client'

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
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
  // Controla se o sync inicial já foi feito nesta sessão de browser
  const hasSynced = useRef(false)

  const [appMode, setAppModeState] = useState<'personal_only' | 'full' | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('dfl_app_mode')
      return (cached as 'personal_only' | 'full') || null
    }
    return null
  })

  const [context, setContextState] = useState<Context>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dfl_app_mode') === 'personal_only' ? 'personal' : 'dfl'
    }
    return 'dfl'
  })

  useEffect(() => {
    // Só busca do Supabase UMA VEZ por sessão de browser
    // e apenas se não houver valor em cache (primeiro acesso / dispositivo novo)
    if (!user?.id) return
    if (hasSynced.current) return

    const cached = localStorage.getItem('dfl_app_mode')

    // Se já tem cache local, confia nele — não vai ao banco
    if (cached === 'personal_only' || cached === 'full') {
      hasSynced.current = true
      return
    }

    // Sem cache: busca do Supabase para saber a preferência salva
    async function fetchFromSupabase() {
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('app_mode')
          .eq('user_id', user!.id)
          .single()

        if (data?.app_mode) {
          setAppModeState(data.app_mode)
          localStorage.setItem('dfl_app_mode', data.app_mode)
          setContextState(data.app_mode === 'personal_only' ? 'personal' : 'dfl')
        } else {
          // Sem registro no banco → padrão 'full'
          setAppModeState('full')
          localStorage.setItem('dfl_app_mode', 'full')
          setContextState('dfl')
        }
      } catch (err) {
        console.error('Erro na sincronização:', err)
        // Fallback seguro
        setAppModeState('full')
        setContextState('dfl')
      } finally {
        hasSynced.current = true
      }
    }

    fetchFromSupabase()
  }, [user?.id])

  function setContext(c: Context) {
    if (appMode === 'personal_only') return
    setContextState(c)
  }

  function setAppMode(mode: 'personal_only' | 'full') {
    setAppModeState(mode)
    localStorage.setItem('dfl_app_mode', mode)
    if (mode === 'personal_only') {
      setContextState('personal')
    } else {
      setContextState('dfl')
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