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
  const [theme, setTheme] = useState<Theme>('light')
  const [userId, setUserId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Obtém o usuário logado
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.id) {
        setUserId(data.session.user.id)
      } else {
        setLoaded(true)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Busca o tema do banco (se logado) ou do localStorage
  useEffect(() => {
    if (!userId) {
      const saved = localStorage.getItem('theme') as Theme | null
      if (saved) {
        setTheme(saved)
        document.documentElement.classList.toggle('dark', saved === 'dark')
      }
      return
    }

    supabase
      .from('user_settings')
      .select('theme')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data?.theme) {
          setTheme(data.theme as Theme)
          document.documentElement.classList.toggle('dark', data.theme === 'dark')
        } else {
          // Fallback localStorage
          const saved = localStorage.getItem('theme') as Theme | null
          if (saved) {
            setTheme(saved)
            document.documentElement.classList.toggle('dark', saved === 'dark')
          }
        }
        setLoaded(true)
      })
  }, [userId])

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')

    if (userId) {
      // Salva no banco
      await supabase.from('user_settings').upsert({
        user_id: userId,
        theme: newTheme,
        updated_at: new Date().toISOString()
      })
    }
  }

  if (!loaded) return null

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}