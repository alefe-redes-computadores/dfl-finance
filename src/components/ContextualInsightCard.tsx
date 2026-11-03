'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUpRight, Sparkles, X } from 'lucide-react'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import {
  buildContextualInsights,
  type ContextualInsight, type InsightScope,
} from '@/lib/contextualInsightEngine'
import { planContextualInsight } from '@/lib/contextualInsightPresentation'

const COOLDOWN_MS = 20 * 60 * 1000
const SHOW_COOLDOWN_MS = 3 * 60 * 1000
/** Apenas identificadores/horários em sessionStorage; sem saldos, valores ou mensagens financeiras. */
function storageKey(scope: InsightScope, context: string, userId: string) {
  return `dfl.finance.contextInsight.r419:${userId}:${context}:${scope}`
}
type Rotation = { id?: string; shownAt?: number; dismissedUntil?: number }
function loadRotation(key: string): Rotation {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) || '{}') as Rotation
    return value && typeof value === 'object' ? value : {}
  } catch { return {} }
}
function saveRotation(key: string, value: Rotation) {
  try { window.sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage opcional */ }
}

export default function ContextualInsightCard({ scope }: { scope: InsightScope }) {
  const router = useRouter()
  const { user } = useAuth()
  const { effectiveContext } = useContext_()
  const [now, setNow] = useState(() => new Date())
  const [foreground, setForeground] = useState(true)

  // O app pode permanecer aberto durante a troca de dia; recalcular a janela
  // somente quando o dia civil mudar, sem leituras periódicas do IndexedDB.
  useEffect(() => {
    const refreshClock = () => {
      const current = new Date()
      setNow(previous => previous.getFullYear() === current.getFullYear() &&
        previous.getMonth() === current.getMonth() &&
        previous.getDate() === current.getDate() ? previous : current)
    }
    const onVisibility = () => {
      setForeground(document.visibilityState !== 'hidden')
      if (document.visibilityState !== 'hidden') refreshClock()
    }
    onVisibility()
    window.addEventListener('focus', refreshClock)
    document.addEventListener('visibilitychange', onVisibility)
    const clock = window.setInterval(refreshClock, 60_000)
    return () => {
      window.clearInterval(clock)
      window.removeEventListener('focus', refreshClock)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  const start = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1, 12)
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), '01'].join('-')
  }, [now])
  const end = useMemo(() => [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'), [now])

  // Consulta limitada a ~2 meses, exclusivamente no IndexedDB e no contexto ativo.
  // Nenhuma chamada remota e nenhum cálculo de saldo/projeção.
  const rows = useLiveQuery(async () => {
    if (!user?.id) return []
    return db.transactions.where('[user_id+context+date]')
      .between([user.id, effectiveContext, start], [user.id, effectiveContext, end], true, true)
      .toArray()
  }, [user?.id, effectiveContext, start, end])
  const candidates = useMemo(() => buildContextualInsights(scope, effectiveContext, rows ?? [], now), [scope, effectiveContext, rows, now])
  const [visible, setVisible] = useState<{ key: string; insight: ContextualInsight } | null>(null)
  const [preparing, setPreparing] = useState(false)
  const key = user?.id ? storageKey(scope, effectiveContext, user.id) : ''

  const activeVisible = visible?.key === key ? visible.insight : null

  useEffect(() => {
    setPreparing(false)
    if (visible && visible.key !== key) {
      setVisible(null)
      return
    }
    if (rows === undefined || !key) {
      if (visible) setVisible(null)
      return
    }

    const remembered = loadRotation(key)
    const decision = planContextualInsight({
      candidates,
      current: activeVisible,
      previousId: remembered.id || null,
      shownAt: remembered.shownAt,
      dismissedUntil: remembered.dismissedUntil,
      nowMs: Date.now(),
      foreground,
      showCooldownMs: SHOW_COOLDOWN_MS,
      repeatCooldownMs: COOLDOWN_MS,
    })

    if (decision.kind === 'keep') {
      const refreshed = decision.insight
      if (!activeVisible || refreshed.title !== activeVisible.title ||
          refreshed.detail !== activeVisible.detail || refreshed.href !== activeVisible.href) {
        setVisible({ key, insight: refreshed })
      }
      return
    }
    if (decision.kind !== 'schedule') {
      if (activeVisible) setVisible(null)
      return
    }

    // O card só entra quando existe informação nova e relevante.
    const next = decision.insight
    const preparingTimer = window.setTimeout(() => setPreparing(true), 160)
    const visibleTimer = window.setTimeout(() => {
      setPreparing(false)
      setVisible({ key, insight: next })
      saveRotation(key, { id: next.id, shownAt: Date.now() })
    }, 780)
    return () => {
      window.clearTimeout(preparingTimer)
      window.clearTimeout(visibleTimer)
    }
  }, [rows, candidates, key, visible, activeVisible, foreground])

  function dismiss() {
    if (key) saveRotation(key, { id: activeVisible?.id, shownAt: Date.now(), dismissedUntil: Date.now() + COOLDOWN_MS })
    setVisible(null)
    setPreparing(false)
  }
  if (!activeVisible && !preparing) return null
  return (
    <section aria-label="Insight contextual do DFL Finance" className="mb-3">
      <div className="relative overflow-hidden rounded-[19px] border border-amber-300/35 bg-amber-50/65 p-3.5 shadow-[0_5px_22px_rgba(234,179,8,0.06)] dark:border-amber-400/15 dark:bg-slate-900/85 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        {preparing && !visible ? (
          <div role="status" className="flex min-h-[42px] items-center gap-2.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">
            <Sparkles size={17} className="shrink-0 animate-pulse text-amber-500 motion-reduce:animate-none" />
            Conferindo movimentações locais…
          </div>
        ) : activeVisible ? (
          <div className="flex items-start gap-2.5">
            <Sparkles size={18} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
            <button type="button" onClick={() => router.push(activeVisible.href)}
              className="group flex min-w-0 flex-1 items-start gap-2 text-left focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-extrabold text-slate-900 dark:text-slate-100">{activeVisible.title}</span>
                <span className="mt-1 block text-[11.5px] leading-[1.6] text-slate-600 dark:text-slate-300">{activeVisible.detail}</span>
                <span className="mt-1.5 block text-[10px] font-semibold text-amber-800 dark:text-amber-300">Baseado nos lançamentos locais · Abrir detalhes</span>
              </span>
              <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            </button>
            <button type="button" onClick={dismiss} aria-label="Dispensar insight por 20 minutos"
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 dark:text-slate-400">
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
