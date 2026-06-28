'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/contexts/ToastContext'
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
  const { showToast } = useToast()
  const [context, setContextState] = useState<Context>('dfl')
  const [appMode, setAppModeState] = useState<'personal_only' | 'full' | null>(null)

  // Carrega a preferência do usuário UMA VEZ quando o usuário estiver pronto
  useEffect(() => {
    if (!user?.id) return
    
    supabase
      .from('user_settings')
      .select('app_mode')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setAppModeState('full')
          return
        }
        const mode = data?.app_mode || 'full'
        setAppModeState(mode)
        if (mode === 'personal_only') {
          setContextState('personal')
        }
      })
  }, [user?.id])

  function setContext(c: Context) {
    if (appMode === 'personal_only') return
    setContextState(c)
  }

  async function setAppMode(mode: 'personal_only' | 'full') {
    setAppModeState(mode)
    if (mode === 'personal_only') {
      setContextState('personal')
    }

    if (!user?.id) {
      showToast('Sessão expirada. Faça login novamente.', 'error')
      return
    }

    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      app_mode: mode,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      showToast(`Erro ao salvar: ${error.message}`, 'error')
      setAppModeState(mode === 'full' ? 'personal_only' : 'full')
      if (mode === 'full') {
        setContextState('personal')
      }
    } else {
      showToast(
        mode === 'full' 
          ? 'Modo Pessoa Jurídica ativado' 
          : 'Modo apenas Pessoa Física ativado', 
        'success'
      )
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