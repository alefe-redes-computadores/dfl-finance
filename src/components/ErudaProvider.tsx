'use client'

import { useEffect } from 'react'

export function ErudaProvider() {
  useEffect(() => {
    // Garante que só vai rodar no navegador (cliente)
    if (typeof window !== 'undefined') {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/eruda'
      script.onload = () => {
        if ((window as any).eruda) {
          (window as any).eruda.init()
          console.log("[Eruda] Console mobile ativado com sucesso!")
        }
      }
      document.head.appendChild(script)
    }
  }, [])

  return null // Não renderiza nada na tela, é totalmente invisível
}
