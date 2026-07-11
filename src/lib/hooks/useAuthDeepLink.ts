'use client'

import { useEffect } from 'react'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export function useAuthDeepLink() {
  const router = useRouter()

  useEffect(() => {
    // Se não estiver rodando no Android/iOS nativo, não faz nada
    if (!Capacitor.isNativePlatform()) return

    // Fica escutando a chamada do "dfl://callback"
    const listener = App.addListener('appUrlOpen', async ({ url }) => {
      // Fecha o navegador externo que o Google abriu
      await Browser.close().catch(() => {})

      try {
        // O Supabase devolve os dados depois da hashtag (#)
        const hashPart = url.split('#')[1]
        if (!hashPart) return

        const params = new URLSearchParams(hashPart)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')

        if (access_token && refresh_token) {
          // Salva a sessão no Supabase
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          
          if (!error) {
            // Força o aplicativo a ir para a Home!
            router.replace('/home')
          } else {
            console.error('Erro ao setar sessão:', error.message)
          }
        }
      } catch (err) {
        console.error('Erro ao processar deep link de auth:', err)
      }
    })

    return () => {
      listener.remove()
    }
  }, [router])
}
