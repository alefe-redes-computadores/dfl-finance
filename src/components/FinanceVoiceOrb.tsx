'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AudioLines, Mic, MicOff, Sparkles, X, Search } from 'lucide-react'
import { useFinancialSpeech } from '@/hooks/useFinancialSpeech'
import { financialVoiceFabEnabled, VOICE_PREFERENCE_EVENT } from '@/lib/voicePreferences'
import { stageFinancialVoiceTranscript } from '@/lib/voiceHandoff'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

export default function FinanceVoiceOrb({ pathname }: { pathname: string }) {
  const router = useRouter()
  const { vibrate } = useHapticFeedback()
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const { status, notice, transcript, start, cancel } = useFinancialSpeech()
  const eligible = ['/home','/transactions','/analysis','/more'].includes(pathname)

  useEffect(() => {
    const update = () => setEnabled(financialVoiceFabEnabled())
    update()
    window.addEventListener(VOICE_PREFERENCE_EVENT, update)
    window.addEventListener('storage', update)
    return () => { window.removeEventListener(VOICE_PREFERENCE_EVENT, update); window.removeEventListener('storage', update) }
  }, [])
  useEffect(() => {
    if (!eligible) return
    const focus = (event: FocusEvent) => {
      const element = event.target as HTMLElement | null
      const tag = element?.tagName
      setEditing(tag === 'INPUT' || tag === 'TEXTAREA' || !!element?.isContentEditable)
    }
    const blur = () => setEditing(false)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', blur)
    return () => { document.removeEventListener('focusin', focus); document.removeEventListener('focusout', blur) }
  }, [eligible])
  useEffect(() => {
    if (!transcript) return
    if (stageFinancialVoiceTranscript(transcript)) {
      setOpen(false)
      router.push('/search?voice=1')
    }
  }, [router, transcript])
  useEffect(() => { if (!eligible || !enabled) { cancel(); setOpen(false) } }, [eligible, enabled, cancel])

  if (!eligible || !enabled) return null
  return (
    <>
      {!open && !editing && (
        <button type="button" onClick={() => { vibrate(12); setOpen(true) }}
          aria-label="Falar com DFL Finance" title="Comando de voz"
          className="fixed bottom-[calc(157px+var(--safe-area-bottom))] right-4 z-[57] flex h-[52px] w-[52px] items-center justify-center rounded-full border border-teal-400/35 bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-800 text-white shadow-[0_8px_26px_rgba(13,148,136,.40)] outline-none transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none"
        >
          <span aria-hidden="true" className="absolute inset-[-4px] rounded-full border border-teal-500/20 motion-safe:animate-pulse" />
          <AudioLines size={24} aria-hidden="true" />
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/70 p-3 pb-[calc(98px+var(--safe-area-bottom))] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="DFL Comando de voz">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar comando de voz" onClick={() => { cancel(); setOpen(false) }} />
          <section className="relative w-full max-w-md rounded-[26px] border border-teal-500/20 bg-slate-900 p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[14px] font-bold"><Sparkles size={18} className="text-teal-300" /> DFL Voice</div>
              <button type="button" aria-label="Fechar voz" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" onClick={() => { cancel(); setOpen(false) }}><X size={18} /></button>
            </div>
            <div className="flex flex-col items-center py-5">
              <div className={`flex h-[84px] w-[84px] items-center justify-center rounded-full border-2 ${status === 'listening' ? 'border-rose-400 bg-rose-500/15 motion-safe:animate-pulse' : 'border-teal-400/50 bg-teal-500/15'}`}>
                {status === 'listening' ? <AudioLines size={36} className="text-rose-300" /> : <Mic size={34} className="text-teal-300" />}
              </div>
              <h2 className="mt-4 text-center text-lg font-bold">{status === 'listening' ? 'Estou ouvindo...' : 'O que você quer fazer?'}</h2>
              <p className="mt-1.5 min-h-10 text-center text-xs leading-5 text-slate-300" role="status">{notice || 'Diga uma despesa, receita ou algo que deseja buscar.'}</p>
            </div>
            <button type="button" onClick={() => { vibrate(10); if (status === 'listening') cancel(); else void start() }}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 text-sm font-bold text-white active:scale-[.99]">
              {status === 'listening' ? <><MicOff size={18} /> Parar de ouvir</> : <><Mic size={18} /> Começar a falar</>}
            </button>
            <button type="button" onClick={() => { cancel(); setOpen(false); router.push('/search') }}
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-xs font-semibold text-slate-300">
              <Search size={15} /> Prefiro digitar ou pesquisar
            </button>
            <p className="text-center text-[10px] text-slate-400">Nenhuma movimentação é salva por voz. Você revisa tudo antes.</p>
          </section>
        </div>
      )}
    </>
  )
}
