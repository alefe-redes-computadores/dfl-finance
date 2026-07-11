'use client'

import { useAuthDeepLink } from '@/lib/hooks/useAuthDeepLink'

export function DeepLinkListener() {
  useAuthDeepLink()
  return null // Ele não renderiza nada na tela, fica apenas escutando em segundo plano
}
