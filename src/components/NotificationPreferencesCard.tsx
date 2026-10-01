'use client'

import { useMemo, useState } from 'react'
import {
  Bell, BellOff, CalendarClock, Check, ChevronDown, ChevronUp,
  CircleDollarSign, CreditCard, HandCoins, Landmark, RefreshCw,
  Repeat, Target, TestTube2, WalletCards
} from 'lucide-react'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useToast } from '@/contexts/ToastContext'
import {
  getNativeNotificationPermission,
  requestNativeNotificationPermission,
  sendNativeNotificationTest,
  type NativeNotificationPermissionState,
} from '@/lib/nativeNotifications'

const categoryOptions = [
  { key: 'invoices', label: 'Faturas', subtitle: 'Fechamento e vencimento de cartões', icon: CreditCard },
  { key: 'transactions', label: 'Contas e receitas', subtitle: 'Lançamentos pendentes com data prevista', icon: CircleDollarSign },
  { key: 'debts', label: 'Quem me deve', subtitle: 'Valores a receber e atrasos', icon: HandCoins },
  { key: 'financings', label: 'Financiamentos', subtitle: 'Próximas parcelas previstas', icon: Landmark },
  { key: 'loans', label: 'Empréstimos', subtitle: 'Compromissos e vencimentos', icon: WalletCards },
  { key: 'subscriptions', label: 'Assinaturas', subtitle: 'Recorrências e cobranças', icon: Repeat },
  { key: 'goals', label: 'Metas', subtitle: 'Prazos das metas financeiras', icon: Target },
] as const

const leadOptions = [
  { value: 7, label: '7 dias' },
  { value: 5, label: '5 dias' },
  { value: 3, label: '3 dias' },
  { value: 1, label: '1 dia' },
  { value: 0, label: 'No dia' },
]

