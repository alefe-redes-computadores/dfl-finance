'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Browser } from '@capacitor/browser'
import { Download, Sparkles, X } from 'lucide-react'
import { useApkUpdate } from '@/hooks/useApkUpdate'
import { formatApkExpiry } from '@/lib/mobileUpdatePolicy'

const SNOOZE_HOURS = 12

export default function AppUpdateBanner() {
  const { latest, updateAvailable } = useApkUpdate()
  const pathname = usePathname()
  const [snoozed, setSnoozed] = useState(false)
  const latestBuild = latest?.build

  useEffect(() => {
    if (!latestBuild) return
    const read = () => {
      try {
        const key = `dfl_apk_update_snooze_r456_${latestBuild}`
        setSnoozed(Number(localStorage.getItem(key) || 0) > Date.now())
      } catch { setSnoozed(false) }
    }
    read()
    document.addEventListener('visibilitychange', read)
    return () => document.removeEventListener('visibilitychange', read)
  }, [latestBuild])

  if (!updateAvailable || !latest || snoozed || pathname === '/updates') return null

  const snooze = () => {
    try {
      localStorage.setItem(
        `dfl_apk_update_snooze_r456_${latest.build}`,
        String(Date.now() + SNOOZE_HOURS * 60 * 60 * 1000),
      )
    } catch { /* LocalStorage opcional. */ }
    setSnoozed(true)
  }

  return (
    <section role="status" aria-label="Nova atualização do aplicativo disponível"
      className="mx-3 mt-3 rounded-[22px] border border-teal-400/35 bg-gradient-to-br from-teal-50 to-white px-3.5 py-3 shadow-sm dark:border-teal-500/25 dark:from-teal-950/55 dark:to-slate-800">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-teal-500/15 text-teal-700 dark:text-teal-300">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-slate-900 dark:text-slate-50">Atualização do Finance disponível</p>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-600 dark:text-slate-300">
            APK #{latest.build} · disponível para baixar até {formatApkExpiry(latest.expiresAt)} (Brasília).
          </p>
          <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
            O prazo é do download no GitHub, não uma obrigação de instalação.
          </p>
        </div>
        <button type="button" onClick={snooze} aria-label="Lembrar atualização mais tarde"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10">
          <X size={17} />
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button type="button" onClick={() => { void Browser.open({ url: latest.pageUrl }).catch(() => { /* Página disponível na Central de Atualizações. */ }) }}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[13px] bg-teal-600 px-3 text-[12px] font-bold text-white active:scale-[0.98]">
          <Download size={15} /> Ver APK no GitHub
        </button>
        <button type="button" onClick={snooze}
          className="min-h-10 rounded-[13px] border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Lembrar depois
        </button>
      </div>
    </section>
  )
}
