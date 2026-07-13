'use client'

import { useEffect, useState } from 'react'
import { X, Share2, PlusSquare } from 'lucide-react'

export default function InstallBanner() {
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return

    try {
      const ua = window.navigator.userAgent.toLowerCase()
      const isIOS = /iphone|ipad|ipod/.test(ua)
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true

      if (!isIOS || isStandalone) return

      const dismissed = window.localStorage.getItem('dfl_install_banner_dismissed')
      if (dismissed) return

      const timer = window.setTimeout(() => setShow(true), 3000)
      return () => window.clearTimeout(timer)
    } catch {
      return
    }
  }, [mounted])

  const handleDismiss = () => {
    setShow(false)

    try {
      window.localStorage.setItem('dfl_install_banner_dismissed', 'true')
    } catch {}
  }

  if (!mounted || !show) return null

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
              Toque em <Share2 size={12} className="inline" /> <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}