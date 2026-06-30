'use client'

import { useState, useEffect } from 'react'
import { X, Share2, PlusSquare } from 'lucide-react'

export default function InstallBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Verifica se é iOS e se já está em modo standalone (já instalado)
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    
    // Não mostra se já está instalado ou não é iOS
    if (!isIOS || isStandalone) return

    // Verifica se o banner já foi fechado antes
    const dismissed = localStorage.getItem('dfl_install_banner_dismissed')
    if (dismissed) return

    // Mostra o banner após 3 segundos
    const timer = setTimeout(() => setShow(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem('dfl_install_banner_dismissed', 'true')
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-xl border border-gray-100 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
            <PlusSquare size={20} className="text-teal-600 dark:text-teal-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-800 dark:text-gray-200">
              Instale o DFL Finance
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Toque em <Share2 size={12} className="inline" /> <strong>Compartilhar</strong> e depois em <strong>"Adicionar à Tela de Início"</strong>
            </p>
          </div>
          <button onClick={handleDismiss} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}