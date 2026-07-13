'use client'

import { useAuthDeepLink } from '@/lib/hooks/useAuthDeepLink'
import { CheckCircle2, Loader2 } from 'lucide-react'

export function DeepLinkListener() {
  const { isProcessing } = useAuthDeepLink()

  if (!isProcessing) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50/90 dark:bg-zinc-950/90 backdrop-blur-md transition-all duration-300">
      <div className="bg-white dark:bg-zinc-900 border border-teal-500/20 p-8 rounded-[2rem] shadow-2xl flex flex-col items-center max-w-sm w-[90%] text-center animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-teal-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <CheckCircle2 className="w-10 h-10 text-teal-600 dark:text-teal-400" />
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2 tracking-tight">
          Login efetuado!
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          Autenticação concluída com sucesso. Estamos preparando tudo e redirecionando você...
        </p>

        <Loader2 className="w-7 h-7 text-teal-600 dark:text-teal-400 animate-spin" />
      </div>
    </div>
  )
}