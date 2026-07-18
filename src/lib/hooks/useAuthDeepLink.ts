'use client'

import { useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { useRouter } from 'next/navigation'

export function useAuthDeepLink() {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listener = App.addListener('appUrlOpen', async ({ url }) => {
      // Verifica se a URL recebida é a nossa de callback
      if (url.includes('callback')) {
        setIsProcessing(true)
        await Browser.close().catch(() => {})

        try {
          // Extrai a URL completa e junta a parte do ?code e do #
          const urlObj = new URL(url)
          const params = urlObj.search + urlObj.hash

          if (params) {
            // Força o Next.js a navegar para a página de callback com os dados
            router.push(`/auth/callback${params}`)
          } else {
            setIsProcessing(false)
          }
        } catch (err) {
          console.error(err)
          setIsProcessing(false)
        }
      }
    })

    return () => {
      listener.remove().catch(() => {})
    }
  }, [router])

  return { isProcessing }
}
