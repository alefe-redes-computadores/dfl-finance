'use client'

import { useState } from 'react'
import { Terminal, Power } from 'lucide-react'

export function ErudaToggler() {
  const [isActive, setIsActive] = useState(false)

  const toggleEruda = async () => {
    if (isActive) {
      window.location.reload() // Forma mais simples de "desligar" o Eruda no navegador
      return
    }

    // Carrega o script dinamicamente apenas sob demanda
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/eruda'
    script.onload = () => {
      (window as any).eruda.init()
      setIsActive(true)
    }
    document.head.appendChild(script)
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
          <Terminal size={20} />
        </div>
        <div>
          <h3 className="font-bold dark:text-white">Console Mobile (Eruda)</h3>
          <p className="text-xs text-gray-500">Injeta o console no navegador</p>
        </div>
      </div>
      <button 
        onClick={toggleEruda}
        className={`p-3 rounded-full transition-all ${isActive ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}
      >
        <Power size={20} />
      </button>
    </div>
  )
}
