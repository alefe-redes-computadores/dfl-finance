'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { 
  Wallet, CreditCard, Tags, Hash, PieChart, Target, TrendingUp, 
  RefreshCw, Landmark, Users, FileText, BarChart2, Bot, ScanLine, 
  FileDown, Settings, ChevronRight, Moon, Sun, Camera, Edit2, Check, X, LogOut, Lock 
} from 'lucide-react'

export default function MorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [dark, setDark] = useState(false)

  // Estados do Perfil
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [displayName, setDisplayName] = useState('Usuário')
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const isGoogleLogin = user?.app_metadata?.provider === 'google'

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') {
      document.documentElement.classList.add('dark')
      setDark(true)
    }
  }, [])

  useEffect(() => {
    if (user) {
      setAvatarUrl(user.user_metadata?.avatar_url || user.user_metadata?.picture || '')
      const name = user.user_metadata?.full_name || user.user_metadata?.name || 'Usuário'
      setDisplayName(name)
      setNameInput(name)
    }
  }, [user])

  function toggleTheme() {
    if (dark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    }
    setDark(!dark)
  }

  // Feedback divertido para funcionalidades indisponíveis
  const handleComingSoon = () => {
    alert('🍔 Estamos preparando essa funcionalidade no capricho! Já já ela sai do forno, fique ligado!')
  }

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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Definição dos itens do menu
  const menuItems = [
    { icon: Wallet, label: 'Contas', href: '/accounts', active: true },
    { icon: Tags, label: 'Categorias', href: '/categories', active: true },
    { icon: CreditCard, label: 'Cartões', active: false },
    { icon: Hash, label: 'Tags', active: false },
    { icon: PieChart, label: 'Orçamento', active: false },
    { icon: Target, label: 'Metas', active: false },
    { icon: TrendingUp, label: 'Projeções', active: false },
    { icon: Users, label: 'Quem me deve', active: false, isPro: true },
    { icon: BarChart2, label: 'Relatórios Pro', active: false, isPro: true },
    { icon: Bot, label: 'Assistente IA', active: false },
    { icon: ScanLine, label: 'Importar comprovante', active: false },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Mais</h1>
          <button onClick={toggleTheme} className="p-2 text-gray-500 hover:text-yellow-500 transition-colors">
            {dark ? <Sun size={22} /> : <Moon size={22} />}
          </button>
        </div>

        {/* Perfil */}
        <div className="flex items-center gap-4 mb-8 bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
           <label className="relative w-14 h-14 rounded-2xl bg-brand-teal flex items-center justify-center overflow-hidden cursor-pointer shadow-sm group shrink-0">
             {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <span className="text-white font-bold text-xl">{displayName.charAt(0).toUpperCase()}</span>}
             <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={18} className="text-white" /></div>
             <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
           </label>
           <div className="flex-1 overflow-hidden">
             {isEditingName ? (
               <div className="flex items-center gap-2"><input value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full bg-gray-100 dark:bg-zinc-800 rounded-lg px-2 py-1 text-sm outline-none" /><button onClick={saveName} className="text-green-500"><Check size={16} /></button></div>
             ) : (
               <div className="flex items-center gap-2">
                 <h2 className="text-lg font-semibold truncate">{displayName}</h2>
                 {!isGoogleLogin && <button onClick={() => setIsEditingName(true)} className="text-gray-400"><Edit2 size={12} /></button>}
               </div>
             )}
             <p className="text-sm text-gray-500">{user?.email}</p>
           </div>
        </div>

        {/* Menu Principal (Ativo) */}
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Menu Principal</h4>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm mb-6 border border-gray-100 dark:border-zinc-800">
          {menuItems.filter(i => i.active).map((item, idx) => (
            <Link href={item.href!} key={idx} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-teal/10 flex items-center justify-center"><item.icon size={18} className="text-brand-teal" /></div>
                <span className="font-medium text-gray-800 dark:text-gray-200">{item.label}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </Link>
          ))}
        </div>

        {/* Em Breve / Pro */}
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">No forno / Premium</h4>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 opacity-70">
          {menuItems.filter(i => !i.active).map((item, idx) => (
            <button key={idx} onClick={handleComingSoon} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center"><item.icon size={18} className="text-gray-500" /></div>
                <span className="font-medium text-gray-600 dark:text-gray-400">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.isPro && <span className="text-[10px] font-bold text-orange-500 bg-orange-100 px-2 py-0.5 rounded-full">PRO</span>}
                <Lock size={16} className="text-gray-300" />
              </div>
            </button>
          ))}
        </div>

        {/* Logout */}
        <button onClick={handleLogout} className="mt-8 w-full flex items-center gap-3 p-4 text-red-500 font-medium hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-colors">
          <LogOut size={20} /> Sair da conta
        </button>
      </div>
    </div>
  )
}
