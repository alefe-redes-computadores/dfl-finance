'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      setLoading(true) 

      // 1. Tenta recuperar do Cache Offline primeiro
      if (typeof window !== 'undefined') {
        try {
          const storageKey = Object.keys(window.localStorage).find(key => 
            key.startsWith('sb-') && key.endsWith('-auth-token')
          )

          if (storageKey) {
            const sessionStr = window.localStorage.getItem(storageKey)
            if (sessionStr) {
              const sessionData = JSON.parse(sessionStr)
              if (sessionData?.user) {
                if (mounted) {
                  setUser(sessionData.user)
                  setLoading(false) 
                  return // Cache encontrado, encerra a verificação aqui
                }
              }
            }
          }
        } catch (err) {
          console.error('Erro ao ler autenticação offline:', err)
        }
      }

      // 2. Fluxo Normal (Online/Refresh de sessão)
      try {
        const { data } = await supabase.auth.getSession()
        if (mounted) {
          setUser(data.session?.user ?? null)
        }
      } catch (e) {
        console.error('Erro na verificação online:', e)
        if (mounted) setUser(null)
      } finally {
        // Garantia: O loading sempre para, não importa o resultado
        if (mounted) setLoading(false)
      }
    }

    initializeAuth()

    return () => { mounted = false }
  }, [])

  return { user, loading }
}
