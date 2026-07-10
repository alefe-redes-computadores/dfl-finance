'use client'

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { Building2, User } from 'lucide-react'

type Context = 'dfl' | 'personal'

interface ContextCtx {
  context: Context
  setContext: (c: Context) => void
  appMode: 'personal_only' | 'full' | null
  setAppMode: (m: 'personal_only' | 'full') => void
  // 🔥 NOVO: contexto efetivo (já calculado)
  effectiveContext: Context
}

const ContextCtx = createContext<ContextCtx>({
  context: 'dfl',
  setContext: () => {},
  appMode: null,
  setAppMode: () => {},
  effectiveContext: 'dfl', // 🔥 NOVO
})

export const useContext_ = () => useContext(ContextCtx)

// Função auxiliar para sincronizar o cookie (usado pelo middleware)
const setAppModeCookie = (mode: 'personal_only' | 'full') => {
  if (typeof document !== 'undefined') {
    document.cookie = `dfl_app_mode=${mode}; path=/; max-age=${60 * 60 * 24 * 30}` // 30 dias
  }
}

export function ContextProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
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

  // 🔥 NOVO: effectiveContext calculado automaticamente
  const effectiveContext: Context = appMode === 'personal_only' ? 'personal' : context

  useEffect(() => {
    if (!user?.id) return
    if (hasSynced.current) return

    const cached = localStorage.getItem('dfl_app_mode')
    if (cached === 'personal_only' || cached === 'full') {
      hasSynced.current = true
      return
    }

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
          setAppModeCookie(data.app_mode)
          setContextState(data.app_mode === 'personal_only' ? 'personal' : 'dfl')
        } else {
          setAppModeState('full')
          localStorage.setItem('dfl_app_mode', 'full')
          setAppModeCookie('full')
          setContextState('dfl')
        }
      } catch (err) {
        console.error('Erro na sincronização:', err)
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
    setAppModeCookie(mode)
    if (mode === 'personal_only') {
      setContextState('personal')
    } else {
      setContextState('dfl')
    }
  }

  return (
    <ContextCtx.Provider value={{
      context,
      setContext,
      appMode,
      setAppMode,
      effectiveContext, // 🔥 EXPORTA o effectiveContext!
    }}>
      {children}
    </ContextCtx.Provider>
  )
}

export default function ContextToggle() {
  const { context, setContext, appMode } = useContext_()

  // 🔥 Se for personal_only, NÃO RENDERIZA NADA
  if (appMode !== 'full') return null

  return (
    <div className="inline-flex mt-1">
      <div className="flex bg-gray-100 dark:bg-slate-700 p-0.5 rounded-full">
        <button
          onClick={() => setContext('dfl')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide transition-all duration-300 ${
            context === 'dfl'
              ? 'bg-white dark:bg-slate-600 shadow-sm text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>PJ</span>
        </button>
        <button
          onClick={() => setContext('personal')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide transition-all duration-300 ${
            context === 'personal'
              ? 'bg-white dark:bg-slate-600 shadow-sm text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>PF</span>
        </button>
      </div>
    </div>
  )
}