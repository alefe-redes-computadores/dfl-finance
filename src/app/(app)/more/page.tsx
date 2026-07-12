
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
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

// 🔥 IMPORTANDO OS SERVIÇOS DE EXPORTAÇÃO CORRIGIDOS
import { exportTransactionsToCSV, exportAnalysisToCSV, downloadCSV } from '@/lib/services/exportService'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[12px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-3 ml-2 mt-8 tracking-widest flex items-center gap-2">
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
  badge,
  colorClass = 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30'
}: {
  iconName: string
  label: string
  href?: string
  disabled?: boolean
  onClick?: () => void
  badge?: string
  colorClass?: string
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
    <div className={`flex items-center group w-full transition-all active:scale-[0.98] ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50/80 dark:hover:bg-slate-700/30'}`}>
      <div className="pl-4 py-3">
        <div className={`w-[38px] h-[38px] rounded-2xl flex items-center justify-center transition-transform ${disabled ? 'bg-gray-100 dark:bg-slate-700 text-gray-400' : `${colorClass} group-hover:scale-110`}`}>
          <IconComp size={18} strokeWidth={2.5} />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-between pr-4 py-4 ml-4 border-b border-gray-100 dark:border-slate-700/50 group-last:border-0">
        <div className="flex-1 min-w-0">
          <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200 truncate block">
            {label}
          </span>
          {disabled && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 block font-medium">
              Requer contexto PJ ativo
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {badge && (
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 flex-shrink-0 animate-pulse">
              {badge}
            </span>
          )}
          {disabled ? (
            <Lock size={16} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 group-hover:translate-x-1 transition-transform flex-shrink-0" />
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

// ... (QuickSettingsModal permanece igual)
function QuickSettingsModal({
  isOpen, onClose, theme, toggleTheme, notificationsEnabled, toggleNotifications, appMode, toggleAppMode,
}: any) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-t-[32px] sm:rounded-3xl w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-10 duration-300" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[20px] bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
              <Settings size={24} className="text-gray-700 dark:text-gray-300" />
            </div>
            <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Configurações</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-[20px] p-4 border border-gray-100 dark:border-slate-700 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                {theme === 'dark' ? <Moon size={20} className="text-indigo-500" /> : <Sun size={20} className="text-amber-500" />}
              </div>
              <div>
                <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Tema Escuro</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{theme === 'dark' ? 'Ativado' : 'Desativado'}</p>
              </div>
            </div>
            <button onClick={toggleTheme} className={`w-12 h-7 rounded-full relative transition-colors shadow-inner ${theme === 'dark' ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${theme === 'dark' ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          {/* Notifications Toggle */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-[20px] p-4 border border-gray-100 dark:border-slate-700 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                {notificationsEnabled ? <Bell size={20} className="text-rose-500" /> : <BellOff size={20} className="text-gray-400" />}
              </div>
              <div>
                <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Notificações</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{notificationsEnabled ? 'Ativadas' : 'Desativadas'}</p>
              </div>
            </div>
            <button onClick={toggleNotifications} className={`w-12 h-7 rounded-full relative transition-colors shadow-inner ${notificationsEnabled ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${notificationsEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          {/* App Mode Toggle */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-[20px] p-4 border border-gray-100 dark:border-slate-700 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                <Building size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Gestão de Empresas</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  {appMode === 'full' ? 'Modo PF e PJ' : 'Apenas PF'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleAppMode}
              className={`w-12 h-7 rounded-full relative transition-colors shadow-inner ${appMode === 'full' ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${appMode === 'full' ? 'right-1' : 'left-1'}`} />
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
  const { appMode, setAppMode, effectiveContext } = useContext_()
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()

  const [showExportModal, setShowExportModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [exportRange, setExportRange] = useState('30')
  const [exportContext, setExportContext] = useState<'dfl' | 'personal'>('personal')
  const [name, setName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)

  const [showCropModal, setShowCropModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('dfl_notifications_enabled')
    setNotificationsEnabled(saved !== 'false')
    setExportContext(effectiveContext)
  }, [effectiveContext])

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
        .upsert({ user_id: user.id, app_mode: newMode, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      if (error) throw error
      showToast(newMode === 'full' ? 'Modo PF e PJ Ativado!' : 'Modo Apenas PF Ativado!', 'success')
    } catch (err: any) {
      console.error('Erro de Supabase:', err.message)
      showToast('Alterado apenas localmente.', 'info')
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
      ctx?.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 400, 400)

      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
        const filePath = `${user?.id}-${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
        
        if (uploadError) {
          showToast('Erro no upload da foto', 'error')
          setUploading(false)
          return
        }
        
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
        await supabase.auth.updateUser({ data: { custom_avatar_url: data.publicUrl } })
        
        setUploading(false)
        setShowCropModal(false)
        window.location.reload()
      }, 'image/jpeg')
    }
    img.src = selectedImage!
  }

  // 🔥 EXPORTAÇÃO BLINDADA COM O NOVO MOTOR LOCAL
  const handleExport = async (type: 'transactions' | 'analysis') => {
    if (!user?.id) return
    setExporting(true)
    
    try {
      const finalContext = appMode === 'personal_only' ? 'personal' : exportContext
      
      let csvData = ''
      let fileNameData = ''

      if (type === 'transactions') {
        const { csv, filename } = await exportTransactionsToCSV(user.id, finalContext, exportRange)
        csvData = csv
        fileNameData = filename
      } else {
        const { csv, filename } = await exportAnalysisToCSV(user.id, finalContext, new Date())
        csvData = csv
        fileNameData = filename
      }

      downloadCSV(csvData, fileNameData)
      
      showToast('Exportação concluída com sucesso!', 'success')
      setShowExportModal(false)
    } catch (error: any) {
      showToast(error.message || 'Erro ao exportar dados.', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300">
      
      {/* Indicador de carregamento fluido */}
      {loadingPulse && (
        <div className="fixed top-12 right-6 z-50">
          <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {/* Crop Modal Omitido/Preservado */}
      {showCropModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 p-6 rounded-[32px] animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-xl mb-6 text-center text-gray-800 dark:text-gray-100">Ajuste a foto</h3>
            <div className="relative w-full aspect-square bg-gray-100 dark:bg-slate-700 overflow-hidden rounded-[24px] shadow-inner border border-gray-200 dark:border-slate-600">
              {selectedImage && <img src={selectedImage} alt="Crop" className="w-full h-full object-cover" />}
            </div>
            <div className="flex gap-4 mt-6">
              <button type="button" onClick={() => setShowCropModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-[20px] font-bold transition-colors hover:bg-gray-200 dark:hover:bg-slate-600 active:scale-95">Cancelar</button>
              <button type="button" onClick={handleCropAndUpload} className="flex-1 py-4 bg-teal-600 text-white rounded-[20px] font-bold shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-colors active:scale-95 flex items-center justify-center gap-2">
                {uploading ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}
                Salvar Foto
              </button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}

      {/* NOVO MODAL DE EXPORTAÇÃO */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-sm" onClick={() => !exporting && setShowExportModal(false)}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-t-[32px] sm:rounded-3xl w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-10 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Exportar Dados</h3>
               <button type="button" onClick={() => setShowExportModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={20}/></button>
            </div>

            {appMode === 'full' && (
              <>
                <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 tracking-widest ml-1">Contexto</p>
                <div className="flex gap-2 mb-6">
                  {(['dfl', 'personal'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setExportContext(c)}
                      className={`flex-1 py-3 rounded-2xl text-[13px] font-bold transition-all active:scale-95 ${exportContext === c ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-slate-600'}`}
                    >
                      {c === 'dfl' ? 'Empresa (PJ)' : 'Pessoal (PF)'}
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 tracking-widest ml-1">Período</p>
            <div className="flex gap-2 mb-6">
              {[{ key: '7', label: '7d' }, { key: '14', label: '14d' }, { key: '30', label: '30d' }, { key: 'total', label: 'Tudo' }].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setExportRange(opt.key)}
                  className={`flex-1 py-3 rounded-2xl text-[13px] font-bold transition-all active:scale-95 ${exportRange === opt.key ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-slate-600'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <button type="button" disabled={exporting} onClick={() => handleExport('transactions')} className="w-full flex items-center gap-4 p-4 rounded-[20px] bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors active:scale-[0.98] disabled:opacity-50">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                   {exporting ? <RefreshCw size={20} className="text-emerald-600 animate-spin" /> : <ReceiptText size={20} className="text-emerald-600 dark:text-emerald-400" />}
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Extrato (Transações)</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Lista completa em CSV</p>
                </div>
              </button>

              <button type="button" disabled={exporting} onClick={() => handleExport('analysis')} className="w-full flex items-center gap-4 p-4 rounded-[20px] bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors active:scale-[0.98] disabled:opacity-50">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                   {exporting ? <RefreshCw size={20} className="text-indigo-600 animate-spin" /> : <PieChart size={20} className="text-indigo-600 dark:text-indigo-400" />}
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Análise Consolidada</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Resumo por categorias</p>
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

      {/* HEADER & PERFIL UNIFICADO */}
      <div className="px-4 pt-4 mb-6">
        {profileLoading ? (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-[28px] flex items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-50 dark:border-slate-700/50 animate-pulse">
            <Skeleton variant="circle" width="56px" height="56px" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" width="120px" />
              <Skeleton variant="text" width="180px" />
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-[28px] flex items-center gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-50 dark:border-slate-700/50 animate-in fade-in duration-300">
            <div className="relative w-[56px] h-[56px] shrink-0 group">
              <img
                src={user?.user_metadata?.custom_avatar_url || user?.user_metadata?.avatar_url || '/avatar.png'}
                className={`w-full h-full rounded-[20px] object-cover shadow-sm transition-all ${uploading ? 'opacity-50' : 'opacity-100 group-hover:scale-105'}`}
                alt="Perfil"
              />
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[20px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                <Camera size={18} className="text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={uploading} />
              </label>
            </div>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2 mb-1">
                  <input value={name} onChange={(e) => setName(e.target.value)} className="bg-gray-100 dark:bg-slate-700 dark:text-gray-200 px-3 py-1.5 rounded-xl text-[14px] w-full outline-none font-bold focus:ring-2 focus:ring-teal-500/20" autoFocus />
                  <button type="button" onClick={saveName} className="bg-teal-600 text-white p-2 rounded-xl shadow-md active:scale-90 transition-transform"><Check size={16} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="font-bold text-[16px] text-gray-800 dark:text-gray-100 truncate tracking-tight">{name || 'Usuário'}</h2>
                  {!isGoogleLogin && (
                    <button type="button" onClick={() => setIsEditing(true)} className="text-gray-400 dark:text-gray-500 hover:text-teal-600 transition-colors flex-shrink-0"><Edit2 size={12} /></button>
                  )}
                </div>
              )}
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
            </div>
            
            {/* Botão de Configurações incorporado no Card de Perfil */}
            <button type="button" onClick={() => setShowSettingsModal(true)} className="w-10 h-10 bg-gray-50 dark:bg-slate-700 rounded-[14px] flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-600 transition-colors flex-shrink-0 active:scale-95">
              <Settings size={20} />
            </button>
          </div>
        )}

        {/* COMPACT PREMIUM STRIP */}
        <div className="mt-4 bg-gradient-to-r from-teal-500 to-emerald-600 rounded-[20px] p-0.5 shadow-lg shadow-teal-500/20 relative overflow-hidden group cursor-default">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="bg-slate-900/10 dark:bg-slate-900/40 backdrop-blur-md rounded-[18px] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles size={16} className="text-teal-100" />
              <div>
                <h3 className="font-bold text-[13px] text-white tracking-wide">DFL Finance <span className="text-teal-200">PRO</span></h3>
                <p className="text-[10px] text-teal-50 font-medium opacity-90">Gestão premium, 100% gratuita.</p>
              </div>
            </div>
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Building size={14} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Soft UI Sections */}
        <div>
          <SectionTitle>Organizar</SectionTitle>
          <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-slate-700/60 overflow-hidden">
            <MenuItem iconName="wallet" label="Contas" href="/accounts" colorClass="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30" />
            <MenuItem iconName="credit-card" label="Cartões de Crédito" href="/cards" colorClass="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30" />
            <MenuItem iconName="tags" label="Categorias" href="/categories" colorClass="text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30" />
            <MenuItem iconName="hash" label="Tags" href="/tags" colorClass="text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700" />
          </div>
        </div>

        <div>
          <SectionTitle>Planejar</SectionTitle>
          <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-slate-700/60 overflow-hidden">
            <MenuItem iconName="pie-chart" label="Orçamento" href="/budgets" colorClass="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30" />
            <MenuItem iconName="target" label="Metas e Caixinhas" href="/goals" colorClass="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30" />
            <MenuItem iconName="trending-up" label="Projeções" href="/projections" colorClass="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30" />
          </div>
        </div>

        <div>
          <SectionTitle>Acompanhar</SectionTitle>
          <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-slate-700/60 overflow-hidden">
            <MenuItem iconName="repeat" label="Recorrências" href="/subscriptions" colorClass="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30" />
            <MenuItem iconName="file-text" label="Financiamentos" href="/financings" colorClass="text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30" />
            <MenuItem iconName="users" label="Quem me deve" href="/debts" colorClass="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30" />
            <MenuItem iconName="arrow-right-left" label="Empréstimos PF/PJ" href={appMode === 'full' ? '/loans' : undefined} disabled={appMode === 'personal_only'} colorClass="text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30" />
          </div>
        </div>

        <div>
          <SectionTitle>Analisar</SectionTitle>
          <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-slate-700/60 overflow-hidden">
            <MenuItem iconName="bar-chart" label="Relatório Personalizado" href="/analysis" colorClass="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30" />
            <MenuItem iconName="pie-chart" label="Relatórios Avançados" href="/reports" colorClass="text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/30" badge="Pro" />
          </div>
        </div>

        <div>
          <SectionTitle>Ferramentas</SectionTitle>
          <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-slate-700/60 overflow-hidden">
            <MenuItem iconName="bot" label="Assistente IA" href="/assistant" badge="Novo" colorClass="text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/30" />
            <MenuItem iconName="check-square" label="Conciliação Inteligente" href="/conciliation" colorClass="text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30" />
            <MenuItem iconName="image" label="Importar Comprovante" href="/import" colorClass="text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30" />
            <MenuItem iconName="file-spreadsheet" label="Importar Extrato (CSV)" href="/import-csv" colorClass="text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30" />
            <MenuItem iconName="download" label="Exportar Dados" onClick={() => setShowExportModal(true)} colorClass="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700" />
          </div>
        </div>

      </div>

      <div className="px-4 mt-10 mb-8">
        <button
          type="button"
          onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
          className="w-full flex items-center justify-center gap-2 p-4 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/50 text-red-500 dark:text-red-400 rounded-[24px] transition-colors font-bold text-[14px] shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.98]"
        >
          <LogOut size={18} strokeWidth={2.5} /> Sair do Aplicativo
        </button>
      </div>
      
      {/* Assinatura Álefe */}
      <div className="text-center pb-8 opacity-70">
        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-1">DFL Finance • v4.0.0</p>
        <p className="text-[10px] text-gray-500 font-medium">Desenvolvido com ♥ por <span className="font-bold text-teal-600 dark:text-teal-400">Álefe Jôhsefe</span></p>
      </div>
    </div>
  )
}
