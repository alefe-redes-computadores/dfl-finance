'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      // 1. Verificação Agressiva Offline
      if (typeof window !== 'undefined' && !window.navigator.onLine) {
        try {
          // Procura a chave do Supabase salva no celular
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
                }
                // Aborta a requisição para o servidor e confia no cache
                return 
              }
            }
          }
        } catch (err) {
          console.error('Erro ao ler autenticação offline:', err)
        }
      }

      // 2. Fluxo Normal (Online)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (mounted) {
          setUser(session?.user ?? null)
          setLoading(false)
        }
      })
    }

    initializeAuth()

    // 3. Listener protegido contra falso-negativo de rede
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        // Se a internet cair e o Supabase disparar um evento vazio por erro de rede, ignoramos.
        // Isso evita deslogar o usuário indevidamente.
        if (typeof window !== 'undefined' && !window.navigator.onLine && !session) {
          return
        }
        
        setUser(session?.user ?? null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
