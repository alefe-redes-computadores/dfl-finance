'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Clock3, Sparkles, Star, Trash2 } from 'lucide-react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import {
  clearHubRecents, hubFavorites, hubRecents, rememberHubAction,
  suggestedHubActions, toggleHubFavorite,
  type CommandHubContext, type CommandHubScope, type CommandHubAction,
} from '@/lib/financialCommandHub'

type Props = {
  scope: CommandHubScope
  context: CommandHubContext
  userId: string | null
}

/** Sugestões executadas somente por toque. Storage mantém IDs públicos, nunca consultas ou valores. */
export default function FinancialCommandHub({ scope, context, userId }: Props) {
  const router = useRouter()
  const { vibrate } = useHapticFeedback()
  const [favorites, setFavorites] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadedFor, setLoadedFor] = useState('')

  useEffect(() => {
    setFavorites(hubFavorites(userId, context))
    setRecent(hubRecents(userId, context))
    setLoaded(true)
    setLoadedFor(`${userId ?? ''}:${context}`)
  }, [userId, context])

  const actions = useMemo(() => suggestedHubActions(scope, favorites, recent), [scope, favorites, recent])

  function launch(action: CommandHubAction) {
    if (!userId) return
    vibrate([9])
    rememberHubAction(userId, context, action.id)
    router.push(action.href)
  }
  function toggleFavorite(id: string) {
    if (!userId) return
    vibrate([6])
    setFavorites(toggleHubFavorite(userId, context, id))
  }
  function clearRecent() {
    if (!userId) return
    clearHubRecents(userId, context)
    setRecent([])
    vibrate([5])
  }

  if (!userId || !loaded || loadedFor !== `${userId}:${context}`) return null
  return (
    <section aria-label="Central unificada de comandos financeiros" className="mb-4 rounded-[21px] border border-amber-300/30 bg-white/85 p-3.5 shadow-sm dark:border-amber-500/15 dark:bg-slate-900/85">
      <div className="mb-2.5 flex items-start gap-2">
        <Sparkles size={17} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[12px] font-extrabold text-slate-900 dark:text-slate-100">Seu centro de comandos</h2>
          <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            {scope === 'transactions' ? 'Sugestões para o extrato' : scope === 'analysis' ? 'Sugestões para análise' : scope === 'cards' ? 'Sugestões para cartões' : scope === 'home' ? 'Ações para começar' : 'Navegue ou abra uma ação segura'}
          </p>
        </div>
        {recent.length > 0 && (
          <button type="button" onClick={clearRecent} aria-label="Limpar ações recentes"
            className="flex h-8 items-center gap-1 rounded-xl px-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Trash2 size={12} aria-hidden="true" /> Limpar
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {actions.map(action => {
          const favorite = favorites.includes(action.id)
          const wasRecent = recent.includes(action.id)
          return (
            <div key={action.id} className="flex min-w-0 items-center gap-1.5 rounded-[14px] border border-slate-100 bg-slate-50/70 px-1.5 dark:border-slate-800 dark:bg-slate-800/50">
              <button type="button" onClick={() => launch(action)}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 active:scale-[0.99]">
                {wasRecent ? <Clock3 size={15} className="shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" /> : <ArrowUpRight size={15} className="shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-slate-800 dark:text-slate-100">{action.title}</span>
                  <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{action.description}</span>
                </span>
              </button>
              <button type="button" onClick={() => toggleFavorite(action.id)} aria-pressed={favorite}
                aria-label={favorite ? `Desafixar ${action.title}` : `Fixar ${action.title}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 dark:text-slate-500">
                <Star size={16} className={favorite ? 'fill-amber-400 text-amber-500' : ''} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
      <p className="mt-2.5 text-[10px] leading-4 text-slate-400 dark:text-slate-500">
        Favoritos: somente atalhos. Recentes: somente nesta sessão. Nenhum lançamento é salvo aqui.
      </p>
    </section>
  )
}
