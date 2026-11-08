'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Bell, BellOff, BellRing, CalendarClock, Check, ChevronDown,
  ChevronUp, Clock3, CreditCard, HandCoins, Landmark, Repeat2, Target,
  WalletCards, CircleDollarSign, ShieldCheck, ShieldAlert, TestTube2,
  RefreshCw, LockKeyhole, Sparkles,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import {
  getNativeNotificationPermission,
  requestNativeNotificationPermission,
  sendNativeNotificationTest,
  type NativeNotificationPermissionState,
} from '@/lib/nativeNotifications'
import {
  NOTIFICATION_KINDS, normalizeNotificationRules, resolveNotificationRule,
  type NotificationKind, type NotificationRule,
} from '@/lib/nativeNotificationRules'

const kinds = [
  { id: 'invoices', title: 'Cartões e faturas', subtitle: 'Somente faturas com saldo em aberto', Icon: CreditCard },
  { id: 'transactions', title: 'Despesas e receitas previstas', subtitle: 'Lançamentos pendentes, sem somar ao saldo', Icon: CircleDollarSign },
  { id: 'debts', title: 'Quem me deve', subtitle: 'Recebíveis e atrasos não quitados', Icon: HandCoins },
  { id: 'financings', title: 'Financiamentos', subtitle: 'Parcelas e datas previstas', Icon: Landmark },
  { id: 'loans', title: 'Empréstimos', subtitle: 'Compromissos não liquidados', Icon: WalletCards },
  { id: 'subscriptions', title: 'Assinaturas', subtitle: 'Cobranças recorrentes ativas', Icon: Repeat2 },
  { id: 'goals', title: 'Metas financeiras', subtitle: 'Prazos de objetivos ainda em andamento', Icon: Target },
] as const

const leadOptions = [30, 15, 7, 5, 3, 2, 1, 0]
const repeatOptions = [
  { value: 0, title: 'Não repetir' },
  { value: 1, title: 'Todos os dias' },
  { value: 2, title: 'A cada 2 dias' },
  { value: 3, title: 'A cada 3 dias' },
  { value: 7, title: 'Semanalmente' },
]
const hours = [6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 21]
const shell = 'rounded-[23px] border border-slate-200/75 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/90'
const pill = (selected: boolean) => `min-h-9 rounded-xl border px-3 py-2 text-[11px] font-semibold transition active:scale-[0.98] disabled:opacity-50 ${selected
  ? 'border-teal-500/70 bg-teal-600 text-white'
  : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`

