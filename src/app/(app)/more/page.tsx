'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
// 🔥 NOVO: Importando o db para que o botão de pânico funcione
import { db } from '@/lib/db'
import {
  ChevronRight, Camera, Edit2, Check, LogOut, Sun, Moon, X, Bot, Lock,
  Download, ReceiptText, PieChart, Sparkles, Settings, Bell, BellOff, Building, RefreshCw
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/contexts/ToastContext'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useSafeDb } from '@/hooks/useSafeDb'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[13px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 ml-4 mt-6 tracking-widest">
      {children}
    </h4>
  )
}

function MenuItem({
  iconName,
  label,
  href,
  disabled = false,
  onClick,
  badge
}: {
  iconName: string
  label: string
  href?: string
  disabled?: boolean
  onClick?: () => void
  badge?: string
}) {
  const router = useRouter()
  const IconComp = getDynamicIcon(iconName)

  const handleClick = () => {
    if (disabled) return
    if (href) {
      router.push(href)
    } else if (onClick) {
      onClick()
    }
  }

  const content = (
    <div className={`flex items-center group w-full transition-all active:scale-[0.98] ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30'}`}>
      <div className="pl-4 py-3">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
          disabled ? 'bg-gray-100 dark:bg-slate-700 text-gray-400' : 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 group-hover:scale-110'
        }`}>
          <IconComp size={20} />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-between pr-4 py-4 ml-4 border-b border-gray-50 dark:border-slate-700/50 group-last:border-0">
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-[15px] text-gray-800 dark:text-gray-200 truncate block">
            {label}
          </span>
          {disabled && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 block">
              Requer dois contextos (PF e PJ)
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {badge && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 flex-shrink-0 animate-pulse">
              {badge}
            </span>
          )}
          {disabled ? (
            <Lock size={16} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
          ) : (
            <ChevronRight size={18} className="text-gray-300 dark:text-gray-500 group-hover:translate-x-1 transition-transform flex-shrink-0" />
          )}
        </div>
      </div>
    </div>
  )

  if (disabled) {
    return <button type="button" className="w-full text-left" onClick={() => {}}>{content}</button>
  }

  if (href) {
    return <Link href={href} className="w-full">{content}</Link>
  }

  return <button type="button" className="w-full text-left" onClick={handleClick}>{content}</button>
}

function QuickSettingsModal({
  isOpen,
  onClose,
  theme,
  toggleTheme,
  notificationsEnabled,
  toggleNotifications,
  appMode,
  toggleAppMode,
}: {
  isOpen: boolean
  onClose: () => void
  theme: string
  toggleTheme: () => void
  notificationsEnabled: boolean
  toggleNotifications: () => void
  appMode: 'personal_only' | 'full' | null
  toggleAppMode: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-t-[32px] sm:rounded-3xl w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-10 duration-300" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[20px] bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
              <Settings size={24} className="text-teal-700 dark:text-teal-400" />
            </div>
            <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Configurações</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-[20px] p-4 border border-gray-100 dark:border-slate-700 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                {theme === 'dark' ? <Moon size={20} className="text-indigo-500" /> : <Sun size={20} className="text-amber-500" />}
              </div>
              <div>
                <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">Modo escuro</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">{theme === 'dark' ? 'Ativado' : 'Desativado'}</p>
              </div>
            </div>
            <button onClick={toggleTheme} className={`w-14 h-8 rounded-full relative transition-colors shadow-inner ${theme === 'dark' ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${theme === 'dark' ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-[20px] p-4 border border-gray-100 dark:border-slate-700 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                {notificationsEnabled ? <Bell size={20} className="text-rose-500" /> : <BellOff size={20} className="text-gray-400" />}
              </div>
              <div>
                <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">Notificações</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">{notificationsEnabled ? 'Ativadas' : 'Desativadas'}</p>
              </div>
            </div>
            <button onClick={toggleNotifications} className={`w-14 h-8 rounded-full relative transition-colors shadow-inner ${notificationsEnabled ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${notificationsEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-[20px] p-4 border border-gray-100 dark:border-slate-700 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                <Building size={20} className="text-teal-500" />
              </div>
              <div>
                <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">Modo PF e PJ</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">
                  {appMode === 'full' ? 'Gerenciar PF e PJ' : 'Apenas Pessoa Física'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleAppMode}
              className={`w-14 h-8 rounded-full relative transition-colors shadow-inner ${
                appMode === 'full' ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${
                appMode === 'full' ? 'right-1' : 'left-1'
              }`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { theme, toggleTheme: toggleThemeOriginal } = useTheme()
  const { showToast } = useToast()
  const { appMode, setAppMode } = useContext_()
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()

  const [showExportModal, setShowExportModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [exportRange, setExportRange] = useState('30')
  const [exportContext, setExportContext] = useState<'dfl' | 'personal'>('dfl')
  const [name, setName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)

  const [showCropModal, setShowCropModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('dfl_notifications_enabled')
    setNotificationsEnabled(saved !== 'false')
  }, [])

  useEffect(() => {
    if (user?.id) {
      setName(user.user_metadata?.full_name || '')
      setLoadingPulse(true)
      const timer = setTimeout(() => {
        setProfileLoading(false)
        setLoadingPulse(false)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [user?.id, user?.user_metadata?.full_name])

  const toggleTheme = () => {
    toggleThemeOriginal()
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    showToast(newTheme === 'dark' ? 'Modo escuro ativado' : 'Modo escuro desativado', 'success')
  }

  const toggleNotifications = () => {
    const newValue = !notificationsEnabled
    setNotificationsEnabled(newValue)
    localStorage.setItem('dfl_notifications_enabled', String(newValue))
    showToast(newValue ? 'Notificações ativadas' : 'Notificações desativadas', 'success')
  }

  const toggleAppMode = async () => {
    if (!user?.id) return
    
    const newMode = appMode === 'full' ? 'personal_only' : 'full'
    
    setAppMode(newMode)
    localStorage.setItem('dfl_app_mode', newMode)

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          app_mode: newMode,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (error) throw error

      showToast(
        newMode === 'full' ? 'Modo PF e PJ Ativado!' : 'Modo Apenas PF Ativado!', 
        'success'
      )
    } catch (err: any) {
      console.error('Erro de Supabase:', err.message)
      showToast('Erro ao salvar na nuvem, mas salvo no celular!', 'error')
    }
  }

  const isGoogleLogin = user?.app_metadata?.provider === 'google'

  const saveName = async () => {
    if (!name.trim()) return
    await supabase.auth.updateUser({ data: { full_name: name } })
    setIsEditing(false)
    window.location.reload()
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string)
        setShowCropModal(true)
      }
      reader.readAsDataURL(event.target.files[0])
    }
  }

  const handleCropAndUpload = async () => {
    if (!canvasRef.current) return
    setUploading(true)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = document.createElement('img')

    img.onload = () => {
      const size = Math.min(img.width, img.height)
      canvas.width = 400
      canvas.height = 400
      ctx?.drawImage(
        img,
        (img.width - size) / 2,
        (img.height - size) / 2,
        size,
        size,
        0,
        0,
        400,
        400
      )

      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
        const filePath = `${user?.id}-${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file)
        
        if (uploadError) {
          alert('Erro no upload')
          setUploading(false)
          return
        }
        
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
        await supabase.auth.updateUser({
          data: { custom_avatar_url: data.publicUrl }
        })
        
        setUploading(false)
        setShowCropModal(false)
        window.location.reload()
      }, 'image/jpeg')
    }

    img.src = selectedImage!
  }

  const handleExport = (type: string) => {
    if (!user) return
    const endpoint = type === 'transactions' ? 'export-transactions' : 'export-analysis'
    const finalContext = appMode === 'personal_only' ? 'personal' : exportContext
    window.open(`/api/${endpoint}?userId=${user.id}&context=${finalContext}&range=${exportRange}`, '_blank')
    setShowExportModal(false)
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 px-4 pt-8 font-sans transition-colors duration-300">
      
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {showCropModal && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 p-6 rounded-[32px] animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-xl mb-6 text-center text-gray-800 dark:text-gray-100">Ajuste a foto</h3>
            <div className="relative w-full aspect-square bg-gray-100 dark:bg-slate-700 overflow-hidden rounded-[24px] shadow-inner border border-gray-200 dark:border-slate-600">
              {selectedImage && <img src={selectedImage} alt="Crop" className="w-full h-full object-cover" />}
            </div>
            <div className="flex gap-4 mt-6">
              <button onClick={() => setShowCropModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-[20px] font-bold transition-colors hover:bg-gray-200 dark:hover:bg-slate-600 active:scale-95">Cancelar</button>
              <button onClick={handleCropAndUpload} className="flex-1 py-4 bg-teal-700 text-white rounded-[20px] font-bold shadow-lg shadow-teal-700/20 hover:bg-teal-800 transition-colors active:scale-95 flex items-center justify-center gap-2">
                {uploading ? <RefreshCw size={18} className="animate-spin" /> : null}
                Salvar Foto
              </button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-sm" onClick={() => setShowExportModal(false)}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-t-[32px] sm:rounded-3xl w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-10 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Exportar Dados</h3>
               <button onClick={() => setShowExportModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={20}/></button>
            </div>

            {appMode === 'full' && (
              <>
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-3 tracking-widest">Contexto</p>
                <div className="flex gap-2 mb-6">
                  {(['dfl', 'personal'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setExportContext(c)}
                      className={`flex-1 py-3 rounded-2xl text-[14px] font-bold transition-all active:scale-95 ${exportContext === c ? 'bg-teal-700 text-white shadow-md' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-slate-600'}`}
                    >
                      {c === 'dfl' ? 'PJ' : 'PF'}
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-3 tracking-widest">Período</p>
            <div className="flex gap-2 mb-8">
              {[{ key: '7', label: '7' }, { key: '14', label: '14' }, { key: '30', label: '30' }, { key: 'total', label: 'Tudo' }].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setExportRange(opt.key)}
                  className={`flex-1 py-3 rounded-2xl text-[14px] font-bold transition-all active:scale-95 ${exportRange === opt.key ? 'bg-teal-700 text-white shadow-md' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-slate-600'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <button onClick={() => handleExport('transactions')} className="w-full flex items-center gap-4 p-4 rounded-[20px] bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors active:scale-[0.98]">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                   <ReceiptText size={20} className="text-teal-700 dark:text-teal-400" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">Extrato CSV</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Lista completa de transações</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <QuickSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        theme={theme}
        toggleTheme={toggleTheme}
        notificationsEnabled={notificationsEnabled}
        toggleNotifications={toggleNotifications}
        appMode={appMode}
        toggleAppMode={toggleAppMode}
      />

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[28px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">Mais</h1>
        <button onClick={() => setShowSettingsModal(true)} className="p-2.5 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-gray-100 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:text-teal-700 dark:hover:text-teal-400 transition-colors active:scale-90">
          <Settings size={20} />
        </button>
      </div>

      <div className="bg-slate-900 dark:bg-slate-800 rounded-[24px] p-6 mb-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-gradient-to-br from-teal-400 to-emerald-600 rounded-full blur-3xl opacity-20" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-[18px] flex items-center justify-center border border-white/10">
            <Sparkles size={24} className="text-teal-400" />
          </div>
          <div>
            <h3 className="font-bold text-[17px] tracking-wide">DFL Finance <span className="text-teal-400 ml-1">PRO</span></h3>
            <p className="text-[12px] text-gray-400 font-medium mt-0.5">Gestão de alto nível, 100% gratuita.</p>
          </div>
        </div>
      </div>

      {profileLoading ? (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-[24px] flex items-center gap-5 mb-8 shadow-sm border border-gray-50 dark:border-slate-700/50 animate-pulse">
          <Skeleton variant="circle" width="64px" height="64px" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="140px" />
            <Skeleton variant="text" width="200px" />
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-[24px] flex items-center gap-5 mb-8 shadow-sm border border-gray-50 dark:border-slate-700/50 animate-in fade-in duration-300">
          <div className="relative w-16 h-16 shrink-0 group">
            <img
              src={user?.user_metadata?.custom_avatar_url || user?.user_metadata?.avatar_url || '/avatar.png'}
              className={`w-full h-full rounded-[20px] object-cover shadow-sm transition-all ${uploading ? 'opacity-50' : 'opacity-100 group-hover:scale-105'}`}
              alt="Perfil"
            />
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[20px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
              <Camera size={20} className="text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={uploading} />
            </label>
          </div>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2 mb-1">
                <input value={name} onChange={(e) => setName(e.target.value)} className="bg-gray-100 dark:bg-slate-700 dark:text-gray-200 px-3 py-2 rounded-xl text-[15px] w-full outline-none font-bold focus:ring-2 focus:ring-teal-500/20" autoFocus />
                <button onClick={saveName} className="bg-teal-700 text-white p-2.5 rounded-xl shadow-md active:scale-90 transition-transform"><Check size={18} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-0.5">
                <h2 className="font-bold text-[18px] text-gray-800 dark:text-gray-100 truncate tracking-tight">{name || 'Usuário'}</h2>
                {!isGoogleLogin && (
                  <button onClick={() => setIsEditing(true)} className="text-gray-400 dark:text-gray-500 hover:text-teal-700 transition-colors flex-shrink-0 p-1"><Edit2 size={14} /></button>
                )}
              </div>
            )}
            <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
      )}

      <div className="space-y-6 animate-in fade-in duration-300">
        
        <div>
          <SectionTitle>Organizar</SectionTitle>
          <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-50 dark:border-slate-700/50 overflow-hidden">
            <MenuItem iconName="wallet" label="Contas" href="/accounts" />
            <MenuItem iconName="credit-card" label="Cartões de Crédito" href="/cards" />
            <MenuItem iconName="tags" label="Categorias" href="/categories" />
            <MenuItem iconName="hash" label="Tags" href="/tags" />
          </div>
        </div>

        <div>
          <SectionTitle>Planejar</SectionTitle>
          <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-50 dark:border-slate-700/50 overflow-hidden">
            <MenuItem iconName="pie-chart" label="Orçamento" href="/budgets" />
            <MenuItem iconName="target" label="Metas" href="/goals" />
            <MenuItem iconName="trending-up" label="Projeções" href="/projections" />
          </div>
        </div>

        <div>
          <SectionTitle>Acompanhar</SectionTitle>
          <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-50 dark:border-slate-700/50 overflow-hidden">
            <MenuItem iconName="repeat" label="Assinaturas" href="/subscriptions" />
            <MenuItem iconName="file-text" label="Financiamentos" href="/financings" />
            <MenuItem iconName="users" label="Quem me deve" href="/debts" />
            <MenuItem iconName="users" label="Contatos" href="/contacts" />
            <MenuItem 
              iconName="arrow-right-left" 
              label={appMode === 'personal_only' ? 'Empréstimos entre Contextos' : 'Empréstimos entre Contextos'} 
              href={appMode === 'personal_only' ? undefined : '/loans'}
              disabled={appMode === 'personal_only'}
            />
          </div>
        </div>

        <div>
          <SectionTitle>Analisar</SectionTitle>
          <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-50 dark:border-slate-700/50 overflow-hidden">
            <MenuItem iconName="bar-chart" label="Relatório Personalizado" href="/analysis" />
            <MenuItem iconName="pie-chart" label="Relatórios Avançados" href="/reports" />
          </div>
        </div>

        <div>
          <SectionTitle>Ferramentas</SectionTitle>
          <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-50 dark:border-slate-700/50 overflow-hidden">
            <MenuItem iconName="bot" label="Assistente IA" href="/assistant" badge="Novo" />
            <MenuItem iconName="check-square" label="Conciliação Inteligente" href="/conciliation" badge="Novo" />
            <MenuItem iconName="image" label="Importar Comprovante" href="/import" />
            <MenuItem iconName="image" label="Galeria de Comprovantes" href="/receipts" />
            <MenuItem iconName="file-spreadsheet" label="Importar Extrato CSV" href="/import-csv" />
            <MenuItem iconName="download" label="Exportar Dados" onClick={() => setShowExportModal(true)} />
          </div>
        </div>
      </div>

      {/* 🔥 BOTÃO DE PÂNICO PARA LIMPAR A FILA DE SYNC */}
      <button
        onClick={async () => {
          if (confirm("Você quer limpar a fila de sincronização travada? Os itens não salvos serão descartados.")) {
            try {
              await db.table('syncQueue').clear();
              alert("Fila limpa com sucesso! Recarregue o app.");
              window.location.reload();
            } catch (e) {
              alert("Erro ao limpar: " + e);
            }
          }
        }}
        className="w-full mt-10 mb-4 flex items-center justify-center gap-3 p-4 bg-rose-600 text-white hover:bg-rose-700 rounded-[20px] transition-colors font-bold text-[15px] shadow-lg shadow-rose-600/20 active:scale-[0.98]"
      >
        <RefreshCw size={20} /> LIMPAR FILA DE SYNC (Zumbis)
      </button>

      <button
        onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
        className="w-full mb-6 flex items-center justify-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-[20px] transition-colors font-bold text-[15px] active:scale-[0.98]"
      >
        <LogOut size={20} /> Encerrar Sessão
      </button>
      
      <p className="text-center text-[11px] text-gray-400 font-medium pb-8">Versão 4.0.0 • DFL Finance</p>
    </div>
  )
}
