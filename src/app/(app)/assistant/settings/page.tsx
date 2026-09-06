// src/app/(app)/assistant/settings/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Bot,
  ChevronLeft,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react'

import ContextToggle from '@/components/ContextToggle'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  DEFAULT_USER_PREFERENCES,
  type UserPreferences,
} from '@/lib/userSettings'
import { useUserSettings } from '@/hooks/useUserSettings'

const SettingsSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {[1, 2, 3, 4].map((item) => (
      <div
        key={item}
        className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-[16px] bg-gray-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-gray-200 dark:bg-slate-700" />
            <div className="h-3 w-44 rounded bg-gray-100 dark:bg-slate-700/50" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-16 rounded-[18px] bg-gray-100 dark:bg-slate-900/60" />
          <div className="h-16 rounded-[18px] bg-gray-100 dark:bg-slate-900/60" />
        </div>
      </div>
    ))}
  </div>
)

function SettingToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  badge,
}: {
  label: string
  description: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
  badge?: string
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-[18px] border px-4 py-3 ${
        disabled
          ? 'border-gray-100 bg-gray-50/70 opacity-70 dark:border-slate-700/60 dark:bg-slate-900/40'
          : 'border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      <div className="min-w-0 pr-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">
            {label}
          </p>
          {badge && (
            <span className="rounded-full bg-gray-200/80 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-slate-700 dark:text-gray-300">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={onChange}
        disabled={disabled}
        aria-pressed={checked}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'
        } ${disabled ? 'cursor-not-allowed' : 'active:scale-[0.96]'}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  )
}

export default function AssistantSettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { showToast } = useToast()
  const {
    settings: storedSettings,
    loading,
    refresh,
    updateSettings,
  } = useUserSettings()

  const [draft, setDraft] = useState<UserPreferences>({
    ...DEFAULT_USER_PREFERENCES,
  })
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  useEffect(() => {
    if (!storedSettings) return
    setDraft({ ...storedSettings.preferences })
  }, [storedSettings])

  const baseline = useMemo(
    () =>
      JSON.stringify(
        storedSettings?.preferences || DEFAULT_USER_PREFERENCES
      ),
    [storedSettings]
  )

  const dirty = useMemo(
    () => JSON.stringify(draft) !== baseline,
    [draft, baseline]
  )

  const handleTouchStart = (event: TouchEvent) => {
    if (window.scrollY > 10 || loading) return
    pullStartY.current = event.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = (event: TouchEvent) => {
    if (!isPulling.current || refreshing) return

    const distance = event.touches[0].clientY - pullStartY.current

    if (distance > 70) {
      isPulling.current = false
      setRefreshing(true)

      refresh().finally(() => {
        setRefreshing(false)
      })
    }
  }

  const handleTouchEnd = () => {
    isPulling.current = false
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    })
    container.addEventListener('touchmove', handleTouchMove, {
      passive: true,
    })
    container.addEventListener('touchend', handleTouchEnd, {
      passive: true,
    })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [loading, refreshing, refresh])

  const toggleSetting = (
    key: keyof Pick<
      UserPreferences,
      | 'ai_enabled'
      | 'auto_categorize'
      | 'weekly_report'
      | 'monthly_report'
      | 'push_notifications'
      | 'email_summary'
    >
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

  const handleSave = async () => {
    if (!user?.id || !dirty || saving) return

    setSaving(true)

    try {
      const result = await updateSettings({
        preferences: draft,
      })

      showToast(
        result.synced
          ? 'Preferências salvas e sincronizadas.'
          : 'Preferências salvas neste dispositivo. A nuvem será atualizada quando houver conexão.',
        result.synced ? 'success' : 'info'
      )
    } catch (error: any) {
      showToast(
        error?.message || 'Não foi possível salvar as preferências.',
        'error'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleThemeToggle = () => {
    toggleTheme()
    showToast(
      theme === 'dark' ? 'Tema claro ativado.' : 'Tema escuro ativado.',
      'info'
    )
  }

  if (loading && !storedSettings) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-[#f8f9fa] px-4 pb-28 pt-4 font-sans transition-colors duration-300 dark:bg-slate-900">
        <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 pb-3 backdrop-blur-xl dark:bg-slate-900/92">
          <div className="rounded-[24px] border border-gray-200/70 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-gray-200/70 bg-gray-50 text-gray-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-300"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-[20px] font-semibold text-gray-800 dark:text-gray-100">
                Configurações IA
              </h2>
              <div className="w-10" />
            </div>
          </div>
        </div>

        <div className="mt-3">
          <SettingsSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="mx-auto min-h-screen max-w-md bg-[#f8f9fa] px-4 pb-28 pt-4 font-sans transition-colors duration-300 dark:bg-slate-900"
    >
      {refreshing && (
        <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center pt-6">
          <div className="flex items-center gap-2 rounded-full border border-gray-200/70 bg-white px-4 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-semibold text-teal-600">
              Atualizando...
            </span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 pb-3 backdrop-blur-xl dark:bg-slate-900/92">
        <div className="rounded-[24px] border border-gray-200/70 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-gray-200/70 bg-gray-50 text-gray-600 transition-colors active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-300"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0 flex-1 text-center">
              <h2 className="flex items-center justify-center gap-2 text-[20px] font-semibold tracking-tight text-gray-800 dark:text-gray-100">
                <Settings size={20} className="text-teal-600" />
                Configurações IA
              </h2>
              <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">
                Preferências sincronizadas entre seus dispositivos
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              aria-label="Salvar preferências"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-teal-600 shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin text-white" />
              ) : (
                <Save size={18} className="text-white" />
              )}
            </button>
          </div>

          <ContextToggle />
        </div>
      </div>

      <div className="mb-3 rounded-[22px] border border-teal-100 bg-teal-50/80 px-4 py-3 dark:border-teal-900/40 dark:bg-teal-950/20">
        <div className="flex items-start gap-3">
          <Sparkles
            size={18}
            className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400"
          />
          <p className="text-[12px] leading-relaxed text-teal-800 dark:text-teal-300">
            As preferências ficam salvas no aparelho e na sua conta. Recursos
            automáticos só executam quando o módulo correspondente estiver
            disponível.
          </p>
        </div>
      </div>

      <div className="space-y-3 animate-in fade-in duration-300">
        <section className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-teal-50 dark:bg-teal-900/20">
              <Bot size={18} className="text-teal-700 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">
                Assistente IA
              </h3>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">
                Comportamento preferido do assistente
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <SettingToggle
              label="Habilitar IA"
              description="Controla o acesso ao Chat inteligente. Desativado, o Chat não envia solicitações ao serviço de IA."
              checked={draft.ai_enabled}
              onChange={() => toggleSetting('ai_enabled')}
            />
            <SettingToggle
              label="Auto categorização"
              description="Guarda sua preferência para categorização automática. O lançamento só será alterado quando um fluxo compatível usar essa opção."
              checked={draft.auto_categorize}
              onChange={() => toggleSetting('auto_categorize')}
            />
          </div>
        </section>

        <section className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-blue-50 dark:bg-blue-900/20">
              <MessageSquare
                size={18}
                className="text-blue-700 dark:text-blue-400"
              />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">
                Resumos e automações
              </h3>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">
                Preferências preparadas para os módulos automáticos
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <SettingToggle
              label="Relatório semanal"
              description="Guardar preferência por um resumo semanal."
              checked={draft.weekly_report}
              onChange={() => toggleSetting('weekly_report')}
              badge="Preferência"
            />
            <SettingToggle
              label="Relatório mensal"
              description="Guardar preferência por um resumo financeiro mensal."
              checked={draft.monthly_report}
              onChange={() => toggleSetting('monthly_report')}
              badge="Preferência"
            />
            <SettingToggle
              label="Resumo por e-mail"
              description="Guardar preferência para receber resumos por e-mail."
              checked={draft.email_summary}
              onChange={() => toggleSetting('email_summary')}
              badge="Preferência"
            />
          </div>
        </section>

        <section className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-purple-50 dark:bg-purple-900/20">
              <Bell
                size={18}
                className="text-purple-700 dark:text-purple-400"
              />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">
                Notificações
              </h3>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">
                A mesma preferência usada nas configurações rápidas
              </p>
            </div>
          </div>

          <SettingToggle
            label="Notificações no dispositivo"
            description="Controla a preferência geral de alertas do aplicativo."
            checked={draft.push_notifications}
            onChange={() => toggleSetting('push_notifications')}
          />
        </section>

        <section className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-amber-50 dark:bg-amber-900/20">
              <Sun size={18} className="text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">
                Aparência
              </h3>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">
                Preferências visuais do aplicativo
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <SettingToggle
              label="Tema escuro"
              description={theme === 'dark' ? 'Escuro ativado' : 'Claro ativado'}
              checked={theme === 'dark'}
              onChange={handleThemeToggle}
            />

            <div className="flex items-center justify-between gap-4 rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <div>
                <p className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                  Idioma
                </p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">
                  Português (Brasil)
                </p>
              </div>
              <span className="rounded-full bg-gray-200/80 px-2.5 py-1 text-[10px] font-semibold text-gray-500 dark:bg-slate-700 dark:text-gray-300">
                Atual
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-rose-50 dark:bg-rose-900/20">
              <Shield size={18} className="text-rose-700 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">
                Privacidade
              </h3>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">
                Preferências sem promessas de coleta inexistente
              </p>
            </div>
          </div>

          <div className="rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <Zap
                size={17}
                className="mt-0.5 shrink-0 text-gray-500 dark:text-gray-400"
              />
              <div>
                <p className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                  Dados de uso
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
                  Esta tela não habilita envio adicional de telemetria. A
                  preferência permanece desativada até existir um fluxo
                  específico e transparente para isso.
                </p>
              </div>
            </div>
          </div>
        </section>

        {dirty && (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="text-[12px] font-medium text-amber-800 dark:text-amber-300">
              Existem alterações ainda não salvas.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
