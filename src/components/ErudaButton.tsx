'use client'

import { useEffect, useState } from 'react'
import { Bug } from 'lucide-react'
import { useIsAdmin } from '@/hooks/useAdmin'

export default function ErudaButton() {
  const { isAdmin, loading } = useIsAdmin()
  const [loaded, setLoaded] = useState(false)
  const [erudaInitialized, setErudaInitialized] = useState(false)

  // 🔥 Se ainda está carregando ou não é admin, não renderiza nada
  if (loading || !isAdmin) return null

  const handleLoad = () => {
    if (erudaInitialized) return

    // Carrega o script do Eruda dinamicamente
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/eruda'
    script.onload = () => {
      if (typeof window !== 'undefined' && (window as any).eruda) {
        ;(window as any).eruda.init()
        setErudaInitialized(true)
        setLoaded(true)
      }
    }
    script.onerror = () => {
      console.error('❌ Erro ao carregar Eruda')
    }
    document.head.appendChild(script)
  }

  // 🔥 Se já carregou, o botão some
  if (loaded) return null

  return (
    <button
      onClick={handleLoad}
      className="fixed bottom-24 right-4 z-[9999] w-12 h-12 bg-red-500/80 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400 active:scale-[0.95] transition-all hover:bg-red-600"
      title="Ativar Console de Debug"
    >
      <Bug size={24} />
    </button>
  )
}