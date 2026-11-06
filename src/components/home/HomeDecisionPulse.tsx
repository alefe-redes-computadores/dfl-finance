'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, CalendarClock, ChevronRight, ShieldCheck, ShieldAlert } from 'lucide-react'
import {
  createHomeVisitSignature, describeHomeChanges, homeTrustSignal, readHomeVisitSignature,
  type HomeDecisionTransaction, type HomeVisitSignature, type HomeTrustInput,
} from '@/lib/homeDecisionSnapshot'

type Props = HomeTrustInput & {
  userId: string | null
  context: string
  transactions: HomeDecisionTransaction[]
  isDataReady: boolean
  upcomingAlerts: number
  onOpenAgenda: () => void
  onOpenSync: () => void
}

/** Resumo compacto; preserva Home, Comando e Centro Financeiro como autoridades. */
export default function HomeDecisionPulse({
  userId, context, transactions, isDataReady, upcomingAlerts, onOpenAgenda, onOpenSync,
  isOnline, isSyncing, hasSyncFailure, pendingCount, hasFinancialOutbox,
  isBalanceReconciling, balanceVerifiedAt, lastSuccessfulSyncAt,
}: Props) {
  const key = userId ? `dfl_home_visit_r453_${userId}_${context}` : ''
  const current = useMemo(() => createHomeVisitSignature(transactions), [transactions])
  const [prior, setPrior] = useState<HomeVisitSignature | null>(null)
  const [loadedFor, setLoadedFor] = useState('')
  const latestRef = useRef({ key, current, ready: isDataReady })
  useEffect(() => { latestRef.current = { key, current, ready: isDataReady } }, [key, current, isDataReady])

  useEffect(() => {
    if (!key) { setLoadedFor(''); setPrior(null); return }
    const read = () => {
      try { setPrior(readHomeVisitSignature(localStorage.getItem(key))) }
      catch { setPrior(null) }
      setLoadedFor(key)
    }
    read()
    const save = () => {
      const view = latestRef.current
      if (!view.ready || view.key !== key) return
      try { localStorage.setItem(key, JSON.stringify(view.current)) }
      catch { /* Storage indisponível: nunca impedir o uso offline. */ }
    }
    const visibility = () => {
      if (document.visibilityState === 'hidden') save()
      else if (document.visibilityState === 'visible') read()
    }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', save)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', save)
      save()
    }
  }, [key])

  const trust = homeTrustSignal({
    isOnline, isSyncing, hasSyncFailure, pendingCount, hasFinancialOutbox,
    isBalanceReconciling, balanceVerifiedAt, lastSuccessfulSyncAt,
  })
  const activity = !isDataReady || loadedFor !== key || !key
    ? 'Verificando histórico de visitas neste dispositivo.'
    : describeHomeChanges(prior, current)
  const TrustIcon = trust.tone === 'caution' ? ShieldAlert : ShieldCheck
  return (
    <section aria-label="Mudanças, vencimentos e confiabilidade do financeiro"
      className="mb-3.5 overflow-hidden rounded-[21px] border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-800/85">
      <div className="grid grid-cols-2 gap-px bg-slate-200/70 sm:grid-cols-3 dark:bg-slate-700/70">
        <div className="col-span-2 flex min-w-0 items-start gap-2.5 bg-white px-3.5 py-2.5 sm:col-span-1 dark:bg-slate-800">
          <Activity size={17} className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">O que mudou</p>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{activity}</p>
            <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">Somente lançamentos deste dispositivo.</p>
          </div>
        </div>
        <button type="button" onClick={onOpenAgenda}
          className="flex min-w-0 items-start gap-2 bg-white px-3 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/40">
          <CalendarClock size={17} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold text-slate-800 dark:text-slate-100">Vencimentos próximos</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              {upcomingAlerts > 0 ? `${upcomingAlerts} alerta${upcomingAlerts === 1 ? '' : 's'} próximo${upcomingAlerts === 1 ? '' : 's'}. Ver Agenda completa.` : 'Veja os compromissos futuros na Agenda.'}
            </span>
          </span>
          <ChevronRight size={15} className="mt-1 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
        <button type="button" onClick={onOpenSync}
          className="flex min-w-0 items-start gap-2 bg-white px-3 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/40">
          <TrustIcon size={17} className={`mt-0.5 shrink-0 ${trust.tone === 'caution' ? 'text-amber-500' : trust.tone === 'safe' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold text-slate-800 dark:text-slate-100">{trust.label}</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">{trust.description}</span>
          </span>
          <ChevronRight size={15} className="mt-1 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
