'use client'

import { useState } from 'react'
import { Bug } from 'lucide-react'

export default function ErudaButton() {
  const [loaded, setLoaded] = useState(false)

  const handleLoad = () => {
    if (loaded) return
    
    // Injeta o Eruda SOMENTE quando você clica no botão
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/eruda'
    script.onload = () => {
      if (typeof window !== 'undefined' && (window as any).eruda) {
        (window as any).eruda.init()
        setLoaded(true)
      }
    }
    document.head.appendChild(script)
  }

  // Se já carregou o Eruda, o botão do inseto some
  if (loaded) return null 

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
