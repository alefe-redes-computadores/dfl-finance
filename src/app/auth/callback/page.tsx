'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // O Supabase intercepta a URL com os tokens automaticamente aqui
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || session) {
        // Sucesso! Capturou a volta do Google e joga para a Home
        router.replace('/home')
      }
    })

    // Fallback de segurança: se demorar mais de 3 segundos, checa manualmente
    const timer = setTimeout(() => {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) router.replace('/home')
        else router.replace('/login')
      })
    }, 3000)

    return () => {
      authListener.subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-10 h-10 border-4 border-brand-teal border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-500 dark:text-gray-400 font-medium">Finalizando o login...</p>
    </div>
  )
}

