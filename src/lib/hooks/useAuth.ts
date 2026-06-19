import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verifica se estamos voltando de um login do Google
    const isOAuthCallback = window.location.href.includes('access_token') || window.location.href.includes('code=');

    // 1. Pega a sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      
      // Se não for retorno do Google, ou se já tiver usuário, encerra o loading
      if (!isOAuthCallback || session?.user) {
        setLoading(false)
      }
    })

    // 2. Escuta qualquer mudança de estado (Removido o bloqueio que causava loading infinito)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
