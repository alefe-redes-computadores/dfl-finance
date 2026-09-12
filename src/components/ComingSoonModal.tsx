'use client'

import { Clock3 } from 'lucide-react'

interface ComingSoonModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
}

export default function ComingSoonModal({ isOpen, onClose, title = "Funcionalidade em breve" }: ComingSoonModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm dark:bg-black/70" onClick={onClose}>
      <div className="app-modal-panel max-w-sm p-8 text-center" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400">
          <Clock3 size={28} />
        </div>
        <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="mb-8 text-sm leading-6 text-gray-500 dark:text-gray-400">
          Ops! Esta funcionalidade estará disponível em breve no nosso aplicativo. Estamos trabalhando para deixar tudo pronto para você.
        </p>
        <button 
          onClick={onClose} 
          className="app-primary-action w-full"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
