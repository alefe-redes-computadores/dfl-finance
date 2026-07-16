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
  // Começamos sempre assumindo light (o script no layout.tsx segura a aparência)
  const [theme, setTheme] = useState<Theme>('light')
  const [userId, setUserId] = useState<string | null>(null)

  // Identifica o usuário logado
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.id) {
        setUserId(data.session.user.id)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Inicializa o tema baseado no navegador ou banco de dados
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setTheme(isDark ? 'dark' : 'light')

    if (!userId) return

    supabase
      .from('user_settings')
      .select('theme')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data?.theme) {
          const dbTheme = data.theme as Theme
          setTheme(dbTheme)
          localStorage.setItem('theme', dbTheme)
          if (dbTheme === 'dark') {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
        }
      })
  }, [userId])

  // Função cirúrgica para trocar o tema sem stales
  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const newTheme = currentTheme === 'light' ? 'dark' : 'light'
      
      // 1. Aplica na tela instantaneamente
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      
      // 2. Salva no celular
      localStorage.setItem('theme', newTheme)

      // 3. Salva na nuvem (em background para não travar o botão)
      if (userId) {
        supabase.from('user_settings').upsert({
          user_id: userId,
          theme: newTheme,
          updated_at: new Date().toISOString()
        }).then()
      }

      return newTheme
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
