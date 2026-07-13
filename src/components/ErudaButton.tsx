'use client'

import { useState, useEffect } from 'react'
import { Bug } from 'lucide-react'

export default function ErudaButton() {
  const [loaded, setLoaded] = useState(false)
  const [isDev, setIsDev] = useState(false)

  useEffect(() => {
    // 1. Liga o Modo Desenvolvedor via URL
    if (window.location.search.includes('debug=1')) {
      localStorage.setItem('dfl_debug', 'true')
    }
    
    // 2. Desliga o Modo Desenvolvedor via URL
    if (window.location.search.includes('debug=0')) {
      localStorage.removeItem('dfl_debug')
    }
    
    // 3. Verifica se o celular tem permissão salva
    if (localStorage.getItem('dfl_debug') === 'true') {
      setIsDev(true)
    }
  }, [])

  const handleLoad = () => {
    if (loaded) return
    
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/eruda'
    script.onload = () => {
      if (typeof window !== 'undefined' && (window as any).eruda) {
        (window as any).eruda.init()
        setLoaded(true) // Quando carrega, o botão vermelho some
      }
    }
    document.head.appendChild(script)
  }

  // Se não estiver no modo dev, ou se o Eruda já foi carregado, fica completamente invisível
  if (!isDev || loaded) return null 

  return (
    <button
      onClick={handleLoad}
      className="fixed bottom-24 right-4 z-[9999] w-12 h-12 bg-red-500/80 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400 active:scale-95 transition-all"
      title="Ativar Console de Debug"
    >
      <Bug size={24} />
    </button>
  )
}