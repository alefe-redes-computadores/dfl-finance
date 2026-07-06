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
import { db } from '@/lib/db' // 🔥 ADICIONADO


// ============================================================
// SKELETON LOADER
// ============================================================
const SettingsSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-32 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    </div>

    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
            </div>
          </div>
          <div className="w-12 h-7 bg-gray-200 dark:bg-slate-700 rounded-full" />
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

  // ============================================================
  // 🔥 CORRIGIDO: Removido realtime: true
  // ============================================================
  const { data: localSettings, loading: settingsLoading, reload: reloadSettings } = useLocalData({
    table: 'user_settings' as any,
    filters: { user_id: user?.id },
  })

  // 🔥 REMOVIDOS: const { update: updateSettings } = useLocalData({ table: 'user_settings' as any })
  // 🔥 REMOVIDOS: const { create: createSettings } = useLocalData({ table: 'user_settings' as any })

  // ============================================================
  // ESTADOS LOCAIS
  // ============================================================
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

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
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

  // ============================================================
  // LOAD DATA
  // ============================================================
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

  // ============================================================
  // HANDLERS
  // ============================================================
  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // ============================================================
  // 🔥 HANDLE SAVE CORRIGIDO
  // ============================================================
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
        // 🔥 CORRIGIDO: Usando db.table().update()
        await db.table('user_settings').update((localSettings[0] as any).id, payload)
      } else {
        // 🔥 CORRIGIDO: Usando db.table().add()
        await db.table('user_settings').add({
          id: crypto.randomUUID(),
          ...payload,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        })
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

  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
        {loadingPulse && (
          <div className="fixed top-20 right-4 z-50">
            <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">Configurações IA</h2>
          <div className="w-10" />
        </div>
        <SettingsSkeleton />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Settings size={24} className="text-teal-600" />
          Configurações IA
        </h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-9 h-9 bg-teal-700 rounded-full flex items-center justify-center shadow-lg shadow-teal-700/20 active:scale-90 transition-transform"
        >
          {saving ? <Loader2 size={20} className="animate-spin text-white" /> : <Save size={20} className="text-white" />}
        </button>
      </div>

      <div className="mb-4">
        <ContextToggle />
      </div>

      <div className="space-y-4 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
              <Bot size={20} className="text-teal-700 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100">Assistente IA</h3>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Configurações do assistente inteligente</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
              <div>
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Habilitar IA</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Ativar o assistente para recomendações</p>
              </div>
              <button
                onClick={() => toggleSetting('ai_enabled')}
                className={`w-11 h-6 rounded-full relative transition-colors ${settings.ai_enabled ? 'bg-teal-700' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.ai_enabled ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
              <div>
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Auto categorização</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Categorizar automaticamente transações</p>
              </div>
              <button
                onClick={() => toggleSetting('auto_categorize')}
                className={`w-11 h-6 rounded-full relative transition-colors ${settings.auto_categorize ? 'bg-teal-700' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.auto_categorize ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <MessageSquare size={20} className="text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100">Relatórios</h3>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Agendamento de relatórios automáticos</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
              <div>
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Relatório semanal</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Receber resumo semanal por e-mail</p>
              </div>
              <button
                onClick={() => toggleSetting('weekly_report')}
                className={`w-11 h-6 rounded-full relative transition-colors ${settings.weekly_report ? 'bg-teal-700' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.weekly_report ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
              <div>
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Relatório mensal</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Análise detalhada mensal</p>
              </div>
              <button
                onClick={() => toggleSetting('monthly_report')}
                className={`w-11 h-6 rounded-full relative transition-colors ${settings.monthly_report ? 'bg-teal-700' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.monthly_report ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
              <Bell size={20} className="text-purple-700 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100">Notificações</h3>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Preferências de notificações</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
              <div>
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Notificações push</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Alertas no celular</p>
              </div>
              <button
                onClick={() => toggleSetting('push_notifications')}
                className={`w-11 h-6 rounded-full relative transition-colors ${settings.push_notifications ? 'bg-teal-700' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.push_notifications ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
              <div>
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Resumo por e-mail</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Receber resumos por e-mail</p>
              </div>
              <button
                onClick={() => toggleSetting('email_summary')}
                className={`w-11 h-6 rounded-full relative transition-colors ${settings.email_summary ? 'bg-teal-700' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.email_summary ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
              <Sun size={20} className="text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100">Aparência</h3>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Tema e idioma</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
              <div>
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Tema</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{theme === 'dark' ? 'Escuro' : 'Claro'}</p>
              </div>
              <button
                onClick={toggleThemeHandler}
                className={`w-11 h-6 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-teal-700' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${theme === 'dark' ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
              <div>
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Idioma</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Português (Brasil)</p>
              </div>
              <button className="text-gray-400 hover:text-gray-600 transition-colors">
                <ChevronLeft size={18} className="rotate-180" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <Shield size={20} className="text-red-700 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100">Privacidade</h3>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Dados e segurança</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
              <div>
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Compartilhar dados de uso</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Ajudar a melhorar a IA</p>
              </div>
              <button
                onClick={() => toggleSetting('share_usage_data')}
                className={`w-11 h-6 rounded-full relative transition-colors ${settings.share_usage_data ? 'bg-teal-700' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.share_usage_data ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/50 dark:to-emerald-950/50 rounded-[24px] p-5 border border-teal-100 dark:border-teal-800">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} className="text-teal-700 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-teal-800 dark:text-teal-300">Assistente IA</p>
              <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">
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