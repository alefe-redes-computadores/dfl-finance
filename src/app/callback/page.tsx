'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let isRedirecting = false
    let unsub: (() => void) | undefined

    const redirecionar = () => {
      if (isRedirecting) return
      isRedirecting = true
      setTimeout(() => router.replace('/home'), 1200)
    }

    const handleAuth = async () => {
      // 1) Já existe sessão? (Web, onde o Supabase já processou a URL sozinho)
      const { data: existing } = await supabase.auth.getSession()
      if (existing?.session) {
        redirecionar()
        return
      }

      // 2) Cold start no Android: o app abriu direto aqui com ?code= na URL
      //    antes do useAuthDeepLink conseguir processar o evento appUrlOpen
      const code = searchParams.get('code')
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error('Erro no exchangeCodeForSession (callback page):', error.message)
          setErrorMsg(error.message)
          return
        }
        if (data?.session) {
          redirecionar()
          return
        }
      }

      // 3) Senão, espera o evento (caso o useAuthDeepLink esteja processando em paralelo)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) redirecionar()
      })
      unsub = () => subscription.unsubscribe()
    }

    handleAuth()

    return () => unsub?.()
  }, [router, searchParams])

  if (errorMsg) {
    return (
      <div>
        <p>Falha ao conectar.</p>
        <p>{errorMsg}</p>
      </div>
    )
  }

  return (
    <div>Conectando...</div>
  )
}
