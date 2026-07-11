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
    if (!Capacitor.isNativePlatform()) return

    const listener = App.addListener('appUrlOpen', async ({ url }) => {
      // DEBUG: Se aparecer esse alerta na tela, o Deep Link está funcionando!
      alert('Deep Link recebido: ' + url) 

      await Browser.close().catch(() => {})

      try {
        const hashPart = url.split('#')[1]
        if (!hashPart) return

        const params = new URLSearchParams(hashPart)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          
          if (!error) {
            router.replace('/home')
          } else {
            alert('Erro no Supabase: ' + error.message)
          }
        }
      } catch (err) {
        alert('Erro no processamento: ' + err)
      }
    })

    return () => {
      listener.remove()
    }
  }, [router])
}
