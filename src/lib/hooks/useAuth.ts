import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verifica se estamos voltando de um login do Google (a URL terá esses códigos)
    const isOAuthCallback = window.location.href.includes('access_token') || window.location.href.includes('code=');

    // 1. Pega a sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      
      // Se não for um retorno do Google, ou se já achou o usuário, tira o loading
      if (!isOAuthCallback || session?.user) {
        setLoading(false)
      }
    })

    // 2. Escuta mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null)
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
