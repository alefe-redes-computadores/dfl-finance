'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Wallet, CreditCard, Tags, Hash, PieChart, Target, TrendingUp, Users, BarChart2, Bot, ChevronRight, Moon, Sun, Camera, Edit2, Check, X, LogOut, Lock } from 'lucide-react'

export default function MorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  
  // Estados do Perfil
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [displayName, setDisplayName] = useState('Usuário')
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const isGoogleLogin = user?.app_metadata?.provider === 'google'

  useEffect(() => {
    if (user) {
      setAvatarUrl(user.user_metadata?.avatar_url || user.user_metadata?.picture || '')
      const name = user.user_metadata?.full_name || user.user_metadata?.name || 'Usuário'
      setDisplayName(name)
      setNameInput(name)
    }
  }, [user])

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploadingAvatar(true)
      const file = event.target.files?.[0]
      if (!file) return
      const filePath = `${user!.id}-${Math.random()}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
      setAvatarUrl(publicUrl)
    } catch (error) { alert('Erro ao enviar foto.') } finally { setUploadingAvatar(false) }
  }

  async function saveName() {
    await supabase.auth.updateUser({ data: { full_name: nameInput } })
    setDisplayName(nameInput)
    setIsEditingName(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-brand-teal/10 rounded-full flex items-center justify-center mx-auto mb-4"><Bot size={32} className="text-brand-teal" /></div>
            <h3 className="font-bold text-lg mb-2">Saindo do forno!</h3>
            <p className="text-gray-500 mb-6 text-sm">Estamos preparando essa função com muito capricho.</p>
            <button onClick={() => setModalOpen(false)} className="w-full bg-brand-teal text-white py-3 rounded-xl font-bold">Entendido</button>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-5 pt-8">
        <h1 className="text-2xl font-semibold mb-6">Mais</h1>
        
        {/* Banner Pro */}
        <div className="bg-gradient-to-r from-teal-700 to-orange-500 rounded-2xl p-4 mb-8 text-white flex items-center justify-between shadow-lg">
          <div><h3 className="font-bold">DFL Finance Pro</h3><p className="text-xs text-teal-50">Sem limites e relatórios avançados</p></div>
          <button className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">Ver</button>
        </div>

        {/* Perfil Restaurado */}
        <div className="flex items-center gap-4 mb-8 bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
           <label className="relative w-14 h-14 rounded-2xl bg-brand-teal flex items-center justify-center overflow-hidden cursor-pointer shadow-sm group shrink-0">
             {uploadingAvatar ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : 
              avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <span className="text-white font-bold text-xl">{displayName.charAt(0).toUpperCase()}</span>}
             <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={18} className="text-white" /></div>
             <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
           </label>
           <div className="flex-1 overflow-hidden">
             {isEditingName ? (
               <div className="flex items-center gap-2"><input value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full bg-gray-100 dark:bg-zinc-800 rounded-lg px-2 py-1 text-sm outline-none" /><button onClick={saveName} className="text-green-500"><Check size={16} /></button><button onClick={() => setIsEditingName(false)} className="text-red-500"><X size={16} /></button></div>
             ) : (
               <div className="flex items-center gap-2">
                 <h2 className="text-lg font-semibold truncate text-gray-900 dark:text-white">{displayName}</h2>
                 {!isGoogleLogin && <button onClick={() => setIsEditingName(true)} className="text-gray-400"><Edit2 size={12} /></button>}
               </div>
             )}
             <p className="text-sm text-gray-500 truncate">{user?.email}</p>
           </div>
        </div>

        {/* Menu */}
        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 px-1">Menu Principal</h4>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border mb-6">
          <Link href="/accounts" className="flex items-center justify-between p-4 border-b hover:bg-gray-50"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center"><Wallet size={16} className="text-brand-teal" /></div><span className="font-medium text-sm">Contas</span></div><ChevronRight size={16} /></Link>
          <Link href="/categories" className="flex items-center justify-between p-4 hover:bg-gray-50"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center"><Tags size={16} className="text-brand-teal" /></div><span className="font-medium text-sm">Categorias</span></div><ChevronRight size={16} /></Link>
        </div>

        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 px-1">No forno</h4>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border opacity-70">
          {[CreditCard, Hash, PieChart, Target, TrendingUp, Users, BarChart2].map((Icon, i) => (
            <button key={i} onClick={() => setModalOpen(true)} className="w-full flex items-center justify-between p-4 border-b last:border-0 hover:bg-gray-50">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><Icon size={16} className="text-gray-500" /></div><span className="font-medium text-sm text-gray-600">Função {i+1}</span></div>
              <Lock size={14} className="text-gray-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