export default function NotificationCenterSettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { settings, loading, updateSettings } = useUserSettings()
  const { showToast } = useToast()
  const { light, success, error: hapticError } = useHapticFeedback()
  const [permission, setPermission] = useState<NativeNotificationPermissionState | null>(null)
  const [expanded, setExpanded] = useState<NotificationKind | null>('invoices')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const checkPermission = useCallback(() => {
    void getNativeNotificationPermission()
      .then(setPermission)
      .catch(() => setPermission('unsupported'))
  }, [])
  useEffect(() => {
    checkPermission()
    const onResume = () => { if (document.visibilityState === 'visible') checkPermission() }
    document.addEventListener('visibilitychange', onResume)
    return () => document.removeEventListener('visibilitychange', onResume)
  }, [checkPermission])

  const prefs = settings?.preferences
  const enabled = prefs?.push_notifications === true
  const onboarding = !!prefs && !prefs.notification_onboarding_done && !enabled
  const enabledCount = NOTIFICATION_KINDS.filter(kind => prefs?.notification_categories[kind] !== false).length

  const save = async (patch: Record<string, unknown>, message?: string) => {
    if (!settings || saving) return
    setSaving(true)
    light()
    try {
      const result = await updateSettings({ preferences: patch })
      if (!result.synced) showToast('Salvo neste aparelho; sincronização pendente.', 'info')
      else if (message) showToast(message, 'success')
      success()
    } catch {
      hapticError()
      showToast('Não foi possível salvar suas preferências.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleMaster = async () => {
    if (!prefs || saving) return
    if (!enabled) {
      try {
        const result = await requestNativeNotificationPermission()
        setPermission(result)
        if (result === 'denied') {
          hapticError()
          showToast('O Android bloqueou os avisos. Libere a permissão nas configurações do aparelho.', 'warning')
          return
        }
        if (result === 'unsupported') {
          showToast('Agendamento local disponível no APK Android. As preferências podem ser organizadas no PWA.', 'info')
          return
        }
        if (result !== 'granted') return
      } catch {
        showToast('Não consegui solicitar a permissão de notificações.', 'error')
        return
      }
    }
    await save({ push_notifications: !enabled, notification_onboarding_done: true }, enabled ? 'Alertas pausados.' : 'Alertas ativados.')
  }

  const updateCategory = async (kind: NotificationKind) => {
    if (!prefs) return
    await save({ notification_categories: {
      ...prefs.notification_categories,
      [kind]: prefs.notification_categories[kind] === false,
    } })
  }

  const updateRule = async (kind: NotificationKind, patch: Partial<NotificationRule>) => {
    if (!prefs) return
    const normalized = normalizeNotificationRules({
      ...prefs.notification_rules,
      [kind]: { ...prefs.notification_rules?.[kind], ...patch },
    })
    await save({ notification_rules: normalized })
  }

  const test = async () => {
    if (testing) return
    setTesting(true)
    try {
      const result = await sendNativeNotificationTest()
      setPermission(result.permission)
      if (!result.supported) showToast('O teste real de notificação funciona no APK Android.', 'info')
      else if (result.sent) { success(); showToast('Teste agendado para alguns segundos.', 'success') }
      else showToast('Permissão não concedida. Verifique as configurações do Android.', 'warning')
    } catch {
      hapticError()
      showToast('Falha no agendamento de teste do Android.', 'error')
    } finally { setTesting(false) }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-3.5 px-4 pb-32 pt-4 text-slate-900 dark:text-slate-100">
      <header className="flex items-center gap-3 pb-1">
        <button type="button" aria-label="Voltar" onClick={() => router.push('/notifications')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
          <ArrowLeft size={19}/>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-300">DFL Finance · 360</p>
          <h1 className="text-[19px] font-black tracking-tight">Meus alertas</h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Você decide o que receber e quando.</p>
        </div>
        <BellRing className="text-teal-500" size={23}/>
      </header>

      {onboarding && <section className="rounded-[25px] bg-slate-950 p-4 text-white dark:border dark:border-teal-500/20">
        <div className="flex items-center gap-2 text-teal-300"><Sparkles size={19}/><span className="text-xs font-bold">Bem-vindo aos alertas do Finance</span></div>
        <p className="mt-2 text-[15px] font-bold">Prazos no seu ritmo, sem spam.</p>
        <p className="mt-1 text-[11px] leading-5 text-slate-300">Primeiro personalize cartões, cobranças e metas. Depois ative quando quiser. A permissão do Android só será solicitada após seu toque.</p>
        <button type="button" disabled={saving} onClick={() => void save({ notification_onboarding_done: true })}
          className="mt-3 min-h-10 rounded-xl bg-white/10 px-3 text-xs font-bold text-teal-200">Entendi, configurar</button>
      </section>}

      <section className={`${shell} p-4`} aria-label="Controle geral dos avisos">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${enabled ? 'bg-teal-500/10 text-teal-600 dark:text-teal-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>
            {enabled ? <Bell size={20}/> : <BellOff size={20}/>}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-bold">Alertas financeiros</h2>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{enabled ? `${enabledCount} categorias disponíveis` : 'Desativados. Nenhum aviso financeiro será agendado.'}</p>
          </div>
          <button type="button" role="switch" aria-label="Ativar notificações financeiras" aria-checked={enabled}
            disabled={loading || !prefs || saving} onClick={() => void toggleMaster()}
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${enabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow ${enabled ? 'left-6' : 'left-1'}`}/>
          </button>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 dark:bg-slate-900/65 dark:text-slate-300">
          {permission === 'granted' ? <ShieldCheck size={16} className="shrink-0 text-teal-500"/>
            : <ShieldAlert size={16} className="shrink-0 text-amber-500"/>}
          <div className="min-w-0 flex-1">
            {permission === 'granted' ? 'Android autorizou os alertas.'
              : permission === 'denied' ? 'Permissão bloqueada. Abra as configurações do Android para permitir avisos.'
              : permission === 'unsupported' ? 'Visualização PWA: agendamentos locais exigem o APK Android.'
              : permission === 'prompt' || permission === 'prompt-with-rationale' ? 'A permissão será solicitada ao ativar os avisos.'
              : 'Verificando a permissão no aparelho…'}
          </div>
          <button type="button" aria-label="Rever permissão" onClick={checkPermission}><RefreshCw size={15}/></button>
        </div>
        <button type="button" disabled={testing} onClick={() => void test()}
          className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold dark:border-slate-700">
          <TestTube2 size={16}/>{testing ? 'Testando…' : 'Enviar notificação de teste'}
        </button>
      </section>

      <section className={`${shell} p-4`}>
        <div className="flex items-center gap-2"><LockKeyhole size={17} className="text-teal-500"/><h2 className="text-[13px] font-bold">Privacidade e horário</h2></div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Por padrão, avisos não revelam valores e usam canal privado na tela bloqueada. Seu Android pode aplicar ajustes adicionais.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={saving || !prefs} className={pill(prefs?.notification_privacy !== 'full')}
            onClick={() => void save({ notification_privacy: 'private' })}>Valores ocultos</button>
          <button type="button" disabled={saving || !prefs} className={pill(prefs?.notification_privacy === 'full')}
            onClick={() => void save({ notification_privacy: 'full' })}>Mostrar valores</button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400"><Clock3 size={15}/> Horários permitidos: 06h–21h. Cada categoria pode ter seu horário.</div>
      </section>

      <div className="px-1 pt-1">
        <h2 className="text-[15px] font-black">Escolha seus lembretes</h2>
        <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">Antecedências diferentes, repetição após o vencimento e valor mínimo por assunto. Toque na categoria para personalizar.</p>
      </div>

      {kinds.map(({ id, title, subtitle, Icon }) => {
        const active = prefs?.notification_categories[id] !== false
        const open = expanded === id
        const rule = resolveNotificationRule(id, prefs || {})
        return <section key={id} className={`${shell} overflow-hidden`}>
          <div className="flex items-center gap-3 px-3.5 py-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${active ? 'bg-teal-500/10 text-teal-600 dark:text-teal-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'}`}><Icon size={19}/></span>
            <button type="button" aria-expanded={open} onClick={() => { light(); setExpanded(open ? null : id) }} className="min-w-0 flex-1 text-left">
              <span className="block text-[12px] font-bold">{title}</span>
              <span className="mt-0.5 block text-[10px] leading-4 text-slate-500 dark:text-slate-400">{subtitle}</span>
            </button>
            <button type="button" role="switch" aria-label={`Ativar ${title}`} aria-checked={active} disabled={!prefs || saving}
              onClick={() => void updateCategory(id)} className={`relative h-6 w-11 shrink-0 rounded-full disabled:opacity-50 ${active ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${active ? 'left-6' : 'left-1'}`}/>
            </button>
            <button type="button" aria-label={open ? 'Recolher categoria' : 'Expandir categoria'} onClick={() => setExpanded(open ? null : id)}>
              {open ? <ChevronUp size={17} className="text-slate-400"/> : <ChevronDown size={17} className="text-slate-400"/>}
            </button>
          </div>
          {open && <div className="space-y-3 border-t border-slate-200/70 px-3.5 py-3.5 dark:border-slate-700/70">
            <div>
              <p className="mb-2 flex items-center gap-2 text-[11px] font-bold"><CalendarClock size={15} className="text-teal-500"/> Avisar antes do vencimento</p>
              <div className="flex flex-wrap gap-1.5">{leadOptions.map(days => <button key={days} type="button" disabled={!prefs || saving}
                aria-pressed={rule.leadDays.includes(days)} className={pill(rule.leadDays.includes(days))}
                onClick={() => void updateRule(id, { leadDays: rule.leadDays.includes(days)
                  ? rule.leadDays.filter(x => x !== days) : [...rule.leadDays, days] })}>
                {days === 0 ? 'No dia' : `${days}d antes`}{rule.leadDays.includes(days) ? <Check size={12} className="ml-1 inline"/> : null}
              </button>)}</div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-bold">Se continuar vencido</p>
              <div className="flex flex-wrap gap-1.5">{repeatOptions.map(option => <button key={option.value} type="button" disabled={!prefs || saving}
                className={pill(rule.overdueEveryDays === option.value)} aria-pressed={rule.overdueEveryDays === option.value}
                onClick={() => void updateRule(id, { overdueEveryDays: option.value })}>{option.title}</button>)}</div>
              {rule.overdueEveryDays > 0 && <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                <span>Parar de repetir após:</span>{[7, 14, 30].map(days => <button type="button" key={days} disabled={!prefs || saving}
                className={pill(rule.overdueMaxDays === days)} onClick={() => void updateRule(id, { overdueMaxDays: days })}>{days} dias</button>)}
              </div>}
              {prefs?.notification_overdue === false && <p className="mt-2 text-[10px] text-amber-600">Avisos vencidos estão desligados no controle legado. Ative-os em Configurações para usar esta regra.</p>}
            </div>
            <div>
              <p className="mb-2 flex items-center gap-2 text-[11px] font-bold"><Clock3 size={15} className="text-teal-500"/> Horário nesta categoria</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">{hours.map(hour => <button type="button" key={hour} disabled={!prefs || saving}
                className={`${pill(rule.hour === hour)} shrink-0`} onClick={() => void updateRule(id, { hour })}>
                {String(hour).padStart(2, '0')}:00</button>)}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
              <label htmlFor={`notification-min-${id}`} className="block text-[11px] font-bold">Valor mínimo para avisar (R$)</label>
              <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">Zero significa sem limite adicional. Faturas quitadas nunca geram lembretes.</p>
              <input key={`${id}:${rule.minimumAmount}`} id={`notification-min-${id}`} type="number" min="0" max="1000000" step="0.01" inputMode="decimal"
                defaultValue={rule.minimumAmount} disabled={!prefs || saving} aria-label={`Valor mínimo para ${title}`}
                onBlur={event => {
                  const value = Number(event.currentTarget.value)
                  if (Number.isFinite(value) && value >= 0 && value !== rule.minimumAmount) void updateRule(id, { minimumAmount: value })
                }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800"/>
            </div>
          </div>}
        </section>
      })}

      <section className="flex gap-2 rounded-[20px] border border-teal-500/20 bg-teal-500/5 px-3.5 py-3 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
        <ShieldCheck size={19} className="mt-0.5 shrink-0 text-teal-600"/>
        <p>Regras salvas na sua conta e também neste aparelho para uso offline. O Android pode atrasar alarmes para economizar bateria. Os lembretes não movimentam dinheiro nem quitam contas automaticamente.</p>
      </section>
    </main>
  )
}
