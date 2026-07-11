'use client'

import { useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export function useAuthDeepLink() {
  const router = useRouter()
  // Novo estado para controlar a tela de carregamento
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listener = App.addListener('appUrlOpen', async ({ url }) => {
      // Ativa a tela de feedback visual
      setIsProcessing(true) 
      await Browser.close().catch(() => {})

      try {
        const hashPart = url.split('#')[1]
        if (!hashPart) {
          setIsProcessing(false)
          return
        }

        const params = new URLSearchParams(hashPart)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          
          if (!error) {
            // Um pequeno delay de 1.5s só para a animação ficar fluida 
            // e dar tempo de ler a mensagem bonita antes de pular pra home
            setTimeout(() => {
              router.replace('/home')
              setIsProcessing(false)
            }, 1500)
          } else {
            console.error(error.message)
            setIsProcessing(false)
          }
        }
      } catch (err) {
        console.error(err)
        setIsProcessing(false)
      }
    })

    return () => {
      listener.remove()
    }
  }, [router])

  return { isProcessing }
}
