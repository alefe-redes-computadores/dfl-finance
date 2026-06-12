'use client'

import { useState, createContext, useContext } from 'react'

type Context = 'dfl' | 'personal'

const ContextCtx = createContext<{
  context: Context
  setContext: (c: Context) => void
}>({ context: 'dfl', setContext: () => {} })

export function ContextProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<Context>('dfl')
  return (
    <ContextCtx.Provider value={{ context, setContext }}>
      {children}
    </ContextCtx.Provider>
  )
}

export function useContext_() {
  return useContext(ContextCtx)
}

export default function ContextToggle() {
  const { context, setContext } = useContext(ContextCtx)

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
        DFL
      </button>
      <button
        onClick={() => setContext('personal')}
        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
          context === 'personal'
            ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        Pessoal
      </button>
    </div>
  )
}
