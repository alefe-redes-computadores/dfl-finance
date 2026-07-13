'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Save, RefreshCw, Loader2, Check, X,
  Bot, Settings, Sparkles, Zap, Brain, MessageSquare,
  AlertCircle, Info, Shield, Key, Globe, Moon, Sun,
  Bell
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useTheme } from '@/contexts/ThemeContext'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { db, addToSyncQueue } from '@/lib/db'

// 🔥 SKELETON ATUALIZADO
const SettingsSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-200/70 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-[18px] bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-32 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    </div>

    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-200/70 dark:border-slate-700">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[14px] bg-gray-200 dark:bg-slate-700 shrink-0" />
            <div className="space-y-2 min-w-0">
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
            </div>
          </div>
          <div className="w-12 h-7 bg-gray-200 dark:bg-slate-700 rounded-full shrink-0" />
        </div>
      </div>
    ))}
  </div>
)

export default function AssistantSettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { theme, toggleTheme } = useTheme()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data: localSettings, loading: settingsLoading, reload: reloadSettings } = useLocalData({
    table: 'user_settings' as any,
    filters: { user_id: user?.id },
  })

  const [settings, setSettings] = useState({
    ai_enabled: true,
    auto_categorize: true,
    weekly_report: true,
    monthly_report: true,
    push_notifications: true,
    email_summary: false,
    language: 'pt-BR',
    theme_preference: 'system',
    share_usage_data: false,
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 10 || loading) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const pullDistance = e.touches[0].clientY - pullStartY.current
    if (pullDistance > 60) {
      setRefreshing(true)
      isPulling.current = false
      loadSettings().finally(() => setRefreshing(false))
    }
  }

  const handleTouchEnd = () => {
    isPulling.current = false
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [loading, refreshing])

  const loadSettings = async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    try {
      await reloadSettings()

      if (localSettings && localSettings.length > 0) {
        const data = localSettings[0] as any
        setSettings({
          ai_enabled: data.ai_enabled ?? true,
          auto_categorize: data.auto_categorize ?? true,
          weekly_report: data.weekly_report ?? true,
          monthly_report: data.monthly_report ?? true,
          push_notifications: data.push_notifications ?? true,
          email_summary: data.email_summary ?? false,
          language: data.language || 'pt-BR',
          theme_preference: data.theme_preference || 'system',
          share_usage_data: data.share_usage_data ?? false,
        })
      }
    } catch (err) {
      console.error('Erro ao carregar configurações:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }

  useEffect(() => {
    if (user?.id) loadSettings()
  }, [user?.id])

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)

    try {
      const payload = {
        user_id: user.id,
        ...settings,
        updated_at: new Date().toISOString(),
      }

      if (localSettings && localSettings.length > 0) {
        const existingId = (localSettings[0] as any).id
        await db.table('user_settings').update(existingId, payload)
        await addToSyncQueue(user.id, 'user_settings' as any, 'update', existingId, payload)
      } else {
        const id = crypto.randomUUID()
        const fullPayload = {
          id,
          ...payload,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        await db.table('user_settings').add(fullPayload)
        await addToSyncQueue(user.id, 'user_settings' as any, 'create', id, fullPayload)
      }

      showToast('Configurações salvas!', 'success')
    } catch (err: any) {
      showToast(`Erro: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleThemeHandler = () => {
    toggleTheme()
    showToast(theme === 'dark' ? 'Modo claro ativado' : 'Modo escuro ativado', 'info')
  }

  // 🔥 LOADING STATE ATUALIZADO
  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-4 transition-colors duration-300">
        {loadingPulse && (
          <div className="fixed top-20 right-4 z-50">
            <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
          </div>
        )}

        <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl pb-3">
          <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => router.back()}
                className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-600 dark:text-gray-300"
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
      className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-4 transition-colors duration-300"
    >
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200/70 dark:border-slate-700">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* 🔥 HEADER UNIFICADO */}
      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl pb-3">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              onClick={() => router.back()}
              className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0 flex-1 text-center">
              <h2 className="text-[20px] font-semibold text-gray-800 dark:text-gray-100 flex items-center justify-center gap-2 tracking-tight">
                <Settings size={20} className="text-teal-600" />
                Configurações IA
              </h2>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                Preferências do assistente e automações
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="h-10 w-10 rounded-[16px] bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-all active:scale-[0.98] shrink-0 disabled:opacity-70"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin text-white" />
              ) : (
                <Save size={18} className="text-white" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <ContextToggle />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 animate-in fade-in duration-300">
        {/* 🔥 ASSISTENTE IA */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-200/70 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[16px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
              <Bot size={18} className="text-teal-700 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="font-semibold text-[15px] text-gray-800 dark:text-gray-100">Assistente IA</h3>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">Configurações do assistente inteligente</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-[18px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3">
              <div className="pr-3">
                <p className="font-semibold text-[14px] text-gray-800 dark:text-gray-200">Habilitar IA</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Ativar o assistente para recomendações</p>
              </div>
              <button
                onClick={() => toggleSetting('ai_enabled')}
                className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${settings.ai_enabled ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${settings.ai_enabled ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-[18px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3">
              <div className="pr-3">
                <p className="font-semibold text-[14px] text-gray-800 dark:text-gray-200">Auto categorização</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Categorizar automaticamente transações</p>
              </div>
              <button
                onClick={() => toggleSetting('auto_categorize')}
                className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${settings.auto_categorize ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${settings.auto_categorize ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* 🔥 RELATÓRIOS */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-200/70 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[16px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <MessageSquare size={18} className="text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-[15px] text-gray-800 dark:text-gray-100">Relatórios</h3>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">Agendamento de relatórios automáticos</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-[18px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3">
              <div className="pr-3">
                <p className="font-semibold text-[14px] text-gray-800 dark:text-gray-200">Relatório semanal</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Receber resumo semanal por e-mail</p>
              </div>
              <button
                onClick={() => toggleSetting('weekly_report')}
                className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${settings.weekly_report ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${settings.weekly_report ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-[18px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3">
              <div className="pr-3">
                <p className="font-semibold text-[14px] text-gray-800 dark:text-gray-200">Relatório mensal</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Análise detalhada mensal</p>
              </div>
              <button
                onClick={() => toggleSetting('monthly_report')}
                className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${settings.monthly_report ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${settings.monthly_report ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* 🔥 NOTIFICAÇÕES */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-200/70 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[16px] bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
              <Bell size={18} className="text-purple-700 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-[15px] text-gray-800 dark:text-gray-100">Notificações</h3>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">Preferências de notificações</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-[18px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3">
              <div className="pr-3">
                <p className="font-semibold text-[14px] text-gray-800 dark:text-gray-200">Notificações push</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Alertas no celular</p>
              </div>
              <button
                onClick={() => toggleSetting('push_notifications')}
                className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${settings.push_notifications ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${settings.push_notifications ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-[18px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3">
              <div className="pr-3">
                <p className="font-semibold text-[14px] text-gray-800 dark:text-gray-200">Resumo por e-mail</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Receber resumos por e-mail</p>
              </div>
              <button
                onClick={() => toggleSetting('email_summary')}
                className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${settings.email_summary ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${settings.email_summary ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* 🔥 APARÊNCIA */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-200/70 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[16px] bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Sun size={18} className="text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-[15px] text-gray-800 dark:text-gray-100">Aparência</h3>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">Tema e idioma</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-[18px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3">
              <div className="pr-3">
                <p className="font-semibold text-[14px] text-gray-800 dark:text-gray-200">Tema</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">{theme === 'dark' ? 'Escuro' : 'Claro'}</p>
              </div>
              <button
                onClick={toggleThemeHandler}
                className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${theme === 'dark' ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${theme === 'dark' ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-[18px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3">
              <div className="pr-3">
                <p className="font-semibold text-[14px] text-gray-800 dark:text-gray-200">Idioma</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Português (Brasil)</p>
              </div>
              <button className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-white dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <ChevronLeft size={16} className="rotate-180" />
              </button>
            </div>
          </div>
        </div>

        {/* 🔥 PRIVACIDADE */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-200/70 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[16px] bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <Shield size={18} className="text-red-700 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-[15px] text-gray-800 dark:text-gray-100">Privacidade</h3>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">Dados e segurança</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-[18px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3">
              <div className="pr-3">
                <p className="font-semibold text-[14px] text-gray-800 dark:text-gray-200">Compartilhar dados de uso</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Ajudar a melhorar a IA</p>
              </div>
              <button
                onClick={() => toggleSetting('share_usage_data')}
                className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${settings.share_usage_data ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${settings.share_usage_data ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* 🔥 FOOTER INFO */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-200/70 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[16px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-teal-700 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-800 dark:text-gray-100">Assistente IA</p>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">
                As configurações serão aplicadas em todas as telas do assistente.
                {settings.ai_enabled && ' O assistente está ativo e pronto para ajudar.'}
                {!settings.ai_enabled && ' O assistente está desativado.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}