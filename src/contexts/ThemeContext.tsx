// src/contexts/ThemeContext.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getCachedUserSettings,
  loadUserSettings,
  saveUserSettings,
  subscribeToUserSettings,
  type ThemePreference,
} from '@/lib/userSettings'

type Theme = ThemePreference

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
})

const THEME_COLORS: Record<Theme, string> = {
  light: '#f8f9fa',
  dark: '#0f172a',
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return

  const isDark = theme === 'dark'
  const themeColor = THEME_COLORS[theme]
  const root = document.documentElement

  root.classList.toggle('dark', isDark)
  root.style.colorScheme = theme
  root.style.backgroundColor = themeColor

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }

  meta.content = themeColor
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const initialTheme: Theme =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light'

    setTheme(initialTheme)
    applyTheme(initialTheme)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUserId(data?.session?.user?.id || null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user?.id || null)
      }
    )

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    const cached = getCachedUserSettings(userId)
    setTheme(cached.theme)
    applyTheme(cached.theme)

    let active = true

    loadUserSettings(userId).then((result) => {
      if (!active) return
      setTheme(result.settings.theme)
      applyTheme(result.settings.theme)
    })

    const unsubscribe = subscribeToUserSettings((settings) => {
      if (settings.user_id !== userId) return
      setTheme(settings.theme)
      applyTheme(settings.theme)
    })

    const handleOnline = () => {
      loadUserSettings(userId).then((result) => {
        if (!active) return
        setTheme(result.settings.theme)
        applyTheme(result.settings.theme)
      })
    }

    window.addEventListener('online', handleOnline)

    return () => {
      active = false
      unsubscribe()
      window.removeEventListener('online', handleOnline)
    }
  }, [userId])

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const nextTheme: Theme =
        currentTheme === 'light' ? 'dark' : 'light'

      applyTheme(nextTheme)

      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', nextTheme)
      }

      if (userId) {
        void saveUserSettings(userId, { theme: nextTheme })
      }

      return nextTheme
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
