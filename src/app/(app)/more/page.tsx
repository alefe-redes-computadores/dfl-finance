'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  Wallet, Tags, ChevronRight, LogOut, Camera, Check, Edit2, Bot, Lock,
  CreditCard, Hash, PieChart, Target, TrendingUp, Users, X,
  Sun, Moon, Download, ReceiptText, PiggyBank
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export default function MorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [modalOpen, setModalOpen] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportRange, setExportRange] = useState('30')
  const [name, setName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  const [showCropModal, setShowCropModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const isGoogleLogin = user?.app_metadata?.provider === 'google'

  useEffect(() => { 
    if (user?.id) setName(user.user_metadata?.full_name || '') 
  }, [user?.id, user?.user_metadata?.full_name])

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
    const img = new Image()
    img.src = selectedImage!
    
    img.onload = () => {
      const size = Math.min(img.width, img.height)
      canvas.width = 400
      canvas.height = 400
      ctx?.drawImage(img, (img.width - size)/2, (img.height - size)/2, size, size, 0, 0, 400, 400)
      
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
        const filePath = `${user?.id}-${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
        if (uploadError) { alert('Erro no upload'); return }
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
        await supabase.auth.updateUser({ data: { custom_avatar_url: data.publicUrl } })
        setShowCropModal(false)
        window.location.reload()
      }, 'image/jpeg')
    }
    setUploading(false)
  }

  const handleExport = (type: string) => {
    if (!user) return
    const endpoint = type === 'transactions' ? 'export-transactions' : 'export-analysis'
    window.open(`/api/${endpoint}?userId=${user.id}&context=dfl&range=${exportRange}`, '_blank')
    setShowExportModal(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 px-5 pt-8 font-sans transition-colors duration-300">
      
      {showCropModal && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 p-4 rounded-3xl">
            <h3 className="font-bold mb-4 text-center text-gray-800 dark:text-gray-100">Ajuste seu rosto</h3>
            <div className="relative w-full aspect-square bg-gray-200 dark:bg-slate-700 overflow-hidden rounded-2xl">
               {selectedImage && <img src={selectedImage} alt="Crop" className="w-full h-full object-cover" />}
            </div>
            <div className="flex gap-4 mt-6">
              <button onClick={() => setShowCropModal(false)} className="flex-1 py-3 text-gray-500 dark:text-gray-400 font-bold">Cancelar</button>
              <button onClick={handleCropAndUpload} className="flex-1 py-3 bg-teal-700 text-white rounded-xl font-bold">Cortar e Salvar</button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}

      {/* Modal Exportar */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setShowExportModal(false)}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-100">Exportar Dados</h3>
            
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2">Período</p>
            <div className="flex gap-2 mb-4">
              {[{ key: '7', label: '7 dias' }, { key: '14', label: '14 dias' }, { key: '30', label: '30 dias' }, { key: 'total', label: 'Total' }].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setExportRange(opt.key)}
                  className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${exportRange === opt.key ? 'bg-teal-700 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <button onClick={() => handleExport('transactions')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors">
                <ReceiptText size={20} className="text-teal-700 dark:text-teal-400" />
                <div className="text-left">
                  <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Extrato de Transações</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">Lista completa de transações (CSV)</p>
                </div>
              </button>
              <button onClick={() => handleExport('analysis')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors">
                <PieChart size={20} className="text-teal-700 dark:text-teal-400" />
                <div className="text-left">
                  <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Resumo por Categoria</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">Gastos agrupados por categoria (CSV)</p>
                </div>
              </button>
            </div>

            <button onClick={() => setShowExportModal(false)} className="w-full mt-4 py-3 text-gray-500 dark:text-gray-400 font-bold text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto mb-4"><Bot size={32} className="text-teal-700 dark:text-teal-400" /></div>
            <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-100">Saindo do forno!</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">Estamos preparando essa função com muito capricho.</p>
            <button onClick={() => setModalOpen(false)} className="w-full bg-teal-800 text-white py-3 rounded-xl font-bold">Entendido</button>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Mais</h1>
      
      <div className="bg-gradient-to-r from-teal-700 to-orange-500 rounded-2xl p-4 mb-8 text-white shadow-lg">
        <h3 className="font-bold">DFL Finance Pro</h3>
        <p className="text-xs text-teal-50">Sem limites e relatórios avançados</p>
      </div>
      
      {/* Perfil */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl flex items-center gap-4 mb-8 shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="relative w-16 h-16">
          <img 
            src={user?.user_metadata?.custom_avatar_url || user?.user_metadata?.avatar_url || '/avatar.png'} 
            className={`w-full h-full rounded-full object-cover border-2 border-gray-100 dark:border-slate-600 ${uploading ? 'opacity-50' : 'opacity-100'}`} 
            alt="Perfil"
          />
          <label className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
            <Camera size={20} className="text-white" />
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
        </div>

        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center gap-2 mb-1">
              <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="bg-gray-100 dark:bg-slate-700 dark:text-gray-200 px-3 py-1.5 rounded-lg text-sm w-full outline-none font-medium" 
                autoFocus
              />
              <button onClick={saveName} className="bg-teal-700 text-white p-1.5 rounded-lg">
                <Check size={16}/>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">{name || 'Usuário'}</h2>
              {!isGoogleLogin && (
                <button onClick={() => setIsEditing(true)} className="text-gray-400 dark:text-gray-500 hover:text-teal-700 transition-colors">
                  <Edit2 size={14}/>
                </button>
              )}
            </div>
          )}
          <p className="text-gray-500 dark:text-gray-400 text-sm truncate">{user?.email}</p>
        </div>
      </div>

      {/* Preferências - Modo Escuro */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 mb-6">
        <button 
          onClick={toggleTheme}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            {theme === 'dark' ? (
              <Moon size={20} className="text-teal-700 dark:text-teal-400" />
            ) : (
              <Sun size={20} className="text-teal-700 dark:text-teal-400" />
            )}
            <span className="font-medium text-gray-700 dark:text-gray-200">Modo escuro</span>
          </div>
          <div className={`w-10 h-6 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-teal-700' : 'bg-gray-300'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${theme === 'dark' ? 'right-1' : 'left-1'}`} />
          </div>
        </button>
      </div>

      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-3 px-1">Organizar</h4>
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 mb-6 overflow-hidden">
        <Link href="/accounts" className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          <div className="flex items-center gap-3 font-medium text-gray-700 dark:text-gray-200"><Wallet className="text-teal-700 dark:text-teal-400" size={20}/> Contas</div>
          <ChevronRight size={18} className="text-gray-400 dark:text-gray-500"/>
        </Link>
        <Link href="/cards" className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          <div className="flex items-center gap-3 font-medium text-gray-700 dark:text-gray-200"><CreditCard className="text-teal-700 dark:text-teal-400" size={20}/> Cartões</div>
          <ChevronRight size={18} className="text-gray-400 dark:text-gray-500"/>
        </Link>
        <Link href="/categories" className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          <div className="flex items-center gap-3 font-medium text-gray-700 dark:text-gray-200"><Tags className="text-teal-700 dark:text-teal-400" size={20}/> Categorias</div>
          <ChevronRight size={18} className="text-gray-400 dark:text-gray-500"/>
        </Link>
        <Link href="/tags" className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          <div className="flex items-center gap-3 font-medium text-gray-700 dark:text-gray-200"><Hash className="text-teal-700 dark:text-teal-400" size={20}/> Tags</div>
          <ChevronRight size={18} className="text-gray-400 dark:text-gray-500"/>
        </Link>
        <Link href="/budgets" className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          <div className="flex items-center gap-3 font-medium text-gray-700 dark:text-gray-200"><Target className="text-teal-700 dark:text-teal-400" size={20}/> Orçamentos</div>
          <ChevronRight size={18} className="text-gray-400 dark:text-gray-500"/>
        </Link>
        {/* NOVO: Metas */}
        <Link href="/goals" className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          <div className="flex items-center gap-3 font-medium text-gray-700 dark:text-gray-200"><PiggyBank className="text-teal-700 dark:text-teal-400" size={20}/> Metas</div>
          <ChevronRight size={18} className="text-gray-400 dark:text-gray-500"/>
        </Link>
        {/* Exportar Dados */}
        <button onClick={() => setShowExportModal(true)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          <div className="flex items-center gap-3 font-medium text-gray-700 dark:text-gray-200"><Download className="text-teal-700 dark:text-teal-400" size={20}/> Exportar Dados</div>
          <ChevronRight size={18} className="text-gray-400 dark:text-gray-500"/>
        </button>
      </div>

      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-3 px-1">No forno</h4>
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 opacity-70 overflow-hidden">
        {[ 
          {icon: TrendingUp, title: 'Projeções'}, 
          {icon: Users, title: 'Assinaturas'}
        ].map((item, i) => (
          <button key={i} onClick={() => setModalOpen(true)} className="w-full flex items-center justify-between p-4 border-b border-gray-50 dark:border-slate-700 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
                <item.icon size={16} />
              </div>
              <span className="font-medium text-sm text-gray-700 dark:text-gray-200">{item.title}</span>
            </div>
            <Lock size={14} className="text-gray-400 dark:text-gray-500" />
          </button>
        ))}
      </div>

      <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="w-full mt-8 flex items-center justify-center gap-2 p-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-colors font-bold">
        <LogOut size={20} /> Sair do Aplicativo
      </button>
    </div>
  )
}