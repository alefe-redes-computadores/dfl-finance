'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { Montserrat } from 'next/font/google'
import { X } from 'lucide-react'

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
          setContextState('personal')
        }
      })
  }, [user?.id])

  const setContext = useCallback((c: Context) => {
    if (appMode === 'personal_only') {
      setContextState('personal')
      return
    }
    setContextState(c)
  }, [appMode])

  const setAppMode = useCallback(async (mode: 'personal_only' | 'full') => {
    setAppModeState(mode)
    if (mode === 'personal_only') {
      setContextState('personal')
    }
    if (!user?.id) return
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
  const { context, setContext, appMode, setAppMode } = useContext_()
  const [showActivateModal, setShowActivateModal] = useState(false)

  // Se for null (carregando), não renderiza nada ainda
  if (appMode === null) return null

  const isLocked = appMode === 'personal_only'

  const handleContextClick = (c: Context) => {
    if (isLocked) {
      setShowActivateModal(true)
      return
    }
    setContext(c)
  }

  const handleActivate = () => {
    setAppMode('full')
    setShowActivateModal(false)
    setContext('dfl') // já que ele quer usar PJ
  }

  return (
    <>
      <div className={`flex bg-gray-200 dark:bg-slate-700 p-1 rounded-full ${montserrat.className} ${isLocked ? 'opacity-60' : ''}`}>
        <button
          onClick={() => handleContextClick('dfl')}
          disabled={isLocked}
          className={`flex-1 py-1.5 px-3 rounded-full text-[11px] font-extralight uppercase tracking-tighter transition-all duration-300 ${
            context === 'dfl'
              ? 'bg-white dark:bg-slate-600 shadow-[0_2px_10px_rgba(0,0,0,0.1)] scale-[1.02] text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          } ${isLocked ? 'cursor-pointer' : ''}`}
        >
          Pessoa Jurídica
        </button>
        <button
          onClick={() => handleContextClick('personal')}
          disabled={isLocked}
          className={`flex-1 py-1.5 px-3 rounded-full text-[11px] font-extralight uppercase tracking-tighter transition-all duration-300 ${
            context === 'personal'
              ? 'bg-white dark:bg-slate-600 shadow-[0_2px_10px_rgba(0,0,0,0.1)] scale-[1.02] text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          } ${isLocked ? 'cursor-pointer' : ''}`}
        >
          Pessoa Física
        </button>
      </div>

      {/* Modal de ativação do modo PJ */}
      {showActivateModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-6" onClick={() => setShowActivateModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Ativar Pessoa Jurídica</h3>
              <button onClick={() => setShowActivateModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Você está no modo apenas Pessoa Física. Deseja ativar o modo Pessoa Jurídica para gerenciar também suas finanças empresariais?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowActivateModal(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleActivate}
                className="flex-1 py-3 bg-teal-700 text-white rounded-xl font-bold"
              >
                Ativar PJ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}