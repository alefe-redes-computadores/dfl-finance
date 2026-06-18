'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  Wallet, Tag, LogOut, Moon, Sun, ChevronRight
} from 'lucide-react'
import { useState, useEffect } from 'react'

export default function MorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') {
      document.documentElement.classList.add('dark')
      setDark(true)
    }
  }, [])

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

      {/* User */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-teal rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-sm">
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-white">
            {user?.displayName ?? 'Usuário'}
          </p>
          <p className="text-xs text-gray-400">{user?.email}</p>
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
