'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, BrainCircuit, CalendarCheck2, CheckCheck,
  Clock3, Eye, History, Info, ShieldCheck, Sparkles, BellOff,
  AlertTriangle, ChevronRight,
} from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/lib/hooks/useAuth'
import { Capacitor } from '@capacitor/core'
import { requestProactiveDigestPermission, syncProactiveNativeDigest } from '@/lib/proactiveNativeDigest'
import { buildFinancialIntelligence } from '@/lib/financial-intelligence'
import { buildMonthlyReview, type MonthlyRow, type MonthlyCategory } from '@/lib/financeMonthlyReview'
import {
  buildProactiveObservations, normalizeProactiveHistory, reviewObservation,
  observationVisibility, type ProactiveFrequency, type ProactiveObservation,
} from '@/lib/proactiveObservations'

const panel = 'rounded-[23px] border border-slate-200/75 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900'
const severityLabel: Record<ProactiveObservation['severity'], string> = {
  critical: 'Urgente', warning: 'Atenção', attention: 'Observar', opportunity: 'Oportunidade', info: 'Informação',
}
const severityTone: Record<ProactiveObservation['severity'], string> = {
  critical: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  attention: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
  opportunity: 'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300',
  info: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
}
const iso = (date: Date) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-')
const month = (date: Date, offset: number) => {
  const other = new Date(date.getFullYear(), date.getMonth()+offset, 15, 12)
  return `${other.getFullYear()}-${String(other.getMonth()+1).padStart(2,'0')}`
}

