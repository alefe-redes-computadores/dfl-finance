'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Wallet, Tag, LogOut, Moon, Sun, ChevronRight, Camera, Edit2, Check, X } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function MorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [dark, setDark] = useState(false)

  // Estados do Avatar e Nome
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [displayName, setDisplayName] = useState('Usuário')
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  // Verifica se o login foi feito pelo Google
  const isGoogleLogin = user?.app_metadata?.provider === 'google'

  // Efeito do Tema (Dark Mode)
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') {
      document.documentElement.classList.add('dark')
      setDark(true)
    }
  }, [])

  // Efeito do Perfil
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

  // UPLOAD DE AVATAR
  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploadingAvatar(true)
      const file = event.target.files?.[0]
      if (!file) return

      const fileExt = file.name.split('.').pop()
      const filePath = `${user!.id}-${Math.random()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      })

      setAvatarUrl(publicUrl)
    } catch (error) {
      alert('Erro ao enviar a foto de perfil.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  // SALVAR NOME
  async function saveName() {
    if (!nameInput.trim()) return
    try {
      await supabase.auth.updateUser({
        data: { full_name: nameInput }
      })
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

  const sections = [
    {
      title: 'Organizar',
      items: [
        { icon: Wallet, label: 'Contas', href: '/accounts' },
        { icon: Tag, label: 'Categorias', href: '/categories' },
      ]
    },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mais</h1>
        <button
          onClick={toggleTheme}
          className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm"
        >
          {dark
            ? <Sun size={18} className="text-yellow-500" />
            : <Moon size={18} className="text-gray-500" />
          }
        </button>
      </div>

      {/* User Card (Otimizado) */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-4 flex items-center gap-4">
        {/* Avatar */}
        <label className="relative w-12 h-12 rounded-full bg-brand-teal flex items-center justify-center overflow-hidden cursor-pointer shadow-sm group shrink-0">
          {uploadingAvatar ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-bold text-lg">{displayName.charAt(0).toUpperCase()}</span>
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={16} className="text-white" />
          </div>
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleAvatarUpload}
            disabled={uploadingAvatar}
          />
        </label>

        {/* Informações */}
        <div className="flex-1 overflow-hidden">
          {isEditingName ? (
            <div className="flex items-center gap-2 mb-1">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full bg-gray-100 dark:bg-zinc-800 border-none rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-teal"
                autoFocus
              />
              <button onClick={saveName} className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
                <Check size={14} />
              </button>
              <button onClick={() => setIsEditingName(false)} className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800 dark:text-white truncate">
                {displayName}
              </h2>
              {!isGoogleLogin && (
                <button onClick={() => setIsEditingName(true)} className="p-1 text-gray-400 hover:text-brand-teal transition-colors">
                  <Edit2 size={12} />
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
        </div>
      </div>

      {/* Seções */}
      {sections.map(section => (
        <div key={section.title} className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
            {section.title}
          </p>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm overflow-hidden">
            {section.items.map((item, i) => {
              const Icon = item.icon
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors ${
                    i !== section.items.length - 1 ? 'border-b border-gray-100 dark:border-zinc-800' : ''
                  }`}
                >
                  <div className="w-8 h-8 bg-brand-light dark:bg-brand-teal/20 rounded-lg flex items-center justify-center">
                    <Icon size={16} className="text-brand-teal" />
                  </div>
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 text-left">{item.label}</span>
                  <ChevronRight size={16} className="text-gray-400" />
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm"
      >
        <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
          <LogOut size={16} className="text-red-500" />
        </div>
        <span className="text-sm text-red-500 font-medium">Sair</span>
      </button>

    </div>
  )
}