export default function NotificationPreferencesCard() {
  const { settings, loading, updateSettings } = useUserSettings()
  const { light, success, error: errorHaptic } = useHapticFeedback()
  const { showToast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [permission, setPermission] =
    useState<NativeNotificationPermissionState | null>(null)

  const prefs = settings?.preferences
  const enabled = prefs?.push_notifications ?? false
  const selectedLeadDays = prefs?.notification_lead_days ?? [3, 1, 0]
  const categories = prefs?.notification_categories

  const enabledCategories = useMemo(
    () => categoryOptions.filter(({ key }) => categories?.[key] !== false).length,
    [categories]
  )

  const save = async (patch: Record<string, unknown>, message?: string) => {
    if (!settings || saving) return
    setSaving(true)
    light()
    try {
      const result = await updateSettings({ preferences: patch })
      if (!result.synced) {
        showToast('Preferência salva no aparelho. Sincronizaremos quando houver conexão.', 'info')
      } else if (message) {
        showToast(message, 'success')
      }
      success()
    } catch (err: any) {
      errorHaptic()
      showToast(err?.message || 'Não foi possível salvar a preferência.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleMaster = async () => {
    if (!settings) return
    if (!enabled) {
      const state = await requestNativeNotificationPermission()
      setPermission(state)
      if (state === 'denied') {
        errorHaptic()
        showToast('Permissão de notificações negada no Android.', 'warning')
        return
      }
    }
    await save(
      { push_notifications: !enabled },
      !enabled
        ? 'Alertas financeiros ativados.'
        : 'Alertas financeiros desativados.'
    )
  }

  const toggleCategory = async (
    key: typeof categoryOptions[number]['key']
  ) => {
    if (!prefs) return
    await save({
      notification_categories: {
        ...prefs.notification_categories,
        [key]: prefs.notification_categories?.[key] === false,
      },
    })
  }

  const toggleLead = async (value: number) => {
    const next = selectedLeadDays.includes(value)
      ? selectedLeadDays.filter((item) => item !== value)
      : [...selectedLeadDays, value].sort((a, b) => b - a)

    if (next.length === 0) {
      showToast('Escolha pelo menos uma antecedência.', 'warning')
      errorHaptic()
      return
    }

    await save({ notification_lead_days: next })
  }

  const testNotification = async () => {
    if (testing) return
    setTesting(true)
    light()

    try {
      const result = await sendNativeNotificationTest()
      setPermission(result.permission)

      if (!result.supported) {
        showToast(
          'O teste do sistema fica disponível no APK. No PWA, as preferências continuam configuráveis.',
          'info'
        )
      } else if (result.sent) {
        success()
        showToast(
          'Notificação de teste agendada para alguns segundos.',
          'success'
        )
      } else {
        errorHaptic()
        showToast(
          'O Android não liberou a notificação de teste.',
          'warning'
        )
      }
    } catch (err: any) {
      errorHaptic()
      showToast(
        err?.message || 'Falha ao testar a notificação.',
        'error'
      )
    } finally {
      setTesting(false)
    }
  }

  if (loading || !prefs) {
    return (
      <div className="mb-3 rounded-[24px] border border-gray-200/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="h-5 w-44 animate-pulse rounded bg-gray-100 dark:bg-slate-700" />
        <div className="mt-3 h-12 animate-pulse rounded-[18px] bg-gray-50 dark:bg-slate-700/60" />
      </div>
    )
  }

  return (
    <section className="mb-3 overflow-hidden rounded-[26px] border border-gray-200/70 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] ${
              enabled
                ? 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400'
                : 'bg-gray-100 text-gray-400 dark:bg-slate-700'
            }`}
          >
            {enabled ? <Bell size={20} /> : <BellOff size={20} />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">
              Alertas financeiros
            </p>

            <p className="mt-0.5 text-[11px] font-medium leading-4 text-gray-400 dark:text-gray-500">
              {enabled
                ? `${enabledCategories} tipos ativos • ${prefs.notification_hour}:00`
                : 'Nenhum lembrete será agendado'}
            </p>
          </div>

          <button
            type="button"
            aria-label={
              enabled
                ? 'Desativar alertas'
                : 'Ativar alertas'
            }
            disabled={saving}
            onClick={toggleMaster}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              enabled
                ? 'bg-teal-500'
                : 'bg-gray-300 dark:bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                enabled ? 'right-1' : 'left-1'
              }`}
            />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            light()
            setExpanded((value) => !value)
          }}
          className="mt-3 flex w-full items-center justify-between rounded-[18px] bg-gray-50 px-3.5 py-3 text-left transition active:scale-[0.99] dark:bg-slate-900/40"
        >
          <div className="flex items-center gap-2.5">
            <CalendarClock
              size={17}
              className="text-teal-600 dark:text-teal-400"
            />

            <div>
              <p className="text-[12px] font-bold text-gray-700 dark:text-gray-200">
                Preferências de aviso
              </p>

              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Tipos, antecedência, horário e vencidos
              </p>
            </div>
          </div>

          {expanded ? (
            <ChevronUp size={17} className="text-gray-400" />
          ) : (
            <ChevronDown size={17} className="text-gray-400" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-4 dark:border-slate-700/70">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
            Antecedência
          </p>

          <div className="grid grid-cols-6 gap-2">
            {leadOptions.map((option, index) => {
              const active = selectedLeadDays.includes(option.value)

              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={saving}
                  onClick={() => toggleLead(option.value)}
                  className={`min-w-0 rounded-[16px] border px-2 py-2.5 text-[11px] font-bold leading-none transition active:scale-95 ${
                    index < 3 ? 'col-span-2' : 'col-span-3'
                  } ${
                    active
                      ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                      : 'border-gray-200 text-gray-500 dark:border-slate-700 dark:text-gray-400'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1 whitespace-nowrap">
                    {active && <Check size={12} className="shrink-0" />}
                    <span>{option.label}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3 rounded-[18px] bg-gray-50 p-3 dark:bg-slate-900/40">
            <div>
              <p className="text-[12px] font-bold text-gray-700 dark:text-gray-200">
                Horário dos lembretes
              </p>

              <p className="text-[10px] text-gray-400">
                Entre 06:00 e 21:00
              </p>
            </div>

            <select
              value={prefs.notification_hour}
              disabled={saving}
              onChange={(event) =>
                save({
                  notification_hour: Number(event.target.value),
                })
              }
              className="rounded-[14px] border border-gray-200 bg-white px-3 py-2 text-[12px] font-bold text-gray-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200"
            >
              {Array.from(
                { length: 16 },
                (_, index) => index + 6
              ).map((hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              save({
                notification_overdue:
                  !prefs.notification_overdue,
              })
            }
            className="mt-2 flex w-full items-center justify-between rounded-[18px] bg-gray-50 p-3 text-left dark:bg-slate-900/40"
          >
            <div>
              <p className="text-[12px] font-bold text-gray-700 dark:text-gray-200">
                Continuar avisando vencidos
              </p>

              <p className="text-[10px] text-gray-400">
                Mantém um lembrete enquanto houver pendência
              </p>
            </div>

            <div
              className={`relative h-6 w-11 rounded-full ${
                prefs.notification_overdue
                  ? 'bg-teal-500'
                  : 'bg-gray-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
                  prefs.notification_overdue
                    ? 'right-1'
                    : 'left-1'
                }`}
              />
            </div>
          </button>

          <p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
            O que avisar
          </p>

          <div className="space-y-1.5">
            {categoryOptions.map(
              ({
                key,
                label,
                subtitle,
                icon: Icon,
              }) => {
                const active = categories?.[key] !== false

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={saving}
                    onClick={() => toggleCategory(key)}
                    className="flex w-full items-center gap-3 rounded-[18px] px-2 py-2.5 text-left transition hover:bg-gray-50 active:scale-[0.99] dark:hover:bg-slate-700/40"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ${
                        active
                          ? 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400'
                          : 'bg-gray-100 text-gray-400 dark:bg-slate-700'
                      }`}
                    >
                      <Icon size={17} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold text-gray-700 dark:text-gray-200">
                        {label}
                      </p>

                      <p className="truncate text-[10px] text-gray-400">
                        {subtitle}
                      </p>
                    </div>

                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        active
                          ? 'border-teal-500 bg-teal-500 text-white'
                          : 'border-gray-200 text-transparent dark:border-slate-600'
                      }`}
                    >
                      <Check size={13} />
                    </div>
                  </button>
                )
              }
            )}
          </div>

          <button
            type="button"
            disabled={testing}
            onClick={testNotification}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-[12px] font-bold text-gray-700 transition active:scale-[0.98] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-200"
          >
            {testing ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <TestTube2 size={16} />
            )}

            {testing
              ? 'Testando…'
              : 'Testar notificação no aparelho'}
          </button>

          {permission === 'denied' && (
            <p className="mt-2 text-center text-[10px] font-medium text-amber-600">
              Permissão bloqueada pelo Android.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