export default function ProactiveObservationsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { effectiveContext } = useContext_()
  const { settings, loading: preferencesLoading, updateSettings } = useUserSettings()
  const { showToast } = useToast()
  const [reference] = useState(() => new Date())
  const [view, setView] = useState<'new' | 'history'>('new')
  const [busy, setBusy] = useState(false)
  const [nativeMessage, setNativeMessage] = useState('')
  const filters = { context: effectiveContext }
  const transactions = useLocalData({ table: 'transactions', filters })
  const accounts = useLocalData({ table: 'accounts', filters })
  const categories = useLocalData({ table: 'categories', filters })
  const debts = useLocalData({ table: 'debts', filters })
  const loans = useLocalData({ table: 'loans', filters })
  const financings = useLocalData({ table: 'financings', filters })
  const subscriptions = useLocalData({ table: 'subscriptions', filters })
  const goals = useLocalData({ table: 'goals', filters })
  const budgets = useLocalData({ table: 'budgets', filters })
  const cards = useLocalData({ table: 'credit_cards', filters })
  const invoices = useLocalData({ table: 'credit_invoices', filters })

  const loading = preferencesLoading || [transactions, accounts, categories, debts, loans, financings,
    subscriptions, goals, budgets, cards, invoices].some(source => source.loading)
  const today = iso(reference)
  const currentMonth = month(reference, 0)
  const lastMonth = month(reference, -1)

  const intelligence = useMemo(() => buildFinancialIntelligence({
    context: effectiveContext,
    now: reference,
    transactions: transactions.data || [],
    accounts: accounts.data || [],
    categories: categories.data || [],
    debts: debts.data || [],
    loans: loans.data || [],
    financings: financings.data || [],
    subscriptions: subscriptions.data || [],
    goals: goals.data || [],
    budgets: budgets.data || [],
    creditCards: cards.data || [],
    creditInvoices: invoices.data || [],
  }), [effectiveContext, reference, transactions.data, accounts.data, categories.data, debts.data, loans.data,
    financings.data, subscriptions.data, goals.data, budgets.data, cards.data, invoices.data])
  const currentReview = useMemo(() => buildMonthlyReview(
    (transactions.data || []) as MonthlyRow[], (categories.data || []) as MonthlyCategory[],
    effectiveContext, currentMonth, today,
  ), [transactions.data, categories.data, effectiveContext, currentMonth, today])
  const closedReview = useMemo(() => buildMonthlyReview(
    (transactions.data || []) as MonthlyRow[], (categories.data || []) as MonthlyCategory[],
    effectiveContext, lastMonth, today,
  ), [transactions.data, categories.data, effectiveContext, lastMonth, today])
  const observations = useMemo(() => buildProactiveObservations(intelligence, currentReview, closedReview),
    [intelligence, currentReview, closedReview])

  const preferences = settings?.preferences
  const frequency: ProactiveFrequency = preferences?.proactive_frequency || 'daily'
  const history = useMemo(() => normalizeProactiveHistory(preferences?.proactive_history, reference),
    [preferences?.proactive_history, reference])
  const visible = useMemo(() => observations.filter(item =>
    observationVisibility(history, item.key, frequency, reference) === 'active'),
    [observations, history, frequency, reference])
  const prior = useMemo(() => observations.filter(item =>
    observationVisibility(history, item.key, frequency, reference) !== 'active'),
    [observations, history, frequency, reference])
  const selected = view === 'new' ? visible : prior

  const save = async (changes: Record<string, unknown>, message: string) => {
    if (!settings || busy) return
    setBusy(true)
    try {
      const result = await updateSettings({ preferences: changes })
      showToast(result.synced ? message : 'Preferência salva neste aparelho. Sincronização pendente.',
        result.synced ? 'success' : 'info')
    } catch {
      showToast('Não consegui salvar esta preferência.', 'error')
    } finally { setBusy(false) }
  }
  const changeHistory = (item: ProactiveObservation, action: 'seen'|'snooze'|'reopen') => {
    void save({ proactive_history: reviewObservation(history, item.key, action, new Date()) },
      action === 'seen' ? 'Observação revisada.' : action === 'snooze' ? 'Adiada por 7 dias.' : 'Observação reaberta.')
  }

  // Só agenda ao examinar a Central; nunca faz varredura financeira global no boot.
  useEffect(() => {
    if (loading || !preferences || !user?.id) return
    let active = true
    void syncProactiveNativeDigest(user.id, effectiveContext, visible, {
      enabled: preferences.proactive_android_enabled === true,
      frequency,
      privacy: preferences.notification_privacy,
      hour: preferences.notification_hour,
    }).then(status => {
      if (!active) return
      const labels: Record<typeof status, string> = {
        unsupported: 'Disponível apenas no APK Android.',
        disabled: 'Resumo Android desligado.',
        'not-permitted': 'O Android ainda não permitiu notificações.',
        unchanged: 'Próximo resumo já está agendado.',
        scheduled: 'Próximo resumo Android agendado.',
        'nothing-to-remind': 'Sem sinais prioritários para agendar.',
      }
      setNativeMessage(labels[status])
    }).catch(() => { if (active) setNativeMessage('Não foi possível agendar. Abra esta tela para tentar novamente.') })
    return () => { active = false }
  }, [loading, user?.id, effectiveContext, visible, preferences, frequency])

  const toggleNativeSummary = async () => {
    if (!settings || busy) return
    if (!settings.preferences.proactive_android_enabled) {
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        showToast('A notificação local funciona somente no APK Android.', 'info')
        return
      }
      try {
        const permission = await requestProactiveDigestPermission()
        if (permission !== 'granted') {
          showToast('Libere as notificações nas configurações do Android para ativar.', 'warning')
          return
        }
      } catch {
        showToast('Não consegui verificar a permissão do Android.', 'error')
        return
      }
    }
    await save({ proactive_android_enabled: !settings.preferences.proactive_android_enabled },
      settings.preferences.proactive_android_enabled ? 'Resumo Android desativado.' : 'Resumo Android ativado.')
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-4 bg-slate-50 px-4 pb-32 pt-4 dark:bg-slate-950">
      <header className="flex items-center gap-3">
        <button type="button" onClick={() => router.push('/intelligence-center')} aria-label="Voltar à Inteligência"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 dark:bg-slate-900 dark:text-white"><ArrowLeft size={19}/></button>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wider text-teal-600">DFL Finance · R458</p>
          <h1 className="text-[19px] font-black text-slate-950 dark:text-white">Observações do Finance</h1></div>
        <BrainCircuit size={22} className="text-teal-600"/>
      </header>
      <ContextToggle/>

      <section className="rounded-[25px] bg-slate-950 p-5 text-white dark:border dark:border-slate-700">
        <div className="flex items-center gap-2 text-teal-300"><Sparkles size={19}/><span className="text-[11px] font-bold">Inteligência explicável</span></div>
        <h2 className="mt-3 text-[20px] font-black leading-tight">O que merece sua atenção?</h2>
        <p className="mt-2 text-[12px] leading-5 text-slate-300">Sinais reais dos seus registros {effectiveContext === 'dfl' ? 'da empresa' : 'pessoais'}, com período, evidências e próximo passo. Nada é alterado automaticamente.</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/10 p-2"><span className="block text-[20px] font-black tabular-nums">{loading ? '—' : visible.length}</span><span className="text-[10px] text-slate-300">Para conferir</span></div>
          <div className="rounded-xl bg-white/10 p-2"><span className="block text-[20px] font-black tabular-nums">{loading ? '—' : prior.length}</span><span className="text-[10px] text-slate-300">Histórico</span></div>
          <div className="rounded-xl bg-white/10 p-2"><span className="block text-[20px] font-black tabular-nums">{loading ? '—' : observations.filter(o=>o.severity==='critical'||o.severity==='warning').length}</span><span className="text-[10px] text-slate-300">Prioridades</span></div>
        </div>
      </section>

      <section className={panel}>
        <div className="mb-2 flex items-center gap-2"><Clock3 size={17} className="text-teal-600"/><h2 className="text-[13px] font-bold">Frequência de reapresentação</h2></div>
        <p className="mb-3 text-[11px] leading-5 text-slate-500 dark:text-slate-400">Após revisar, o mesmo sinal só volta como novo de acordo com sua escolha. A lista histórica continua disponível.</p>
        <div className="grid grid-cols-3 gap-2">{([
          ['daily','Diária'],['weekly','Semanal'],['off','Pausar'],
        ] as const).map(([value,label]) => <button key={value} type="button" disabled={!settings || busy}
          onClick={() => void save({ proactive_frequency: value }, 'Frequência atualizada.')}
          aria-pressed={frequency === value}
          className={`min-h-11 rounded-[14px] border px-2 text-[11px] font-bold disabled:opacity-50 ${frequency === value
            ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{label}</button>)}</div>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[10px] leading-4 text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
          <Info size={15} className="mt-0.5 shrink-0"/><p>Estas são observações dentro do aplicativo. Não são push Android e não exigem permissão. Os lembretes nativos de vencimento continuam separados na Central de Alertas 360.</p>
        </div>
      </section>

      <section className={panel}>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-500/10"><BrainCircuit size={20}/></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">Resumo inteligente no Android</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">Opcional. Agenda um próximo aviso quando você consulta esta tela e há sinais prioritários confiáveis. Não acompanha mudanças com o app fechado.</p>
          </div>
          <button type="button" role="switch" aria-label="Receber resumo inteligente no Android"
            aria-checked={preferences?.proactive_android_enabled === true} disabled={!settings || busy || loading}
            onClick={() => void toggleNativeSummary()}
            className={`relative h-7 w-12 shrink-0 rounded-full disabled:opacity-50 ${preferences?.proactive_android_enabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${preferences?.proactive_android_enabled ? 'left-6' : 'left-1'}`}/>
          </button>
        </div>
        <p role="status" className="mt-2 text-[10px] leading-5 text-slate-500">{nativeMessage || 'O padrão é desligado. Toque para ativar e solicitar permissão.'} O horário é o definido na Central de Notificações; a entrega pode variar conforme o Android.</p>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setView('new')} aria-pressed={view==='new'}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-[15px] border text-[12px] font-bold ${view==='new' ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}><Eye size={16}/> Novas</button>
        <button type="button" onClick={() => setView('history')} aria-pressed={view==='history'}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-[15px] border text-[12px] font-bold ${view==='history' ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}><History size={16}/> Histórico</button>
      </div>

      {loading ? <section role="status" className={panel}><p className="text-[12px] text-slate-500">Conferindo os dados disponíveis neste dispositivo…</p></section>
        : selected.length === 0 ? <section className={panel}>
          <div className="flex items-center gap-2 text-teal-600"><CalendarCheck2 size={20}/><h2 className="text-[14px] font-bold">{frequency==='off' && view==='new' ? 'Observações pausadas' : view==='new' ? 'Nenhuma observação nova' : 'Histórico vazio'}</h2></div>
          <p className="mt-2 text-[12px] leading-5 text-slate-500">{view==='new' ? 'Sinais revisados, adiados ou sem base suficiente não geram alertas fictícios. Confira novamente após sincronizar seus dados.' : 'As observações revisadas ou adiadas aparecem aqui, sem armazenar cópias dos seus valores.'}</p>
          <Link href="/monthly-review" className="mt-3 inline-flex min-h-10 items-center gap-2 text-[12px] font-bold text-teal-700 dark:text-teal-300">Abrir revisão mensal <ChevronRight size={15}/></Link>
        </section> : selected.map(item => {
          const status = observationVisibility(history, item.key, frequency, reference)
          return <article key={item.key} className={`${panel} space-y-3`}>
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${severityTone[item.severity]}`}>
                {item.severity==='critical'||item.severity==='warning' ? <AlertTriangle size={18}/> : <BrainCircuit size={18}/>}</span>
              <div className="min-w-0 flex-1"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{severityLabel[item.severity]} · {item.period}</span>
                <h3 className="mt-1 text-[15px] font-bold leading-5 text-slate-900 dark:text-slate-100">{item.title}</h3>
                {status !== 'active' && <p className="mt-1 text-[10px] font-semibold text-teal-700 dark:text-teal-300">{status==='snoozed' ? 'Adiada por 7 dias' : status==='paused' ? 'Pausada' : 'Revisada recentemente'}</p>}</div>
            </div>
            <p className="text-[12px] leading-5 text-slate-700 dark:text-slate-300">{item.message}</p>
            <div className="rounded-[15px] bg-slate-50 p-3 dark:bg-slate-800/70">
              <p className="flex items-center gap-2 text-[11px] font-bold text-slate-800 dark:text-slate-100"><ShieldCheck size={14} className="text-teal-600"/> Por que estou vendo isto?</p>
              <p className="mt-1.5 text-[11px] leading-5 text-slate-600 dark:text-slate-300">{item.why}</p>
              <p className="mt-2 text-[10px] leading-5 text-slate-500 dark:text-slate-400">{item.evidence}</p>
            </div>
            <Link href={item.route} className="flex min-h-11 items-center justify-between rounded-[14px] bg-teal-600 px-3 text-[12px] font-bold text-white">
              {item.actionLabel}<ArrowRight size={16}/></Link>
            <div className="grid grid-cols-2 gap-2">
              {status==='active' ? <>
                <button type="button" onClick={()=>changeHistory(item,'seen')} disabled={busy} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"><CheckCheck size={15}/> Já conferi</button>
                <button type="button" onClick={()=>changeHistory(item,'snooze')} disabled={busy} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"><Clock3 size={15}/> Adiar 7 dias</button>
              </> : <button type="button" onClick={()=>changeHistory(item,'reopen')} disabled={busy} className="col-span-2 min-h-10 rounded-xl border border-slate-200 text-[11px] font-semibold text-teal-700 disabled:opacity-50 dark:border-slate-700 dark:text-teal-300">Reabrir observação</button>}
            </div>
          </article>
        })}

      <section className="flex gap-3 rounded-[22px] border border-teal-500/20 bg-teal-500/5 p-4">
        <BellOff size={20} className="shrink-0 text-teal-600"/>
        <div className="min-w-0"><p className="text-[12px] font-bold">Você controla os avisos</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">Histórico e frequência são salvos na sua conta quando a sincronização estiver disponível. As configurações de alarmes Android permanecem independentes.</p>
          <Link href="/notification-center" className="mt-2 inline-flex min-h-9 items-center gap-2 text-[11px] font-bold text-teal-700 dark:text-teal-300">Personalizar alarmes Android <ArrowRight size={14}/></Link>
        </div>
      </section>
    </main>
  )
}
