'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function AppRouteError({ reset }: { reset: () => void }) {
  return (
    <main className="app-page flex min-h-[70dvh] items-center justify-center px-4 py-10">
      <section className="app-surface w-full max-w-md p-6 text-center" role="alert">
        <div className="app-icon-surface mx-auto mb-4 text-amber-600 dark:text-amber-400">
          <AlertTriangle size={24} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Não foi possível abrir esta tela</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Seus dados locais continuam preservados. Tente carregar esta área novamente.
        </p>
        <button type="button" onClick={reset} className="app-primary-action mt-6 w-full gap-2">
          <RefreshCw size={18} />
          Tentar novamente
        </button>
      </section>
    </main>
  )
}
