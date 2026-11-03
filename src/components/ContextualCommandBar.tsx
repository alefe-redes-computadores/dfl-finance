'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Mic, Search, Sparkles } from 'lucide-react'
import { CONTEXTUAL_COMMAND, safeContextualRoute, type ContextualCommandScope, type ContextualShortcut } from '@/lib/contextualCommand'
import { stageContextualSearchQuery } from '@/lib/contextualSearchHandoff'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

/** Entrada de intencao por contexto. Voz e lancamentos continuam nos fluxos existentes. */
export default function ContextualCommandBar({ scope }: { scope: ContextualCommandScope }) {
  const router = useRouter()
  const { vibrate } = useHapticFeedback()
  const config = CONTEXTUAL_COMMAND[scope]
  const [shown, setShown] = useState(false)
  const [animate, setAnimate] = useState(false)
  const [position, setPosition] = useState(0)
  const [letters, setLetters] = useState(0)

  useEffect(() => {
    const handle = window.setTimeout(() => setShown(true), 300)
    return () => window.clearTimeout(handle)
  }, [])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setAnimate(!media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])
  useEffect(() => {
    if (!animate || !shown) return
    const example = config.examples[position]
    const complete = letters >= example.length
    const timer = window.setTimeout(() => {
      if (complete) { setLetters(0); setPosition(current => (current + 1) % config.examples.length) }
      else setLetters(current => current + 1)
    }, complete ? 3000 : 63)
    return () => window.clearTimeout(timer)
  }, [animate, shown, letters, position, config])

  function openSearch() { vibrate([6]); router.push('/search') }
  function openVoice() { vibrate([6]); router.push('/search') }
  function openShortcut(item: ContextualShortcut) {
    const destination = safeContextualRoute(item)
    if (!destination) return
    if (item.kind === 'search' && !stageContextualSearchQuery(item.value)) return
    vibrate([6])
    router.push(destination)
  }

  return (
    <div className={`mb-3 w-full transition-[opacity,transform] duration-300 motion-reduce:transition-none ${shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}>
      <div className="dfl-command-frame">
        <div className="dfl-command-shell">
          <div className="mb-1 flex items-center gap-1.5 px-0.5">
            <Sparkles size={13} className="text-amber-500" aria-hidden="true" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.10em] text-amber-700 dark:text-amber-300">{config.eyebrow}</span>
            <span className="ml-auto text-[10px] font-medium text-slate-400 dark:text-slate-500">Buscar · agir · navegar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={openSearch} aria-label="Abrir Busca Inteligente do DFL Finance"
              className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left transition-colors hover:bg-slate-100/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500 active:scale-[0.99] dark:hover:bg-slate-800/90">
              <Search size={18} className="shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-600 dark:text-slate-300" aria-hidden="true">
                {animate && shown ? config.examples[position].slice(0, letters) || '\u00a0' : config.examples[0]}
                {animate && shown && <span className="dfl-command-caret" aria-hidden="true">|</span>}
              </span>
              <ArrowUpRight size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
            </button>
            <button type="button" onClick={openVoice} aria-label="Abrir busca com reconhecimento de voz"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:bg-teal-950/50 dark:text-teal-300">
              <Mic size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Atalhos contextuais">
            {config.shortcuts.map(shortcut => (
              <button key={shortcut.label} type="button" onClick={() => openShortcut(shortcut)}
                className="rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 text-[10.5px] font-semibold text-slate-600 transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {shortcut.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
