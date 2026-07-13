'use client'

import { useEffect } from 'react'

export function ErudaProvider() {
  useEffect(() => {
    // Garante que só vai rodar no navegador (celular/PC)
    if (typeof window !== 'undefined') {
      
      // 1. Lógica para LIGAR o Eruda via URL (?debug=1)
      if (window.location.search.includes('debug=1')) {
        localStorage.setItem('enable_eruda', 'true')
      }
      
      // 2. Lógica para DESLIGAR o Eruda via URL (?debug=0)
      if (window.location.search.includes('debug=0')) {
        localStorage.removeItem('enable_eruda')
      }

      // 3. Só injeta e pesa o aplicativo SE estiver ativado
      if (localStorage.getItem('enable_eruda') === 'true') {
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
    }
  }, [])

  return null // Continua invisível no React
}
