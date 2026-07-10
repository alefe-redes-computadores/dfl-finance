'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 1. Inicialize sempre com um valor padrão (evita o erro de hidratação)
  const [theme, setTheme] = useState<Theme>('light')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    // 2. Aplica o tema imediatamente ao montar
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved) {
      setTheme(saved)
      document.documentElement.classList.toggle('dark', saved === 'dark')
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark')
      document.documentElement.classList.add('dark')
    }

    // Carrega o usuário
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.id) setUserId(data.session.user.id)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Efeito separado para sincronizar tema do banco se o usuário logar
  useEffect(() => {
    if (!userId) return

    supabase
      .from('user_settings')
      .select('theme')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data?.theme) {
          const t = data.theme as Theme
          setTheme(t)
          document.documentElement.classList.toggle('dark', t === 'dark')
          localStorage.setItem('theme', t)
        }
      })
  }, [userId])

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')

    if (userId) {
      await supabase.from('user_settings').upsert({
        user_id: userId,
        theme: newTheme,
        updated_at: new Date().toISOString()
      })
    }
  }

  // REMOVEMOS O "if (!loaded) return null" AQUI
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
