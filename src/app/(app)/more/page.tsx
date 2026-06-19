'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { 
  Wallet, CreditCard, Tags, Hash, PieChart, Target, TrendingUp, 
  RefreshCw, Landmark, Users, FileText, BarChart2, Bot, ScanLine, 
  FileDown, Settings, ChevronRight, Moon, Sun, Camera, Edit2, Check, X, LogOut 
} from 'lucide-react'

// Aqui criamos a regra de tipagem para acalmar o TypeScript no Vercel
type MenuItem = {
  icon: any
  label: string
  active: boolean
  href?: string
  isPro?: boolean // O ponto de interrogação diz que é opcional
}

type MenuSection = {
  title: string
  items: MenuItem[]
}

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

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploadingAvatar(true)
      const file = event.target.files?.[0]
      if (!file) return

      const fileExt = file.name.split('.').pop()
      const filePath = `${user!.id}-${Math.random()}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
      setAvatarUrl(publicUrl)
    } catch (error) {
      alert('Erro ao enviar a foto de perfil.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function saveName() {
    if (!nameInput.trim()) return
    try {
      await supabase.auth.updateUser({ data: { full_name: nameInput } })
      setDisplayName(nameInput)
      setIsEditingName(false)
    } catch (error) {
      alert('Erro ao atualizar o nome.')
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Estrutura do Menu com a tipagem aplicada
  const menuData: MenuSection[] = [
    {
      title: 'Organizar',
      items: [
        { icon: Wallet, label: 'Contas', href: '/accounts', active: true },
        { icon: CreditCard, label: 'Cartões de Crédito', active: false },
        { icon: Tags, label: 'Categorias', href: '/categories', active: true },
        { icon: Hash, label: 'Tags', active: false },
      ]
    },
    {
      title: 'Planejar',
      items: [
        { icon: PieChart, label: 'Orçamento', active: false },
        { icon: Target, label: 'Metas', active: false },
        { icon: TrendingUp, label: 'Projeções', active: false },
      ]
    },
    {
      title: 'Acompanhar',
      items: [
        { icon: RefreshCw, label: 'Assinaturas', active: false },
        { icon: Landmark, label: 'Financiamentos', active: false },
        { icon: Users, label: 'Quem me deve', active: false, isPro: true },
      ]
    },
    {
      title: 'Analisar',
      items: [
        { icon: FileText, label: 'Relatório personalizado', active: false },
        { icon: BarChart2, label: 'Relatórios avançados', active: false, isPro: true },
      ]
    },
    {
      title: 'Ferramentas',
      items: [
        { icon: Bot, label: 'Assistente IA', active: false },
        { icon: ScanLine, label: 'Importar comprovante', active: false },
        { icon: FileDown, label: 'Importar extrato (CSV)', active: false },
      ]
    },
    {
      title: 'App',
      items: [
        { icon: Settings, label: 'Configurações', active: false },
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">

        {/* Header Simples */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Mais</h1>
          <button onClick={toggleTheme} className="p-2 text-gray-500 hover:text-yellow-500 transition-colors">
            {dark ? <Sun size={22} /> : <Moon size={22} />}
          </button>
        </div>

        {/* Perfil Simplificado */}
        <div className="flex items-center gap-4 mb-6">
          <label className="relative w-14 h-14 rounded-2xl bg-brand-teal flex items-center justify-center overflow-hidden cursor-pointer shadow-sm group shrink-0">
            {uploadingAvatar ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-xl">{displayName.charAt(0).toUpperCase()}</span>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={18} className="text-white" />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
          </label>

          <div className="flex-1 overflow-hidden">
            {isEditingName ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-gray-200 dark:bg-zinc-800 border-none rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white outline-none"
                  autoFocus
                />
                <button onClick={saveName} className="p-2 bg-green-100 text-green-600 rounded-lg"><Check size={14} /></button>
                <button onClick={() => setIsEditingName(false)} className="p-2 bg-red-100 text-red-600 rounded-lg"><X size={14} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{displayName}</h2>
                {!isGoogleLogin && (
                  <button onClick={() => setIsEditingName(true)} className="p-1 text-gray-400">
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>

        {/* Banner DFL Pro */}
        <div className="w-full bg-gradient-to-r from-teal-700 via-teal-600 to-orange-400 rounded-2xl p-5 mb-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-white">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <h3 className="font-bold text-lg">DFL Pro</h3>
            </div>
            <p className="text-sm text-teal-50 mb-3 w-4/5">Relatórios avançados, temas e tudo sem limite</p>
            <button className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-4 py-2 rounded-full backdrop-blur-sm transition-colors">
              Experimente 7 dias grátis
            </button>
          </div>
          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50" size={24} />
        </div>

        {/* Listas do Menu */}
        <div className="space-y-6">
          {menuData.map((section, index) => (
            <div key={index}>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 pl-1">{section.title}</h4>
              <div className="space-y-1">
                {section.items.map((item, itemIdx) => {
                  const Icon = item.icon
                  
                  const ItemContent = (
                    <div className={`w-full flex items-center justify-between p-3 rounded-2xl transition-colors ${item.active ? 'hover:bg-gray-100 dark:hover:bg-zinc-900 active:bg-gray-200' : 'opacity-50 cursor-not-allowed'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.active ? 'bg-brand-teal/10 dark:bg-brand-teal/20' : 'bg-gray-200 dark:bg-zinc-800'}`}>
                          <Icon size={20} className={item.active ? 'text-brand-teal' : 'text-gray-500'} />
                        </div>
                        <span className={`font-medium ${item.active ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-500'}`}>
                          {item.label}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {item.isPro && (
                          <span className="text-xs font-bold text-brand-teal bg-brand-teal/10 px-2 py-1 rounded-md">Pro</span>
                        )}
                        <ChevronRight size={18} className="text-gray-300 dark:text-zinc-700" />
                      </div>
                    </div>
                  )

                  if (item.active && item.href) {
                    return (
                      <Link href={item.href} key={itemIdx} className="block">
                        {ItemContent}
                      </Link>
                    )
                  }

                  return (
                    <div key={itemIdx}>
                      {ItemContent}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Botão de Logout */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-zinc-800">
          <button onClick={handleLogout} className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <LogOut size={20} className="text-red-500" />
            </div>
            <span className="font-medium text-red-500">Sair da conta</span>
          </button>
        </div>

      </div>
    </div>
  )
}
